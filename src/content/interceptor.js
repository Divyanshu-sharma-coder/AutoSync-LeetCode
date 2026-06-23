(function() {
  'use strict';

  let messageNonce = null;
  const originalFetch = window.fetch;
  const originalXHR = window.XMLHttpRequest.prototype.open;

  // Listen for the handshake event containing our secure message verification token
  document.addEventListener('__LC_SYNC_HANDSHAKE__', (event) => {
    messageNonce = event.detail?.nonce;
    console.log('[LeetCode Sync] Secure handshake completed.');
  }, { once: true });

  // Helper function to check if a URL matches LeetCode submission endpoints
  function isSubmissionEndpoint(url) {
    const urlStr = String(url);
    const isClassicSubmission = urlStr.includes('https://leetcode.com/submissions/detail/') && urlStr.includes('/check/');
    const isGraphQLSubmission = urlStr.includes('https://leetcode.com/graphql/');
    return isClassicSubmission || isGraphQLSubmission;
  }

  // Helper function to extract operation name from GraphQL request body
  function extractGraphQLOperation(body) {
    try {
      if (typeof body === 'string') {
        const parsed = JSON.parse(body);
        return parsed.operationName || null;
      }
    } catch (e) {
      // Ignore parse errors
    }
    return null;
  }

  // Helper function to check if response indicates successful submission
  function isAcceptedSubmission(responseData) {
    if (!responseData) return false;
    
    // For classic API: check status_msg field
    if (responseData.status_msg === 'Accepted' || responseData.state === 'SUCCESS') {
      return true;
    }

    // For GraphQL API: check nested submission status
    if (responseData.data?.submitSubmission?.submission?.statusDisplay === 'Accepted') {
      return true;
    }

    return false;
  }

  // Helper function to extract submission data from response
  function extractSubmissionData(responseData, url) {
    const extracted = {
      metadata: {
        sync_engine_version: '1.0.0',
        timestamp_utc: new Date().toISOString()
      },
      problem: {},
      submission: {},
      raw_response: responseData
    };

    // Extract from classic API response
    if (responseData.status_msg === 'Accepted') {
      extracted.problem = {
        id: responseData.question_id || null,
        slug: responseData.question__title_slug || null,
        title: responseData.question__title || null,
        difficulty: responseData.question__difficulty?.level || null,
        url: responseData.question__article__slug ? `https://leetcode.com/problems/${responseData.question__article__slug}/` : null
      };
      extracted.submission = {
        id: responseData.id || null,
        language: responseData.lang || null,
        language_extension: getLanguageExtension(responseData.lang),
        runtime_ms: responseData.runtime || null,
        memory_mb: responseData.memory || null,
        runtime_percentile: responseData.runtime_percentile || null,
        memory_percentile: responseData.memory_percentile || null,
        code: responseData.code || null
      };
    }

    // Extract from GraphQL API response
    if (responseData.data?.submitSubmission?.submission) {
      const submission = responseData.data.submitSubmission.submission;
      extracted.problem = {
        id: submission.question?.questionId || null,
        slug: submission.question?.titleSlug || null,
        title: submission.question?.title || null,
        difficulty: submission.question?.difficulty || null,
        url: submission.question?.titleSlug ? `https://leetcode.com/problems/${submission.question.titleSlug}/` : null
      };
      extracted.submission = {
        id: submission.id || null,
        language: submission.lang || null,
        language_extension: getLanguageExtension(submission.lang),
        runtime_ms: submission.runtime || null,
        memory_mb: submission.memory || null,
        runtime_percentile: submission.runtimePercentile || null,
        memory_percentile: submission.memoryPercentile || null,
        code: submission.code || null
      };
    }

    return extracted;
  }

  // Helper function to map language to file extension
  function getLanguageExtension(language) {
    const languageMap = {
      'python': 'py',
      'python3': 'py',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'c++': 'cpp',
      'csharp': 'cs',
      'c#': 'cs',
      'javascript': 'js',
      'typescript': 'ts',
      'go': 'go',
      'rust': 'rs',
      'kotlin': 'kt',
      'swift': 'swift',
      'ruby': 'rb',
      'php': 'php',
      'scala': 'scala',
      'mysql': 'sql',
      'sql': 'sql',
      'bash': 'sh',
      'r': 'r'
    };
    return languageMap[language?.toLowerCase()] || 'txt';
  }

  // Override window.fetch
  window.fetch = function(...args) {
    const url = args[0];
    const options = args[1] || {};

    const fetchPromise = originalFetch.apply(this, args);

    if (isSubmissionEndpoint(url)) {
      fetchPromise
        .then(async (response) => {
          const clonedResponse = response.clone();
          const responseData = await clonedResponse.json();

          if (isAcceptedSubmission(responseData)) {
            const submissionData = extractSubmissionData(responseData, url);
            
            if (messageNonce) {
              window.postMessage(
                {
                  type: 'SYNC_PAYLOAD',
                  nonce: messageNonce,
                  data: submissionData
                },
                'https://leetcode.com'
              );
            }
          }

          return response;
        })
        .catch(() => {
          // Silently handle errors in our interception logic
        });
    }

    return fetchPromise;
  };

  // Override XMLHttpRequest.open
  window.XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    const xhrInstance = this;
    const originalOnReadyStateChange = this.onreadystatechange;

    if (isSubmissionEndpoint(url) && method.toUpperCase() === 'POST') {
      this.onreadystatechange = function() {
        if (originalOnReadyStateChange) {
          originalOnReadyStateChange.call(this);
        }

        if (this.readyState === 4 && this.status === 200) {
          try {
            const responseData = JSON.parse(this.responseText);

            if (isAcceptedSubmission(responseData)) {
              const submissionData = extractSubmissionData(responseData, url);
              
              if (messageNonce) {
                window.postMessage(
                  {
                    type: 'SYNC_PAYLOAD',
                    nonce: messageNonce,
                    data: submissionData
                  },
                  'https://leetcode.com'
                );
              }
            }
          } catch (e) {
            // Silently handle JSON parse errors
          }
        }
      };
    }

    return originalXHR.call(this, method, url, ...rest);
  };

  console.log('[LeetCode Sync] Main-world interceptor initialized');

  // Notify the content script that the interceptor is loaded and ready to receive the handshake nonce
  window.postMessage({ type: 'INTERCEPTOR_READY' }, 'https://leetcode.com');
})();