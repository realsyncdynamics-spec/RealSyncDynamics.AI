// options.js — laedt + speichert die Tenant-Konfig in chrome.storage.local.

const FIELDS = ['endpoint', 'tenantKey', 'userTag', 'team'];
const DEFAULT_ENDPOINT = 'https://realsyncdynamicsai.de/api/telemetry/ai-event';

async function load() {
  const stored = await chrome.storage.local.get(FIELDS);
  document.getElementById('endpoint').value = stored.endpoint || DEFAULT_ENDPOINT;
  document.getElementById('tenantKey').value = stored.tenantKey || '';
  document.getElementById('userTag').value = stored.userTag || '';
  document.getElementById('team').value = stored.team || '';
}

function setStatus(message, kind) {
  const el = document.getElementById('status');
  el.className = `status ${kind}`;
  el.textContent = message;
  el.style.display = 'block';
  setTimeout(() => {
    el.style.display = 'none';
  }, 3500);
}

async function save() {
  const endpoint = document.getElementById('endpoint').value.trim();
  const tenantKey = document.getElementById('tenantKey').value.trim();
  const userTag = document.getElementById('userTag').value.trim();
  const team = document.getElementById('team').value.trim();

  if (!endpoint) {
    setStatus('Endpoint ist Pflicht.', 'error');
    return;
  }
  try {
    new URL(endpoint);
  } catch {
    setStatus('Endpoint ist keine gueltige URL.', 'error');
    return;
  }
  if (tenantKey && !/^[0-9a-f-]{36}$/i.test(tenantKey)) {
    setStatus('Tenant-Key sollte eine UUID (36 Zeichen) sein.', 'error');
    return;
  }

  await chrome.storage.local.set({ endpoint, tenantKey, userTag, team });
  setStatus('Gespeichert. Aenderungen wirken sofort.', 'success');
}

document.addEventListener('DOMContentLoaded', () => {
  load();
  document.getElementById('save').addEventListener('click', save);
});
