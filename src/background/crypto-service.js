/**
 * Crypto Service: Web Crypto API implementation for AES-GCM encryption and PBKDF2 key derivation
 * Handles Master PIN-based encryption for GitHub PAT storage
 */

export class CryptoService {
  constructor() {
    this.SALT_LENGTH = 16; // 16 bytes
    this.IV_LENGTH = 12; // 12 bytes for GCM
    this.PBKDF2_ITERATIONS = 100000;
    this.KEY_LENGTH = 256; // bits
    this.ALGORITHM = 'AES-GCM';
  }

  /**
   * Generate a cryptographically secure random salt
   */
  async generateSalt() {
    const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
    return this.arrayBufferToBase64(salt);
  }

  /**
   * Generate a cryptographically secure random IV for GCM
   */
  generateIV() {
    return crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
  }

  /**
   * Derive a key from the Master PIN and salt using PBKDF2
   */
  async deriveKey(masterPin, salt) {
    // Convert salt from base64 back to ArrayBuffer
    const saltBuffer = this.base64ToArrayBuffer(salt);

    // Convert master PIN to ArrayBuffer
    const pinBuffer = new TextEncoder().encode(masterPin);

    // Import the PIN as a key for PBKDF2
    const baseKey = await crypto.subtle.importKey(
      'raw',
      pinBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    // Derive the key using PBKDF2
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: saltBuffer,
        iterations: this.PBKDF2_ITERATIONS
      },
      baseKey,
      this.KEY_LENGTH
    );

    // Import the derived bits as an AES-GCM key
    const derivedKey = await crypto.subtle.importKey(
      'raw',
      derivedBits,
      { name: this.ALGORITHM },
      false,
      ['encrypt', 'decrypt']
    );

    return derivedKey;
  }

  /**
   * Encrypt a GitHub PAT token
   * Returns an object with crypto metadata and encrypted payload
   */
  async encryptToken(token, masterPin) {
    try {
      // Generate a new salt if not already stored
      let salt = await this.getSaltFromStorage();
      if (!salt) {
        salt = await this.generateSalt();
        await this.setSaltInStorage(salt);
      }

      // Derive the key from the master PIN and salt
      const key = await this.deriveKey(masterPin, salt);

      // Generate a random IV
      const iv = this.generateIV();

      // Encode the token as UTF-8
      const tokenBuffer = new TextEncoder().encode(token);

      // Encrypt the token using AES-GCM
      const ciphertext = await crypto.subtle.encrypt(
        {
          name: this.ALGORITHM,
          iv: iv
        },
        key,
        tokenBuffer
      );

      // Return the encrypted payload with metadata
      return {
        crypto_metadata: {
          salt: salt,
          iv: this.arrayBufferToBase64(iv)
        },
        secure_payload: this.arrayBufferToBase64(ciphertext)
      };
    } catch (error) {
      console.error('[CryptoService] Encryption failed:', error);
      throw error;
    }
  }

  /**
   * Decrypt a GitHub PAT token
   * Requires the encrypted payload and master PIN
   */
  async decryptToken(encryptedData, masterPin) {
    try {
      const { crypto_metadata, secure_payload } = encryptedData;

      if (!crypto_metadata || !secure_payload) {
        throw new Error('Invalid encrypted data structure');
      }

      // Derive the key using the stored salt and master PIN
      const key = await this.deriveKey(masterPin, crypto_metadata.salt);

      // Convert IV and ciphertext from base64
      const iv = this.base64ToArrayBuffer(crypto_metadata.iv);
      const ciphertext = this.base64ToArrayBuffer(secure_payload);

      // Decrypt using AES-GCM
      const plaintext = await crypto.subtle.decrypt(
        {
          name: this.ALGORITHM,
          iv: iv
        },
        key,
        ciphertext
      );

      // Convert the decrypted plaintext to a string
      const token = new TextDecoder().decode(plaintext);
      return token;
    } catch (error) {
      console.error('[CryptoService] Decryption failed:', error);
      throw error;
    }
  }

  /**
   * Store the salt in chrome.storage.local (unencrypted, for future key derivations)
   */
  async setSaltInStorage(salt) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ 'crypto_salt': salt }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Retrieve the salt from chrome.storage.local
   */
  async getSaltFromStorage() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get('crypto_salt', (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result.crypto_salt || null);
        }
      });
    });
  }

  /**
   * Store the encrypted token and metadata in chrome.storage.local
   */
  async storeEncryptedToken(encryptedData) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ 'encrypted_github_pat': encryptedData }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Retrieve the encrypted token from chrome.storage.local
   */
  async getEncryptedToken() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get('encrypted_github_pat', (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result.encrypted_github_pat || null);
        }
      });
    });
  }

  /**
   * Store the decrypted token in chrome.storage.session (ephemeral, cleared on browser close)
   */
  async storeSessionToken(token) {
    return new Promise((resolve, reject) => {
      chrome.storage.session.set({ 'session_github_pat': token }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Retrieve the session token from chrome.storage.session
   */
  async getSessionToken() {
    return new Promise((resolve, reject) => {
      chrome.storage.session.get('session_github_pat', (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result.session_github_pat || null);
        }
      });
    });
  }

  /**
   * Clear the session token (for logout)
   */
  async clearSessionToken() {
    return new Promise((resolve, reject) => {
      chrome.storage.session.remove('session_github_pat', () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Convert ArrayBuffer to Base64 string
   */
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert Base64 string to ArrayBuffer
   */
  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Validate a Master PIN (basic checks)
   */
  validateMasterPin(pin) {
    if (!pin || typeof pin !== 'string') {
      return { valid: false, error: 'PIN must be a non-empty string' };
    }
    if (pin.length < 4) {
      return { valid: false, error: 'PIN must be at least 4 characters' };
    }
    if (pin.length > 32) {
      return { valid: false, error: 'PIN must be at most 32 characters' };
    }
    return { valid: true };
  }

  /**
   * Verify that a Master PIN can decrypt stored data
   */
  async verifyMasterPin(pin) {
    try {
      const encryptedData = await this.getEncryptedToken();
      if (!encryptedData) {
        return { valid: false, error: 'No encrypted token stored' };
      }

      await this.decryptToken(encryptedData, pin);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'PIN verification failed' };
    }
  }
}

// Export for use in service worker
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CryptoService;
}
