/**
 * Strikte, fail-closed Prüfung des kanonischen Vertrags. Eingaben gelten als
 * untrusted: nur eigene Daten-Properties, keine Zusatzfelder, keine Getter.
 */
import {
  FACTORY_ACTIVE_STATUSES,
  FACTORY_ALLOWED_REPOSITORIES,
  FACTORY_CONTRACT_VERSION,
  FACTORY_EVIDENCE_KINDS,
  FACTORY_JOB_STATUSES,
  FACTORY_REVIEW_EVIDENCE,
  FACTORY_RUN_PHASES,
  FactoryContractError,
  type FactoryAttempts,
  type FactoryBudget,
  type FactoryEvidenceRef,
  type FactoryJob,
  type FactoryJobEvent,
  type FactoryJobStatus,
  type FactoryProvenance,
  type FactoryRepository,
  type FactoryRunPhase,
} from './contract.ts';

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA1_RE = /^[0-9a-f]{40}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
/** Kompatibel zur Branch-Regel aus PR #2346 (`^sf-[a-z0-9-]+$`). */
const BRANCH_RE = /^sf-[a-z0-9][a-z0-9-]{0,99}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const REF_RE = /^[\x21-\x7e][\x20-\x7e]{0,299}$/;

export function fail(code: string): never {
  throw new FactoryContractError(code);
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Liest ein Objekt mit exakt diesen Schlüsseln; Getter und Zusatzfelder → Fehler. */
export function readExact(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!isPlainRecord(value)) fail(`${label}_object_required`);
  const own = Reflect.ownKeys(value);
  for (const key of own) {
    if (typeof key !== 'string' || !keys.includes(key)) fail(`${label}_unexpected_field:${String(key)}`);
  }
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (!d || !Object.hasOwn(d, 'value')) fail(`${label}_${key}_missing`);
    out[key] = d.value;
  }
  return out;
}

export function requireMatch(value: unknown, re: RegExp, code: string): string {
  if (typeof value !== 'string' || !re.test(value)) fail(code);
  return value;
}

export function requireCount(value: unknown, code: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) fail(code);
  return value;
}

export function requireTimestamp(value: unknown, code: string): string {
  if (typeof value !== 'string' || !ISO_RE.test(value) || !Number.isFinite(Date.parse(value))) fail(code);
  return value;
}

function requireOneOf<T extends string>(value: unknown, allowed: readonly T[], code: string): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) fail(code);
  return value as T;
}

function requireText(value: unknown, max: number, code: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x1f\x7f]/.test(value)) fail(code);
  return value;
}

export const validators = {
  id: (v: unknown) => requireMatch(v, ID_RE, 'job_id_invalid'),
  tenantId: (v: unknown) => requireMatch(v, UUID_RE, 'tenant_id_invalid'),
  repository: (v: unknown) => requireOneOf<FactoryRepository>(v, FACTORY_ALLOWED_REPOSITORIES, 'repository_not_allowed'),
  branch: (v: unknown) => requireMatch(v, BRANCH_RE, 'branch_invalid'),
  baseCommitSha: (v: unknown) => requireMatch(v, SHA1_RE, 'base_commit_sha_invalid'),
  specSha256: (v: unknown) => requireMatch(v, SHA256_RE, 'spec_sha256_invalid'),
  scopeId: (v: unknown) => requireMatch(v, ID_RE, 'scope_id_invalid'),
  status: (v: unknown) => requireOneOf<FactoryJobStatus>(v, FACTORY_JOB_STATUSES, 'status_unknown'),
  phase: (v: unknown): FactoryRunPhase | null =>
    v === null ? null : requireOneOf<FactoryRunPhase>(v, FACTORY_RUN_PHASES, 'phase_unknown'),
  actorRef: (v: unknown) => requireText(v, 120, 'actor_ref_invalid'),
  note: (v: unknown) => requireText(v, 500, 'note_invalid'),
};

