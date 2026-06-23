/**
 * GitHub API Client: Direct HTTP REST operations for repository management
 */

export class GitHubAPIClient {
  constructor(token) {
    this.token = token;
    this.baseURL = 'https://api.github.com';
    this.headers = {
      // FIX: Changed from 'token' to 'Bearer' to match modern GitHub API requirements
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };
  }

  /**
   * Make an HTTP request to the GitHub API
   */
  async request(method, endpoint, body = null) {
    const url = `${this.baseURL}${endpoint}`;
    const options = {
      method: method,
      headers: this.headers
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      
      // If HEAD request, handle cleanly without trying to read JSON body
      if (method === 'HEAD') {
        return { status: response.status, data: null };
      }

      const data = await response.json();

      if (!response.ok) {
        throw {
          status: response.status,
          message: data.message || 'GitHub API error',
          data: data
        };
      }

      return { status: response.status, data: data };
    } catch (error) {
      console.error('[GitHubAPIClient] Request failed:', error);
      throw error;
    }
  }

  /**
   * Validate the GitHub token by fetching the authenticated user
   */
  async validateToken() {
    try {
      const response = await this.request('GET', '/user');
      return { valid: true, user: response.data };
    } catch (error) {
      console.error('[GitHubAPIClient] Token validation failed:', error);
      return { valid: false, error: error };
    }
  }

  /**
   * Get the authenticated user's repositories
   */
  async getUserRepositories(perPage = 100) {
    try {
      const response = await this.request('GET', `/user/repos?per_page=${perPage}&sort=updated`);
      return { success: true, repositories: response.data };
    } catch (error) {
      return { success: false, error: error };
    }
  }

  /**
   * Check if a repository exists
   */
  async repositoryExists(owner, repo) {
    try {
      const response = await fetch(
        `${this.baseURL}/repos/${owner}/${repo}`,
        { method: 'HEAD', headers: this.headers }
      );
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create a new repository
   */
  async createRepository(repoName, description = '') {
    try {
      const response = await this.request('POST', '/user/repos', {
        name: repoName,
        description: description,
        private: false,
        auto_init: true
      });
      return { success: true, repository: response.data };
    } catch (error) {
      return { success: false, error: error };
    }
  }

  /**
   * Get file content from a repository
   */
  async getFileContent(owner, repo, path) {
    try {
      const response = await this.request('GET', `/repos/${owner}/${repo}/contents/${path}`);
      return { success: true, file: response.data };
    } catch (error) {
      if (error.status === 404) {
        return { success: false, notFound: true };
      }
      return { success: false, error: error };
    }
  }

  /**
   * Create or update a file in a repository
   */
  async createOrUpdateFile(owner, repo, path, content, message, sha = null) {
    try {
      const body = {
        message: message,
        content: this.stringToBase64(content),
        branch: 'main'
      };

      if (sha) {
        body.sha = sha;
      }

      const response = await this.request('PUT', `/repos/${owner}/${repo}/contents/${path}`, body);
      return { success: true, commit: response.data };
    } catch (error) {
      return { success: false, error: error };
    }
  }

  /**
   * Get the SHA of a file blob
   */
  async getFileSHA(owner, repo, path) {
    try {
      const response = await this.request('GET', `/repos/${owner}/${repo}/contents/${path}`);
      return { success: true, sha: response.data.sha };
    } catch (error) {
      if (error.status === 404) {
        return { success: false, notFound: true };
      }
      return { success: false, error: error };
    }
  }

  /**
   * Compute SHA-1 hash of content (for deduplication)
   */
  async computeSHA1(content) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    return this.arrayBufferToHex(hashBuffer);
  }

  /**
   * Convert string to Base64 safely handling Unicode/Special Code Characters
   * FIX: btoa(unescape(encodeURIComponent(str))) fails or is deprecated in modern service workers.
   */
  stringToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
    return btoa(binString);
  }

  /**
   * Convert Base64 to string safely handling Unicode
   */
  base64ToString(base64) {
    const binString = atob(base64);
    const bytes = Uint8Array.from(binString, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  /**
   * Convert ArrayBuffer to hex string
   */
  arrayBufferToHex(buffer) {
    const bytes = new Uint8Array(buffer);
    let hex = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
  }

  /**
   * Search repositories by name (client-side filtering)
   */
  filterRepositoriesByName(repositories, query) {
    if (!query || query.trim() === '') {
      return repositories;
    }

    const lowerQuery = query.toLowerCase();
    return repositories.filter(repo => 
      repo.name.toLowerCase().includes(lowerQuery) ||
      (repo.description && repo.description.toLowerCase().includes(lowerQuery))
    );
  }
}

// Export for use in service worker
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GitHubAPIClient;
}