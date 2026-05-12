// RealSyncDynamics Governance — Content Script
//
// Runs at document_start on every page. Detects:
//
//   1. <script> insertions from new origins (potential trackers)
//   2. outbound fetch / XHR calls to known AI-vendor hostnames
//   3. cookies set before a recognised consent signal
//
// For each finding it emits a structured event to the
// extension's service-worker via chrome.runtime.sendMessage. The
// worker batches + ships them to /functions/v1/governance-ingest.

(() => {
  'use strict';

  const AI_HOSTS = [
    'api.openai.com',
    'api.anthropic.com',
    'generativelanguage.googleapis.com',
    'api.mistral.ai',
    'api.cohere.com',
    'api.together.xyz',
    'api.perplexity.ai',
    'api.deepseek.com',
  ];

  const TRACKER_HOSTS = [
    'www.googletagmanager.com',
    'www.google-analytics.com',
    'connect.facebook.net',
    'static.hotjar.com',
    'cdn.matomo.cloud',
    'cdn.segment.com',
    'js.hs-scripts.com',
    'static.cloudflareinsights.com',
  ];

  const pageUrl = location.href;
  const pageOrigin = location.origin;

  /** Send a fire-and-forget event to the service worker. */
  function emit(event) {
    try {
      chrome.runtime.sendMessage({ type: 'rsd:event', event });
    } catch {
      /* extension context invalidated — ignore */
    }
  }

  function classifyHost(host) {
    if (AI_HOSTS.some((h) => host.endsWith(h)))      return 'ai_vendor';
    if (TRACKER_HOSTS.some((h) => host.endsWith(h))) return 'tracker';
    return null;
  }

  function hostFromUrl(u) {
    try { return new URL(u, pageUrl).host; } catch { return null; }
  }

  // ── 1) Script-tag insertions ───────────────────────────────
  const seenScriptHosts = new Set();
  function inspectScript(node) {
    const src = node.getAttribute?.('src');
    if (!src) return;
    const host = hostFromUrl(src);
    if (!host || host === location.host) return;
    const kind = classifyHost(host);
    if (!kind) return;
    if (seenScriptHosts.has(host)) return;
    seenScriptHosts.add(host);
    emit({
      event_type: kind === 'tracker' ? 'scanner.tracker_added' : 'scanner.ai_script_added',
      event_source: 'browser_extension',
      title: `${kind === 'tracker' ? 'Tracker' : 'AI script'} detected: ${host}`,
      summary: `Page ${pageOrigin} loaded a ${kind === 'tracker' ? 'tracking' : 'AI-vendor'} script from ${host}.`,
      risk_level: kind === 'tracker' ? 'medium' : 'high',
      vendor: host,
      data_types: kind === 'tracker' ? ['cookie_ids', 'ip_address'] : ['prompt_text'],
      policy_action: 'warn',
      payload: { url: pageUrl, script: src },
    });
  }

  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const n of m.addedNodes) {
        if (n.nodeType === 1 && n.tagName === 'SCRIPT') inspectScript(n);
      }
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // Initial scan for scripts already in the DOM at document_start
  document.querySelectorAll('script[src]').forEach(inspectScript);

  // ── 2) fetch / XHR to AI-vendor hosts ──────────────────────
  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      const url = typeof input === 'string' ? input : input.url;
      const host = hostFromUrl(url);
      if (host && classifyHost(host) === 'ai_vendor') {
        emit({
          event_type: 'agent.runtime.call',
          event_source: 'browser_extension',
          title: `Outbound AI call: ${host}`,
          summary: `Page ${pageOrigin} called ${host} from in-browser fetch.`,
          risk_level: 'high',
          vendor: host,
          data_types: ['prompt_text'],
          policy_action: 'warn',
          payload: { url, method: (init?.method ?? 'GET').toUpperCase() },
        });
      }
    } catch { /* ignore */ }
    return origFetch.apply(this, arguments);
  };

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    try {
      const host = hostFromUrl(url);
      if (host && classifyHost(host) === 'ai_vendor') {
        emit({
          event_type: 'agent.runtime.call',
          event_source: 'browser_extension',
          title: `Outbound AI call (XHR): ${host}`,
          summary: `Page ${pageOrigin} called ${host} from in-browser XHR.`,
          risk_level: 'high',
          vendor: host,
          data_types: ['prompt_text'],
          policy_action: 'warn',
          payload: { url, method },
        });
      }
    } catch { /* ignore */ }
    return origOpen.apply(this, arguments);
  };

  // ── 3) Cookies set without recognised consent ──────────────
  // Heuristic: if a non-essential cookie is written and no
  // recognised consent cookie / window flag is present, flag it.
  // Recognised consent signals:
  //   - cookie named CookieConsent / OptanonConsent / borlabs-cookie
  //   - window.__cmpapi / __tcfapi
  const CONSENT_COOKIES = /(CookieConsent|OptanonConsent|borlabs-cookie|cookie_consent)/i;
  function hasConsentSignal() {
    if (CONSENT_COOKIES.test(document.cookie)) return true;
    if (typeof window.__tcfapi === 'function')  return true;
    if (typeof window.__cmpapi === 'function')  return true;
    return false;
  }
  const cookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
  if (cookieDesc?.set) {
    const origSet = cookieDesc.set;
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: cookieDesc.get,
      set(value) {
        try {
          if (!hasConsentSignal() && /=/.test(value)) {
            const name = String(value).split('=')[0];
            // Only flag what looks like tracking / analytics cookies
            if (/^(_ga|_gid|_gcl|_fbp|_hjid|hubspot|_mkto)/i.test(name)) {
              emit({
                event_type: 'cookie.before_consent',
                event_source: 'browser_extension',
                title: `Cookie set before consent: ${name}`,
                summary: `Page ${pageOrigin} set ${name} without a recognised consent signal.`,
                risk_level: 'high',
                vendor: null,
                data_types: ['cookie_ids', 'ip_address'],
                policy_action: 'warn',
                payload: { cookie_name: name, url: pageUrl },
              });
            }
          }
        } catch { /* ignore */ }
        return origSet.call(this, value);
      },
    });
  }
})();