export function parseEvidenceRef(value: unknown): FactoryEvidenceRef {
  const r = readExact(value, ['kind', 'ref', 'sha256'], 'evidence');
  return {
    kind: requireOneOf(r.kind, FACTORY_EVIDENCE_KINDS, 'evidence_kind_unknown'),
    ref: requireMatch(r.ref, REF_RE, 'evidence_ref_invalid'),
    sha256: requireMatch(r.sha256, SHA256_RE, 'evidence_sha256_invalid'),
  };
}

export function parseEvidenceList(value: unknown): FactoryEvidenceRef[] {
  if (!Array.isArray(value) || value.length > 50) fail('evidence_list_invalid');
  return value.map(parseEvidenceRef);
}

export function parseBudget(value: unknown): FactoryBudget {
  const b = readExact(value, ['currency', 'maxCents', 'spentCents'], 'budget');
  if (b.currency !== 'EUR') fail('budget_currency_unsupported');
  const maxCents = requireCount(b.maxCents, 'budget_max_cents_invalid');
  const spentCents = requireCount(b.spentCents, 'budget_spent_cents_invalid');
  if (spentCents > maxCents) fail('budget_exceeded');
  return { currency: 'EUR', maxCents, spentCents };
}

export function parseAttempts(value: unknown): FactoryAttempts {
  const a = readExact(value, ['max', 'used'], 'attempts');
  const max = requireCount(a.max, 'attempts_max_invalid');
  const used = requireCount(a.used, 'attempts_used_invalid');
  if (max === 0) fail('attempts_max_invalid');
  if (used > max) fail('attempts_exhausted');
  return { max, used };
}

function parseProvenance(value: unknown): FactoryProvenance {
  const p = readExact(value, ['source', 'legacyStatus', 'legacyEventCount', 'importedAt'], 'provenance');
  const source = requireOneOf(p.source, ['canonical', 'legacy-sf006', 'legacy-pr2346'] as const, 'provenance_source_unknown');
  const legacyEventCount = requireCount(p.legacyEventCount, 'provenance_event_count_invalid');
  if (source === 'canonical') {
    if (p.legacyStatus !== null || p.importedAt !== null || legacyEventCount !== 0) fail('provenance_inconsistent');
    return { source, legacyStatus: null, legacyEventCount: 0, importedAt: null };
  }
  return {
    source,
    legacyStatus: requireMatch(p.legacyStatus, /^[a-z_]{1,40}$/, 'provenance_legacy_status_invalid'),
    legacyEventCount,
    importedAt: requireTimestamp(p.importedAt, 'provenance_imported_at_invalid'),
  };
}

const EVENT_KEYS = ['sequence', 'from', 'to', 'phase', 'at', 'actorRef', 'note', 'costCents', 'leaseEpoch'] as const;

function parseEvent(value: unknown): FactoryJobEvent {
  const e = readExact(value, EVENT_KEYS, 'event');
  return {
    sequence: requireCount(e.sequence, 'event_sequence_invalid'),
    from: validators.status(e.from),
    to: validators.status(e.to),
    phase: validators.phase(e.phase),
    at: requireTimestamp(e.at, 'event_at_invalid'),
    actorRef: validators.actorRef(e.actorRef),
    note: validators.note(e.note),
    costCents: requireCount(e.costCents, 'event_cost_invalid'),
    leaseEpoch: requireCount(e.leaseEpoch, 'event_lease_epoch_invalid'),
  };
}

export const JOB_KEYS = [
  'contractVersion', 'id', 'tenantId', 'repository', 'branch', 'baseCommitSha', 'specSha256', 'scopeId',
  'status', 'phase', 'version', 'leaseEpoch', 'budget', 'attempts', 'evidence', 'provenance', 'events',
] as const;

