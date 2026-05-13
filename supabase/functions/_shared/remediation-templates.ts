// Remediation Templates — 5 patterns, deterministic rendering.
//
// Each template requires a fixed set of params (validated below) and
// produces a copy-paste-ready snippet with title, rationale, and
// references to the relevant regulations.

export type Pattern =
  | 'csp_header_block'
  | 'consent_wrapper'
  | 'font_self_host'
  | 'tracker_dom_remove'
  | 'dsgvo_footer_block';

export const KNOWN_PATTERNS: Pattern[] = [
  'csp_header_block',
  'consent_wrapper',
  'font_self_host',
  'tracker_dom_remove',
  'dsgvo_footer_block',
];

export interface RenderedSnippet {
  title: string;
  rationale: string;
  snippet: string;
  target_lang: 'html' | 'js' | 'css' | 'nginx' | 'apache' | 'vercel' | 'netlify' | 'wordpress' | 'shopify';
  applies_to?: string;
  references?: string[];
}

export function renderTemplate(pattern: Pattern, params: Record<string, string>): RenderedSnippet {
  switch (pattern) {
    case 'csp_header_block':     return csp(params);
    case 'consent_wrapper':      return consent(params);
    case 'font_self_host':       return fontSelfHost(params);
    case 'tracker_dom_remove':   return trackerDomRemove(params);
    case 'dsgvo_footer_block':   return dsgvoFooter(params);
  }
}

function need(params: Record<string, string>, key: string): string {
  const v = params[key];
  if (!v) throw new Error(`missing param: ${key}`);
  return v;
}

function csp(p: Record<string, string>): RenderedSnippet {
  const blockedHost = need(p, 'blocked_host');
  const target = p.target ?? 'vercel';
  let snippet: string;
  let target_lang: RenderedSnippet['target_lang'];
  let applies_to: string;

  if (target === 'vercel') {
    target_lang = 'vercel';
    applies_to = 'vercel.json (oder next.config.js headers())';
    snippet = `{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; frame-src 'none'; report-uri /api/csp-report"
        }
      ]
    }
  ]
}
// Hinweis: enthält bewusst KEINEN Allow-Eintrag für ${blockedHost}.
// Falls weitere externe Hosts erlaubt sein müssen, einzeln aufnehmen.`;
  } else if (target === 'nginx') {
    target_lang = 'nginx';
    applies_to = '/etc/nginx/sites-available/<site>.conf';
    snippet = `add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; frame-src 'none'; report-uri /csp-report" always;
# Bewusst kein ${blockedHost} im script-src oder connect-src.`;
  } else {
    target_lang = 'html';
    applies_to = '<head> der gerenderten HTML-Seiten';
    snippet = `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; frame-src 'none'">
<!-- Achtung: meta-CSP greift erst ab erstem Render. Header-CSP via Webserver bevorzugen. -->`;
  }

  return {
    title: `CSP-Block für ${blockedHost}`,
    rationale: `Tracker von ${blockedHost} wurde vor consent.granted erkannt. Ein restriktiver Content-Security-Policy-Header blockiert Lade-Versuche bereits im Browser, bevor sie ausgeführt werden — auch dann, wenn das Tag-Manager-Setup verbleibt. Stärker als clientseitiges Script-Removal.`,
    snippet,
    target_lang,
    applies_to,
    references: ['TTDSG_25', 'GDPR_ART_6', 'GDPR_ART_25'],
  };
}

function consent(p: Record<string, string>): RenderedSnippet {
  const scriptSrc = need(p, 'script_src');
  const category = p.category ?? 'analytics';
  const snippet = `<!-- Original-Script wird NICHT direkt geladen. Stattdessen als type="text/plain" -->
<!-- Erst nach Consent setzt das CMP type="text/javascript" und triggert ein erneutes Parsing. -->
<script
  type="text/plain"
  data-category="${category}"
  data-src="${scriptSrc}"
  async
></script>

<script>
// CMP-Bridge — wird von vielen CMPs (Cookiebot, Usercentrics, OneTrust, Borlabs) so erwartet.
// Wenn euer CMP eine andere API hat: data-category + data-src bleiben, Activator anpassen.
document.addEventListener('rsd:consent.granted', (e) => {
  if (!e || !e.detail || !e.detail.categories) return;
  if (!e.detail.categories.includes('${category}')) return;
  document.querySelectorAll('script[type="text/plain"][data-category="${category}"]').forEach((s) => {
    const real = document.createElement('script');
    real.async = true;
    real.src = s.getAttribute('data-src') || '';
    s.replaceWith(real);
  });
});
</script>`;
  return {
    title: `Consent-Wrapper für ${scriptSrc}`,
    rationale: `Das Script ${scriptSrc} fällt unter TTDSG §25 und braucht aktive Einwilligung vor Ausführung. Der Wrapper lädt es zunächst als type="text/plain" (Browser ignoriert es), und erst nach \`rsd:consent.granted\`-Event in der Kategorie ${category} wird es zu einem echten <script>-Tag transformiert. Funktioniert mit den 4 großen CMPs.`,
    snippet,
    target_lang: 'html',
    applies_to: 'Stelle wo das Original-Script eingebunden ist',
    references: ['TTDSG_25', 'GDPR_ART_6', 'GDPR_ART_7'],
  };
}

