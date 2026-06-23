/**
 * Popup UI Script: Handles onboarding, authentication, and repository configuration
 */

class PopupUI {
  constructor() {
    this.DEBOUNCE_DELAY_MS = 300;
    this.currentToken = null;
    this.selectedRepository = null;
    this.debounceTimer = null;
    this.allRepositories = [];

    this.initializeElements();
    this.attachEventListeners();
    this.loadInitialState();
  }

  /**
   * Initialize DOM elements
   */
  initializeElements() {
    // Auth section
    this.authSection = document.getElementById('authSection');
    this.masterPinInput = document.getElementById('masterPin');
    this.githubTokenInput = document.getElementById('githubToken');
    this.authenticateBtn = document.getElementById('authenticateBtn');
    this.authError = document.getElementById('authError');

    // Repo section
    this.repoSection = document.getElementById('repoSection');
    this.repoSearch = document.getElementById('repoSearch');
    this.repoDropdown = document.getElementById('repoDropdown');
    this.repoList = document.getElementById('repoList');
    this.selectedRepoBox = document.getElementById('selectedRepoBox');
    this.selectedRepoName = document.getElementById('selectedRepoName');
    this.selectedRepoDescription = document.getElementById('selectedRepoDescription');
    this.saveRepoBtn = document.getElementById('saveRepoBtn');
    this.changeRepoBtn = document.getElementById('changeRepoBtn');
    this.repoError = document.getElementById('repoError');

    // Queue section
    this.queueSection = document.getElementById('queueSection');
    this.totalTasks = document.getElementById('totalTasks');
    this.pendingTasks = document.getElementById('pendingTasks');
    this.readyTasks = document.getElementById('readyTasks');
    this.processQueueBtn = document.getElementById('processQueueBtn');

    // Settings section
    this.settingsSection = document.getElementById('settingsSection');
    this.logoutBtn = document.getElementById('logoutBtn');
    this.clearQueueBtn = document.getElementById('clearQueueBtn');

    // Status section
    this.statusSection = document.getElementById('statusSection');
    this.statusUser = document.getElementById('statusUser');
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    this.authenticateBtn.addEventListener('click', () => this.handleAuthenticate());
    this.repoSearch.addEventListener('input', (e) => this.handleRepoSearch(e));
    this.changeRepoBtn.addEventListener('click', () => this.showRepoSearch());
    this.saveRepoBtn.addEventListener('click', () => this.handleSaveRepository());
    this.processQueueBtn.addEventListener('click', () => this.handleProcessQueue());
    this.logoutBtn.addEventListener('click', () => this.handleLogout());
    this.clearQueueBtn.addEventListener('click', () => this.handleClearQueue());

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-container')) {
        this.repoDropdown.classList.add('hidden');
      }
    });
  }

  /**
   * Load initial state
   */
  async loadInitialState() {
    try {
      // Check if already authenticated
      const token = await this.getSessionToken();
      if (token) {
        this.currentToken = token;
        this.showAuthenticatedState();
        
        // Dynamic Autofill Check: Read preserved target sync configurations from storage
        chrome.storage.local.get('target_repository', (result) => {
          if (result && result.target_repository) {
            const { owner, repo } = result.target_repository;
            console.log(`[PopupUI] Found existing configuration: ${owner}/${repo}`);
            
            // Build a matching placeholder object format to populate UI layout natively
            this.selectRepository({
              name: repo,
              full_name: `${owner}/${repo}`,
              description: 'Currently configured target repository'
            });
            
            // Hide the active modification confirmation save button on startup
            this.saveRepoBtn.classList.add('hidden');
          }
        });
      } else {
        this.showAuthenticationState();
      }

      // Load queue stats
      await this.updateQueueStats();
    } catch (error) {
      console.error('[PopupUI] Failed to load initial state:', error);
    }
  }

  /**
   * Handle authentication
   */
  async handleAuthenticate() {
    try {
      const masterPin = this.masterPinInput.value.trim();
      const token = this.githubTokenInput.value.trim();

      if (!masterPin || !token) {
        this.showAuthError('Please enter both Master PIN and GitHub token');
        return;
      }

      this.setButtonLoading(this.authenticateBtn, true);
      this.clearAuthError();

      // Send credentials to background service worker
      const response = await this.sendMessage({
        action: 'STORE_CREDENTIALS',
        masterPin: masterPin,
        token: token
      });

      if (!response.success) {
        this.showAuthError(response.error || 'Authentication failed');
        this.setButtonLoading(this.authenticateBtn, false);
        return;
      }

      this.currentToken = token;
      this.masterPinInput.value = '';
      this.githubTokenInput.value = '';

      this.showAuthenticatedState();
      this.setButtonLoading(this.authenticateBtn, false);
    } catch (error) {
      console.error('[PopupUI] Authentication error:', error);
      this.showAuthError(error.message);
      this.setButtonLoading(this.authenticateBtn, false);
    }
  }

  /**
   * Handle repository search with debouncing
   */
  handleRepoSearch(event) {
    clearTimeout(this.debounceTimer);

    const query = event.target.value.trim();

    if (!query) {
      this.repoDropdown.classList.add('hidden');
      return;
    }

    this.debounceTimer = setTimeout(() => {
      this.performRepoSearch(query);
    }, this.DEBOUNCE_DELAY_MS);
  }

  /**
   * Perform repository search
   */
  async performRepoSearch(query) {
    try {
      if (!this.currentToken) {
        return;
      }

      // If we haven't fetched all repos yet, do it now
      if (this.allRepositories.length === 0) {
        const response = await this.sendMessage({
          action: 'SEARCH_REPOSITORIES',
          token: this.currentToken,
          query: ''
        });

        if (!response.success) {
          console.error('[PopupUI] Failed to fetch repositories:', response.error);
          return;
        }

        this.allRepositories = response.repositories || [];
      }

      // Filter repositories based on query
      const filtered = this.allRepositories.filter(repo =>
        repo.name.toLowerCase().includes(query.toLowerCase()) ||
        (repo.description && repo.description.toLowerCase().includes(query.toLowerCase()))
      );

      this.displayRepoList(filtered);
      this.repoDropdown.classList.remove('hidden');
    } catch (error) {
      console.error('[PopupUI] Repository search error:', error);
    }
  }

  /**
   * Display repository list
   */
  displayRepoList(repositories) {
    this.repoList.innerHTML = '';

    if (repositories.length === 0) {
      const item = document.createElement('div');
      item.className = 'repo-item';
      item.innerHTML = '<p class="repo-item-name">No repositories found</p>';
      this.repoList.appendChild(item);
      return;
    }

    repositories.forEach(repo => {
      const item = document.createElement('div');
      item.className = 'repo-item';
      item.innerHTML = `
        <p class="repo-item-name">${this.escapeHtml(repo.name)}</p>
        ${repo.description ? `<p class="repo-item-desc">${this.escapeHtml(repo.description)}</p>` : ''}
      `;
      item.addEventListener('click', () => this.selectRepository(repo));
      this.repoList.appendChild(item);
    });
  }

  /**
   * Select a repository
   */
  selectRepository(repo) {
    this.selectedRepository = repo;
    this.selectedRepoName.textContent = repo.name;
    this.selectedRepoDescription.textContent = repo.description || 'No description';
    this.selectedRepoBox.classList.remove('hidden');
    this.saveRepoBtn.classList.remove('hidden');
    this.repoSearch.value = '';
    this.repoDropdown.classList.add('hidden');
  }

  /**
   * Show repository search
   */
  showRepoSearch() {
    this.selectedRepoBox.classList.add('hidden');
    this.saveRepoBtn.classList.add('hidden');
    this.repoSearch.value = '';
    this.repoSearch.focus();
  }

  /**
   * Handle save repository
   */
  async handleSaveRepository() {
    try {
      if (!this.selectedRepository || !this.selectedRepository.full_name) {
        this.showRepoError('No repository selected');
        return;
      }

      this.setButtonLoading(this.saveRepoBtn, true);

      // Split owner and repository names cleanly out of full_name string payload dynamically
      const parts = this.selectedRepository.full_name.split('/');
      const parsedOwner = parts[0].trim();
      const parsedRepo = this.selectedRepository.name.trim();

      // Save to background service worker with verified dynamic parameters
      const response = await this.sendMessage({
        action: 'SAVE_REPOSITORY',
        owner: parsedOwner,
        repo: parsedRepo
      });

      if (!response.success) {
        this.showRepoError(response.error || 'Failed to save repository');
        this.setButtonLoading(this.saveRepoBtn, false);
        return;
      }

      this.setButtonLoading(this.saveRepoBtn, false);
      this.showSuccessMessage('Repository saved successfully');
    } catch (error) {
      console.error('[PopupUI] Save repository error:', error);
      this.showRepoError(error.message);
      this.setButtonLoading(this.saveRepoBtn, false);
    }
  }

  /**
   * Handle process queue
   */
  async handleProcessQueue() {
    try {
      this.setButtonLoading(this.processQueueBtn, true);

      const response = await this.sendMessage({
        action: 'PROCESS_QUEUE'
      });

      this.setButtonLoading(this.processQueueBtn, false);

      if (response.success) {
        this.showSuccessMessage(`Processed ${response.processed} tasks`);
        await this.updateQueueStats();
      } else {
        console.error('[PopupUI] Queue processing error:', response.error);
      }
    } catch (error) {
      console.error('[PopupUI] Process queue error:', error);
      this.setButtonLoading(this.processQueueBtn, false);
    }
  }

  /**
   * Handle logout
   */
  async handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
      try {
        // Clear session token
        await this.sendMessage({
          action: 'LOGOUT'
        });

        this.currentToken = null;
        this.selectedRepository = null;
        this.allRepositories = [];
        this.showAuthenticationState();
      } catch (error) {
        console.error('[PopupUI] Logout error:', error);
      }
    }
  }

  /**
   * Handle clear queue
   */
  async handleClearQueue() {
    if (confirm('Are you sure you want to clear the offline queue?')) {
      try {
        await this.sendMessage({
          action: 'CLEAR_QUEUE'
        });

        this.showSuccessMessage('Queue cleared');
        await this.updateQueueStats();
      } catch (error) {
        console.error('[PopupUI] Clear queue error:', error);
      }
    }
  }

  /**
   * Update queue statistics
   */
  async updateQueueStats() {
    try {
      const response = await this.sendMessage({
        action: 'GET_QUEUE_STATS'
      });

      if (response.success && response.stats) {
        this.totalTasks.textContent = response.stats.total_tasks;
        this.pendingTasks.textContent = response.stats.pending_tasks;
        this.readyTasks.textContent = response.stats.ready_for_retry;
      }
    } catch (error) {
      console.error('[PopupUI] Failed to update queue stats:', error);
    }
  }

  /**
   * Show authenticated state
   */
  showAuthenticatedState() {
    this.authSection.classList.add('hidden');
    this.repoSection.classList.remove('hidden');
    this.queueSection.classList.remove('hidden');
    this.settingsSection.classList.remove('hidden');
    this.statusSection.classList.remove('hidden');
    this.statusUser.textContent = 'Connected to GitHub';
  }

  /**
   * Show authentication state
   */
  showAuthenticationState() {
    this.authSection.classList.remove('hidden');
    this.repoSection.classList.add('hidden');
    this.queueSection.classList.add('hidden');
    this.settingsSection.classList.add('hidden');
    this.statusSection.classList.add('hidden');
  }

  /**
   * Get session token
   */
  async getSessionToken() {
    return new Promise((resolve) => {
      chrome.storage.session.get('session_github_pat', (result) => {
        resolve(result.session_github_pat || null);
      });
    });
  }

  /**
   * Send message to background service worker
   */
  sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.error("[PopupUI] Chrome Runtime Message Error:", chrome.runtime.lastError.message);
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response || {});
        }
      });
    });
  }

  /**
   * Show authentication error
   */
  showAuthError(message) {
    this.authError.textContent = message;
    this.authError.classList.remove('hidden');
  }

  /**
   * Clear authentication error
   */
  clearAuthError() {
    this.authError.classList.add('hidden');
  }

  /**
   * Show repository error
   */
  showRepoError(message) {
    this.repoError.textContent = message;
    this.repoError.classList.remove('hidden');
  }

  /**
   * Show success message
   */
  showSuccessMessage(message) {
    alert(message);
  }

  /**
   * Set button loading state
   */
  setButtonLoading(button, isLoading) {
    const spinner = button.querySelector('.button-spinner');
    const text = button.querySelector('.button-text');

    if (!spinner || !text) return; // Guard condition to prevent errors if elements don't contain children

    if (isLoading) {
      button.disabled = true;
      spinner.classList.remove('hidden');
      text.classList.add('hidden');
    } else {
      button.disabled = false;
      spinner.classList.add('hidden');
      text.classList.remove('hidden');
    }
  }

  /**
   * Escape HTML special characters
   */
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}

// Initialize the popup UI when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupUI();
});