// background.js — RealSyncDynamicsAI AI Usage Monitor (MV3 service worker).
//
// Verantwortlichkeiten:
//   1. Empfaengt Events vom Content-Script (chrome.runtime.onMessage)
//   2. Forwarded sie an die Telemetry-API der Compliance-Plattform
//   3. Haelt einen lokalen Counter "Events heute" pro Vendor fuer Popup-Anzeige
//   4. Liest Tenant-Konfig aus chrome.storage.local (Endpoint + tenantKey)
//
// In v0 nicht enthalten:
//   - Blocking / Policy-Enforcement (kommt in #138)
//   - Batch-Send / Retry / Offline-Queue (kommt mit Telemetry-SDK-v2)
//   - HMAC-Signing (kommt mit tenant_api_keys-Tabelle)

const DEFAULT_ENDPOINT = 'https://realsyncdynamicsai.de/api/telemetry/ai-event';

// ─── Config Helpers ──────────────────────────────────────────────────────────

async function getConfig() {
  const stored = await chrome.storage.local.get(['endpoint', 'tenantKey', 'userTag', 'team']);
  return {
    endpoint: stored.endpoint || DEFAULT_ENDPOINT,
    tenantKey: stored.tenantKey || '',
    userTag: stored.userTag || '',
    team: stored.team || '',
  };
}

// ─── Counter (per-vendor heute) ──────────────────────────────────────────────

async function bumpCounter(vendor) {
  const today = new Date().toISOString().slice(0, 10);
  const key = `counter:${today}:${vendor}`;
  const stored = await chrome.storage.local.get(key);
  const next = (stored[key] || 0) + 1;
  await chrome.storage.local.set({ [key]: next });

  // Auch einen Total-Counter fuer Popup
  const totalKey = `counter:${today}:_total`;
  const totalStored = await chrome.storage.local.get(totalKey);
  await chrome.storage.local.set({ [totalKey]: (totalStored[totalKey] || 0) + 1 });

  // Badge aktualisieren
  const total = (totalStored[totalKey] || 0) + 1;
  if (chrome.action && typeof chrome.action.setBadgeText === 'function') {
    await chrome.action.setBadgeText({ text: total > 99 ? '99+' : String(total) });
    await chrome.action.setBadgeBackgroundColor({ color: '#D4AF37' });
  }
}

// ─── Telemetry-Send ──────────────────────────────────────────────────────────

async function sendEvent(payload) {
  const cfg = await getConfig();
  if (!cfg.tenantKey) {
    // Keine Tenant-Konfig hinterlegt -> wir loggen nur lokal, koennen aber
    // nicht an die Compliance-Plattform senden.
    return { ok: false, reason: 'NO_TENANT_KEY' };
  }

  try {
    const resp = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-rsd-tenant-key': cfg.tenantKey,
      },
      body: JSON.stringify({
        ...payload,
        user_id: cfg.userTag || undefined,
        team: cfg.team || undefined,
      }),
    });
    if (!resp.ok) {
      return { ok: false, reason: `HTTP_${resp.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e?.message || 'NETWORK_ERROR' };
  }
}

// ─── Message-Listener ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'rsd:ai-event' && msg.payload) {
    bumpCounter(msg.payload.vendor || 'unknown');
    sendEvent(msg.payload).then(sendResponse);
    return true; // async sendResponse
  }
  if (msg?.type === 'rsd:get-stats') {
    const today = new Date().toISOString().slice(0, 10);
    const prefix = `counter:${today}:`;
    chrome.storage.local.get(null).then((all) => {
      const stats = {};
      for (const [key, value] of Object.entries(all)) {
        if (key.startsWith(prefix)) stats[key.slice(prefix.length)] = value;
      }
      sendResponse(stats);
    });
    return true;
  }
  return false;
});

// ─── Install-Hook ────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Beim Erst-Install Options-Page oeffnen, damit User Tenant-Key setzen
    chrome.runtime.openOptionsPage();
  }
});
