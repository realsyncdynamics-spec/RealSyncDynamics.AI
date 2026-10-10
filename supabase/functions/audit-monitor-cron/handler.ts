// audit-monitor-cron — Request-Handler. index.ts verdrahtet die echten
// Abhängigkeiten (Supabase-Repo, cookie-scan, Entitlements, Resend); Tests
// injizieren Fakes. Deno-/jsr-frei.
//
// Reihenfolge (festgehalten in test/edge/audit-monitor-cron.test.ts):
//   1. OPTIONS / POST-only
//   2. Cron-Auth: CRON_AUDIT_MONITOR_KEY fehlt → 500, falscher Bearer → 401.
//      Vorher kein DB-Zugriff, kein Scan.
//   3. aktive monitored_domains laden; Plan je Tenant (tenant_entitlements):
//      ohne monitoring.daily/monthly → kein Dauerbetrieb (Free = Einmal-Scan),
//      nur die ersten limit.domains Domains je Tenant, Kadenz laut Plan.
//   4. je fällige Domain: Scan → Drift NUR gegen den letzten Lauf derselben
//      Domain → Evidence (hash-chained, governance_evidence) für JEDEN Lauf,
//      auch ohne Delta und auch bei Scan-Fehler → erst danach Ergebnis →
//      Alert NUR bei Delta in die Outbox (audit_monitor_alerts) → erst dann
//      Domain-Status (Baseline) → Zustellung.
//   5. Fail-closed: fehlt der Scanner, scheitert der Scan oder der
//      Evidence-Write, ist der Lauf `failed`; kein Status-Update, kein Alert,
//      Antwort ok:false (HTTP 500).
//   6. Outbox: Ein Alert ist eingereiht, bevor die Baseline vorrückt. Scheitert
//      die Zustellung, bleibt er `pending` und wird in späteren Läufen erneut
//      zugestellt (höchstens MAX_ALERT_ATTEMPTS). Der Fingerabdruck verhindert
//      einen zweiten Alert für dieselbe Drift; die Alert-ID geht als
//      Idempotency-Key an Resend.

import { handleOptions, jsonError, jsonResponse } from '../_shared/gateway.ts';
import type { Kadenz } from '../_shared/monitoring-cadence.ts';
import {
  EVIDENCE_HASH_METHOD,
  EVIDENCE_TITLE,
  MAX_ALERT_ATTEMPTS,
  SCANNER_VERSION,
  alertFingerprint,
  alertPayload,
  buildSnapshot,
  checkCronAuth,
  detectDrift,
  evidenceContentHash,
  gateDomain,
  rankWithinTenant,
  type AlertPayload,
  type MonitoredDomain,
  type PlanView,
  type ScanResult,
} from './logic.ts';

/** Ein Drift-Alert in der Outbox (audit_monitor_alerts). */
export interface AlertRecord {
  id: string;
  monitored_domain_id: string;
  tenant_id: string;
  domain: string;
  recipient: string;
  fingerprint: string;
  payload: AlertPayload;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
}

/** Wie viele ältere, noch nicht zugestellte Alerts ein Lauf höchstens nachholt. */
const ALERT_RETRY_BATCH = 50;

const EVIDENCE_APPEND_ATTEMPTS = 3;
// Conservative budget below Supabase's 150s free-tier wall-clock limit.
// One already-started scan is allowed to finish; no new work starts after expiry.
const DEFAULT_RUN_BUDGET_MS = 90_000;

export interface MonitorRepo {
  listActiveDomains(): Promise<MonitoredDomain[]>;
  latestEvidenceHash(tenantId: string): Promise<string | null>;
  /** CAS auf den Chain-Head (append_governance_evidence); 'conflict' wenn der Head wanderte. */
  appendEvidence(row: Record<string, unknown>, expectedPreviousHash: string | null): Promise<{ id: string } | 'conflict'>;
  insertResult(row: Record<string, unknown>): Promise<void>;
  updateDomainState(id: string, patch: Record<string, unknown>): Promise<void>;
  /**
   * Reiht einen Alert ein; idempotent auf (monitored_domain_id, fingerprint).
   * Gibt den gespeicherten Datensatz zurück — bei Duplikat den vorhandenen.
   */
  enqueueAlert(row: Omit<AlertRecord, 'status' | 'attempts'>): Promise<AlertRecord>;
  /** Noch nicht zugestellte Alerts, älteste zuerst. */
  pendingAlerts(limit: number): Promise<AlertRecord[]>;
  markAlert(id: string, patch: { status: AlertRecord['status']; attempts: number; last_error: string | null; sent_at: string | null }): Promise<void>;
}

