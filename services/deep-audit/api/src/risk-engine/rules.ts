import { getDomain } from 'tldts';

// Risk engine — turns a raw scan result (requests + cookies + consent
// state) into a deterministic score + findings list. Mirrors the rule
// vocabulary of the parent platform's `_shared/rules/` but specialised
// for the Playwright deep-scan input shape.

export interface ScanRequest {
  url: string;
  method: string;
  resourceType: string;
  /** Was this request fired BEFORE the consent banner was accepted? */
  preConsent?: boolean;
}

export interface ScanCookie {
  name: string;
  domain: string | null;
  value?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
}

export interface ScanResult {
  url: string;
  cookies: ScanCookie[];
  requests: ScanRequest[];
  consent?: { found: boolean; selector?: string };
  fetched_at?: string;
}

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface RiskFinding {
  id: string;
  severity: Severity;
  issue: string;
  detail?: string;
  paragraph_ref?: string;
}

export interface RiskReport {
  score: number;            // 0..100, higher = more risk
  severity: Severity | 'pass';
  findings: RiskFinding[];
  stats: {
    total_requests: number;
    pre_consent_requests: number;
    third_party_hosts: number;
  };
}

const TRACKER_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  weight: number;
  finding: Omit<RiskFinding, 'severity'>;
  severity: Severity;
}> = [
  {
    pattern: /google-analytics\.com|googletagmanager\.com\/gtag/i,
    weight: 30,
    severity: 'critical',
    finding: {
      id: 'tracker_google_analytics',
      issue: 'Google Analytics / GTM detected',
      detail: 'GA fires personal-data requests. Must require prior consent under DSGVO Art. 6 lit. a and TTDSG §25.',
      paragraph_ref: 'DSGVO Art. 6 · TTDSG §25',
    },
  },
  {
    pattern: /connect\.facebook\.net|facebook\.com\/tr/i,
    weight: 30,
    severity: 'critical',
    finding: {
      id: 'tracker_meta_pixel',
      issue: 'Meta (Facebook) Pixel detected',
      detail: 'Meta Pixel transmits hashed user identifiers to Meta on every pageview. Requires explicit consent.',
      paragraph_ref: 'DSGVO Art. 6 · TTDSG §25',
    },
  },
  {
    pattern: /hotjar\.com|clarity\.ms/i,
    weight: 20,
    severity: 'high',
    finding: {
      id: 'tracker_session_replay',
      issue: 'Session-replay analytics detected',
      detail: 'Session replay can record keystrokes / mouse paths. High DSGVO impact, often a DPIA trigger.',
      paragraph_ref: 'DSGVO Art. 35',
    },
  },
  {
    pattern: /doubleclick\.net|googleadservices\.com|googlesyndication\.com/i,
    weight: 25,
    severity: 'high',
    finding: {
      id: 'tracker_ad_network',
      issue: 'Ad network tracker detected',
      detail: 'DoubleClick / Google Ads / AdSense share IDs across domains. Consent required.',
      paragraph_ref: 'DSGVO Art. 6 · TTDSG §25',
    },
  },
  {
    pattern: /linkedin\.com\/(px|insight)/i,
    weight: 20,
    severity: 'high',
    finding: {
      id: 'tracker_linkedin_insight',
      issue: 'LinkedIn Insight Tag detected',
      detail: 'LinkedIn Insight transmits visitor data to LinkedIn (US transfer risk). Requires consent.',
      paragraph_ref: 'DSGVO Art. 44–49',
    },
  },
  {
    pattern: /fonts\.googleapis\.com|fonts\.gstatic\.com/i,
    weight: 10,
    severity: 'medium',
    finding: {
      id: 'tracker_google_fonts',
      issue: 'Google Fonts loaded from Google servers',
      detail: 'Google Fonts must be self-hosted (LG München 3 O 17493/20, "Google Fonts" 100 € decision).',
      paragraph_ref: 'DSGVO Art. 6',
    },
  },
];

export function calculateRisk(scan: ScanResult): RiskReport {
  let score = 0;
  const findings: RiskFinding[] = [];

  const requestUrls = scan.requests.map((r) => r.url);
  const matched = new Set<string>();

  for (const rule of TRACKER_PATTERNS) {
    if (matched.has(rule.finding.id)) continue;
    const hit = requestUrls.some((u) => rule.pattern.test(u));
    if (!hit) continue;
    score += rule.weight;
    findings.push({ ...rule.finding, severity: rule.severity });
    matched.add(rule.finding.id);
  }

  // Only THIRD-PARTY pre-consent requests trigger the finding. The worker
  // marks every request before the accept-click as preConsent, including
  // the top-level document and same-site assets — those are fine. The
  // TTDSG §25 risk is loading another company's tracker before the user
  // says yes.
  const siteDomain = getDomain(scan.url);
  const preConsentThirdParty = scan.requests.filter((r) => {
    if (r.preConsent !== true) return false;
    const reqDomain = getDomain(r.url);
    return !!reqDomain && !!siteDomain && reqDomain !== siteDomain;
  });

  if (preConsentThirdParty.length > 0) {
    score += 25;
    findings.push({
      id: 'pre_consent_traffic',
      severity: 'critical',
      issue: `${preConsentThirdParty.length} third-party requests fired before consent`,
      detail: 'Any third-party request before the user accepts consent is a TTDSG §25 violation.',
      paragraph_ref: 'TTDSG §25',
    });
  }

  if (scan.consent && !scan.consent.found) {
    score += 15;
    findings.push({
      id: 'consent_banner_missing',
      severity: 'high',
      issue: 'No consent banner detected',
      detail: 'No accept/reject control was found via the standard CMP selectors.',
      paragraph_ref: 'TTDSG §25',
    });
  }

  const thirdPartyHosts = uniqueThirdPartyHosts(scan);

  const severity = pickSeverity(score, findings);

  return {
    score: Math.min(score, 100),
    severity,
    findings,
    stats: {
      total_requests:        scan.requests.length,
      pre_consent_requests:  preConsentThirdParty.length,
      third_party_hosts:     thirdPartyHosts.size,
    },
  };
}

function pickSeverity(score: number, findings: RiskFinding[]): RiskReport['severity'] {
  if (findings.some((f) => f.severity === 'critical')) return 'critical';
  if (score >= 30) return 'high';
  if (score >= 15) return 'medium';
  if (score >  0)  return 'low';
  return 'pass';
}

function uniqueThirdPartyHosts(scan: ScanResult): Set<string> {
  const sitePublicSuffix = safeHost(scan.url);
  const hosts = new Set<string>();
  for (const r of scan.requests) {
    const host = safeHost(r.url);
    if (host && host !== sitePublicSuffix) hosts.add(host);
  }
  return hosts;
}

function safeHost(u: string): string | null {
  try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ''); }
  catch { return null; }
}
