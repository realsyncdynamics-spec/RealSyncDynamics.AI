// Pure-function mirror of Shopify scanner utilities — kept in
// src/features/shopify so it can be unit-tested with Vitest (the
// canonical implementations under supabase/functions/_shared/ use
// Deno-specific imports and aren't directly importable from Vitest).
//
// Keep these in sync with the Edge-Function versions. If you change
// scoring weights or vendor regexes, change BOTH files and add a test.

const ALLOWED_SCOPES = new Set([
  'read_themes',
  'read_content',
  'read_products',
  'read_script_tags',
  'read_pixels',
]);

export function normalizeShopDomain(input: string): string | null {
  if (!input) return null;
  let s = input.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(s)) return null;
  return s;
}

export function validateScopes(raw: string): string[] {
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  for (const p of parts) {
    if (!ALLOWED_SCOPES.has(p)) throw new Error(`scope not allowed: ${p}`);
  }
  return parts;
}

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export function calculateShopifyScore(findings: Array<{ severity: Severity }>): number {
  let score = 100;
  for (const f of findings) {
    if (f.severity === 'critical') score -= 25;
    else if (f.severity === 'high') score -= 15;
    else if (f.severity === 'medium') score -= 8;
    else score -= 3;
  }
  return Math.max(0, score);
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

export function detectVendors(html: string): string[] {
  const out = new Set<string>();
  for (const t of TRACKER_PATTERNS) {
    if (t.pattern.test(html)) out.add(t.label);
  }
  return [...out];
}

export interface DriftScanShape {
  score: number;
  findings: Array<{ id: string; severity: Severity }>;
  evidence: {
    scannedUrls: string[];
    headers: Record<string, Record<string, string>>;
    detectedVendors: string[];
    consentSignals: string[];
  };
}

export interface DriftEvent {
  type:
    | 'new_tracker'
    | 'new_external_script_host'
    | 'lost_security_header'
    | 'score_drop'
    | 'new_high_finding'
    | 'lost_consent_signal';
  severity: Severity;
  title: string;
  description: string;
}

export function compareShopifyScans(
  previous: DriftScanShape | null,
  current: DriftScanShape,
): DriftEvent[] {
  const out: DriftEvent[] = [];
  if (!previous) return out;

  const prevVendors = new Set(previous.evidence.detectedVendors);
  for (const v of current.evidence.detectedVendors) {
    if (!prevVendors.has(v)) {
      out.push({
        type: 'new_tracker',
        severity: 'high',
        title: `Neuer Tracker erkannt: ${v}`,
        description: `Vendor-Signal "${v}" war im vorherigen Scan nicht da.`,
      });
    }
  }

  const prevSignals = new Set(previous.evidence.consentSignals);
  const curSignals = new Set(current.evidence.consentSignals);
  for (const s of prevSignals) {
    if (!curSignals.has(s)) {
      out.push({
        type: 'lost_consent_signal',
        severity: 'high',
        title: `Consent-Signal verschwunden: ${s}`,
        description: `"${s}" war vorher vorhanden, fehlt jetzt.`,
      });
    }
  }

  for (const url of current.evidence.scannedUrls) {
    const prevH = previous.evidence.headers[url] ?? {};
    const curH = current.evidence.headers[url] ?? {};
    for (const h of ['strict-transport-security', 'content-security-policy', 'x-content-type-options', 'referrer-policy', 'permissions-policy']) {
      if (prevH[h] && !curH[h]) {
        out.push({
          type: 'lost_security_header',
          severity: 'medium',
          title: `Security-Header verloren: ${h}`,
          description: `${h} war vorher auf ${url} gesetzt.`,
        });
      }
    }
  }

  if (current.score < previous.score - 10) {
    out.push({
      type: 'score_drop',
      severity: 'high',
      title: `Score-Drop um ${previous.score - current.score} Punkte`,
      description: `Score sank von ${previous.score} auf ${current.score}.`,
    });
  }

  const prevIds = new Set(previous.findings.map((f) => f.id));
  for (const f of current.findings) {
    if ((f.severity === 'high' || f.severity === 'critical') && !prevIds.has(f.id)) {
      out.push({
        type: 'new_high_finding',
        severity: f.severity,
        title: `Neuer ${f.severity}-Befund: ${f.id}`,
        description: `id ${f.id}`,
      });
    }
  }

  return out;
}