export type Scanner = (d: MonitoredDomain) => Promise<ScanResult>;
/**
 * Bestehender Benachrichtigungsweg (Resend). 'not_configured' = kein Provider-Key.
 * `alert.id` ist als Idempotency-Key zu verwenden.
 */
export type Alerter = (alert: AlertRecord) => Promise<'sent' | 'not_configured'>;

export interface HandlerDeps {
  cronKey: string | undefined;
  repo: MonitorRepo;
  /** null = kein Scanner-Endpoint konfiguriert → jeder fällige Lauf failed. */
  scanner: Scanner | null;
  plan: (tenantId: string) => Promise<PlanView>;
  alerter: Alerter;
  now?: () => Date;
  uuid?: () => string;
  /** Pause zwischen Domains (ms); Tests setzen 0. */
  pauseMs?: number;
  /** Maximum elapsed time before stopping further domains (ms). */
  runBudgetMs?: number;
}

/**
 * `failed` = Zustellung gescheitert, Alert bleibt `pending` für den nächsten Lauf.
 * `duplicate` = dieselbe Drift war schon eingereiht und ist bereits zugestellt.
 */
export type AlertState = 'none' | 'sent' | 'suppressed_plan' | 'no_recipient' | 'not_configured' | 'failed' | 'duplicate';

export interface DomainOutcome {
  domain_id: string;
  domain: string;
  tenant_id: string;
  status: 'ok' | 'failed' | 'skipped';
  reason?: string;
  drift?: boolean;
  baseline?: boolean;
  alert?: AlertState;
  evidence_id?: string | null;
  error?: string;
}

export async function handleAuditMonitor(req: Request, deps: HandlerDeps): Promise<Response> {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED', 'POST only');

  const auth = checkCronAuth(deps.cronKey, req.headers.get('Authorization'));
  if (!auth.ok) return jsonError(auth.status, auth.code, auth.message);

  const now = deps.now ?? (() => new Date());
  const startedAt = now().getTime();
  const runBudgetMs = deps.runBudgetMs ?? DEFAULT_RUN_BUDGET_MS;
  const uuid = deps.uuid ?? (() => crypto.randomUUID());
  const { repo } = deps;

  let domains: MonitoredDomain[];
  try {
    domains = await repo.listActiveDomains();
  } catch (e) {
    return jsonResponse({ ok: false, status: 'failed', error: `monitored_domains: ${(e as Error).message}` }, 500);
  }

  const ranks = rankWithinTenant(domains);
  const plans = new Map<string, PlanView | Error>();
  const heads = new Map<string, string | null>();
  const results: DomainOutcome[] = [];
  const attemptedAlerts = new Set<string>();

  // Outbox: ältere, noch nicht zugestellte Alerts ZUERST nachholen. Danach
  // fressen die Scans das Zeitbudget; liefe der Pass erst am Ende, bliebe er bei
  // vielen Domains dauerhaft aus. Ein Zustellversuch ist billig (ein HTTP-Call),
  // die Menge ist auf ALERT_RETRY_BATCH begrenzt. Ein Fehler hier macht den Lauf
  // nicht `failed`, steht aber in der Antwort.
  const alertRetries: { attempted: number; sent: number; error?: string } = { attempted: 0, sent: 0 };
  try {
    for (const a of await repo.pendingAlerts(ALERT_RETRY_BATCH)) {
      if (now().getTime() - startedAt >= runBudgetMs) break;
      attemptedAlerts.add(a.id);
      alertRetries.attempted++;
      if ((await deliverAlert(a, deps, now)).state === 'sent') alertRetries.sent++;
    }
  } catch (e) {
    alertRetries.error = `pending_alerts: ${(e as Error)?.message ?? String(e)}`;
  }

  for (const d of domains) {
    // Leave unprocessed rows unchanged. The next daily invocation will retry them.
    if (now().getTime() - startedAt >= runBudgetMs) break;
    const base = { domain_id: d.id, domain: d.domain, tenant_id: d.tenant_id };
    if (!plans.has(d.tenant_id)) {
      try { plans.set(d.tenant_id, await deps.plan(d.tenant_id)); }
      catch (e) { plans.set(d.tenant_id, e instanceof Error ? e : new Error(String(e))); }
    }
    const plan = plans.get(d.tenant_id)!;
    if (plan instanceof Error) {
      // Plan unbekannt → kein Scan (kein kostenloser Dauerbetrieb), aber auch kein Erfolg.
      results.push({ ...base, status: 'failed', reason: 'plan_unavailable', error: plan.message });
      continue;
    }
    const gate = gateDomain(d, plan, ranks.get(d.id) ?? 0, now().getTime());
    if (!gate.scan) {
      results.push({ ...base, status: 'skipped', reason: gate.reason });
      continue;
    }
    results.push(await runDomain(d, plan, gate.kadenz, deps, heads, now, uuid, attemptedAlerts));
    if (deps.pauseMs && now().getTime() - startedAt < runBudgetMs) {
      await new Promise((r) => setTimeout(r, deps.pauseMs));
    }
  }

  const deferred = domains.length - results.length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const body = {
    ok: failed === 0 && deferred === 0,
    status: failed > 0 ? 'failed' : deferred > 0 ? 'partial' : 'ok',
    scanner_version: SCANNER_VERSION,
    domains_total: domains.length,
    scanned: results.filter((r) => r.status === 'ok').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    failed,
    deferred,
    drifts: results.filter((r) => r.drift).length,
    alerts_sent: results.filter((r) => r.alert === 'sent').length,
    alert_retries: alertRetries,
    results,
  };
  return jsonResponse(body, failed > 0 ? 500 : deferred > 0 ? 202 : 200);
}

