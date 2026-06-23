# Milestone 0: System Architecture & File Tree

## 1. Production-Grade File Directory Tree

The following structure is designed for a modular, TypeScript-ready (or modern ESM) unpacked extension. It enforces strict separation of concerns and follows the principle of least privilege.

```text
leetcode-to-github-sync/
├── manifest.json                # Manifest V3 configuration
├── icons/                       # Extension icons (16, 48, 128)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── src/
│   ├── background/              # Service Worker (Background context)
│   │   ├── service-worker.js    # Entry point for the SW
│   │   ├── crypto-service.js    # AES-GCM, PBKDF2, Master PIN logic
│   │   ├── github-api.js        # GitHub REST API client
│   │   ├── sync-engine.js       # Orchestration of the sync flow
│   │   ├── storage-manager.js   # Local/Session storage abstraction
│   │   └── queue-manager.js     # Offline retry & fault tolerance logic
│   ├── content/                 # Isolated World (Content Script context)
│   │   ├── content-script.js    # Entry point, DOM MutationObserver
│   │   └── secure-bridge.js     # Nonce generation & Main World handshake
│   ├── injected/                # Main World (Page context)
│   │   └── interceptor.js       # window.fetch & XHR overrides
│   ├── popup/                   # Extension Popup UI
│   │   ├── popup.html           # Onboarding & Settings UI
│   │   ├── popup.css            # Tailwind-inspired utility styles
│   │   └── popup.js             # UI logic & debounced repo search
│   └── common/                  # Shared utilities and constants
│       ├── constants.js         # API endpoints, selector strings
│       ├── schema-validator.js  # Message interface & payload validation
│       ├── markdown-engine.js   # README generation & Layman's parser
│       └── utils.js             # Generic helpers (SHA-1, formatting)
└── README.md                    # Developer documentation
```

---

## 2. Technical Breakdown: Secure Messaging Bridge (Nonce-Based)

To satisfy the requirement of capturing network traffic from the **MAIN** world while securely passing it to the **ISOLATED** world, we implement a cryptographically secure, single-use handshake.

### The Problem
The `MAIN` world (where LeetCode's scripts run) can access the `ISOLATED` world's `window` object via `postMessage`. However, any malicious script on the page could also attempt to spoof messages to our content script.

### The Solution: Nonce-Based Handshake & Origin Validation

| Step | Component | Action | Security Benefit |
| :--- | :--- | :--- | :--- |
| **1. Generation** | **Content Script** | Generates a 32-character alpha-numeric `MessageNonce` using `crypto.getRandomValues()`. | Unpredictable token prevents pre-computed spoofing. |
| **2. Handshake** | **Content Script** | Injects `interceptor.js` via a `<script>` tag. Immediately dispatches a one-time Custom Event `__LC_SYNC_HANDSHAKE__` containing the nonce. | Limits nonce exposure to the exact moment of script initialization. |
| **3. Capture** | **Injected Script** | Receives the nonce via the event listener (then removes the listener). It stores the nonce in a private closure. | The nonce never enters the global `window` scope or DOM attributes. |
| **4. Transmission** | **Injected Script** | Upon an "Accepted" submission, it calls `window.postMessage({ type: 'SYNC_PAYLOAD', nonce: SECRET_NONCE, data: {...} }, 'https://leetcode.com')`. | Specifies the target origin to prevent data leakage to other frames. |
| **5. Verification** | **Content Script** | Listens for `message` events. It **MUST** verify: `event.origin === 'https://leetcode.com'` AND `event.data.nonce === MessageNonce`. | Prevents Cross-Site Scripting (XSS) and unauthorized message injection. |
| **6. Validation** | **Content Script** | Passes the raw data through a `SchemaValidator` before sending it to the Service Worker. | Ensures the payload structure matches the expected TypeScript interface. |

### Implementation Logic Snippet (Conceptual)

```javascript
// content/secure-bridge.js
const nonce = crypto.randomUUID(); 
window.addEventListener('message', (event) => {
    if (event.origin !== 'https://leetcode.com') return;
    if (event.data.nonce !== nonce) return;
    // Proceed to forward to Service Worker
    chrome.runtime.sendMessage({ action: 'PROCESS_SUBMISSION', payload: event.data.payload });
});

// Dispatch handshake
const event = new CustomEvent('__LC_SYNC_HANDSHAKE__', { detail: { nonce } });
document.dispatchEvent(event);
```

This architecture ensures that even if a malicious script is present on LeetCode, it cannot intercept the nonce (as it's passed via a transient event during initialization) and cannot guess it to inject fake submissions into the sync pipeline.
