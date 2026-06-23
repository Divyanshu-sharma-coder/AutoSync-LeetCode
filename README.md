# LeetCode to GitHub Sync Extension

A production-grade, serverless Chrome Extension that automatically syncs your accepted LeetCode solutions to a personal GitHub repository. This extension operates entirely client-side with zero external dependencies, ensuring complete privacy and security.

## Features

- **Zero-Server Architecture**: All processing happens locally in your browser. No data is sent to external servers.
- **End-to-End Encryption**: Your GitHub Personal Access Token is encrypted locally using AES-GCM (256-bit) and PBKDF2 key derivation.
- **Automatic Sync**: Detects when you solve a LeetCode problem and automatically commits the solution to GitHub.
- **Dual-Layer Detection**: Combines network interception and DOM observation for reliable submission detection.
- **Offline Queue**: Failed syncs are automatically queued and retried with exponential backoff.
- **Manifest V3 Compliant**: Built for Chrome's modern extension architecture with enhanced security.
- **No External APIs**: Uses only GitHub's REST API directly from the browser.

## Architecture

### Core Components

1. **Main World Interceptor** (`src/injected/interceptor.js`)
   - Runs in the page's main execution context
   - Overrides `window.fetch` and `XMLHttpRequest` to capture submission traffic
   - Detects both classic and GraphQL LeetCode APIs

2. **Isolated Content Script** (`src/content/content-script.js`)
   - Generates a cryptographically secure nonce for message validation
   - Injects the main-world interceptor
   - Monitors DOM for visual confirmation of accepted submissions
   - Validates and forwards submissions to the background service worker

3. **Background Service Worker** (`src/background/service-worker.js`)
   - Orchestrates the sync pipeline
   - Manages GitHub API interactions
   - Handles offline queue and retry logic
   - Processes periodic background tasks

4. **Crypto Service** (`src/background/crypto-service.js`)
   - Implements AES-GCM encryption and PBKDF2 key derivation
   - Manages ephemeral session tokens
   - Stores encrypted credentials locally

5. **GitHub API Client** (`src/background/github-api.js`)
   - Direct HTTP REST operations to GitHub
   - Repository management and file operations
   - SHA-1 deduplication for preventing redundant commits

6. **Popup UI** (`src/popup/popup.html`, `src/popup/popup.js`)
   - Onboarding interface for Master PIN and GitHub token
   - Debounced repository search (300ms delay)
   - Queue status monitoring

### Security Model

#### Nonce-Based Message Bridge

The extension uses a cryptographically secure handshake to prevent XSS injection:

1. Content script generates a 32-character alpha-numeric nonce using `crypto.getRandomValues()`
2. Nonce is passed to the main-world script via a one-time custom DOM event
3. Main-world script stores the nonce in a closure (never exposed globally)
4. Upon submission capture, the script posts the payload with the nonce
5. Content script validates `event.origin === 'https://leetcode.com'` and verifies the nonce
6. Only messages with the correct nonce are forwarded to the service worker

#### Credential Storage

- **Master PIN**: Never stored, only used for key derivation
- **GitHub Token**: Encrypted with AES-GCM using a derived key
- **Encryption Key**: Derived from Master PIN + random salt using PBKDF2 (100,000 iterations)
- **Session Token**: Cached in `chrome.storage.session` (cleared on browser close)
- **Salt**: Stored unencrypted in `chrome.storage.local` for future key derivations

## Installation

1. Clone or download this repository
2. Open `chrome://extensions/` in your Chrome browser
3. Enable "Developer mode" (top-right toggle)
4. Click "Load unpacked" and select the extension directory
5. The extension icon should appear in your toolbar

## Usage

### Initial Setup

