// RealSyncDynamics Governance — Page-World Injected Script
//
// Runs at document_start in the page's MAIN world via manifest
// content_scripts entry with "world": "MAIN". Patches the page's
// own window.fetch, XMLHttpRequest.prototype.open and document.cookie
// setter — none of which would be observable from the isolated
// content-script world.
//
// Because MAIN world has no access to chrome.runtime, this script
// hands events back to the isolated content.js via window.postMessage.
// The isolated bridge then forwards to the service worker.

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

  const pageUrl = location.href;
  const pageOrigin = location.origin;

  function hostFromUrl(u) {
    try { return new URL(u, pageUrl).host; } catch { return null; }
  }
  function isAiHost(host) {
    return AI_HOSTS.some((h) => host.endsWith(h));
  }

  /** Hand event to the ISOLATED-world bridge. */
  function emit(event) {
    try {
      window.postMessage({ __rsdGovernance: true, event }, pageOrigin);
    } catch { /* ignore */ }
  }

  // ── fetch / XHR to AI-vendor hosts ─────────────────────────
  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      const url = typeof input === 'string' ? input : input?.url;
      const host = url ? hostFromUrl(url) : null;
      if (host && isAiHost(host)) {
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
      if (host && isAiHost(host)) {
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

  // ── Cookies set without recognised consent ─────────────────
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