/** Prüft Querbeziehungen, die kein einzelnes Feld allein abdeckt. */
export function assertJobInvariants(job: FactoryJob): void {
  if ((job.status === 'running') !== (job.phase !== null)) fail('phase_status_mismatch');
  if (job.status === 'review_required') {
    const kinds = new Set(job.evidence.map(e => e.kind));
    for (const kind of FACTORY_REVIEW_EVIDENCE) if (!kinds.has(kind)) fail(`review_evidence_missing:${kind}`);
  }
  if (FACTORY_ACTIVE_STATUSES.includes(job.status) && job.leaseEpoch === 0) fail('active_job_without_lease_epoch');
  let previous = 0;
  for (const event of job.events) {
    if (event.sequence !== previous + 1) fail('event_sequence_gap');
    previous = event.sequence;
  }
  const last = job.events.at(-1);
  if (last && last.to !== job.status) fail('event_status_mismatch');
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const key of Reflect.ownKeys(value)) deepFreeze((value as Record<PropertyKey, unknown>)[key]);
    Object.freeze(value);
  }
  return value;
}

/** Validiert einen untrusted Snapshot und gibt eine tief eingefrorene Kopie zurück. */
export function parseFactoryJob(value: unknown): FactoryJob {
  const j = readExact(value, JOB_KEYS, 'job');
  if (j.contractVersion !== FACTORY_CONTRACT_VERSION) fail('contract_version_unsupported');
  if (!Array.isArray(j.events) || j.events.length > 1000) fail('events_invalid');
  const job: FactoryJob = {
    contractVersion: FACTORY_CONTRACT_VERSION,
    id: validators.id(j.id),
    tenantId: validators.tenantId(j.tenantId),
    repository: validators.repository(j.repository),
    branch: validators.branch(j.branch),
    baseCommitSha: validators.baseCommitSha(j.baseCommitSha),
    specSha256: validators.specSha256(j.specSha256),
    scopeId: validators.scopeId(j.scopeId),
    status: validators.status(j.status),
    phase: validators.phase(j.phase),
    version: requireCount(j.version, 'version_invalid'),
    leaseEpoch: requireCount(j.leaseEpoch, 'lease_epoch_invalid'),
    budget: parseBudget(j.budget),
    attempts: parseAttempts(j.attempts),
    evidence: parseEvidenceList(j.evidence),
    provenance: parseProvenance(j.provenance),
    events: j.events.map(parseEvent),
  };
  assertJobInvariants(job);
  return deepFreeze(job);
}

export interface CreateFactoryJobInput {
  readonly id: string;
  readonly tenantId: string;
  readonly repository: string;
  readonly branch: string;
  readonly baseCommitSha: string;
  readonly specSha256: string;
  readonly scopeId: string;
  readonly budgetMaxCents: number;
  readonly maxImplementationAttempts: number;
}

/** Legt einen lokalen Entwurf an. Reiht nichts ein und startet nichts. */
export function createFactoryJob(input: CreateFactoryJobInput): FactoryJob {
  const i = readExact(input, [
    'id', 'tenantId', 'repository', 'branch', 'baseCommitSha', 'specSha256', 'scopeId',
    'budgetMaxCents', 'maxImplementationAttempts',
  ], 'create');
  return parseFactoryJob({
    contractVersion: FACTORY_CONTRACT_VERSION,
    id: i.id,
    tenantId: i.tenantId,
    repository: i.repository,
    branch: i.branch,
    baseCommitSha: i.baseCommitSha,
    specSha256: i.specSha256,
    scopeId: i.scopeId,
    status: 'draft',
    phase: null,
    version: 0,
    leaseEpoch: 0,
    budget: { currency: 'EUR', maxCents: i.budgetMaxCents, spentCents: 0 },
    attempts: { max: i.maxImplementationAttempts, used: 0 },
    evidence: [],
    provenance: { source: 'canonical', legacyStatus: null, legacyEventCount: 0, importedAt: null },
    events: [],
  });
}
