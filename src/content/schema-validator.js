/**
 * Schema Validator: Validates message and payload structures
 */

class SchemaValidator {
  /**
   * Validate an internal message from the content script
   */
  static validateInternalMessage(message) {
    if (!message || typeof message !== 'object') {
      return { valid: false, error: 'Message must be an object' };
    }

    if (typeof message.source !== 'string') {
      return { valid: false, error: 'Message must have a source field' };
    }

    if (typeof message.action !== 'string') {
      return { valid: false, error: 'Message must have an action field' };
    }

    if (message.source !== 'LEETCODE_CONTENT_SCRIPT') {
      return { valid: false, error: 'Invalid message source' };
    }

    if (message.action !== 'PROCESS_SUBMISSION') {
      return { valid: false, error: 'Invalid message action' };
    }

    if (typeof message.validationHash !== 'string') {
      return { valid: false, error: 'Message must have a validationHash field' };
    }

    if (!message.payload || typeof message.payload !== 'object') {
      return { valid: false, error: 'Message must have a payload field' };
    }

    return { valid: true };
  }

  /**
   * Validate a submission payload
   */
  static validateSubmissionPayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return { valid: false, error: 'Payload must be an object' };
    }

    // Validate metadata
    if (!payload.metadata || typeof payload.metadata !== 'object') {
      return { valid: false, error: 'Payload must have metadata' };
    }

    if (typeof payload.metadata.sync_engine_version !== 'string') {
      return { valid: false, error: 'Metadata must have sync_engine_version' };
    }

    if (typeof payload.metadata.timestamp_utc !== 'string') {
      return { valid: false, error: 'Metadata must have timestamp_utc' };
    }

    // Validate problem
    if (!payload.problem || typeof payload.problem !== 'object') {
      return { valid: false, error: 'Payload must have problem' };
    }

    if (typeof payload.problem.id !== 'number' && typeof payload.problem.id !== 'string') {
      return { valid: false, error: 'Problem must have an id' };
    }

    if (typeof payload.problem.slug !== 'string') {
      return { valid: false, error: 'Problem must have a slug' };
    }

    if (typeof payload.problem.title !== 'string') {
      return { valid: false, error: 'Problem must have a title' };
    }

    // Validate submission
    if (!payload.submission || typeof payload.submission !== 'object') {
      return { valid: false, error: 'Payload must have submission' };
    }

    if (typeof payload.submission.id !== 'number' && typeof payload.submission.id !== 'string') {
      return { valid: false, error: 'Submission must have an id' };
    }

    if (typeof payload.submission.language !== 'string') {
      return { valid: false, error: 'Submission must have a language' };
    }

    if (typeof payload.submission.language_extension !== 'string') {
      return { valid: false, error: 'Submission must have a language_extension' };
    }

    return { valid: true };
  }

  /**
   * Validate a GitHub API response
   */
  static validateGitHubResponse(response) {
    if (!response || typeof response !== 'object') {
      return { valid: false, error: 'Response must be an object' };
    }

    if (typeof response.status !== 'number') {
      return { valid: false, error: 'Response must have a status' };
    }

    return { valid: true };
  }

  /**
   * Validate a GitHub token
   */
  static validateGitHubToken(token) {
    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'Token must be a non-empty string' };
    }

    if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
      return { valid: false, error: 'Invalid GitHub token format' };
    }

    if (token.length < 20) {
      return { valid: false, error: 'Token is too short' };
    }

    return { valid: true };
  }

  /**
   * Validate a repository name
   */
  static validateRepositoryName(name) {
    if (!name || typeof name !== 'string') {
      return { valid: false, error: 'Repository name must be a non-empty string' };
    }

    if (name.length > 255) {
      return { valid: false, error: 'Repository name is too long' };
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
      return { valid: false, error: 'Repository name contains invalid characters' };
    }

    return { valid: true };
  }

  /**
   * Validate an owner name
   */
  static validateOwnerName(owner) {
    if (!owner || typeof owner !== 'string') {
      return { valid: false, error: 'Owner name must be a non-empty string' };
    }

    if (owner.length > 39) {
      return { valid: false, error: 'Owner name is too long' };
    }

    if (!/^[a-zA-Z0-9-]+$/.test(owner)) {
      return { valid: false, error: 'Owner name contains invalid characters' };
    }

    return { valid: true };
  }

  /**
   * Validate a file path
   */
  static validateFilePath(path) {
    if (!path || typeof path !== 'string') {
      return { valid: false, error: 'File path must be a non-empty string' };
    }

    if (path.length > 255) {
      return { valid: false, error: 'File path is too long' };
    }

    if (path.includes('..')) {
      return { valid: false, error: 'File path cannot contain parent directory references' };
    }

    return { valid: true };
  }

  /**
   * Validate commit message
   */
  static validateCommitMessage(message) {
    if (!message || typeof message !== 'string') {
      return { valid: false, error: 'Commit message must be a non-empty string' };
    }

    if (message.length > 72) {
      return { valid: false, error: 'Commit message is too long' };
    }

    return { valid: true };
  }

  /**
   * Validate code content
   */
  static validateCodeContent(code) {
    if (!code || typeof code !== 'string') {
      return { valid: false, error: 'Code must be a non-empty string' };
    }

    if (code.length > 1000000) {
      return { valid: false, error: 'Code content is too large' };
    }

    return { valid: true };
  }

  /**
   * Validate encryption metadata
   */
  static validateEncryptionMetadata(metadata) {
    if (!metadata || typeof metadata !== 'object') {
      return { valid: false, error: 'Metadata must be an object' };
    }

    if (typeof metadata.salt !== 'string') {
      return { valid: false, error: 'Metadata must have salt' };
    }

    if (typeof metadata.iv !== 'string') {
      return { valid: false, error: 'Metadata must have iv' };
    }

    return { valid: true };
  }

  /**
   * Validate encrypted payload
   */
  static validateEncryptedPayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return { valid: false, error: 'Payload must be an object' };
    }

    if (!payload.crypto_metadata || typeof payload.crypto_metadata !== 'object') {
      return { valid: false, error: 'Payload must have crypto_metadata' };
    }

    if (typeof payload.secure_payload !== 'string') {
      return { valid: false, error: 'Payload must have secure_payload' };
    }

    const metadataValidation = this.validateEncryptionMetadata(payload.crypto_metadata);
    if (!metadataValidation.valid) {
      return metadataValidation;
    }

    return { valid: true };
  }
}

// Export for use in service worker
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SchemaValidator;
}
