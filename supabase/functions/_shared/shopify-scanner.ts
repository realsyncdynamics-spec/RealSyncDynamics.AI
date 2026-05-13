// Shopify storefront scanner. Fetches public URLs of the shop, parses
// raw HTML, inspects HTTP response headers, returns a structured result.
//
// Scope notes:
//   - Public surface only. No authenticated admin scraping here.
//   - No JS execution. Pre-consent risk is therefore detected as
//     "possible_pre_consent_tracking" (defensive wording) when a
//     known tracker host appears in the initial HTML and no consent
//     gate is detected — never as an absolute claim.

export interface ShopifyFinding {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  evidence: {
    url?: string;
    header?: string;
    scriptSrc?: string;
    cookieName?: string;
    raw?: string;
  };
  recommendation: string;
}

export interface ShopifyScanResult {
  score: number;
  summary: string;
  findings: ShopifyFinding[];
  evidence: {
    scannedUrls: string[];
    headers: Record<string, Record<string, string>>;
    detectedVendors: string[];
    consentSignals: string[];
  };
}

const TRACKER_PATTERNS: Array<{ id: string; label: string; pattern: RegExp }> = [
  { id: 'gtag',           label: 'Google Analytics / gtag.js', pattern: /(?:googletagmanager\.com\/gtag\/js|google-analytics\.com\/(?:ga\.js|analytics\.js|gtag))/i },
  { id: 'gtm',            label: 'Google Tag Manager',         pattern: /googletagmanager\.com\/gtm\.js/i },
  { id: 'meta_pixel',     label: 'Meta (Facebook) Pixel',      pattern: /(?:connect\.facebook\.net\/[^"']+\/fbevents\.js|fbq\s*\()/i },
  { id: 'tiktok_pixel',   label: 'TikTok Pixel',               pattern: /analytics\.tiktok\.com\/i18n\/pixel/i },
  { id: 'klaviyo',        label: 'Klaviyo',                    pattern: /klaviyo\.com\/onsite\/js/i },
  { id: 'hotjar',         label: 'Hotjar',                     pattern: /static\.hotjar\.com\/c\/hotjar/i },
  { id: 'pinterest',      label: 'Pinterest Tag',              pattern: /s\.pinimg\.com\/ct\/core\.js/i },
  { id: 'linkedin',       label: 'LinkedIn Insight Tag',       pattern: /snap\.licdn\.com\/li\.lms-analytics/i },
  { id: 'ms_clarity',     label: 'Microsoft Clarity',          pattern: /(?:clarity\.ms\/tag|microsoft-clarity)/i },
];

const CONSENT_SIGNALS: Array<{ id: string; label: string; pattern: RegExp }> = [
  { id: 'onetrust',        label: 'OneTrust',                  pattern: /(?:cdn\.cookielaw\.org|otBannerSdk)/i },
  { id: 'cookiebot',       label: 'Cookiebot',                 pattern: /consent\.cookiebot\.com/i },
  { id: 'usercentrics',    label: 'Usercentrics',              pattern: /(?:app\.usercentrics\.eu|window\.UC_UI)/i },
  { id: 'shopify_privacy', label: 'Shopify Customer Privacy',  pattern: /Shopify\.customerPrivacy/i },
  { id: 'cookieyes',       label: 'CookieYes',                 pattern: /cdn-cookieyes\.com/i },
];

const SECURITY_HEADERS = [
  'strict-transport-security',
  'content-security-policy',
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
] as const;

export async function runShopifyStorefrontScan(input: { shopDomain: string }): Promise<ShopifyScanResult> {
  const base = `https://${input.shopDomain}`;
  const urls = [base + '/', base + '/cart', base + '/collections/all'];

  const findings: ShopifyFinding[] = [];
  const headers: Record<string, Record<string, string>> = {};
  const detectedVendors = new Set<string>();
  const detectedConsentSignals = new Set<string>();

  for (const url of urls) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      const respHeaders: Record<string, string> = {};
      for (const [k, v] of res.headers.entries()) respHeaders[k.toLowerCase()] = v;
      headers[url] = respHeaders;
      const html = await res.text();

      // HTTPS check (after redirects)
      if (!res.url.startsWith('https://')) {
        findings.push({
          id: `https-${url}`,
          type: 'transport',
          severity: 'high',
          title: 'HTTPS nicht erzwungen',
          description: `${url} antwortet nicht über HTTPS oder leitet auf HTTP weiter.`,
          evidence: { url: res.url },
          recommendation: 'Force-HTTPS auf Domain-Ebene aktivieren + HSTS-Header setzen.',
        });
      }

      // Security headers
      for (const h of SECURITY_HEADERS) {
        if (!respHeaders[h]) {
          findings.push({
            id: `header-${h}-${url}`,
            type: 'security_header',
            severity: h === 'strict-transport-security' || h === 'content-security-policy' ? 'high' : 'medium',
            title: `Fehlender Header: ${h}`,
            description: `${url} liefert keinen ${h}-Header.`,
            evidence: { url, header: h },
            recommendation: `${h}-Header über Shopify Theme-Layout oder via Cloudflare-Worker setzen.`,
          });
        }
      }

      // Cookie flags (storefront Set-Cookie)
      const setCookieAll = res.headers.get('set-cookie') ?? '';
      if (setCookieAll && !/Secure/i.test(setCookieAll)) {
        findings.push({
          id: `cookie-secure-${url}`,
          type: 'cookie_flag',
          severity: 'medium',
          title: 'Cookies ohne Secure-Flag',
          description: `${url} setzt mind. ein Cookie ohne Secure.`,
          evidence: { url, header: 'set-cookie', raw: setCookieAll.slice(0, 200) },
          recommendation: 'Cookies mit Secure + SameSite=Lax/Strict ausliefern.',
        });
      }
      if (setCookieAll && !/HttpOnly/i.test(setCookieAll)) {
        findings.push({
          id: `cookie-httponly-${url}`,
          type: 'cookie_flag',
          severity: 'low',
          title: 'Cookies ohne HttpOnly-Flag',
          description: `${url} setzt mind. ein Cookie ohne HttpOnly.`,
          evidence: { url, header: 'set-cookie', raw: setCookieAll.slice(0, 200) },
          recommendation: 'Session-/Auth-Cookies sollten HttpOnly tragen, Tracking-Cookies können bewusst ausgenommen sein.',
        });
      }

      // Trackers
      for (const t of TRACKER_PATTERNS) {
        if (t.pattern.test(html)) {
          detectedVendors.add(t.label);
        }
      }

      // Consent signals
      for (const c of CONSENT_SIGNALS) {
        if (c.pattern.test(html)) detectedConsentSignals.add(c.label);
      }
    } catch (e) {
      findings.push({
        id: `fetch-error-${url}`,
        type: 'unreachable',
        severity: 'medium',
        title: 'URL nicht erreichbar',
        description: `${url} konnte nicht geladen werden: ${(e as Error).message}`,
        evidence: { url },
        recommendation: 'Domain + DNS prüfen; ggf. Storefront-Passwort entfernen für den Scan.',
      });
    }
  }

  // Pre-consent risk: defensive labelling
  if (detectedVendors.size > 0 && detectedConsentSignals.size === 0) {
    for (const v of detectedVendors) {
      findings.push({
        id: `possible-preconsent-${v}`,
        type: 'possible_pre_consent_tracking',
        severity: 'high',
        title: `Möglicherweise Pre-Consent-Tracking: ${v}`,
        description: `${v} wurde im initialen HTML erkannt, aber kein bekanntes Consent-Gate (OneTrust / Cookiebot / Usercentrics / Shopify Customer Privacy / CookieYes). Dies kann auf Tracking vor Einwilligung hindeuten; eine endgültige Bewertung erfordert eine Headless-Browser-Analyse mit aktiviertem JS und Beobachtung der tatsächlichen Network-Calls.`,
        evidence: { raw: v },
        recommendation: 'Consent-Wrapper einsetzen (Shopify Customer Privacy API oder externes CMP) und Tracker via web-pixel-extension mit Consent-Subscription registrieren.',
      });
    }
  }

  // Score
  let score = 100;
  for (const f of findings) {
    if (f.severity === 'critical') score -= 25;
    else if (f.severity === 'high') score -= 15;
    else if (f.severity === 'medium') score -= 8;
    else score -= 3;
  }
  if (score < 0) score = 0;

  const summary = findings.length === 0
    ? `Sauber. ${detectedVendors.size} Vendor-Signale, ${detectedConsentSignals.size} Consent-Signale.`
    : `${findings.length} Befunde — ${findings.filter((f) => f.severity === 'critical' || f.severity === 'high').length} hoch/kritisch. Vendors: ${[...detectedVendors].join(', ') || '–'}. Consent: ${[...detectedConsentSignals].join(', ') || 'keines erkannt'}.`;

  return {
    score,
    summary,
    findings,
    evidence: {
      scannedUrls: urls,
      headers,
      detectedVendors: [...detectedVendors],
      consentSignals: [...detectedConsentSignals],
    },
  };
}

// Pure functions exported for tests
export function calculateShopifyScore(findings: Array<{ severity: ShopifyFinding['severity'] }>): number {
  let score = 100;
  for (const f of findings) {
    if (f.severity === 'critical') score -= 25;
    else if (f.severity === 'high') score -= 15;
    else if (f.severity === 'medium') score -= 8;
    else score -= 3;
  }
  return Math.max(0, score);
}

export function detectVendors(html: string): string[] {
  const out = new Set<string>();
  for (const t of TRACKER_PATTERNS) {
    if (t.pattern.test(html)) out.add(t.label);
  }
  return [...out];
}
