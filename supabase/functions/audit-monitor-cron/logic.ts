// audit-monitor-cron — reine Logik (Deno-/jsr-frei, damit Vitest sie
// importieren kann; Hausregel wie email-auth-rescan/logic.ts).
//
// Getestet in test/edge/audit-monitor-cron.test.ts.

import { timingSafeEqual } from '../_shared/timingSafeEqual.ts';
import { erlaubteKadenz, KADENZ_ABSTAND_MS, type Kadenz } from '../_shared/monitoring-cadence.ts';
import { canonicalJson } from '../_shared/evidence-hash.ts';
import { sha256Hex } from '../_shared/hash.ts';

export { canonicalJson, evidenceContentHash, EVIDENCE_HASH_METHOD } from '../_shared/evidence-hash.ts';

export const SCANNER_VERSION = 'audit-monitor-cron/2';
export const EVIDENCE_TITLE = 'Domain-Monitoring Re-Scan';
export const CRON_ENV = 'CRON_AUDIT_MONITOR_KEY';
export const CRON_VAULT = 'cron_audit_monitor_key';

/** Ab dieser Score-Änderung (Punkte) gilt eine Score-Bewegung als Delta. */
export const SCORE_DELTA_THRESHOLD = 10;
/**
 * Toleranz gegen Uhr-Jitter des täglichen Crons: ein Lauf, der 23 h nach dem
 * letzten liegt, zählt noch als "fällig" für eine tägliche Kadenz.
 */
export const CADENCE_SLACK_MS = 2 * 3_600_000;

// ─── Typen ───────────────────────────────────────────────────────────────────

export interface MonitoredDomain {
  id: string;
  tenant_id: string;
  domain: string;
  tier: string;
  active: boolean;
  alert_email: string | null;
  last_scan_at: string | null;
  last_risk_score: number | null;
  last_trackers: string[] | null;
  created_at?: string | null;
}

export interface ScanIssue { id: string; risk: string; issue: string }

export interface ScanResult {
  domain: string;
  risk_score: number;
  trackers: string[];
  cookie_count: number;
  consent_manager_detected: boolean;
  issues: ScanIssue[];
  scanned_at: string;
  scan_type: 'fetch' | 'playwright';
}

export interface DriftReport {
  baseline: boolean; // erster Lauf: kein Vergleich möglich
  has_drift: boolean;
  new_trackers: string[];
  removed_trackers: string[];
  score_delta: number;
  new_critical_issues: ScanIssue[];
}

/** Plan-Sicht eines Tenants, aus tenant_entitlements gelesen. */
export interface PlanView {
  /** null = Plan enthält keine Dauerüberwachung (Free → nur Einmal-Scan). */
  kadenz: Kadenz | null;
  /** limit.domains: -1 = unbegrenzt, 0 = keine. */
  domainLimit: number;
  /** alerts.email && monitoring.drift */
  driftAlerts: boolean;
}

// ─── Cron-Auth (fail-closed) ─────────────────────────────────────────────────

export type CronAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 500; code: string; message: string };

export function checkCronAuth(cronKey: string | undefined | null, authHeader: string | null): CronAuthResult {
  const key = (cronKey ?? '').trim();
  if (!key) return { ok: false, status: 500, code: 'CRON_KEY_MISSING', message: `${CRON_ENV} not configured` };
  const header = authHeader ?? '';
  if (!header.startsWith('Bearer ') || !timingSafeEqual(header, `Bearer ${key}`)) {
    return { ok: false, status: 401, code: 'UNAUTHORIZED', message: 'cron only' };
  }
  return { ok: true };
}

// ─── Plan-Gate ───────────────────────────────────────────────────────────────

/** Entitlement-Lookup ohne Kenntnis der Entitlements-Form. */
export type FeatureLookup = { has(key: string): boolean; limit(key: string): number | null };

export function planViewFrom(f: FeatureLookup): PlanView {
  const kadenz = erlaubteKadenz(f.has('monitoring.daily'), f.has('monitoring.monthly'));
  const raw = f.limit('limit.domains');
  // Fehlt limit.domains im Plan, gibt Billing kein Kontingent her → 0.
  const domainLimit = raw === null ? 0 : raw;
  return { kadenz, domainLimit, driftAlerts: f.has('alerts.email') && f.has('monitoring.drift') };
}

