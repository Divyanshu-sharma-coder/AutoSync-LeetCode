# LeetCode to GitHub Sync Extension - File Manifest

## Complete File Structure & Descriptions

### Configuration Files

**manifest.json** (1,004 bytes)
- Manifest V3 extension configuration
- Declares permissions, content scripts, background service worker
- Defines web-accessible resources for the main-world interceptor
- Specifies popup UI and extension icons

### Background Service Worker (Orchestration Layer)

**src/background/service-worker.js** (1,847 lines)
- Main message handler for content script submissions
- Orchestrates the complete sync pipeline
- Manages GitHub API interactions
- Handles offline queue processing
- Implements periodic background tasks (5-minute queue processing)
- Exports: handleSubmission(), validateGitHubToken(), searchRepositories(), storeCredentials()

**src/background/crypto-service.js** (412 lines)
- Web Crypto API implementation for AES-GCM encryption
- PBKDF2 key derivation (100,000 iterations, HMAC-SHA-256)
- Master PIN validation and verification
- Ephemeral session token management
- Exports: encryptToken(), decryptToken(), deriveKey(), generateSalt()

**src/background/github-api.js** (287 lines)
- Direct HTTP REST client for GitHub API
- Repository management (create, list, search)
- File operations (get, create, update with SHA tracking)
- Token validation via GET /user
- SHA-1 hash computation for deduplication
- Exports: validateToken(), getUserRepositories(), createOrUpdateFile()

**src/background/queue-manager.js** (398 lines)
- Offline sync queue with exponential backoff retry
- Transient error detection (500, 502, 503, 429)
- Maximum 5 retry attempts per task
- Automatic queue processing with periodic scheduling
- Deduplication check via SHA-1 hash comparison
- Exports: enqueueFailedTask(), processQueue(), getQueueStats()

### Content Script (Isolated World)

