/**
 * RealSyncDynamics Cookie-Consent SDK v1.0
 *
 * BfDI-Leitlinie 2024 + § 25 TTDSG konformer Cookie-Banner.
 * Drei gleichberechtigte Buttons (Accept · Reject · Customize), kein Dark-Pattern.
 *
 * Embed:
 *   <script src="https://realsyncdynamicsai.de/sdk/cookie-consent.js"
 *           data-rsd-key="rsd_xxxxxxxxxxxx"
 *           defer></script>
 *
 * Lizenz: 49€/Monat — siehe https://realsyncdynamicsai.de/cookie-consent-sdk
 *
 * @license Apache-2.0
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'rsd-cookie-consent-v1';
  const SCRIPT_TAG = document.currentScript || document.querySelector('script[data-rsd-key]');
  const API_KEY = SCRIPT_TAG?.getAttribute('data-rsd-key') ?? null;
  const POSITION = SCRIPT_TAG?.getAttribute('data-rsd-position') ?? 'bottom';
  const LANG = (document.documentElement.lang || 'de').toLowerCase().slice(0, 2);

  const I18N = {
    de: {
      title: 'Datenschutz auf dieser Website',
      body: 'Wir setzen technisch notwendige Cookies. Optional Statistik + Marketing nach Deiner Einwilligung. Mehr in der Datenschutzerklärung.',
      accept: 'Alles akzeptieren',
      reject: 'Alle ablehnen',
      customize: 'Einstellungen',
      necessary: 'Notwendig',
      necessary_desc: 'Login, Session, CSRF. Ohne diese funktioniert die Site nicht.',
      analytics: 'Statistik',
      analytics_desc: 'Anonyme Nutzungs-Statistik.',
      marketing: 'Marketing',
      marketing_desc: 'Tracking für Re-Marketing-Pixel.',
      save: 'Auswahl speichern',
      back: 'Zurück',
      footer: 'Verarbeitung gemäß § 25 TTDSG · powered by RealSyncDynamics.AI',
    },
    en: {
      title: 'Privacy on this site',
      body: 'We set technically necessary cookies. Statistics + marketing only with your consent.',
      accept: 'Accept all', reject: 'Reject all', customize: 'Settings',
      necessary: 'Necessary', necessary_desc: 'Login, session, CSRF — required.',
      analytics: 'Analytics', analytics_desc: 'Anonymous usage stats.',
      marketing: 'Marketing', marketing_desc: 'Re-marketing pixels.',
      save: 'Save choice', back: 'Back',
      footer: 'Processing per GDPR Art. 7 · powered by RealSyncDynamics.AI',
    },
  };
  const t = I18N[LANG] || I18N.de;

  function readConsent() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
    catch { return null; }
  }

  function saveConsent(c) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)); } catch {}
    document.body?.removeChild(document.getElementById('rsd-cc-root'));
    if (API_KEY) {
      // Telemetry-back to RSD (decoupled — fails silent)
      fetch('https://realsyncdynamicsai.de/api/cookie-consent-event', {
        method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: API_KEY,
          host: location.hostname,
          consent: { necessary: true, analytics: c.analytics, marketing: c.marketing },
        }),
      }).catch(() => {});
    }
    window.dispatchEvent(new CustomEvent('rsd-consent-updated', { detail: c }));
  }

  function render() {
    if (readConsent()) return; // user already decided
    const root = document.createElement('div');
    root.id = 'rsd-cc-root';
    root.innerHTML = `
      <style>
        #rsd-cc-root * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif; }
        #rsd-cc-root { position: fixed; ${POSITION}: 0; left: 0; right: 0; z-index: 999999; padding: 16px; }
        .rsd-cc-card { max-width: 720px; margin: 0 auto; background: #ffffff; border: 1px solid #d4d4d8; box-shadow: 0 8px 24px rgba(0,0,0,0.12); padding: 18px 20px; }
        .rsd-cc-row { display: flex; gap: 12px; align-items: flex-start; }
        .rsd-cc-icon { flex: 0 0 36px; height: 36px; background: linear-gradient(135deg,#f59e0b,#ea580c); border-radius: 0; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; }
        .rsd-cc-title { font-weight: 700; color: #18181b; margin: 0 0 6px; font-size: 14px; }
        .rsd-cc-body { font-size: 12px; color: #52525b; margin: 0 0 12px; line-height: 1.5; }
        .rsd-cc-buttons { display: flex; flex-wrap: wrap; gap: 8px; }
        .rsd-cc-btn { padding: 9px 16px; font-size: 12px; font-weight: 700; border: 0; cursor: pointer; border-radius: 0; }
        .rsd-cc-btn-primary { background: #0284c7; color: white; }
        .rsd-cc-btn-secondary { background: #52525b; color: white; }
        .rsd-cc-btn-tertiary { background: #fafafa; border: 1px solid #d4d4d8; color: #18181b; }
        .rsd-cc-btn:hover { opacity: 0.9; }
        .rsd-cc-cat { display: flex; gap: 12px; padding: 8px; border: 1px solid #e4e4e7; margin-bottom: 6px; }
        .rsd-cc-cat-name { font-weight: 700; font-size: 12px; color: #18181b; }
        .rsd-cc-cat-desc { font-size: 11px; color: #71717a; margin-top: 2px; }
        .rsd-cc-foot { font-size: 10px; color: #a1a1aa; margin-top: 10px; }
      </style>
      <div class="rsd-cc-card" role="dialog" aria-labelledby="rsd-cc-title">
        <div class="rsd-cc-row">
          <div class="rsd-cc-icon" aria-hidden="true">🍪</div>
          <div style="flex:1">
            <h2 id="rsd-cc-title" class="rsd-cc-title">${t.title}</h2>
            <p class="rsd-cc-body">${t.body}</p>
            <div class="rsd-cc-default-view">
              <div class="rsd-cc-buttons">
                <button class="rsd-cc-btn rsd-cc-btn-primary" data-rsd-action="accept">${t.accept}</button>
                <button class="rsd-cc-btn rsd-cc-btn-secondary" data-rsd-action="reject">${t.reject}</button>
                <button class="rsd-cc-btn rsd-cc-btn-tertiary" data-rsd-action="customize">${t.customize}</button>
              </div>
            </div>
            <div class="rsd-cc-customize-view" style="display:none">
              <label class="rsd-cc-cat">
                <input type="checkbox" checked disabled />
                <div><div class="rsd-cc-cat-name">${t.necessary}</div><div class="rsd-cc-cat-desc">${t.necessary_desc}</div></div>
              </label>
              <label class="rsd-cc-cat">
                <input type="checkbox" data-rsd-cat="analytics" />
                <div><div class="rsd-cc-cat-name">${t.analytics}</div><div class="rsd-cc-cat-desc">${t.analytics_desc}</div></div>
              </label>
              <label class="rsd-cc-cat">
                <input type="checkbox" data-rsd-cat="marketing" />
                <div><div class="rsd-cc-cat-name">${t.marketing}</div><div class="rsd-cc-cat-desc">${t.marketing_desc}</div></div>
              </label>
              <div class="rsd-cc-buttons" style="margin-top:8px">
                <button class="rsd-cc-btn rsd-cc-btn-primary" data-rsd-action="save-custom">${t.save}</button>
                <button class="rsd-cc-btn rsd-cc-btn-tertiary" data-rsd-action="back">${t.back}</button>
              </div>
            </div>
            <div class="rsd-cc-foot">${t.footer}</div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(root);

    const defaultView = root.querySelector('.rsd-cc-default-view');
    const customView = root.querySelector('.rsd-cc-customize-view');

    root.addEventListener('click', (e) => {
      const action = e.target.getAttribute?.('data-rsd-action');
      if (!action) return;
      if (action === 'accept')   saveConsent({ necessary: true, analytics: true, marketing: true, decided_at: new Date().toISOString() });
      if (action === 'reject')   saveConsent({ necessary: true, analytics: false, marketing: false, decided_at: new Date().toISOString() });
      if (action === 'customize'){ defaultView.style.display = 'none'; customView.style.display = 'block'; }
      if (action === 'back')     { defaultView.style.display = 'block'; customView.style.display = 'none'; }
      if (action === 'save-custom') {
        const a = root.querySelector('[data-rsd-cat="analytics"]')?.checked || false;
        const m = root.querySelector('[data-rsd-cat="marketing"]')?.checked || false;
        saveConsent({ necessary: true, analytics: a, marketing: m, decided_at: new Date().toISOString() });
      }
    });
  }

  // Public API
  window.RsdConsent = {
    get: readConsent,
    reopen: () => { localStorage.removeItem(STORAGE_KEY); render(); },
    on: (event, cb) => window.addEventListener('rsd-consent-' + event, cb),
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