export type GateDecision =
  | { scan: true; kadenz: Kadenz }
  | { scan: false; reason: 'no_monitoring_plan' | 'over_domain_quota' | 'not_due' };

/**
 * Entscheidet je Domain. `rank` = 0-basierte Position der Domain innerhalb
 * ihres Tenants (älteste zuerst) — nur die ersten `domainLimit` Domains
 * laufen im Dauerbetrieb. Die Spalte `monitored_domains.tier` ist vom Client
 * gesetzt und wird bewusst NICHT als Gate verwendet.
 */
export function gateDomain(d: MonitoredDomain, plan: PlanView, rank: number, nowMs: number): GateDecision {
  if (!plan.kadenz) return { scan: false, reason: 'no_monitoring_plan' };
  if (plan.domainLimit !== -1 && rank >= plan.domainLimit) return { scan: false, reason: 'over_domain_quota' };
  if (d.last_scan_at) {
    const since = nowMs - new Date(d.last_scan_at).getTime();
    if (since < KADENZ_ABSTAND_MS[plan.kadenz] - CADENCE_SLACK_MS) return { scan: false, reason: 'not_due' };
  }
  return { scan: true, kadenz: plan.kadenz };
}

/** Rang je Domain innerhalb des Tenants (created_at, dann id). */
export function rankWithinTenant(domains: MonitoredDomain[]): Map<string, number> {
  const byTenant = new Map<string, MonitoredDomain[]>();
  for (const d of domains) {
    const list = byTenant.get(d.tenant_id) ?? [];
    list.push(d);
    byTenant.set(d.tenant_id, list);
  }
  const out = new Map<string, number>();
  for (const list of byTenant.values()) {
    list.sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.id.localeCompare(b.id));
    list.forEach((d, i) => out.set(d.id, i));
  }
  return out;
}

// ─── Drift (nur gegen den letzten Lauf derselben Domain) ─────────────────────

export function detectDrift(curr: ScanResult, prev: MonitoredDomain): DriftReport {
  if (!prev.last_scan_at || prev.last_risk_score === null) {
    return { baseline: true, has_drift: false, new_trackers: [], removed_trackers: [], score_delta: 0, new_critical_issues: [] };
  }
  const prevT = new Set(prev.last_trackers ?? []);
  const currT = new Set(curr.trackers);
  const newT = [...currT].filter((t) => !prevT.has(t)).sort();
  const removedT = [...prevT].filter((t) => !currT.has(t)).sort();
  const delta = prev.last_risk_score - curr.risk_score; // >0 = schlechter geworden
  const newCrit = curr.issues.filter((i) => i.risk === 'critical' && newT.some((t) => i.id.includes(t)));
  return {
    baseline: false,
    has_drift: newT.length > 0 || removedT.length > 0 || Math.abs(delta) >= SCORE_DELTA_THRESHOLD,
    new_trackers: newT,
    removed_trackers: removedT,
    score_delta: delta,
    new_critical_issues: newCrit,
  };
}

// ─── Scan-Ergebnis validieren (fail-closed) ──────────────────────────────────

/**
 * Normalisiert die cookie-scan-Antwort. Fehlt der Risk-Score, ist das kein
 * Ergebnis (früher: stiller Default 50 → Schein-Drift/Schein-OK) → throw.
 */
