# PRD Notes

## Source
- `/home/ubuntu/upload/PRD.pdf`, pages 1-5 viewed visually.

## Key findings from pages 1-5
- Product: **Serverless Open-Source LeetCode-to-GitHub Sync Engine**.
- Target platform: **Google Chrome Extension (Manifest V3)**.
- Distribution: **Self-hosted / unpacked developer mode**.
- Core value proposition: fully client-side, zero-server, privacy-preserving sync from accepted LeetCode submissions to a personal GitHub repository.
- Architectural requirement: **Zero-Server Security Architecture** with all logic inside the client browser runtime.
- Security emphasis: protect against supply-chain risk, credential theft, malicious script injection, and XSS.
- PAT storage requirement: GitHub PAT must be encrypted locally using **Web Crypto API AES-GCM (256-bit)**.
- Key derivation requirement: **PBKDF2 with HMAC-SHA-256 and 100,000 iterations** using a random 16-byte salt.
- Storage format includes unencrypted crypto metadata (`salt`, `iv`) and encrypted `secure_payload` ciphertext.
- Session requirement: derived key or decrypted token may only be cached in `chrome.storage.session` / memory and must not persist long-term.
- Main-world to isolated-world messaging requirement:
  1. Content script generates a cryptographically random `MessageNonce`.
  2. Content script injects the main-world hook script and passes the nonce through a single-use custom DOM event.
  3. Main-world script posts intercepted payloads and includes the correct nonce.
  4. Content script validates `event.origin === https://leetcode.com` and verifies the nonce before accepting the message.
- Isolated-world to service-worker channel uses `chrome.runtime.sendMessage`.
- Background worker must validate strict message schema and should not expose `externally_connectable` in the manifest.
- Internal interface example includes: `source`, `action`, `validationHash`, and `payload`.

## Immediate implications for Milestone 0
- The extension must separate concerns across **service worker**, **isolated content script**, and **main-world injected script**.
- The file tree should include dedicated modules for crypto, messaging contracts, page hooks, GitHub sync, storage, queueing, and UI.
- The nonce bridge must be designed as an ephemeral handshake, never persisted, scoped per page instance, and combined with origin checks plus strict message schema validation.

## Open items to confirm from remaining pages
- Exact end-to-end submission capture flow.
- GitHub repo structure rules.
- Queueing/offline behavior details.
- README / layman parser specifics.
- Additional permissions and UX requirements.

## Key findings from pages 6-10

Pages 6-10 define the submission-capture pipeline, GitHub synchronization behavior, repository structure, README generation, and non-functional constraints. The extension must use a **dual-layer capture strategy**. The primary layer is a **main-world network interceptor** injected at `document_start` in the page's main execution context. It overrides `window.fetch` and `XMLHttpRequest` to monitor LeetCode submission traffic. For the old/classic UI, it targets POST requests to `https://leetcode.com/submissions/detail/*/check/`. For the new/GraphQL UI, it targets POST requests to `https://leetcode.com/graphql/` and filters for operation names such as `submitSubmission` or `submissionDetails`. The interceptor parses response JSON and only forwards data when the execution result indicates a successful acceptance state.

The secondary validation layer is an **isolated-world content script MutationObserver** that watches the LeetCode SPA DOM for a visible success state. The PRD specifies old UI selectors such as `.submission-status-container` and new UI selectors such as `div[data-e2e-locator="submission-result"]`. The internal pipeline should proceed only when the observed text transitions to the exact green success state **"Accepted"**, thereby correlating network telemetry with UI confirmation.

The standardized extraction payload must combine metadata, problem information, and submission information in a structured object. Based on the examples, the payload includes a sync engine version and UTC timestamp, problem fields such as `id`, `slug`, `title`, `difficulty`, and `url`, and submission fields such as `id`, `language`, `language_extension`, `runtime_ms`, and likely memory/runtime percentile and the solution source code when available.

GitHub integration must be performed directly from the **background service worker** using GitHub REST endpoints. The onboarding flow begins with PAT entry, then validation through `GET /user`. If the token is valid, the UI enables repository search. Repository search is implemented as a **debounced type-ahead** flow, with an approximately **300ms debounce**, followed by `GET /user/repos?per_page=100`, and client-side substring filtering on repository names. The PRD therefore favors simple authenticated repository listing plus local filtering rather than remote search APIs.

The synchronization engine must validate the incoming submission payload, decrypt the PAT in memory, and then perform a deterministic repository-write sequence. It first checks repository existence using `HEAD /repos/{owner}/{repo}`. If the repository does not exist, it creates one via `POST /user/repos`. It then computes a deterministic path and calls `GET /repos/{owner}/{repo}/contents/{path}` to determine whether the target file already exists.

The repository file structure is explicitly canonical. Each problem is stored in a directory named with a zero-padded numeric identifier and slug, following the pattern `0001_two-sum/`. That directory contains the source file such as `solution.py` and a generated `README.md`. This strongly implies a deterministic language-extension mapper and deterministic path builder that must remain stable across runs.

The README engine is deterministic and programmatic. It generates a human-readable Markdown document using scraped problem context and submission stats. The sample format includes the problem heading, a properties section with difficulty, language, runtime performance, memory footprint, and source problem link, followed by a problem statement section and additional explanatory sections. This aligns with future Milestone 4 requirements for a layman's-terms parser and documentation generator.

Non-functional constraints are strict. All major operations must be **asynchronous and non-blocking**, preserving UI responsiveness in the browser. The background service worker runtime memory footprint must stay under **20MB**, and cryptographic ArrayBuffers should be explicitly nulled or released as soon as synchronization completes.

The PRD also defines **idempotency and anti-spam controls**. The extension must maintain a local deduplication log in `chrome.storage.local`, keyed by a concatenated identifier such as `${problemId}_${submissionId}`. If a later submission arrives for the same problem but a different submission ID, the engine must fetch the remote file metadata, derive the SHA-1 of the newly compiled code artifact, compare it to the GitHub blob SHA, and skip the write if both hashes match exactly. This prevents redundant commits when the same solution is re-submitted.

Finally, the PRD requires an **offline or fault-tolerant sync queue** stored in `chrome.storage.local`. When connectivity fails or GitHub responds with transient error classes such as `500`, `502`, `503`, or `429`, the extension must enqueue failed sync tasks with metadata including a retry UUID, retry count, and failed timestamp. This will drive the later offline queue engine in Milestone 5.
