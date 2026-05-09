/**
 * cookie-scan-deep — Playwright-gestützter DSGVO-Tiefenscanner
 *
 * Tier: Growth/Business (Supabase-Plan ≥ Pro benötigt, externe Playwright-Microservice-URL)
 *
 * Unterschied zu cookie-scan (fetch-basiert):
 *   - Nutzt echten Headless-Chromium via externem Playwright-Microservice
 *   - Erkennt JS-gerenderete Tracker (GTM, Meta Pixel, Hotjar, TikTok etc.)
 *   - Consent-Timing: welche Requests feuerten VOR erstem User-Interaction?
 *   - Screenshot für Audit-Report-PDF
 *   - Multi-Page crawl (Startseite + Unterseiten)
 *
 * POST /functions/v1/cookie-scan-deep
 * Body: { url: string, scan_depth?: 1|2|3, tenant_id?: string }
 * Response: DeepScanResult
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DeepScanRequest {
  url: string;
  scan_depth?: 1 | 2 | 3;
  tenant_id?: string;
}

interface PlaywrightScanResult {
  url: string;
  cookies: CookieEntry[];
  requests: NetworkRequest[];
  consentTimingMs: number | null;   // null = no consent banner detected
  preConsentRequests: NetworkRequest[];
  screenshot: string | null;        // base64 PNG
  crawledUrls: string[];
  durationMs: number;
  error?: string;
}

interface CookieEntry {
  name: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string;
  expires: number;
  size: number;
  category: 'necessary' | 'analytics' | 'marketing' | 'functional' | 'unknown';
}

interface NetworkRequest {
  url: string;
  resourceType: string;
  initiator: string;
  timestamp: number;
  tracker: string | null;
  thirdParty: boolean;
}

interface TrackerHit {
  tracker: string;
  law: string;
  risk: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  thirdCountry: boolean;
  consentRequired: boolean;
  firedBeforeConsent: boolean;
  requestCount: number;
}

interface DeepScanResult {
  url: string;
  scanDepth: number;
  crawledUrls: string[];
  cookies: CookieEntry[];
  trackers: TrackerHit[];
  preConsentTrackers: TrackerHit[];
  consentTimingMs: number | null;
  riskScore: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  issues: RiskIssue[];
  screenshot: string | null;
  durationMs: number;
  timestamp: string;
}

interface RiskIssue {
  id: string;
  risk: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  issue: string;
  detail: string;
  law: string;
  fixable: boolean;
  autofix?: string;
}

// ---------------------------------------------------------------------------
// Tracker patterns (subset — full list in tracker-registry.json)
// ---------------------------------------------------------------------------

const TRACKER_PATTERNS: Array<{
  id: string;
  patterns: RegExp[];
  law: string;
  risk: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  thirdCountry: boolean;
  consentRequired: boolean;
}> = [
  {
    id: 'google-analytics-4',
    patterns: [/google-analytics\.com\/g\/collect/, /analytics\.google\.com/, /gtag\/js/],
    law: 'Art. 5 Abs. 3 ePrivacy + Art. 44 DSGVO (Drittlandtransfer USA)',
    risk: 'critical',
    category: 'analytics',
    thirdCountry: true,
    consentRequired: true,
  },
  {
    id: 'google-tag-manager',
    patterns: [/googletagmanager\.com\/gtm\.js/, /googletagmanager\.com\/gtag/],
    law: 'Art. 5 Abs. 3 ePrivacy (ermöglicht weitere Tracker)',
    risk: 'critical',
    category: 'tag-manager',
    thirdCountry: true,
    consentRequired: true,
  },
  {
    id: 'meta-pixel',
    patterns: [/connect\.facebook\.net/, /facebook\.com\/tr/, /fbevents\.js/],
    law: 'Art. 5 Abs. 3 ePrivacy + Art. 44 DSGVO (Drittlandtransfer USA)',
    risk: 'critical',
    category: 'marketing',
    thirdCountry: true,
    consentRequired: true,
  },
  {
    id: 'tiktok-pixel',
    patterns: [/analytics\.tiktok\.com/, /tiktok\.com\/i18n\/pixel/],
    law: 'Art. 5 Abs. 3 ePrivacy + Art. 44 DSGVO (Drittlandtransfer CN/USA)',
    risk: 'critical',
    category: 'marketing',
    thirdCountry: true,
    consentRequired: true,
  },
  {
    id: 'hotjar',
    patterns: [/static\.hotjar\.com/, /insights\.hotjar\.com/],
    law: 'Art. 5 Abs. 3 ePrivacy + Art. 44 DSGVO',
    risk: 'high',
    category: 'analytics',
    thirdCountry: true,
    consentRequired: true,
  },
  {
    id: 'microsoft-clarity',
    patterns: [/clarity\.ms\/tag/, /bing\.com\/bat\.js/],
    law: 'Art. 5 Abs. 3 ePrivacy + Art. 44 DSGVO (Drittlandtransfer USA)',
    risk: 'high',
    category: 'analytics',
    thirdCountry: true,
    consentRequired: true,
  },
  {
    id: 'google-fonts-external',
    patterns: [/fonts\.googleapis\.com/, /fonts\.gstatic\.com/],
    law: 'Art. 44 DSGVO — IP-Übermittlung an Google USA (LG München I, Az. 3 O 17493/20)',
    risk: 'high',
    category: 'fonts',
    thirdCountry: true,
    consentRequired: true,
  },
  {
    id: 'youtube-embed',
    patterns: [/youtube\.com\/embed/, /youtu\.be\/embed/, /ytimg\.com/],
    law: 'Art. 5 Abs. 3 ePrivacy + Art. 44 DSGVO',
    risk: 'high',
    category: 'media',
    thirdCountry: true,
    consentRequired: true,
  },
  {
    id: 'linkedin-insight',
    patterns: [/snap\.licdn\.com\/li\.lms-analytics/, /linkedin\.com\/px/],
    law: 'Art. 5 Abs. 3 ePrivacy + Art. 44 DSGVO',
    risk: 'high',
    category: 'marketing',
    thirdCountry: true,
    consentRequired: true,
  },
  {
    id: 'intercom',
    patterns: [/widget\.intercom\.io/, /api\.intercom\.io/],
    law: 'Art. 5 Abs. 3 ePrivacy + Art. 44 DSGVO (USA)',
    risk: 'medium',
    category: 'chat',
    thirdCountry: true,
    consentRequired: true,
  },
  {
    id: 'hubspot',
    patterns: [/js\.hs-scripts\.com/, /js\.hubspot\.com/, /hubspot\.com\/conversations/],
    law: 'Art. 5 Abs. 3 ePrivacy + Art. 44 DSGVO (USA)',
    risk: 'medium',
    category: 'crm',
    thirdCountry: true,
    consentRequired: true,
  },
  {
    id: 'stripe',
    patterns: [/js\.stripe\.com\/v3/, /stripe\.com\/fingerprinted/],
    law: 'Art. 6 Abs. 1 lit. b DSGVO (Vertrag) — Ausnahme bei echter Zahlungsabwicklung',
    risk: 'low',
    category: 'payment',
    thirdCountry: true,
    consentRequired: false,
  },
];

// ---------------------------------------------------------------------------
// Helper: classify request
// ---------------------------------------------------------------------------

function classifyRequest(req: NetworkRequest, baseDomain: string): string | null {
  for (const t of TRACKER_PATTERNS) {
    for (const p of t.patterns) {
      if (p.test(req.url)) return t.id;
    }
  }
  return null;
}

function buildTrackerHits(
  requests: NetworkRequest[],
  preConsentRequests: NetworkRequest[],
  baseDomain: string
): TrackerHit[] {
  const hits = new Map<string, TrackerHit>();
  const preConsentUrls = new Set(preConsentRequests.map((r) => r.url));

  for (const req of requests) {
    const trackerId = classifyRequest(req, baseDomain);
    if (!trackerId) continue;
    const def = TRACKER_PATTERNS.find((t) => t.id === trackerId)!;

    if (!hits.has(trackerId)) {
      hits.set(trackerId, {
        tracker: trackerId,
        law: def.law,
        risk: def.risk,
        category: def.category,
        thirdCountry: def.thirdCountry,
        consentRequired: def.consentRequired,
        firedBeforeConsent: preConsentUrls.has(req.url),
        requestCount: 0,
      });
    }
    const hit = hits.get(trackerId)!;
    hit.requestCount++;
    if (preConsentUrls.has(req.url)) hit.firedBeforeConsent = true;
  }

  return Array.from(hits.values());
}

// ---------------------------------------------------------------------------
// Risk scoring
// ---------------------------------------------------------------------------

function scoreTrackers(trackers: TrackerHit[], preConsent: TrackerHit[]): number {
  let score = 100;
  for (const t of trackers) {
    if (t.risk === 'critical') score -= t.firedBeforeConsent ? 25 : 15;
    else if (t.risk === 'high') score -= t.firedBeforeConsent ? 15 : 8;
    else if (t.risk === 'medium') score -= t.firedBeforeConsent ? 8 : 3;
    else score -= 1;
  }
  return Math.max(0, score);
}

function riskLevel(score: number): 'critical' | 'high' | 'medium' | 'low' {
  if (score < 40) return 'critical';
  if (score < 60) return 'high';
  if (score < 80) return 'medium';
  return 'low';
}

// ---------------------------------------------------------------------------
// Build RiskIssues from trackers
// ---------------------------------------------------------------------------

function buildIssues(trackers: TrackerHit[], url: string): RiskIssue[] {
  const issues: RiskIssue[] = [];

  for (const t of trackers) {
    if (t.firedBeforeConsent) {
      issues.push({
        id: `pre-consent-${t.tracker}`,
        risk: 'critical',
        category: 'consent-timing',
        issue: `${t.tracker} feuerte VOR Consent-Erteilung`,
        detail: `Der Tracker wurde geladen, bevor der Nutzer eine Einwilligung erteilt hat. Dies ist ein klarer Verstoß gegen Art. 5 Abs. 3 ePrivacy-Richtlinie.`,
        law: t.law,
        fixable: true,
        autofix: 'script-type-plain-consent-attribute',
      });
    } else if (t.consentRequired) {
      issues.push({
        id: `consent-required-${t.tracker}`,
        risk: t.risk,
        category: 'tracking',
        issue: `${t.tracker} erfordert Opt-In-Consent`,
        detail: `Dieser Tracker setzt Marketing-/Analytics-Cookies und erfordert eine aktive Einwilligung.`,
        law: t.law,
        fixable: true,
        autofix: 'consent-banner-injection',
      });
    }

    if (t.thirdCountry) {
      issues.push({
        id: `third-country-${t.tracker}`,
        risk: 'high',
        category: 'third-country-transfer',
        issue: `${t.tracker} überträgt Daten in Drittland`,
        detail: `Datentransfer ohne hinreichende Garantien (Schrems II). Geeignete Maßnahmen oder Einwilligung erforderlich.`,
        law: 'Art. 44–49 DSGVO',
        fixable: false,
      });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const body = (await req.json()) as DeepScanRequest;
    const rawUrl = body.url?.trim();
    const scanDepth = body.scan_depth ?? 1;

    if (!rawUrl) {
      return new Response(JSON.stringify({ error: 'url required' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Normalize URL
    const targetUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
    const baseDomain = new URL(targetUrl).hostname;

    // Playwright microservice endpoint from Supabase Vault env
    const playwrightUrl = Deno.env.get('PLAYWRIGHT_SCANNER_URL');
    const playwrightKey = Deno.env.get('PLAYWRIGHT_SCANNER_KEY');

    if (!playwrightUrl) {
      return new Response(
        JSON.stringify({ error: 'PLAYWRIGHT_SCANNER_URL not configured. Deploy playwright-scanner microservice first.' }),
        { status: 503, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    const t0 = Date.now();

    // Call Playwright microservice
    const pwResp = await fetch(`${playwrightUrl}/scan/full`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(playwrightKey ? { 'Authorization': `Bearer ${playwrightKey}` } : {}),
      },
      body: JSON.stringify({ url: targetUrl, depth: scanDepth, screenshot: true }),
    });

    if (!pwResp.ok) {
      const errText = await pwResp.text();
      return new Response(
        JSON.stringify({ error: `Playwright scanner error: ${pwResp.status} — ${errText}` }),
        { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    const pwData = (await pwResp.json()) as PlaywrightScanResult;

    // Annotate requests with tracker info
    const annotated = pwData.requests.map((r) => ({
      ...r,
      tracker: classifyRequest(r, baseDomain),
      thirdParty: !r.url.includes(baseDomain),
    }));

    const preConsentAnnotated = pwData.preConsentRequests.map((r) => ({
      ...r,
      tracker: classifyRequest(r, baseDomain),
      thirdParty: !r.url.includes(baseDomain),
    }));

    // Build tracker hits
    const trackers = buildTrackerHits(annotated, preConsentAnnotated, baseDomain);
    const preConsentTrackers = trackers.filter((t) => t.firedBeforeConsent);

    // Score
    const riskScore = scoreTrackers(trackers, preConsentTrackers);
    const level = riskLevel(riskScore);

    // Issues
    const issues = buildIssues(trackers, targetUrl);

    const result: DeepScanResult = {
      url: targetUrl,
      scanDepth,
      crawledUrls: pwData.crawledUrls,
      cookies: pwData.cookies,
      trackers,
      preConsentTrackers,
      consentTimingMs: pwData.consentTimingMs,
      riskScore,
      riskLevel: level,
      issues,
      screenshot: pwData.screenshot,
      durationMs: Date.now() - t0,
      timestamp: new Date().toISOString(),
    };

    // Persist to gdpr_audits if tenant_id provided
    if (body.tenant_id) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      await supabase.from('gdpr_audits').insert({
        tenant_id: body.tenant_id,
        url: targetUrl,
        scan_type: 'deep',
        risk_score: riskScore,
        risk_level: level,
        result: result,
        created_at: result.timestamp,
      });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[cookie-scan-deep] error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }
});