export function normalizeCookieScan(domain: string, data: unknown, scannedAt: string): ScanResult {
  const d = (data ?? {}) as Record<string, unknown>;
  // Exact wire contract of cookie-scan/index.ts. Never turn failed fetches
  // into a fabricated score of 100 (the scanner can return ok:true on error).
  // Terminal 3xx counts as success, as in cookie-scan itself
  // (`status >= 300 && status < 400`): fetchGuarded follows real redirects.
  if (d.ok !== true || d.fetch_error !== null ||
      typeof d.fetched_status !== 'number' || d.fetched_status < 200 || d.fetched_status >= 400) {
    throw new Error('cookie-scan did not fetch a successful response');
  }
  const score = d.score;
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100) {
    throw new Error('cookie-scan returned no valid score');
  }
  if (!Array.isArray(d.trackers) ||
      d.trackers.some((t: unknown) => !t || typeof t !== 'object' ||
        typeof (t as { id?: unknown }).id !== 'string' || !(t as { id: string }).id.trim())) {
    throw new Error('cookie-scan returned invalid trackers');
  }
  if (!Array.isArray(d.cookies) || typeof d.consent_manager_detected !== 'boolean') {
    throw new Error('cookie-scan returned incomplete cookie/consent data');
  }
  const trackers = (d.trackers as Array<{ id: string }>).map((t) => t.id);
  return {
    domain, scan_type: 'fetch',
    risk_score: Math.round(score),
    trackers: [...new Set(trackers)].sort(),
    cookie_count: d.cookies.length,
    consent_manager_detected: d.consent_manager_detected,
    issues: Array.isArray(d.issues) ? (d.issues as ScanIssue[]) : [],
    scanned_at: scannedAt,
  };
}

// ─── Drift-Alert (Outbox) ────────────────────────────────────────────────────

/** Zustellversuche je Alert, bevor er als `failed` liegen bleibt (bei täglichem Lauf ≈ 5 Tage). */
export const MAX_ALERT_ATTEMPTS = 5;

/** Was die Drift-Mail braucht — gespeichert, damit ein späterer Lauf sie ohne Neu-Scan zustellen kann. */
export interface AlertPayload {
  risk_score: number;
  score_delta: number;
  new_trackers: string[];
  removed_trackers: string[];
  critical: boolean;
}

export function alertPayload(scan: ScanResult, drift: DriftReport): AlertPayload {
  return {
    risk_score: scan.risk_score,
    score_delta: drift.score_delta,
    new_trackers: drift.new_trackers,
    removed_trackers: drift.removed_trackers,
    critical: drift.new_critical_issues.length > 0,
  };
}

/**
 * Identität einer Drift: Ausgangsstand (last_scan_at der Baseline) + Tracker-Delta.
 * Scheitert nach dem Einreihen das Fortschreiben der Baseline, erkennt der
 * nächste Lauf dieselbe Drift gegen dieselbe Baseline — gleicher
 * Fingerabdruck, kein zweiter Alert. Bewusst ohne risk_score (schwankt
 * zwischen Re-Scans leicht) und ohne evidence_id/ran_at, die sich je Lauf ändern.
 */
export function alertFingerprint(d: MonitoredDomain, drift: DriftReport): Promise<string> {
  return sha256Hex(canonicalJson({
    monitored_domain_id: d.id,
    baseline_scan_at: d.last_scan_at,
    new_trackers: [...drift.new_trackers].sort(),
    removed_trackers: [...drift.removed_trackers].sort(),
  }));
}

// ─── Evidence-Snapshot ───────────────────────────────────────────────────────

export type RunStatus = 'ok' | 'failed';

export function buildSnapshot(a: {
  evidenceId: string;
  tenantId: string;
  domainId: string;
  domain: string;
  previousHash: string | null;
  status: RunStatus;
  ranAt: string;
  kadenz: Kadenz;
  scan: ScanResult | null;
  drift: DriftReport | null;
  error: string | null;
}): Record<string, unknown> {
  return {
    kind: 'domain_monitor_run',
    scanner_version: SCANNER_VERSION,
    evidence_id: a.evidenceId,
    tenant_id: a.tenantId,
    monitored_domain_id: a.domainId,
    domain: a.domain,
    previous_hash: a.previousHash,
    status: a.status,
    ran_at: a.ranAt,
    cadence: a.kadenz,
    scan: a.scan
      ? {
          scan_type: a.scan.scan_type, risk_score: a.scan.risk_score, trackers: a.scan.trackers,
          cookie_count: a.scan.cookie_count, consent_manager_detected: a.scan.consent_manager_detected,
          scanned_at: a.scan.scanned_at,
        }
      : null,
    drift: a.drift,
    error: a.error,
  };
}
