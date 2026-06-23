/**
 * Queue Manager: Handles offline sync queue and retry logic for failed GitHub operations
 */

export class QueueManager {
  constructor() {
    this.QUEUE_KEY = 'offline_sync_queue';
    this.MAX_RETRIES = 5;
    this.RETRY_DELAY_MS = 5000; // 5 seconds
    this.TRANSIENT_ERROR_CODES = [500, 502, 503, 429]; // Server errors and rate limiting
  }

  /**
   * Add a failed sync task to the offline queue
   */
  async enqueueFailedTask(submissionData, error, owner, repo) {
    try {
      const queue = await this.getQueue();

      const task = {
        retry_id: this.generateRetryId(),
        submission_data: submissionData,
        owner: owner,
        repo: repo,
        error_message: error.message || String(error),
        error_status: error.status || null,
        retry_count: 0,
        failed_at_timestamp: new Date().toISOString(),
        next_retry_at: this.calculateNextRetryTime(0)
      };

      queue.push(task);
      await this.saveQueue(queue);

      console.log('[QueueManager] Task enqueued:', task.retry_id);
      return task;
    } catch (error) {
      console.error('[QueueManager] Failed to enqueue task:', error);
      throw error;
    }
  }

  /**
   * Process the offline queue and retry failed tasks
   */
  async processQueue(cryptoService, githubAPI) {
    try {
      const queue = await this.getQueue();

      if (queue.length === 0) {
        console.log('[QueueManager] Queue is empty');
        return { processed: 0, succeeded: 0, failed: 0 };
      }

      let processed = 0;
      let succeeded = 0;
      let failed = 0;

      const now = new Date();
      const tasksToProcess = queue.filter(task => 
        new Date(task.next_retry_at) <= now
      );

      for (const task of tasksToProcess) {
        try {
          console.log('[QueueManager] Processing queued task:', task.retry_id);

          const result = await this.retrySync(task, cryptoService, githubAPI);

          if (result.success) {
            succeeded++;
            // Remove successful task from queue
            queue.splice(queue.indexOf(task), 1);
          } else {
            failed++;
            // Update retry count and next retry time
            task.retry_count++;
            task.next_retry_at = this.calculateNextRetryTime(task.retry_count);
            task.error_message = result.error;

            // Remove task if max retries exceeded
            if (task.retry_count >= this.MAX_RETRIES) {
              console.warn('[QueueManager] Task exceeded max retries:', task.retry_id);
              queue.splice(queue.indexOf(task), 1);
            }
          }

          processed++;
        } catch (error) {
          console.error('[QueueManager] Error processing task:', error);
          failed++;
        }
      }

      await this.saveQueue(queue);

      console.log(`[QueueManager] Queue processing complete: ${processed} processed, ${succeeded} succeeded, ${failed} failed`);
      return { processed, succeeded, failed };
    } catch (error) {
      console.error('[QueueManager] Queue processing failed:', error);
      throw error;
    }
  }

