import { saveEvidence, captureScreenshot } from '../shared/api';

interface EvidenceFormData {
  title: string;
  type: string;
  notes: string;
  url: string;
  screenshot?: string;
  timestamp: string;
}

// Form elements
const form = document.getElementById('evidenceForm') as HTMLFormElement;
const titleInput = document.getElementById('title') as HTMLInputElement;
const typeSelect = document.getElementById('type') as HTMLSelectElement;
const notesInput = document.getElementById('notes') as HTMLTextAreaElement;
const screenshotBtn = document.getElementById('screenshotBtn') as HTMLButtonElement;
const submitBtn = document.getElementById('submitBtn') as HTMLButtonElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;
const loadingDiv = document.getElementById('loading') as HTMLDivElement;
const errorDiv = document.getElementById('error') as HTMLDivElement;
const successDiv = document.getElementById('success') as HTMLDivElement;

let capturedScreenshot: string | undefined;
let currentTab: chrome.tabs.Tab | undefined;

// Initialize popup
async function init() {
  // Get current tab info
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tabs[0];

  // Check authentication status
  const { authToken } = await chrome.storage.local.get('authToken');
  if (authToken) {
    statusDiv.textContent = 'Ready to capture evidence';
  } else {
    statusDiv.textContent = '⚠️ Not authenticated - please log in';
    submitBtn.disabled = true;
    screenshotBtn.disabled = true;
  }
}

// Screenshot handler
screenshotBtn.addEventListener('click', async () => {
  screenshotBtn.disabled = true;
  loadingDiv.classList.add('active');
  errorDiv.classList.remove('active');

  try {
    capturedScreenshot = await captureScreenshot(currentTab?.id || 0);
    screenshotBtn.textContent = '✓ Screenshot captured';
    screenshotBtn.classList.add('success');
  } catch (error) {
    console.error('Screenshot failed:', error);
    showError('Failed to capture screenshot');
  } finally {
    loadingDiv.classList.remove('active');
  }
});

// Form submission
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!titleInput.value || !typeSelect.value) {
    showError('Please fill in required fields');
    return;
  }

  submitBtn.disabled = true;
  loadingDiv.classList.add('active');
  errorDiv.classList.remove('active');
  successDiv.classList.remove('active');

  try {
    const { authToken } = await chrome.storage.local.get('authToken');
    if (!authToken) {
      throw new Error('Not authenticated');
    }

    const evidenceData: EvidenceFormData = {
      title: titleInput.value,
      type: typeSelect.value,
      notes: notesInput.value,
      url: currentTab?.url || '',
      screenshot: capturedScreenshot,
      timestamp: new Date().toISOString(),
    };

    await saveEvidence(evidenceData, authToken);

    // Reset form
    form.reset();
    capturedScreenshot = undefined;
    screenshotBtn.textContent = '📸 Screenshot';
    screenshotBtn.classList.remove('success');
    successDiv.classList.add('active');

    // Auto-hide success message
    setTimeout(() => {
      successDiv.classList.remove('active');
    }, 3000);
  } catch (error) {
    console.error('Save failed:', error);
    showError(error instanceof Error ? error.message : 'Failed to save evidence');
  } finally {
    submitBtn.disabled = false;
    loadingDiv.classList.remove('active');
  }
});

function showError(message: string) {
  errorDiv.textContent = message;
  errorDiv.classList.add('active');
}

// Initialize on load
init();
