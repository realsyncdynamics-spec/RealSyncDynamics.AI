/**
 * Explizite Abbildung der zwei bestehenden Factory-Linien auf den kanonischen
 * Vertrag (Issue #2357):
 *
 *   - `sf006`  = Linie A, factory/sf-006 bzw. SF-000 (`FactoryJob` mit Cents, `baseRef`)
 *   - `pr2346` = Linie B, Draft-PR #2346/#2347 (`FactoryJob` mit EUR-Zahlen, `branch`)
 *
 * Regeln (fail-closed):
 *   - Felder, die die Legacy-Linie nicht kennt (Tenant, Basis-SHA, Spec-Hash,
 *     Scope), kommen NUR aus einer ausdrücklichen Bindung des Aufrufers.
 *   - Abweichungen zwischen Snapshot und Bindung brechen ab, statt zu raten.
 *   - Keine Währungs- oder Rundungskonvertierung: EUR-Zahlen werden nur gegen
 *     ausdrücklich gebundene Cent-Werte verglichen.
 *   - Aktive Jobs (Lease gehalten) werden nicht importiert; erst pausieren.
 *   - Legacy-Events sind unauthentifiziert und werden nur gezählt.
 *   - Mitgelieferte Actor-/Freigabe-Objekte werden abgelehnt.
 */
import {
  FACTORY_ACTIVE_STATUSES,
  NO_AUTHORITY,
  type FactoryJobStatus,
  type FactoryProvenanceSource,
  type FactoryResult,
  type FactoryRunPhase,
} from './contract.ts';
import {
  deepFreeze,
  fail,
  isPlainRecord,
  parseEvidenceList,
  parseFactoryJob,
  readExact,
  requireCount,
  requireMatch,
  requireTimestamp,
  validators,
} from './validate.ts';

export interface LegacyStatusMapping {
  readonly status: FactoryJobStatus;
  readonly phase: FactoryRunPhase | null;
}

const m = (status: FactoryJobStatus, phase: FactoryRunPhase | null = null): LegacyStatusMapping =>
  Object.freeze({ status, phase });

/** Linie A → kanonisch. `draft_pr_ready` heißt nur: Draft-PR wartet auf Review. */
export const SF006_STATUS_MAP: Readonly<Record<string, LegacyStatusMapping>> = Object.freeze({
  queued: m('queued'),
  analyzing: m('running', 'analysis'),
  planning: m('running', 'planning'),
  implementing: m('running', 'implementation'),
  validating: m('validating'),
  blocked: m('blocked'),
  draft_pr_ready: m('review_required'),
  failed: m('failed'),
  cancelled: m('cancelled'),
});

/** Linie B → kanonisch. `running` kennt dort keine Phasen und gilt als Implementierung. */
export const PR2346_STATUS_MAP: Readonly<Record<string, LegacyStatusMapping>> = Object.freeze({
  draft: m('draft'),
  specified: m('specified'),
  queued: m('queued'),
  paused: m('paused'),
  running: m('running', 'implementation'),
  validating: m('validating'),
  pr_ready: m('review_required'),
  failed: m('failed'),
  canceled: m('cancelled'),
});

/**
 * Vom Aufrufer gelieferte Bindung. Sie stammt idealerweise aus einer
 * serverseitig geprüften Quelle; dieses Modul kann das nicht prüfen und gibt
 * deshalb `NO_AUTHORITY` zurück. Nicht bekannte Werte sind `null`.
 */
export interface LegacyBinding {
  readonly tenantId: string;
  readonly branch: string | null;
  readonly baseCommitSha: string;
  readonly specSha256: string;
  readonly scopeId: string;
  readonly budgetMaxCents: number | null;
  readonly budgetSpentCents: number | null;
  readonly evidence: readonly unknown[];
  readonly importedAt: string;
}

const BINDING_KEYS = [
  'tenantId', 'branch', 'baseCommitSha', 'specSha256', 'scopeId',
  'budgetMaxCents', 'budgetSpentCents', 'evidence', 'importedAt',
] as const;

/** Felder, die nach Identität oder Freigabe aussehen und nie übernommen werden. */
const ACTOR_LIKE_KEYS = ['actor', 'trustedActor', 'actorId', 'actorKind', 'isOperator', 'aal', 'authorization', 'approvedBy', 'approval'];

function rejectActorFields(snapshot: unknown): void {
  if (!isPlainRecord(snapshot)) fail('legacy_object_required');
  for (const key of ACTOR_LIKE_KEYS) if (Object.hasOwn(snapshot, key)) fail('legacy_actor_not_accepted');
}

function mapStatus(map: Readonly<Record<string, LegacyStatusMapping>>, raw: unknown): LegacyStatusMapping {
  if (typeof raw !== 'string' || !Object.hasOwn(map, raw)) fail('legacy_status_unknown');
  const mapped = map[raw];
  if (FACTORY_ACTIVE_STATUSES.includes(mapped.status)) fail('legacy_job_active_pause_first');
  return mapped;
}

function readBinding(value: unknown) {
  const b = readExact(value, BINDING_KEYS, 'binding');
  return {
    tenantId: validators.tenantId(b.tenantId),
    branch: b.branch === null ? null : validators.branch(b.branch),
    baseCommitSha: validators.baseCommitSha(b.baseCommitSha),
    specSha256: validators.specSha256(b.specSha256),
    scopeId: validators.scopeId(b.scopeId),
    budgetMaxCents: b.budgetMaxCents === null ? null : requireCount(b.budgetMaxCents, 'binding_budget_max_invalid'),
    budgetSpentCents: b.budgetSpentCents === null ? null : requireCount(b.budgetSpentCents, 'binding_budget_spent_invalid'),
    evidence: parseEvidenceList(b.evidence),
    importedAt: requireTimestamp(b.importedAt, 'binding_imported_at_invalid'),
  };
}