  /**
   * Retry a failed sync operation
   */
  async retrySync(task, cryptoService, githubAPI) {
    try {
      const { submission_data, owner, repo } = task;

      // Decrypt the GitHub token
      const encryptedData = await cryptoService.getEncryptedToken();
      if (!encryptedData) {
        return { success: false, error: 'No encrypted token available' };
      }

      // Get the Master PIN from storage (this is a limitation - in production, you'd need to re-prompt)
      // For now, we'll assume the token is in session storage
      const sessionToken = await cryptoService.getSessionToken();
      if (!sessionToken) {
        return { success: false, error: 'Session token expired' };
      }

      // Perform the sync operation
      const syncResult = await this.performSync(submission_data, owner, repo, sessionToken, githubAPI);

      if (syncResult.success) {
        console.log('[QueueManager] Task retry succeeded:', task.retry_id);
        return { success: true };
      } else {
        console.warn('[QueueManager] Task retry failed:', task.retry_id, syncResult.error);
        return { success: false, error: syncResult.error };
      }
    } catch (error) {
      console.error('[QueueManager] Retry sync failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Perform the actual sync operation (write to GitHub)
   */
  async performSync(submissionData, owner, repo, token, githubAPI) {
    try {
      const { problem, submission } = submissionData;

      // Generate the file path
      const problemId = String(problem.id).padStart(4, '0');
      const slug = problem.slug || 'unknown';
      const dirPath = `${problemId}_${slug}`;
      const fileName = `solution.${submission.language_extension}`;
      const filePath = `${dirPath}/${fileName}`;

      // Check if file already exists
      const existingFile = await githubAPI.getFileContent(owner, repo, filePath);

      let sha = null;
      if (existingFile.success) {
        sha = existingFile.file.sha;

        // Check for duplicate content using SHA-1
        const newContentHash = await githubAPI.computeSHA1(submission.code);
        const existingContent = githubAPI.base64ToString(existingFile.file.content);
        const existingContentHash = await githubAPI.computeSHA1(existingContent);

        if (newContentHash === existingContentHash) {
          console.log('[QueueManager] Duplicate content detected, skipping write');
          return { success: true, message: 'Duplicate content' };
        }
      }

      // Create or update the solution file
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
        return { success: false, error: fileResult.error.message };
      }

      // Create or update the README
      const readmePath = `${dirPath}/README.md`;
      const readmeContent = this.generateReadme(submissionData);
      const readmeResult = await githubAPI.createOrUpdateFile(
        owner,
        repo,
        readmePath,
        readmeContent,
        `Add README for ${problem.title} (${problem.id})`
      );

      if (!readmeResult.success) {
        console.warn('[QueueManager] README creation failed:', readmeResult.error);
        // Don't fail the entire operation if README fails
      }

      return { success: true };
    } catch (error) {
      console.error('[QueueManager] Sync operation failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get the offline queue from storage
   */
  async getQueue() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(this.QUEUE_KEY, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result[this.QUEUE_KEY] || []);
        }
      });
    });
  }

  /**
   * Save the offline queue to storage
   */
  async saveQueue(queue) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [this.QUEUE_KEY]: queue }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Calculate the next retry time based on exponential backoff
   */
  calculateNextRetryTime(retryCount) {
    const backoffMs = this.RETRY_DELAY_MS * Math.pow(2, retryCount);
    const nextRetry = new Date(Date.now() + backoffMs);
    return nextRetry.toISOString();
  }

  /**
   * Generate a unique retry ID
   */
  generateRetryId() {
    return `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if an error is transient (should be retried)
   */
  isTransientError(error) {
    if (!error) return false;
    return this.TRANSIENT_ERROR_CODES.includes(error.status);
  }

  /**
   * Clear the entire queue
   */
  async clearQueue() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(this.QUEUE_KEY, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    try {
      const queue = await this.getQueue();
      return {
        total_tasks: queue.length,
        pending_tasks: queue.filter(t => new Date(t.next_retry_at) > new Date()).length,
        ready_for_retry: queue.filter(t => new Date(t.next_retry_at) <= new Date()).length
      };
    } catch (error) {
      console.error('[QueueManager] Failed to get queue stats:', error);
      return { total_tasks: 0, pending_tasks: 0, ready_for_retry: 0 };
    }
  }

  /**
   * Generate a README for a submission (simplified version)
   */
  generateReadme(submissionData) {
    const { problem, submission } = submissionData;
    let readme = `# ${problem.id}. ${problem.title}\n\n`;

    readme += `## Properties\n\n`;
    if (problem.difficulty) readme += `- **Difficulty:** ${problem.difficulty}\n`;
    if (submission.language) readme += `- **Language:** ${submission.language}\n`;
    if (submission.runtime_ms) readme += `- **Runtime:** ${submission.runtime_ms}ms\n`;
    if (submission.memory_mb) readme += `- **Memory:** ${submission.memory_mb}MB\n`;

    readme += `\n## Solution\n\n`;
    readme += `\`\`\`${submission.language_extension}\n${submission.code}\n\`\`\`\n`;

    return readme;
  }
}