1. Click the extension icon to open the popup
2. Enter a secure Master PIN (4-32 characters)
3. Enter your GitHub Personal Access Token (create one at https://github.com/settings/tokens)
4. Click "Authenticate"
5. Select your target repository from the search dropdown
6. Click "Save Repository"

### Automatic Sync

Once configured, the extension will:

1. Monitor LeetCode for accepted submissions
2. Extract problem details and solution code
3. Create a directory structure: `{PROBLEM_ID}_{SLUG}/`
4. Commit the solution file and auto-generated README
5. Handle failures gracefully with offline retry queue

### Repository Structure

```
your-repo/
├── 0001_two-sum/
│   ├── solution.py
│   └── README.md
├── 0002_add-two-numbers/
│   ├── solution.py
│   └── README.md
└── ...
```

## File Structure

```
leetcode-to-github-sync/
├── manifest.json                          # Manifest V3 configuration
├── src/
│   ├── background/
│   │   ├── service-worker.js             # Main orchestration layer
│   │   ├── crypto-service.js             # Web Crypto API implementation
│   │   ├── github-api.js                 # GitHub REST client
│   │   └── queue-manager.js              # Offline queue and retry logic
│   ├── content/
│   │   └── content-script.js             # Isolated world content script
│   ├── injected/
│   │   └── interceptor.js                # Main world network interceptor
│   ├── popup/
│   │   ├── popup.html                    # Onboarding UI
│   │   ├── popup.css                     # Styling
│   │   └── popup.js                      # UI logic
│   └── common/
│       ├── markdown-engine.js            # README generation
│       └── schema-validator.js           # Message validation
└── README.md
```

## Technical Details

### Network Interception

The extension monitors two LeetCode endpoints:

- **Classic API**: `POST https://leetcode.com/submissions/detail/*/check/`
- **GraphQL API**: `POST https://leetcode.com/graphql/` (operations: `submitSubmission`, `submissionDetails`)

### Submission Detection

The interceptor checks for:
- Response status: `status_msg === "Accepted"` (classic) or `statusDisplay === "Accepted"` (GraphQL)
- DOM confirmation: Text content transitions to "Accepted" in submission result container

### GitHub Integration

- **Token Validation**: `GET /user`
- **Repository Search**: `GET /user/repos?per_page=100` with client-side filtering
- **File Operations**: `GET/PUT /repos/{owner}/{repo}/contents/{path}`
- **Deduplication**: SHA-1 hash comparison to prevent redundant commits

### Offline Queue

Failed syncs are queued with:
- Exponential backoff retry strategy
- Transient error detection (500, 502, 503, 429)
- Maximum 5 retry attempts
- Automatic processing every 5 minutes

## Performance Constraints

- **Memory Footprint**: Background service worker stays under 20MB
- **Async Execution**: All operations are non-blocking
- **Debounce Delay**: Repository search uses 300ms debounce
- **Session Lifetime**: Encryption key cached only during browser session

## Privacy & Security

- ✅ No data leaves your browser
- ✅ No external servers or databases
- ✅ No tracking or analytics
- ✅ No third-party dependencies
- ✅ Open-source code for full transparency
- ✅ Credentials encrypted locally with Web Crypto API

## Troubleshooting

### Token Validation Failed

- Ensure your GitHub token has `repo` scope permissions
- Check that the token hasn't expired
- Verify the token format (should start with `ghp_` or `github_pat_`)

### Submissions Not Syncing

- Verify the extension is enabled on LeetCode
- Check that a repository is configured
- Open the popup to view queue status
- Try manually processing the queue

### Repository Not Found

- Ensure you have write access to the repository
- Check that the repository name is correct
- Try creating a new public repository for testing

## Development

### Building

The extension is ready to use as-is. No build process is required.

### Debugging

1. Open `chrome://extensions/`
2. Click "Details" on the extension
3. Click "Inspect views" → "service worker" for background logs
4. Right-click on LeetCode page → "Inspect" for content script logs

### Testing

1. Create a test repository on GitHub
2. Configure the extension with the test repository
3. Submit a solution on LeetCode
4. Check the repository for the synced files

## Limitations

- Only works on LeetCode.com
- Requires Chrome/Chromium-based browser
- GitHub token must have repo permissions
- Offline queue has a 5-retry limit

## Future Enhancements

- Support for other coding platforms (HackerRank, Codeforces, etc.)
- Custom README templates
- Problem categorization and tagging
- Statistics dashboard
- Batch sync for historical submissions

## License

This project is open-source and available for personal and educational use.

## Support

For issues, questions, or suggestions, please create an issue in the repository.

---

**Version**: 1.0.0  
**Last Updated**: 2026  
**Architecture**: Zero-Server, Manifest V3, Client-Side Encryption
