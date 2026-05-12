// RealSyncDynamics Governance — Content Script (ISOLATED world)
//
// Two responsibilities:
//
//   1. DOM-based detection: new <script> tags from tracker / AI-vendor
//      hosts. Works fine from ISOLATED because the DOM is shared.
//
//   2. Bridge: forwards events from the MAIN-world injected.js script
//      (which hooks fetch / XHR / document.cookie — those hooks only
//      observe page-script activity when set in the same world as the
//      page) to the extension's service worker via chrome.runtime.
//
// Hooks like window.fetch must run in MAIN world to see the page's
// own calls; the previous in-this-file hooks only saw isolated-world
// fetches, which is empty in practice. See injected.js + manifest.json.

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

  // ── 2) Bridge: receive events from injected.js (MAIN world) ──
  // injected.js posts `{ __rsdGovernance: true, event }` via
  // window.postMessage to its own origin. Validate strictly: the
  // postMessage event.origin must match this page's origin AND the
  // payload must carry the magic marker. This prevents arbitrary
  // pages from poisoning the bridge.
  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    if (e.origin !== pageOrigin) return;
    const data = e.data;
    if (!data || data.__rsdGovernance !== true) return;
    const event = data.event;
    if (!event || typeof event !== 'object') return;
    emit(event);
  });
})();
