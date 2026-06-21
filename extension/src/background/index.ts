import { setAuthToken, getAuthToken } from '../shared/api';

/**
 * Background Service Worker
 * Handles:
 * - Authentication state management
 * - Message passing between popup and content script
 * - Periodic sync of pending evidence
 */

interface Message {
  type: string;
  payload?: unknown;
}

interface AuthMessage extends Message {
  type: 'auth:set' | 'auth:get' | 'auth:clear';
}

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener(
  (message: Message, sender, sendResponse) => {
    handleMessage(message, sender).then(sendResponse).catch((error) => {
      sendResponse({ error: error.message });
    });
    return true; // Keep channel open for async response
  }
);

async function handleMessage(message: Message, sender: any): Promise<unknown> {
  switch (message.type) {
    case 'auth:set': {
      const { token } = message.payload as { token: string };
      await setAuthToken(token);
      return { success: true };
    }

    case 'auth:get': {
      const token = await getAuthToken();
      return { token };
    }

    case 'auth:clear': {
      await chrome.storage.local.remove('authToken');
      return { success: true };
    }

    case 'sync:pending': {
      // Sync any pending evidence (for offline support)
      return await syncPendingEvidence();
    }

    default:
      return { error: 'Unknown message type' };
  }
}

/**
 * Sync pending evidence when connection is restored
 */
async function syncPendingEvidence(): Promise<{ synced: number }> {
  const { pendingEvidence = [] } = await chrome.storage.local.get('pendingEvidence');
  const token = await getAuthToken();

  if (!token || pendingEvidence.length === 0) {
    return { synced: 0 };
  }

  // TODO: Implement sync logic when offline support is needed
  return { synced: 0 };
}

/**
 * Listen for tab updates to inject auth context into pages
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Send auth context to content script
    const authToken = chrome.storage.local.get('authToken');
    chrome.tabs.sendMessage(tabId, {
      type: 'auth:context',
      payload: { authToken },
    }).catch(() => {
      // Content script not available, ignore
    });
  }
});

console.log('RealSyncDynamics Evidence Tracker background service worker loaded');
