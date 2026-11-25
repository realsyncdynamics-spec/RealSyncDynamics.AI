/**
 * Kanonische Job-Transitionen, deterministisch und im Speicher.
 *
 * Das ist KEIN dauerhaftes Audit, keine Identitätsprüfung und kein Release-Gate.
 * Ein späterer Dienst muss Event und Zustand atomar mit derselben
 * Compare-and-swap-Version und Fencing-Epoche in PostgreSQL schreiben
 * (Abnahmekriterium 4) und vorher serverseitig `authorizeAction()` aufrufen.
 */
import {
  FACTORY_LOOP_STATUSES,
  FACTORY_RUN_PHASES,
  NO_AUTHORITY,
  type FactoryEvidenceRef,
  type FactoryJob,
  type FactoryJobEvent,
  type FactoryJobStatus,
  type FactoryResult,
  type FactoryRunPhase,
} from './contract.ts';
import {
  assertJobInvariants,
  deepFreeze,
  fail,
  parseEvidenceList,
  parseFactoryJob,
  readExact,
  requireCount,
  requireTimestamp,
  validators,
} from './validate.ts';

export const FACTORY_TRANSITIONS: Readonly<Record<FactoryJobStatus, readonly FactoryJobStatus[]>> = Object.freeze({
  draft: ['specified', 'cancelled'],
  specified: ['queued', 'cancelled'],
  queued: ['running', 'paused', 'cancelled'],
  running: ['running', 'validating', 'paused', 'blocked', 'failed', 'cancelled'],
  validating: ['running', 'review_required', 'blocked', 'failed', 'cancelled'],
  paused: ['queued', 'cancelled'],
  blocked: ['queued', 'cancelled'],
  review_required: [],
  failed: [],
  cancelled: [],
});

/** Übergänge, die nur der Worker mit gültiger Lease melden darf. */
const FENCED_TARGETS: readonly FactoryJobStatus[] = ['running', 'validating', 'review_required', 'blocked', 'failed'];

export interface FactoryTransitionCommand {
  readonly to: FactoryJobStatus;
  /** Pflicht bei `to: 'running'`, sonst `null`. */
  readonly phase: FactoryRunPhase | null;
  readonly expectedVersion: number;
  /** Pflicht bei Worker-Übergängen aus `running`/`validating`, sonst `null`. */
  readonly fencingEpoch: number | null;
  readonly at: string;
  readonly actorRef: string;
  readonly note: string;
  /** Kosten dieses Schritts in Cent; wird vor dem Zustandswechsel gegen das Budget geprüft. */
  readonly costCents: number;
  readonly evidence: readonly FactoryEvidenceRef[];
}

const COMMAND_KEYS = [
  'to', 'phase', 'expectedVersion', 'fencingEpoch', 'at', 'actorRef', 'note', 'costCents', 'evidence',
] as const;

function phaseIndex(phase: FactoryRunPhase): number {
  return FACTORY_RUN_PHASES.indexOf(phase);
}

export function canTransition(from: FactoryJobStatus, to: FactoryJobStatus): boolean {
  return FACTORY_TRANSITIONS[from].includes(to);
}

/**
 * Wendet genau eine Transition an. Jeder Fehler wirft und lässt den Job
 * unverändert (fail-closed). Ergebnis trägt immer `NO_AUTHORITY`.
 */
export function transitionFactoryJob(current: FactoryJob, command: FactoryTransitionCommand): FactoryResult {
  const job = parseFactoryJob(current);
  const c = readExact(command, COMMAND_KEYS, 'command');
  const to = validators.status(c.to);
  const phase = validators.phase(c.phase);
  const expectedVersion = requireCount(c.expectedVersion, 'expected_version_invalid');
  const fencingEpoch = c.fencingEpoch === null ? null : requireCount(c.fencingEpoch, 'fencing_epoch_invalid');
  const at = requireTimestamp(c.at, 'command_at_invalid');
  const actorRef = validators.actorRef(c.actorRef);
  const note = validators.note(c.note);
  const costCents = requireCount(c.costCents, 'cost_cents_invalid');
  const newEvidence = parseEvidenceList(c.evidence);

  if (expectedVersion !== job.version) fail('version_conflict');
  if (!canTransition(job.status, to)) fail('invalid_transition');

  const lastAt = job.events.at(-1)?.at;
  if (lastAt && Date.parse(at) < Date.parse(lastAt)) fail('event_time_regression');

  // Phase: nur in `running`, und dort nur vorwärts.
  if (to === 'running') {
    if (phase === null) fail('phase_required');
    if (job.status === 'running' && job.phase !== null && phaseIndex(phase) <= phaseIndex(job.phase)) {
      fail('phase_regression');
    }
    if (job.status === 'validating' && phase !== 'implementation') fail('retry_must_reenter_implementation');
  } else if (phase !== null) {
    fail('phase_only_in_running');
  }

  // Fencing: ein neuer Lauf erhöht die Epoche; alte Worker werden abgewiesen.
  const startsRun = job.status === 'queued' && to === 'running';
  const leaseEpoch = startsRun ? job.leaseEpoch + 1 : job.leaseEpoch;
  const fenced = !startsRun && (job.status === 'running' || job.status === 'validating') && FENCED_TARGETS.includes(to);
  if (fenced) {
    if (fencingEpoch === null) fail('fencing_epoch_required');
    if (fencingEpoch !== job.leaseEpoch) fail('stale_lease');
  } else if (fencingEpoch !== null && fencingEpoch !== leaseEpoch) {
    fail('stale_lease');
  }

  // Budget: Überschreitung blockiert den Schritt, kein stilles Kappen.
  const spentCents = job.budget.spentCents + costCents;
  if (!Number.isSafeInteger(spentCents) || spentCents > job.budget.maxCents) fail('budget_exceeded');

  // Versuche: jeder Eintritt in `implementation` zählt.
  const entersImplementation = to === 'running' && phase === 'implementation'
    && !(job.status === 'running' && job.phase === 'implementation');
  const used = job.attempts.used + (entersImplementation ? 1 : 0);
  if (used > job.attempts.max) fail('attempts_exhausted');

  const event: FactoryJobEvent = {
    sequence: (job.events.at(-1)?.sequence ?? 0) + 1,
    from: job.status,
    to,
    phase,
    at,
    actorRef,
    note,
    costCents,
    leaseEpoch,
  };

  const next: FactoryJob = {
    ...job,
    status: to,
    phase,
    version: job.version + 1,
    leaseEpoch,
    budget: { ...job.budget, spentCents },
    attempts: { ...job.attempts, used },
    evidence: [...job.evidence, ...newEvidence],
    events: [...job.events, event],
  };
  assertJobInvariants(next);
  return deepFreeze({ job: next, authority: NO_AUTHORITY });
}

/**
 * Goal-Loop-Zustände sind nur während eines laufenden Implementierungs- oder
 * Validierungsschritts gültig. Der Loop setzt den Job-Status nie selbst.
 */
export function isLoopCompatibleWithJob(job: FactoryJob, loopStatus: string): boolean {
  if (!(FACTORY_LOOP_STATUSES as readonly string[]).includes(loopStatus)) return false;
  if (job.status === 'running') return job.phase === 'implementation';
  return job.status === 'validating';
}
