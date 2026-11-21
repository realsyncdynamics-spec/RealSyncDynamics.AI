// RealSyncDynamics Governance — Service Worker (MV3)
//
// Receives event payloads from the content-script via
// chrome.runtime.sendMessage and forwards them to the tenant's
// Governance Telemetry Ingestion API (PR #135):
//
//   POST https://<project>.supabase.co/functions/v1/governance-ingest
//   Authorization: Bearer rsd_gov_<token>
//
// Token + ingest URL come from chrome.storage.local (set via the
// popup UI on first install). Without configured token, events
// are buffered locally and dropped silently — never POSTed.
//
// Der Decision-Gate nutzt einen anderen Speicher und einen anderen
// Key (rsd_gateway_config). rsd_gov_ geht nie an /api/decide.

import { verdictFromGateway } from "./gate.js";

const STORAGE_KEY = 'rsd_governance_config';
const GATEWAY_KEY = 'rsd_gateway_config';
const BUFFER_KEY = 'rsd_governance_buffer';
const MAX_BUFFER = 200;
const FLUSH_INTERVAL_MS = 15_000;

/** @returns {Promise<{ token?: string, ingestUrl?: string }>} */
async function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (res) => {
      resolve(res[STORAGE_KEY] ?? {});
    });
  });
}

async function pushBuffer(event) {
  const all = await new Promise((res) =>
    chrome.storage.local.get([BUFFER_KEY], (r) => res(r[BUFFER_KEY] ?? [])),
  );
  all.push(event);
  while (all.length > MAX_BUFFER) all.shift();
  await new Promise((res) =>
    chrome.storage.local.set({ [BUFFER_KEY]: all }, res),
  );
}

async function readBuffer() {
  return new Promise((res) =>
    chrome.storage.local.get([BUFFER_KEY], (r) => res(r[BUFFER_KEY] ?? [])),
  );
}

async function clearBuffer() {
  await new Promise((res) =>
    chrome.storage.local.set({ [BUFFER_KEY]: [] }, res),
  );
}

async function flush() {
  const cfg = await getConfig();
  if (!cfg.token || !cfg.ingestUrl) return;
  const events = await readBuffer();
  if (events.length === 0) return;
  try {
    const res = await fetch(cfg.ingestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.token}`,
      },
      body: JSON.stringify({
        events: events.map((e) => ({ event: e })),
      }),
    });
    if (res.ok) {
      await clearBuffer();
    }
    // On failure we keep the buffer for the next flush cycle.
  } catch {
    /* network blip — retain buffer */
  }
}

async function getGateway() {
  return new Promise((resolve) => {
    chrome.storage.local.get([GATEWAY_KEY], (res) => {
      resolve(res[GATEWAY_KEY] ?? {});
    });
  });
}

async function decideFetch(req) {
  const cfg = await getGateway();
  if (!cfg.token || !cfg.gatewayUrl) return { proceed: false, reason: "unconfigured" };
  if (String(cfg.token).startsWith("rsd_gov_")) return { proceed: false, reason: "wrong-token" };
  if (String(cfg.gatewayUrl).includes("governance-ingest")) return { proceed: false, reason: "wrong-endpoint" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1200);
  try {
    const res = await fetch(`${String(cfg.gatewayUrl).replace(/\/$/, "")}/api/decide`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.token}`,
        "Idempotency-Key": String(req.id),
      },
      body: JSON.stringify({
        intent: "browser.fetch",
        source: "extension",
        payload: {
          url: req.url,
          method: req.method,
          host: req.host,
        },
      }),
    });
    let body = null;
    try { body = await res.json(); } catch { body = null; }
    return verdictFromGateway(res.status, body);
  } catch {
    return { proceed: false, reason: "network" };
  } finally {
    clearTimeout(timer);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  // Periodic flush — Service-Worker may sleep, but webNavigation /
  // content-script events will wake it and the next flush runs.
  setInterval(flush, FLUSH_INTERVAL_MS);
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'rsd:event' && msg.event) {
    pushBuffer(msg.event).then(() => {
      // Best-effort immediate flush; don't await
      flush();
      sendResponse({ ok: true });
    });
    return true; // async response
  }
  if (msg?.type === 'rsd:flush') {
    flush().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === 'rsd:get_buffer') {
    readBuffer().then((events) => sendResponse({ ok: true, events }));
    return true;
  }
  if (msg?.type === 'rsd:decide' && msg.decide && typeof msg.decide.id === 'string') {
    decideFetch(msg.decide).then((result) => sendResponse(result));
    return true;
  }
});

chrome.webNavigation.onCompleted.addListener(() => {
  // Wake-up trigger so the periodic flush fires reliably even after
  // SW suspension.
  flush();
});