async function runDomain(
  d: MonitoredDomain,
  plan: PlanView,
  kadenz: Kadenz,
  deps: HandlerDeps,
  heads: Map<string, string | null>,
  now: () => Date,
  uuid: () => string,
  attemptedAlerts: Set<string>,
): Promise<DomainOutcome> {
  const out: DomainOutcome = { domain_id: d.id, domain: d.domain, tenant_id: d.tenant_id, status: 'failed' };
  const ranAt = now().toISOString();

  // 1. Scan
  let scan: ScanResult | null = null;
  let scanError: string | null = null;
  if (!deps.scanner) {
    scanError = 'scanner_not_configured';
  } else {
    try { scan = await deps.scanner(d); }
    catch (e) { scanError = `scan_failed: ${(e as Error)?.message ?? String(e)}`; }
  }

  // 2. Drift — nur gegen den letzten erfolgreichen Lauf derselben Domain
  //    (monitored_domains.last_*), nur wenn gescannt wurde.
  const drift = scan ? detectDrift(scan, d) : null;
  const status = scan ? 'ok' : 'failed';

  // 3. Evidence für JEDEN Lauf
  const evidenceId = uuid();
  try {
    let appended: { id: string } | 'conflict' = 'conflict';
    let contentHash = '';
    for (let attempt = 0; attempt < EVIDENCE_APPEND_ATTEMPTS && appended === 'conflict'; attempt++) {
      if (attempt > 0 || !heads.has(d.tenant_id)) heads.set(d.tenant_id, await deps.repo.latestEvidenceHash(d.tenant_id));
      const previousHash = heads.get(d.tenant_id) ?? null;
      const snapshot = buildSnapshot({
        evidenceId, tenantId: d.tenant_id, domainId: d.id, domain: d.domain, previousHash,
        status, ranAt, kadenz, scan, drift, error: scanError,
      });
      contentHash = await evidenceContentHash(snapshot);
      appended = await deps.repo.appendEvidence({
        id: evidenceId,
        tenant_id: d.tenant_id,
        event_id: null,
        asset_id: null,
        evidence_type: 'json',
        title: `${EVIDENCE_TITLE}: ${d.domain}`,
        storage_path: null,
        content_hash: contentHash,
        previous_hash: previousHash,
        metadata: { snapshot, hash_method: EVIDENCE_HASH_METHOD, source: 'audit-monitor-cron', status },
      }, previousHash);
    }
    if (appended === 'conflict') throw new Error(`evidence chain head kept moving (${EVIDENCE_APPEND_ATTEMPTS} attempts)`);
    heads.set(d.tenant_id, contentHash);
    out.evidence_id = appended.id;
  } catch (e) {
    heads.delete(d.tenant_id);
    out.error = `evidence_write_failed: ${(e as Error)?.message ?? String(e)}`;
    out.reason = 'evidence_write_failed';
    return out; // fail-closed: kein Status-Update, kein Alert
  }

  if (!scan || !drift) {
    out.reason = scanError === 'scanner_not_configured' ? 'scanner_not_configured' : 'scan_failed';
    out.error = scanError ?? undefined;
    return out;
  }

  // 4. Ergebnis → Alert in die Outbox (nur bei Delta) → erst dann Domain-Status
  //    (Baseline für den nächsten Vergleich). Scheitert das Einreihen, rückt
  //    die Baseline nicht vor: Der nächste Lauf erkennt dieselbe Drift erneut.
  const wantsAlert = drift.has_drift && plan.driftAlerts && !!d.alert_email;
  let alert: AlertRecord | null = null;
  try {
    await deps.repo.insertResult({
      monitored_domain_id: d.id, tenant_id: d.tenant_id, domain: d.domain,
      risk_score: scan.risk_score, trackers: scan.trackers,
      cookie_count: scan.cookie_count, consent_manager_detected: scan.consent_manager_detected,
      drift_detected: drift.has_drift, new_trackers: drift.new_trackers,
      removed_trackers: drift.removed_trackers, score_delta: drift.score_delta,
      raw_result: { ...scan, evidence_id: out.evidence_id }, scan_type: scan.scan_type, scanned_at: scan.scanned_at,
    });
    if (wantsAlert) {
      alert = await deps.repo.enqueueAlert({
        id: uuid(),
        monitored_domain_id: d.id,
        tenant_id: d.tenant_id,
        domain: d.domain,
        recipient: d.alert_email!,
        // Vor updateDomainState: der Fingerabdruck hängt an der alten Baseline.
        fingerprint: await alertFingerprint(d, drift),
        payload: alertPayload(scan, drift),
      });
    }
    await deps.repo.updateDomainState(d.id, {
      last_scan_at: scan.scanned_at, last_risk_score: scan.risk_score, last_trackers: scan.trackers,
    });
  } catch (e) {
    out.error = `persist_failed: ${(e as Error)?.message ?? String(e)}`;
    out.reason = 'persist_failed';
    return out;
  }

  out.status = 'ok';
  out.drift = drift.has_drift;
  out.baseline = drift.baseline;

  // 5. Alert NUR bei Delta — nie ein "alles ok".
  if (!drift.has_drift) { out.alert = 'none'; return out; }
  if (!plan.driftAlerts) { out.alert = 'suppressed_plan'; return out; }
  if (!alert) { out.alert = 'no_recipient'; return out; }
  // Schon in diesem Lauf versucht (Nachhol-Pass) oder nicht mehr offen → kein zweiter Versand.
  if (attemptedAlerts.has(alert.id) || alert.status !== 'pending') { out.alert = 'duplicate'; return out; }
  attemptedAlerts.add(alert.id);
  const delivered = await deliverAlert(alert, deps, now);
  out.alert = delivered.state;
  if (delivered.error) out.error = delivered.error;
  return out;
}