function fontSelfHost(p: Record<string, string>): RenderedSnippet {
  const fontFamily = p.font_family ?? 'Inter';
  const weights = p.weights ?? '400;500;600;700';
  const snippet = `/* ─── 1) Google-Fonts <link> aus dem HTML entfernen ─── */
/* <link rel="preconnect" href="https://fonts.googleapis.com"> ← weg
   <link href="https://fonts.googleapis.com/css2?family=${fontFamily}:wght@${weights}" rel="stylesheet"> ← weg */

/* ─── 2) Font selbst hosten ─── */
/* Schritt 1: Font-Dateien herunterladen
   - Open Foundry oder direkt vom Foundry-Hersteller (z. B. https://rsms.me/inter/ für Inter)
   - WOFF2 reicht in 99% der Browser
   - Ablegen unter /public/fonts/${fontFamily}/

   Schritt 2: @font-face in CSS einbauen — z. B. in src/index.css: */

@font-face {
  font-family: '${fontFamily}';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url('/fonts/${fontFamily}/${fontFamily}-variable.woff2') format('woff2-variations');
}

body { font-family: '${fontFamily}', system-ui, sans-serif; }`;
  return {
    title: `Self-Host für ${fontFamily} statt Google Fonts`,
    rationale: `Google Fonts via fonts.googleapis.com überträgt die IP-Adresse des Besuchers in die USA. Mehrere deutsche Gerichte (u. a. LG München 2022) haben dies als DSGVO-Verstoß bewertet (§6 ohne Rechtsgrundlage). Self-Hosting eliminiert den Transfer und bringt typischerweise sogar bessere Performance.`,
    snippet,
    target_lang: 'css',
    applies_to: 'HTML-Head + globale CSS-Datei',
    references: ['GDPR_ART_6', 'GDPR_ART_44', 'GDPR_ART_46'],
  };
}

function trackerDomRemove(p: Record<string, string>): RenderedSnippet {
  const trackerHost = need(p, 'tracker_host');
  const snippet = `// Notfall-Snippet — räumt einen Tracker per JS aus dem DOM, falls ein CMS-Eingriff am Markup nicht
// möglich ist. CSP-Header-Block (Pattern csp_header_block) ist die robustere Lösung.
// Dieses Snippet als <script> mit type="text/javascript" so früh wie möglich im <head> einbinden.

(function () {
  'use strict';
  var BLOCKED = '${trackerHost}';

  function stripTagsLoading(node) {
    if (!node) return;
    // 1) Wenn der Tag noch nicht ausgeführt wurde (type=plain o.ä.) — entfernen.
    var scripts = node.querySelectorAll('script[src*="' + BLOCKED + '"]');
    scripts.forEach(function (s) { s.parentNode && s.parentNode.removeChild(s); });
    // 2) Iframes desselben Hosts auch entfernen.
    var iframes = node.querySelectorAll('iframe[src*="' + BLOCKED + '"]');
    iframes.forEach(function (f) { f.parentNode && f.parentNode.removeChild(f); });
  }

  stripTagsLoading(document);

  var mo = new MutationObserver(function (muts) {
    muts.forEach(function (m) {
      m.addedNodes.forEach(function (n) {
        if (n.nodeType === 1) stripTagsLoading(n);
      });
    });
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();`;
  return {
    title: `JS-DOM-Strip für ${trackerHost}`,
    rationale: `Wenn ein Tracker via Tag Manager oder dynamisch nachgeladen wird und der CSP-Header zu invasiv wäre, kann dieses Notfall-Snippet helfen. Es entfernt <script src="*${trackerHost}*"> und gleichnamige <iframe> aus dem DOM — initial + per MutationObserver. **Robustere Lösung ist CSP-Header.**`,
    snippet,
    target_lang: 'js',
    applies_to: '<head> der HTML-Seite, so früh wie möglich',
    references: ['TTDSG_25', 'GDPR_ART_6'],
  };
}

function dsgvoFooter(p: Record<string, string>): RenderedSnippet {
  const companyName = need(p, 'company_name');
  const dpoEmail = p.dpo_email ?? 'datenschutz@example.de';
  const snippet = `<!-- DSGVO-Footer-Block — Pflichtangaben Art. 13 + 14 GDPR -->
<footer class="dsgvo-footer">
  <div class="dsgvo-footer__cols">
    <div>
      <strong>Verantwortlicher</strong><br />
      ${companyName}<br />
      Anschrift, PLZ Ort
    </div>
    <div>
      <strong>Datenschutz</strong><br />
      DSB: <a href="mailto:${dpoEmail}">${dpoEmail}</a><br />
      <a href="/datenschutz">Datenschutzerklärung</a><br />
      <a href="/avv">AVV / DPA</a>
    </div>
    <div>
      <strong>Compliance</strong><br />
      <a href="/impressum">Impressum</a><br />
      <a href="/cookie-settings">Cookie-Einstellungen</a><br />
      <a href="/sub-processors">Sub-Prozessoren</a>
    </div>
  </div>
  <p class="dsgvo-footer__notice">
    Diese Seite verwendet ausschließlich technisch notwendige Cookies sowie — nach Einwilligung —
    Analyse-/Marketing-Tools. Eure Einwilligung könnt ihr unter
    <a href="/cookie-settings">Cookie-Einstellungen</a> jederzeit anpassen oder widerrufen.
  </p>
</footer>`;
  return {
    title: `DSGVO-konformer Footer-Block`,
    rationale: `Art. 13 + 14 GDPR verlangen, dass die Identität des Verantwortlichen, die Kontaktdaten des DSB und die Wege zur Einwilligungs-Widerrufung leicht zugänglich sind. Dieser Footer-Block deckt das ab + verlinkt die typischen Detail-Seiten (Datenschutzerklärung, AVV, Impressum, Cookie-Settings, Sub-Prozessoren).`,
    snippet,
    target_lang: 'html',
    applies_to: 'Layout-Komponente, Footer-Slot',
    references: ['GDPR_ART_13', 'GDPR_ART_14', 'GDPR_ART_30'],
  };
}
