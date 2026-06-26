/**
 * Content Script
 * Runs in the context of the web page
 * Provides integration points for evidence capture
 */

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'auth:context') {
    // Store auth context on page
    const { authToken } = message.payload;
    (window as any).__RealSyncDynamicsAuth = { authToken };
  }
});

// Add context menu for evidence capture
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'capture-element',
    title: 'Capture as Evidence',
    contexts: ['page', 'selection', 'image'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'capture-element' && tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'evidence:capture',
      payload: { selectionText: info.selectionText },
    });
  }
});

console.log('RealSyncDynamics Evidence Tracker content script loaded');
