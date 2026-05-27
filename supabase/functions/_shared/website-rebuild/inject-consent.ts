// Step 5 — inject_consent: Cookie-Consent-Banner-SDK ins <head> einbetten.
//
// Verwendet das eigene RealSync-Consent-SDK (siehe /cookie-consent-sdk).
// Konfiguration leitet sich aus dem Audit-Report ab — Tracker, die nach
// Step strip_trackers noch übrig sind (z. B. eigene Marketing-Cookies),
// bekommen einen entsprechenden Consent-Eintrag.

interface ConsentConfig {
  domain: string;
  primaryLang: 'de' | 'en';
  showImprintLink: boolean;
  privacyPolicyUrl: string;
  imprintUrl: string;
}

export function injectConsentSdk(html: string, cfg: ConsentConfig): string {
  const sdkSnippet = renderConsentSnippet(cfg);

  // Vor dem schließenden </head> einfügen; Fallback an den Anfang von <body>
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${sdkSnippet}\n</head>`);
  }
  return html.replace(/<body([^>]*)>/i, `<body$1>\n${sdkSnippet}`);
}

function renderConsentSnippet(cfg: ConsentConfig): string {
  return `<!-- RealSync Cookie-Consent — DSGVO Art. 7 + TTDSG §25 -->
<script defer src="https://realsyncdynamicsai.de/sdk/cookie-consent.js"
  data-domain="${cfg.domain}"
  data-lang="${cfg.primaryLang}"
  data-privacy-url="${cfg.privacyPolicyUrl}"
  data-imprint-url="${cfg.imprintUrl}"
  data-consent-mode="opt-in"
  data-deny-non-essential-by-default="true"
></script>`;
}
