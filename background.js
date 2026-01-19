// Background service worker for the extension
// This handles browser automation tasks

chrome.runtime.onInstalled.addListener(() => {
  console.log('Voice Assistant Extension installed');
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'executeBrowserAction') {
    executeBrowserAction(request.data)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep the message channel open for async response
  }
});

async function executeBrowserAction(actionData) {
  // This can be called from the assistant if needed
  // Most actions are handled directly in assistant.js using chrome.tabs API
  return { message: 'Action executed' };
}



