/**
 * Playwright-basierter Site-Crawler.
 *
 * Aufgabe: lädt URL in Real-Browser, sammelt facts dictionary für Rule
 * Engine (Tracker-Detections, Consent-Banner, AI-Widgets, Subpages),
 * persistiert scan_run + findings + Evidence (Screenshot) nach Supabase.
 *
 * Persistenz-Kontrakt (siehe ./persistence.ts):
 *   scan_run anlegen → crawl → findings + evidence schreiben → scan_run
 *   abschließen. Crawl-Fehler markieren den scan_run als 'failed' und
 *   propagieren, damit index.ts den audit_job ebenfalls als failed meldet.
 */
import { chromium, type Browser, type Request, type Response } from 'playwright';
import type { SupabaseClient } from '@supabase/supabase-js';
import { detectTrackers } from './detectors/trackers';
import { detectConsent } from './detectors/consent';
import type { RuleFindingLike } from './mapping';
import {
  startScanRun,
  recordFindings,
  recordScreenshotEvidence,
  completeScanRun,
  failScanRun,
} from './persistence';

// Detector-Identität, die in scan_runs.detector + findings.detector landet.
const DETECTOR = 'audit-worker';

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

  // scan_run zuerst anlegen, damit Crawl-Fehler dagegen verbucht werden können.
  const startedAt = Date.now();
  const { scan_run_id, correlation_id } = await startScanRun(supabase, {
    tenant_id: tenantId,
    detector: DETECTOR,
    raw_payload: { job_id: jobId, url },
  });

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

    // Screenshot für Evidence. Pfad-Konvention <tenant>/<scan_run>/<file>
    // matcht die Storage-RLS-Policy aus 20260507100000_audit_evidence.sql.
    const screenshot = await page.screenshot({ fullPage: false, type: 'png' });
    const screenshotPath = `${tenantId}/${scan_run_id}/initial.png`;
    const upload = await supabase.storage.from('audit-evidence').upload(screenshotPath, screenshot, {
      contentType: 'image/png',
      upsert: false,
    });
    if (!upload.error) {
      await recordScreenshotEvidence(supabase, {
        tenant_id: tenantId,
        audit_id: scan_run_id,
        storage_path: screenshotPath,
        size_bytes: screenshot.byteLength,
      });
    } else {
      console.error('[worker] screenshot upload failed (non-fatal):', upload.error.message);
    }

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
    const findings = evaluateAll(facts) as RuleFindingLike[];
    const score = calculateScore(findings as Parameters<typeof calculateScore>[0]);

    // Findings persistieren und scan_run terminal abschließen.
    const { count, severity_max } = await recordFindings(supabase, findings, {
      tenant_id: tenantId,
      scan_run_id,
      correlation_id,
      detector: DETECTOR,
      evidence_ref: screenshotPath,
    });

    await completeScanRun(supabase, scan_run_id, {
      finding_count: count,
      severity_max,
      started_at: startedAt,
    });

    return {
      audit_id: scan_run_id,
      score,
      findings,
      methodology_version: RULE_ENGINE_VERSION,
    };
  } catch (err) {
    // scan_run als failed markieren, bevor wir an index.ts weiterreichen
    // (das dann zusätzlich den audit_job auf failed setzt + Retry plant).
    const message = err instanceof Error ? err.message : String(err);
    await failScanRun(supabase, scan_run_id, 'CRAWL_ERROR', message);
    throw err;
  } finally {
    if (browser) await browser.close();
  }
}
