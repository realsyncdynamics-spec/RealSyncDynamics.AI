/**
 * Playwright-basierter Site-Crawler.
 *
 * Status: Scaffold. Aktiviert wenn Worker hosted wird.
 *
 * Aufgabe: lädt URL in Real-Browser, sammelt facts dictionary für Rule
 * Engine (Tracker-Detections, Consent-Banner, AI-Widgets, Subpages),
 * persistiert Evidence (Screenshot + Network-Logs) in Supabase Storage.
 */
import { chromium, type Browser, type Request, type Response } from 'playwright';
import type { SupabaseClient } from '@supabase/supabase-js';
import { detectTrackers } from './detectors/trackers';
import { detectConsent } from './detectors/consent';

const PLAYWRIGHT_TIMEOUT_MS = Number(process.env.PLAYWRIGHT_TIMEOUT_MS || 30000);

interface RunAuditInput {
  jobId: string;
  tenantId: string;
  domain: string;
  options: Record<string, unknown>;
  supabase: SupabaseClient;
}

interface RunAuditResult {
  audit_id: string;
  score: number;
  findings: unknown[];
  methodology_version: string;
}

export async function runAudit(input: RunAuditInput): Promise<RunAuditResult> {
  const { jobId, tenantId, domain, supabase } = input;
  const url = domain.startsWith('http') ? domain : `https://${domain}`;

  let browser: Browser | null = null;
  const networkLog: { url: string; method: string; before_consent: boolean; resource_type: string }[] = [];

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'RealSyncAuditBot/1.0 (+https://realsyncdynamicsai.de/audit)',
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    // Network sniffing — sammelt alle Requests vor Consent
    page.on('request', (req: Request) => {
      networkLog.push({
        url: req.url(),
        method: req.method(),
        before_consent: true, // initial: alle vor Consent (Heuristik)
        resource_type: req.resourceType(),
      });
    });

    page.on('response', (_resp: Response) => {
      // Reserve für später: Header-Analyse, Status-Codes etc.
    });

    await page.goto(url, { waitUntil: 'networkidle', timeout: PLAYWRIGHT_TIMEOUT_MS });

    // Screenshot für Evidence
    const screenshot = await page.screenshot({ fullPage: false, type: 'png' });
    const screenshotPath = `${tenantId}/${jobId}/initial.png`;
    await supabase.storage.from('audit-evidence').upload(screenshotPath, screenshot, {
      contentType: 'image/png',
      upsert: false,
    });

    // Detector-Layer aufrufen (Stubs — in echter Impl. mehr Heuristiken)
    const trackerFacts = await detectTrackers(page, networkLog);
    const consentFacts = await detectConsent(page);

    const facts: Record<string, unknown> = {
      ...trackerFacts,
      ...consentFacts,
      page: {
        privacy_policy: { url_found: false }, // TODO: Subpage-Crawl
        impressum: { url_found: false },
      },
    };

    // Rule Engine: importiere via dynamic import damit Worker und Frontend
    // dieselbe Datei nutzen können (in v1 src/rules/, in v9 packages/compliance-rules/)
    const { evaluateAll, calculateScore, RULE_ENGINE_VERSION } = await import('../../src/rules');
    const findings = evaluateAll(facts);
    const score = calculateScore(findings);

    // TODO Phase 8.2: persist findings + evidence
    // Für Scaffold: nur returnen, der Caller (index.ts) marked job complete
    const audit_id = jobId; // Placeholder — bei echter Impl. neuer Audit-Record

    return {
      audit_id,
      score,
      findings,
      methodology_version: RULE_ENGINE_VERSION,
    };
  } finally {
    if (browser) await browser.close();
  }
}