/**
 * Ein Zustellversuch. `sent` → erledigt; sonst bleibt der Alert `pending`,
 * bis MAX_ALERT_ATTEMPTS erreicht ist (dann `failed`). Scheitert das
 * Markieren nach erfolgreichem Versand, bleibt er `pending` — der nächste
 * Lauf stellt mit derselben Alert-ID (Idempotency-Key) erneut zu.
 */
async function deliverAlert(
  a: AlertRecord,
  deps: HandlerDeps,
  now: () => Date,
): Promise<{ state: AlertState; error?: string }> {
  let attempts = a.attempts + 1;
  let state: AlertState;
  let lastError: string | null = null;
  try {
    state = await deps.alerter(a);
    // Fehlender Provider-Key ist kein Zustellversuch: Der Alert bleibt pending,
    // bis Resend konfiguriert ist, statt nach MAX_ALERT_ATTEMPTS still zu verfallen.
    if (state === 'not_configured') { lastError = 'not_configured'; attempts = a.attempts; }
  } catch (e) {
    state = 'failed';
    lastError = (e as Error)?.message ?? String(e);
  }
  const status: AlertRecord['status'] = state === 'sent' ? 'sent' : attempts >= MAX_ALERT_ATTEMPTS ? 'failed' : 'pending';
  try {
    await deps.repo.markAlert(a.id, {
      status, attempts, last_error: lastError, sent_at: state === 'sent' ? now().toISOString() : null,
    });
  } catch (e) {
    return { state, error: `alert_mark_failed: ${(e as Error)?.message ?? String(e)}` };
  }
  return state === 'failed' ? { state, error: `alert_failed: ${lastError}` } : { state };
}
