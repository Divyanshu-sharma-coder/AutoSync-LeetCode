/**
 * Service Worker: Main orchestration layer for the LeetCode-to-GitHub sync engine
 * Handles message routing, sync logic, and background operations
 */

import { CryptoService } from './crypto-service.js';
import { GitHubAPIClient } from './github-api.js';
import { QueueManager } from './queue-manager.js';
import { MarkdownEngine } from '../content/markdown-engine.js';

// Initialize services after files are securely imported
const cryptoService = new CryptoService();
const queueManager = new QueueManager();

let githubAPI = null;

// HARDCODED TESTING FALLBACKS
const BACKUP_USER = "Divyanshu-sharma-coder";
const BACKUP_REPO = "Leetcode";

// Message handler for content script submissions
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.source === 'LEETCODE_CONTENT_SCRIPT' && request.action === 'PROCESS_SUBMISSION') {
    handleSubmission(request.payload)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep the channel open for async response
  }

  if (request.action === 'INJECT_INTERCEPTOR_MAIN_WORLD') {
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      files: ['src/content/interceptor.js'],
      world: 'MAIN' // This runs it directly in LeetCode's JavaScript context natively!
    })
    .then(() => sendResponse({ success: true }))
    .catch(err => {
      console.error('[ServiceWorker] Main world execution blocked:', err);
      sendResponse({ success: false, error: err.message });
    });
    return true; // Keep channel open for the async .then() resolution!
  }

  if (request.action === 'VALIDATE_TOKEN') {
    validateGitHubToken(request.token)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'SEARCH_REPOSITORIES') {
    searchRepositories(request.token, request.query)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'STORE_CREDENTIALS') {
    storeCredentials(request.masterPin, request.token)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'SAVE_REPOSITORY') {
    // Pass the dynamic properties directly from the popup message payload
    setTargetRepository(request.owner, request.repo)
      .then(() => {
        // Respond to the popup so it knows saving finished securely
        sendResponse({ success: true, message: 'Repository configuration saved' });
      })
      .catch(error => {
        console.error('[ServiceWorker] Error saving repository:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for the async resolution!
  }

  if (request.action === 'GET_QUEUE_STATS') {
    queueManager.getQueueStats()
      .then(stats => sendResponse({ success: true, stats }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'PROCESS_QUEUE') {
    processOfflineQueue()
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // --- POPUP SYSTEM MESSAGES ---
  if (request.action === 'CLEAR_QUEUE') {
    chrome.storage.local.set({ offline_queue: [], sync_log: {} }, () => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true });
      }
    });
    return true;
  }

  if (request.action === 'LOGOUT') {
    Promise.all([
      cryptoService.storeSessionToken ? cryptoService.storeSessionToken('') : Promise.resolve(),
      new Promise((resolve) => chrome.storage.local.remove(['target_repository', 'sync_log'], resolve))
    ])
    .then(() => sendResponse({ success: true }))
    .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

/**
 * Handle a submission from the content script
 */
async function handleSubmission(submissionData) {
  try {
    console.log('[ServiceWorker] Normalizing submission payload...');

    // TRANSFORMATION LAYER: If incoming payload is from UI Scraper, normalize it to match expected schema
    if (submissionData.code && submissionData.title) {
      submissionData = {
        problem: {
          id: submissionData.id || Math.floor(Math.random() * 1000),
          title: submissionData.title,
          slug: submissionData.title.toLowerCase().replace(/ /g, '-')
        },
        submission: {
          id: Date.now(),
          language_extension: submissionData.language === 'c++' || submissionData.language === 'cpp' ? 'cpp' : 'js',
          code: submissionData.code
        },
        metadata: {
          timestamp: new Date().toISOString()
        }
      };
    }

    if (!submissionData.problem || !submissionData.submission || !submissionData.metadata) {
      throw new Error('Invalid submission data structure');
    }

    console.log('[ServiceWorker] Processing normalized submission:', submissionData.problem.title);

    const token = await cryptoService.getSessionToken();
    if (!token) {
      throw new Error('GitHub token not found. Please authenticate first.');
    }

    githubAPI = new GitHubAPIClient(token);

    const targetRepo = await getTargetRepository();
    const owner = targetRepo.owner;
    const repo = targetRepo.repo;

    console.log(`[ServiceWorker] Routing sync push operation directly to target repository: ${owner}/${repo}`);

    const repoExists = await githubAPI.repositoryExists(owner, repo);
    if (!repoExists) {
      throw new Error(`Repository ${owner}/${repo} does not exist`);
    }

    const syncResult = await performSync(submissionData, owner, repo);

    if (!syncResult.success) {
      if (queueManager.isTransientError(syncResult.error)) {
        await queueManager.enqueueFailedTask(submissionData, syncResult.error, owner, repo);
        return {
          success: false,
          message: 'Sync failed, task queued for retry',
          queued: true,
          error: syncResult.error.message
        };
      }
      throw syncResult.error;
    }

    return {
      success: true,
      message: 'Submission synced successfully',
      problem_id: submissionData.problem.id,
      problem_title: submissionData.problem.title
    };
  } catch (error) {
    console.error('[ServiceWorker] Submission handling failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Perform the sync operation to GitHub
 */
async function performSync(submissionData, owner, repo) {
  try {
    const { problem, submission } = submissionData;

    const deduplicationKey = `${problem.id}_${submission.id}`;
    const isDuplicate = await checkDuplication(deduplicationKey, owner, repo, submission.code);

    if (isDuplicate) {
      console.log('[ServiceWorker] Duplicate submission detected, skipping');
      return { success: true, message: 'Duplicate submission' };
    }

    const problemId = String(problem.id).padStart(4, '0');
    const slug = problem.slug || 'unknown';
    const dirPath = `${problemId}_${slug}`;
    const fileName = `solution.${submission.language_extension}`;
    const filePath = `${dirPath}/${fileName}`;

    const existingFile = await githubAPI.getFileContent(owner, repo, filePath);
    let sha = null;

    if (existingFile.success) {
      sha = existingFile.file.sha;
    } else if (!existingFile.notFound) {
      return { success: false, error: existingFile.error };
    }

    const commitMessage = `Add solution for ${problem.title} (${problem.id})`;
    const fileResult = await githubAPI.createOrUpdateFile(
      owner,
      repo,
      filePath,
      submission.code,
      commitMessage,
      sha
    );

    if (!fileResult.success) {
      return { success: false, error: fileResult.error };
    }

    const markdownEngine = new MarkdownEngine();
    const readmeContent = markdownEngine.generateReadme(submissionData);
    const readmePath = `${dirPath}/README.md`;

    const readmeResult = await githubAPI.createOrUpdateFile(
      owner,
      repo,
      readmePath,
      readmeContent,
      `Add README for ${problem.title} (${problem.id})`
    );

    if (!readmeResult.success) {
      console.warn('[ServiceWorker] README creation failed:', readmeResult.error);
    }

    await recordSuccessfulSync(deduplicationKey);

    console.log('[ServiceWorker] Sync completed successfully');
    return { success: true };
  } catch (error) {
    console.error('[ServiceWorker] Sync operation failed:', error);
    return { success: false, error: error };
  }
}

/**
 * Check if a submission is a duplicate
 */
async function checkDuplication(deduplicationKey, owner, repo, code) {
  try {
    const syncLog = await getSyncLog();
    if (syncLog[deduplicationKey]) {
      return true;
    }
    return false;
  } catch (error) {
    console.warn('[ServiceWorker] Deduplication check failed:', error);
    return false;
  }
}

/**
 * Record a successful sync
 */
async function recordSuccessfulSync(deduplicationKey) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get('sync_log', (result) => {
      const syncLog = result.sync_log || {};
      syncLog[deduplicationKey] = {
        timestamp: new Date().toISOString(),
        synced: true
      };
      chrome.storage.local.set({ sync_log: syncLog }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  });
}

/**
 * Get the sync log
 */
async function getSyncLog() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get('sync_log', (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result.sync_log || {});
      }
    });
  });
}

/**
 * Validate a GitHub token
 */
async function validateGitHubToken(token) {
  try {
    const client = new GitHubAPIClient(token);
    const result = await client.validateToken();

    if (result.valid) {
      return {
        success: true,
        valid: true,
        user: result.user.login
      };
    } else {
      return {
        success: false,
        valid: false,
        error: 'Invalid token'
      };
    }
  } catch (error) {
    return {
      success: false,
      valid: false,
      error: error.message
    };
  }
}

/**
 * Search repositories
 */
async function searchRepositories(token, query) {
  try {
    const client = new GitHubAPIClient(token);
    const result = await client.getUserRepositories();

    if (!result.success) {
      return {
        success: false,
        error: result.error.message
      };
    }

    const filtered = client.filterRepositoriesByName(result.repositories, query);

    return {
      success: true,
      repositories: filtered.map(repo => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        url: repo.html_url
      }))
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Store credentials (Master PIN and GitHub token)
 */
async function storeCredentials(masterPin, token) {
  try {
    const pinValidation = cryptoService.validateMasterPin(masterPin);
    if (!pinValidation.valid) {
      return {
        success: false,
        error: pinValidation.error
      };
    }

    const tokenValidation = await validateGitHubToken(token);
    if (!tokenValidation.valid) {
      return {
        success: false,
        error: 'Invalid GitHub token'
      };
    }

    const encryptedData = await cryptoService.encryptToken(token, masterPin);
    await cryptoService.storeEncryptedToken(encryptedData);
    await cryptoService.storeSessionToken(token);

    return {
      success: true,
      message: 'Credentials stored successfully'
    };
  } catch (error) {
    console.error('[ServiceWorker] Credential storage failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get the target repository configuration with absolute hardcoded fallback configuration
 */
async function getTargetRepository() {
  return new Promise((resolve) => {
    chrome.storage.local.get('target_repository', (result) => {
      if (result && result.target_repository && result.target_repository.owner && result.target_repository.repo) {
        resolve(result.target_repository);
      } else {
        // Fallback directly to verified credentials if storage layer reads empty
        resolve({ owner: BACKUP_USER, repo: BACKUP_REPO });
      }
    });
  });
}

/**
 * Set the target repository configuration
 */
async function setTargetRepository(owner, repo) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ target_repository: { owner, repo } }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Process the offline queue
 */
async function processOfflineQueue() {
  try {
    const token = await cryptoService.getSessionToken();
    if (!token) {
      return {
        success: false,
        error: 'GitHub token not available'
      };
    }

    githubAPI = new GitHubAPIClient(token);
    const result = await queueManager.processQueue(cryptoService, githubAPI);

    return {
      success: true,
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed
    };
  } catch (error) {
    console.error('[ServiceWorker] Queue processing failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Periodically process the offline queue
chrome.alarms.create('processQueue', { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'processQueue') {
    processOfflineQueue()
      .then(result => console.log('[ServiceWorker] Queue processing result:', result))
      .catch(error => console.error('[ServiceWorker] Queue processing error:', error));
  }
});

console.log('[ServiceWorker] Service worker initialized');