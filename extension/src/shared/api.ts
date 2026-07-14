const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

export interface EvidenceData {
  title: string;
  type: string;
  notes: string;
  url: string;
  screenshot?: string;
  timestamp: string;
}

/**
 * Capture screenshot of active tab
 */
export async function captureScreenshot(tabId: number): Promise<string> {
  const screenshot = await chrome.tabs.captureVisibleTab(tabId, {
    format: 'png',
  });
  return screenshot;
}

/**
 * Save evidence to Supabase
 */
export async function saveEvidence(
  data: EvidenceData,
  authToken: string
): Promise<{ id: string }> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/governance_evidence`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      title: data.title,
      evidence_type: data.type,
      metadata: {
        notes: data.notes,
        url: data.url,
        captured_at: data.timestamp,
        extension_version: chrome.runtime.getManifest().version,
      },
      storage_path: data.screenshot ? `evidence/${Date.now()}.png` : null,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to save evidence');
  }

  const result = await response.json();

  // Upload screenshot if captured
  if (data.screenshot) {
    await uploadScreenshot(data.screenshot, result[0].id, authToken);
  }

  return { id: result[0].id };
}

/**
 * Upload screenshot to Supabase Storage
 */
async function uploadScreenshot(
  screenshotData: string,
  evidenceId: string,
  authToken: string
): Promise<void> {
  const blob = dataURLToBlob(screenshotData);
  const fileName = `evidence/${evidenceId}.png`;

  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/governance-evidence/${fileName}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: blob,
    }
  );

  if (!response.ok) {
    console.error('Failed to upload screenshot:', await response.json());
  }
}

/**
 * Convert data URL to Blob
 */
function dataURLToBlob(dataURL: string): Blob {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  const n = bstr.length;
  const u8arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Get stored auth token
 */
export async function getAuthToken(): Promise<string | null> {
  const { authToken } = await chrome.storage.local.get('authToken');
  return authToken || null;
}

/**
 * Store auth token
 */
export async function setAuthToken(token: string): Promise<void> {
  await chrome.storage.local.set({ authToken: token });
}

/**
 * Clear auth token
 */
export async function clearAuthToken(): Promise<void> {
  await chrome.storage.local.remove('authToken');
}