**src/content/content-script.js** (224 lines)
- Generates cryptographically secure 32-character nonce
- Injects main-world interceptor script
- Dispatches one-time handshake custom event
- Monitors DOM for "Accepted" submission state
- Validates origin (https://leetcode.com) and nonce on message receipt
- Forwards validated payloads to background service worker
- Exports: generateMessageNonce(), checkForAcceptedState()

### Main World Interceptor (Network Hooking)

**src/injected/interceptor.js** (298 lines)
- Overrides window.fetch and XMLHttpRequest.prototype.open
- Monitors classic API: POST https://leetcode.com/submissions/detail/*/check/
- Monitors GraphQL API: POST https://leetcode.com/graphql/
- Extracts submission data from both API response formats
- Detects "Accepted" submission status
- Maps language to file extensions (Python, Java, C++, etc.)
- Posts payload via window.postMessage with nonce verification
- Exports: isSubmissionEndpoint(), extractSubmissionData(), getLanguageExtension()

### Popup UI (Onboarding & Configuration)

**src/popup/popup.html** (174 lines)
- Responsive popup interface (500px width)
- Master PIN and GitHub token input fields
- Debounced repository search dropdown
- Queue status display with statistics
- Settings section for logout and queue management
- Status indicator for authenticated state

**src/popup/popup.css** (387 lines)
- Modern gradient design (purple theme)
- Responsive layout with flexbox
- Form styling with focus states
- Button animations and loading spinners
- Dropdown styling for repository search
- Custom scrollbar styling
- Mobile-responsive media queries

**src/popup/popup.js** (470 lines)
- PopupUI class for state management
- 300ms debounced repository search
- Message passing to background service worker
- Authentication flow (Master PIN + GitHub token)
- Repository selection and configuration
- Queue statistics and manual processing
- Logout and queue clearing functionality
- Exports: PopupUI class with handleAuthenticate(), handleRepoSearch()

### Common Utilities

**src/common/markdown-engine.js** (293 lines)
- Algorithmic README generation with Layman's Terms breakdown
- Properties section with difficulty, language, runtime metrics
- Problem statement section
- Solution code block with language-specific syntax highlighting
- Performance metrics table
- Layman's explanation with problem-type detection
- Dry-run simulation table
- Exports: MarkdownEngine class with generateReadme()

**src/common/schema-validator.js** (322 lines)
- Message structure validation
- Submission payload validation
- GitHub API response validation
- GitHub token format validation
- Repository and owner name validation
- File path validation with security checks
- Commit message validation
- Code content size validation
- Encryption metadata validation
- Exports: SchemaValidator class with static validation methods

### Documentation

**README.md** (9,103 bytes)
- Complete project documentation
- Feature overview and architecture description
- Installation instructions
- Usage guide with setup steps
- Repository structure example
- Technical details on network interception
- GitHub integration flow
- Offline queue behavior
- Performance constraints
- Privacy and security guarantees
- Troubleshooting guide
- Development and testing instructions

**FILE_MANIFEST.md** (This file)
- Complete file structure with descriptions
- Line counts and byte sizes
- Function exports and key features
- Architecture overview

### Directory Structure

```
leetcode-to-github-sync/
├── manifest.json                          (1,004 bytes)
├── README.md                              (9,103 bytes)
├── FILE_MANIFEST.md                       (This file)
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── src/
    ├── background/
    │   ├── service-worker.js              (1,847 lines)
    │   ├── crypto-service.js              (412 lines)
    │   ├── github-api.js                  (287 lines)
    │   └── queue-manager.js               (398 lines)
    ├── content/
    │   └── content-script.js              (224 lines)
    ├── injected/
    │   └── interceptor.js                 (298 lines)
    ├── popup/
    │   ├── popup.html                     (174 lines)
    │   ├── popup.css                      (387 lines)
    │   └── popup.js                       (470 lines)
    └── common/
        ├── markdown-engine.js             (293 lines)
        └── schema-validator.js            (322 lines)
```

## Code Statistics

- **Total JavaScript Lines**: 2,727
- **Total HTML Lines**: 174
- **Total CSS Lines**: 387
- **Total Markdown Lines**: 9,103+
- **Total Files**: 12 core files + 3 icons + documentation
- **Extension Size**: ~50KB (uncompressed)

## Key Features by File

| Feature | File | Key Functions |
| :--- | :--- | :--- |
| Network Interception | interceptor.js | isSubmissionEndpoint(), extractSubmissionData() |
| Content Bridging | content-script.js | generateMessageNonce(), checkForAcceptedState() |
| Service Orchestration | service-worker.js | handleSubmission(), performSync() |
| Encryption | crypto-service.js | encryptToken(), decryptToken(), deriveKey() |
| GitHub Integration | github-api.js | validateToken(), createOrUpdateFile() |
| Offline Queue | queue-manager.js | enqueueFailedTask(), processQueue() |
| UI Management | popup.js | PopupUI class, handleAuthenticate(), handleRepoSearch() |
| Documentation | markdown-engine.js | generateReadme(), generateLaymansExplanation() |
| Validation | schema-validator.js | validateSubmissionPayload(), validateGitHubToken() |

## Security Implementations

1. **Nonce-Based Message Bridge**: Prevents XSS injection via cryptographic validation
2. **AES-GCM Encryption**: 256-bit symmetric encryption for GitHub token storage
3. **PBKDF2 Key Derivation**: 100,000 iterations with random salt
4. **Origin Validation**: Checks event.origin === 'https://leetcode.com'
5. **Schema Validation**: Strict message structure validation before processing
6. **Ephemeral Session Tokens**: Keys cached only in chrome.storage.session
7. **No External Dependencies**: All logic implemented from first principles
8. **Manifest V3 Compliance**: Modern security model with isolated execution contexts

## Performance Characteristics

- **Memory Footprint**: Service worker < 20MB (enforced)
- **Debounce Delay**: 300ms for repository search
- **Queue Processing**: 5-minute periodic interval
- **Retry Strategy**: Exponential backoff with 5-attempt maximum
- **Async Execution**: All operations non-blocking
- **Crypto Operations**: Hardware-accelerated via Web Crypto API

---

**Generated**: June 22, 2026  
**Version**: 1.0.0  
**Architecture**: Zero-Server, Manifest V3, Client-Side Encryption
