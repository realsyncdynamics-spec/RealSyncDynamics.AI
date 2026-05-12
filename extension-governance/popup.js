// RSD Governance — Popup controller.
//
// Reads / writes the extension's local config (ingest URL + token)
// and displays the in-memory event buffer so the user can verify
// taps are firing before flushing.

const STORAGE_KEY = 'rsd_governance_config';

const $ = (id) => document.getElementById(id);

function setStatus(msg, isError) {
  const el = $('status');
  el.textContent = msg ?? '';
  el.style.color = isError ? '#f43f5e' : '#a1a1aa';
}

function loadConfig() {
  chrome.storage.local.get([STORAGE_KEY], (res) => {
    const cfg = res[STORAGE_KEY] ?? {};
    $('url').value = cfg.ingestUrl ?? '';
    $('token').value = cfg.token ?? '';
    setStatus(cfg.token ? 'Konfiguriert.' : 'Noch nicht konfiguriert.');
  });
}

function saveConfig() {
  const ingestUrl = $('url').value.trim();
  const token = $('token').value.trim();
  if (!/^https:\/\/.+\/functions\/v1\/governance-ingest$/.test(ingestUrl)) {
    setStatus('Ingest-URL muss /functions/v1/governance-ingest enden.', true);
    return;
  }
  if (!token.startsWith('rsd_gov_')) {
    setStatus('Token muss mit rsd_gov_ beginnen.', true);
    return;
  }
  chrome.storage.local.set({ [STORAGE_KEY]: { ingestUrl, token } }, () => {
    setStatus('Gespeichert.');
  });
}

function severityClass(level) {
  return level || 'info';
}

function renderEvents(events) {
  const wrap = $('events');
  if (!events || events.length === 0) {
    wrap.innerHTML = '<div class="empty">Noch keine Events erfasst.</div>';
    return;
  }
  wrap.innerHTML = '';
  events.slice().reverse().slice(0, 20).forEach((e) => {
    const div = document.createElement('div');
    div.className = 'event';
    const lvl = severityClass(e.risk_level);
    div.innerHTML = `
      <span class="badge ${lvl}">${e.risk_level ?? 'info'}</span>
      <span class="badge info">${escapeHtml(e.event_source ?? '')}</span>
      <div class="title">${escapeHtml(e.title ?? e.event_type ?? '')}</div>
      ${e.summary ? `<div class="summary">${escapeHtml(e.summary)}</div>` : ''}
    `;
    wrap.appendChild(div);
  });
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function refreshBuffer() {
  chrome.runtime.sendMessage({ type: 'rsd:get_buffer' }, (r) => {
    if (chrome.runtime.lastError) return;
    renderEvents(r?.events ?? []);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadConfig();
  refreshBuffer();

  $('save').addEventListener('click', saveConfig);
  $('flush').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'rsd:flush' }, () => {
      setStatus('Flush versucht.');
      setTimeout(refreshBuffer, 600);
    });
  });
  $('clear').addEventListener('click', () => {
    chrome.storage.local.set({ rsd_governance_buffer: [] }, () => {
      setStatus('Buffer geleert.');
      refreshBuffer();
    });
  });

  // Link to the SaaS dashboard
  $('dash').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://realsyncdynamicsai.de/governance-runtime' });
  });
});
