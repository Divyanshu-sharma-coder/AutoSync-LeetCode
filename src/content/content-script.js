(function() {
  'use strict';
  console.log('🚀 [LeetCode Sync] Deep-Extractor script loaded!');

  // =====================================================================
  // 1. INJECT NETWORK INTERCEPTOR (Bypasses Monaco Virtualization)
  // =====================================================================
  const injectScript = document.createElement('script');
  injectScript.textContent = `
    (function() {
        const originalFetch = window.fetch;
        window.fetch = async function(...args) {
            const url = args[0];
            const options = args[1];

            // Intercept the exact moment LeetCode sends your code to the server
            if (url && typeof url === 'string' && url.includes('/submit/')) {
                try {
                    if (options && options.body) {
                        const body = JSON.parse(options.body);
                        if (body.typed_code) {
                            // Beam the full, raw code back to our extension
                            window.postMessage({
                                type: 'LC_EXACT_CODE',
                                code: body.typed_code,
                                language: body.lang || 'cpp'
                            }, '*');
                            console.log('🕵️ [LeetCode Sync] Intercepted raw 100% complete code payload!');
                        }
                    }
                } catch (e) { }
            }
            return originalFetch.apply(this, args);
        };
    })();
  `;
  document.documentElement.appendChild(injectScript);
  injectScript.remove(); // Clean up

  // =====================================================================
  // 2. LISTEN FOR THE INTERCEPTED PAYLOAD
  // =====================================================================
  let interceptedCode = null;
  let interceptedLang = null;

  window.addEventListener('message', (event) => {
      if (event.source !== window || !event.data) return;
      if (event.data.type === 'LC_EXACT_CODE') {
          interceptedCode = event.data.code;
          interceptedLang = event.data.language;
      }
  });

  // =====================================================================
  // 3. BUILD THE FINAL PAYLOAD
  // =====================================================================
  function extractData() {
    let title = document.title.split('-')[0].trim();
    if (title === 'LeetCode') {
        const match = location.pathname.match(/\/problems\/([^/]+)/);
        if (match) title = match[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        else title = 'Unknown Problem';
    }

    // Always prefer our intercepted full code. Only fallback if something weird happens.
    let codeText = interceptedCode;
    if (!codeText) {
        console.warn('⚠️ [LeetCode Sync] Network intercept empty, falling back to visible screen scraping...');
        const lines = document.querySelectorAll('.view-line');
        codeText = Array.from(lines).map(l => l.textContent).join('\n');
    }

    let language = interceptedLang || 'cpp';

    return { title, language, code: codeText, status: "Accepted" };
  }

  // =====================================================================
  // 4. FIRE TO BACKGROUND WORKER
  // =====================================================================
  function firePayload() {
    const payload = extractData();
    
    // Log a preview so it doesn't spam your console, but sends the full thing
    const preview = payload.code ? payload.code.substring(0, 50).replace(/\n/g, ' ') + '...' : 'null';
    console.log(`📦 [LeetCode Sync] Payload built. Title: "${payload.title}" | Code: ${preview}`);

    if (!payload.code || payload.code.trim().length < 5) return;

    chrome.runtime.sendMessage({
        source: 'LEETCODE_CONTENT_SCRIPT',
        action: 'PROCESS_SUBMISSION',
        payload: payload
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.error("❌ [LeetCode Sync] Channel Error:", chrome.runtime.lastError.message);
        } else {
            console.log("📥 [LeetCode Sync] Background Worker responded with:", response);
        }
    });
  }

  // =====================================================================
  // 5. OBSERVE PAGE FOR "ACCEPTED" STATUS
  // =====================================================================
  let lastUrl = location.href;
  let hasSynced = false;

  setInterval(() => {
      // Reset flags if you move to a new submission page
      if (location.href !== lastUrl) {
          lastUrl = location.href;
          hasSynced = false;
      }

      if (hasSynced) return;
      if (!location.pathname.includes('/problems/')) return;

      const pageText = document.body.innerText;
      if (pageText.includes('Accepted') && (pageText.includes('Runtime') || pageText.includes('Memory'))) {
          console.log("✅ [LeetCode Sync] 'Accepted' state detected on screen!");
          hasSynced = true; 
          setTimeout(() => firePayload(), 1500); // Give UI a second to settle
      }
  }, 2000);
})();