function legacyEventCount(value: unknown): number {
  if (!Array.isArray(value)) fail('legacy_events_invalid');
  return value.length;
}

function finish(candidate: Record<string, unknown>, source: FactoryProvenanceSource, legacyStatus: string, events: number, importedAt: string): FactoryResult {
  const job = parseFactoryJob({
    ...candidate,
    contractVersion: 1,
    provenance: { source, legacyStatus, legacyEventCount: events, importedAt },
    events: [],
  });
  return deepFreeze({ job, authority: NO_AUTHORITY });
}

/** Linie A (SF-006/SF-000) → kanonisch. */
export function importSf006Job(snapshot: unknown, bindingInput: LegacyBinding): FactoryResult {
  rejectActorFields(snapshot);
  const s = readExact(snapshot, [
    'id', 'repository', 'baseRef', 'specificationRef', 'status', 'limits',
    'spentCents', 'implementationAttempts', 'events',
  ], 'legacy');
  const limits = readExact(s.limits, ['maxCostCents', 'maxImplementationAttempts'], 'legacy_limits');
  const binding = readBinding(bindingInput);
  const mapped = mapStatus(SF006_STATUS_MAP, s.status);

  if (binding.branch === null) fail('binding_branch_required');
  const baseRef = requireMatch(s.baseRef, /^[\x21-\x7e]{1,200}$/, 'legacy_base_ref_invalid');
  // SF-004 verlangt eine SHA als baseRef; ist es eine, muss sie zur Bindung passen.
  if (/^[0-9a-f]{40}$/.test(baseRef) && baseRef !== binding.baseCommitSha) fail('base_commit_divergence');
  requireMatch(s.specificationRef, /^[\x21-\x7e][\x20-\x7e]{0,299}$/, 'legacy_specification_ref_invalid');

  const maxCents = requireCount(limits.maxCostCents, 'legacy_budget_invalid');
  const spentCents = requireCount(s.spentCents, 'legacy_budget_invalid');
  if (binding.budgetMaxCents !== null && binding.budgetMaxCents !== maxCents) fail('budget_divergence');
  if (binding.budgetSpentCents !== null && binding.budgetSpentCents !== spentCents) fail('budget_divergence');

  return finish({
    id: s.id,
    tenantId: binding.tenantId,
    repository: s.repository,
    branch: binding.branch,
    baseCommitSha: binding.baseCommitSha,
    specSha256: binding.specSha256,
    scopeId: binding.scopeId,
    status: mapped.status,
    phase: mapped.phase,
    version: 0,
    leaseEpoch: 0,
    budget: { currency: 'EUR', maxCents, spentCents },
    attempts: { max: limits.maxImplementationAttempts, used: s.implementationAttempts },
    evidence: binding.evidence,
  }, 'legacy-sf006', s.status as string, legacyEventCount(s.events), binding.importedAt);
}

function eurMatchesCents(eur: unknown, cents: number): boolean {
  if (typeof eur !== 'number' || !Number.isFinite(eur) || eur < 0) return false;
  return Math.abs(eur * 100 - cents) < 1e-6;
}

/** Linie B (PR #2346/#2347) → kanonisch. */
export function importPr2346Job(snapshot: unknown, bindingInput: LegacyBinding): FactoryResult {
  rejectActorFields(snapshot);
  const s = readExact(snapshot, [
    'id', 'repository', 'branch', 'status', 'scopeApproved', 'budget', 'version', 'history',
  ], 'legacy');
  const budget = readExact(s.budget, ['maxCostEur', 'spentCostEur', 'maxAttempts', 'attempts'], 'legacy_budget');
  const binding = readBinding(bindingInput);
  const mapped = mapStatus(PR2346_STATUS_MAP, s.status);

  const branch = validators.branch(s.branch);
  if (binding.branch !== null && binding.branch !== branch) fail('branch_divergence');

  if (typeof s.scopeApproved !== 'boolean') fail('legacy_scope_approved_invalid');
  // Selbstauskunft wird nicht übernommen, nur auf Widerspruch geprüft.
  if (!s.scopeApproved && ['queued', 'paused', 'review_required'].includes(mapped.status)) {
    fail('legacy_scope_inconsistent');
  }

  if (binding.budgetMaxCents === null || binding.budgetSpentCents === null) fail('budget_cents_binding_required');
  if (!eurMatchesCents(budget.maxCostEur, binding.budgetMaxCents)) fail('budget_divergence');
  if (!eurMatchesCents(budget.spentCostEur, binding.budgetSpentCents)) fail('budget_divergence');

  return finish({
    id: s.id,
    tenantId: binding.tenantId,
    repository: s.repository,
    branch,
    baseCommitSha: binding.baseCommitSha,
    specSha256: binding.specSha256,
    scopeId: binding.scopeId,
    status: mapped.status,
    phase: mapped.phase,
    version: requireCount(s.version, 'legacy_version_invalid'),
    leaseEpoch: 0,
    budget: { currency: 'EUR', maxCents: binding.budgetMaxCents, spentCents: binding.budgetSpentCents },
    attempts: { max: budget.maxAttempts, used: budget.attempts },
    evidence: binding.evidence,
  }, 'legacy-pr2346', s.status as string, legacyEventCount(s.history), binding.importedAt);
}
