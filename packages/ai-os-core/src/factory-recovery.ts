/**
 * SF-003 – read-only, deterministic recovery inspection.
 * It NEVER retries, changes a job, sends an outbox event or approves work.
 * Input is a synthetic snapshot; no caller-supplied data can grant authority.
 */
import type { FactoryJob } from './factory-contract.ts';

export interface RecoveryLeaseView {
  readonly jobId: string;
  readonly scopeId: string;
  readonly revision: number;
  readonly lastEpoch: number;
  readonly active: null | {
    readonly holderId: string;
    readonly epoch: number;
    readonly expiresAt: string;
  };
}
export interface RecoveryInspectionInput {
  readonly job: FactoryJob;
  /** null means not loaded / unknown, not that no lease exists. */
  readonly lease: RecoveryLeaseView | null;
  /** null means unavailable; zero is a verified fixture count, not delivery proof. */
  readonly undeliveredOutboxCount: number | null;
  readonly observedAt: string;
}
export type RecoveryCategory =
  | 'invalid_snapshot'
  | 'storage_incomplete'
  | 'outbox_reconciliation_required'
  | 'orphaned_worker'
  | 'lease_active'
  | 'awaiting_human_review'
  | 'terminal'
  | 'not_running';
export type RecoveryInspection = {
  readonly category: RecoveryCategory;
  readonly action: 'halt_and_investigate' | 'reconcile_outbox' | 'inspect_orphaned_job' |
    'observe_only' | 'request_human_review' | 'none';
  /** Intentionally always false. A human or server authorization is mandatory. */
  readonly canAutomaticallyExecute: false;
  readonly detail: string;
};

const TERMINAL = new Set(['completed', 'failed', 'blocked', 'cancelled']);
const ACTIVE = new Set(['approved_for_sandbox', 'running']);
const VALID = new Set([
  'draft', 'specified', 'approved_for_sandbox', 'running', 'testing',
  'review_required', 'completed', 'blocked', 'failed', 'cancelled',
]);
function nonNegativeSafe(n: number): boolean {
  return Number.isSafeInteger(n) && n >= 0;
}
function validTimestamp(s: string): boolean {
  return typeof s === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(s) &&
    Number.isFinite(Date.parse(s));
}
const decision = (category: RecoveryCategory, action: RecoveryInspection['action'], detail: string): RecoveryInspection => ({
  category, action, detail, canAutomaticallyExecute: false,
});

function isValidJob(j: FactoryJob): boolean {
  if (!j.id || !j.scopeId || !VALID.has(j.state) || !nonNegativeSafe(j.version) ||
      !nonNegativeSafe(j.budgetCents) || !nonNegativeSafe(j.spentCents) ||
      j.spentCents > j.budgetCents || !Array.isArray(j.events) ||
      !Array.isArray(j.receipts) || j.events.length !== j.version ||
      j.receipts.length !== j.version) return false;
  const receipts = new Set<string>();
  let previous: string = 'draft';
  for (let i = 0; i < j.events.length; i++) {
    const e = j.events[i];
    const r = j.receipts[i];
    if (!e || !r || e.sequence !== i + 1 || e.from !== previous ||
        !VALID.has(e.to) || !e.actor || !e.evidenceRef ||
        !validTimestamp(e.at) || !r.key || receipts.has(r.key)) return false;
    receipts.add(r.key);
    previous = e.to;
  }
  if (previous !== j.state) return false;
  if (j.version === 0 && (j.state !== 'draft' || j.specSha256 !== null)) return false;
  return true;
}
function isValidLease(l: RecoveryLeaseView, j: FactoryJob): boolean {
  if (l.jobId !== j.id || l.scopeId !== j.scopeId ||
      !nonNegativeSafe(l.revision) || !nonNegativeSafe(l.lastEpoch)) return false;
  if (!l.active) return true;
  return !!l.active.holderId && Number.isSafeInteger(l.active.epoch) &&
    l.active.epoch > 0 && l.active.epoch <= l.lastEpoch &&
    validTimestamp(l.active.expiresAt);
}

/** Read-only diagnostics, not a decision to execute. No I/O, no clock reads. */
export function inspectFactoryRecovery(input: RecoveryInspectionInput): RecoveryInspection {
  const { job, lease, undeliveredOutboxCount, observedAt } = input;
  if (!validTimestamp(observedAt) || !isValidJob(job) ||
      (lease !== null && !isValidLease(lease, job)) ||
      (undeliveredOutboxCount !== null && !nonNegativeSafe(undeliveredOutboxCount))) {
    return decision('invalid_snapshot', 'halt_and_investigate', 'Job, Lease, Ereigniskette oder Zeitstempel widersprüchlich.');
  }
  if (lease === null || undeliveredOutboxCount === null) {
    return decision('storage_incomplete', 'halt_and_investigate', 'Unvollständige Momentaufnahme; kein sicherer Wiederanlauf.');
  }
  // Outbox reconciliation precedes any recovery classification; delivery is at-least-once.
  if (undeliveredOutboxCount > 0) {
    return decision('outbox_reconciliation_required', 'reconcile_outbox', 'Offene Outbox-Einträge müssen vor einem Wiederanlauf manuell abgeglichen werden.');
  }
  if (ACTIVE.has(job.state)) {
    if (!lease.active || Date.parse(lease.active.expiresAt) <= Date.parse(observedAt)) {
      if (job.state === 'running') {
        return decision('orphaned_worker', 'inspect_orphaned_job', 'Running-Job ohne gültige Lease: Provider-Seiteneffekte und letzten Fencing-Token prüfen.');
      }
      return decision('not_running', 'none', 'Sandbox-Freigabe liegt vor, aber es läuft kein gültiger Worker. Keine automatische Zuteilung.');
    }
    return decision('lease_active', 'observe_only', 'Gültige Lease beobachtet; keine Wiederanlaufaktion.');
  }
  if (job.state === 'review_required') {
    return decision('awaiting_human_review', 'request_human_review', 'Abschluss benötigt gesonderte menschliche Freigabe.');
  }
  if (TERMINAL.has(job.state)) {
    return decision('terminal', 'none', 'Endzustand; Wiederholung nur als neuer, separat freigegebener Auftrag.');
  }
  return decision('not_running', 'none', 'Kein ausführbarer Jobzustand; keine Aktion.');
}
