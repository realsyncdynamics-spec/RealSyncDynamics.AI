/**
 * Kanonischer FactoryJob-Vertrag v1 (Issue #2357, Abnahmekriterium 1).
 *
 * Reine Datentypen und Konstanten: kein Netzwerk, keine Datenbank, keine
 * Secrets, keine Ausführung. Ein gültiger Vertrag ist KEINE Autorisierung.
 * Maßgeblich bleibt serverseitig `authorizeAction()` aus `@realsync/ai-os-core`
 * plus Tenant-RLS (Abnahmekriterium 2, nicht Teil dieses Moduls).
 */

export const FACTORY_CONTRACT_VERSION = 1 as const;

/** Einziges Repository, auf das sich ein Factory-Job beziehen darf. */
export const FACTORY_ALLOWED_REPOSITORIES = ['realsyncdynamics-spec/RealSyncDynamics.AI'] as const;
export type FactoryRepository = (typeof FACTORY_ALLOWED_REPOSITORIES)[number];

/**
 * Job-State-Machine. `review_required` ist der letzte Zustand, den die Factory
 * selbst erreichen kann: ein Draft-PR wartet auf menschliches Review.
 * Freigabe, Merge und Release liegen bewusst AUSSERHALB dieses Vertrags.
 */
export const FACTORY_JOB_STATUSES = [
  'draft',
  'specified',
  'queued',
  'running',
  'validating',
  'paused',
  'blocked',
  'review_required',
  'failed',
  'cancelled',
] as const;
export type FactoryJobStatus = (typeof FACTORY_JOB_STATUSES)[number];

export const FACTORY_TERMINAL_STATUSES: readonly FactoryJobStatus[] = ['review_required', 'failed', 'cancelled'];

/** Zustände, in denen ein Worker eine Lease hält. Legacy-Import nur im Ruhezustand. */
export const FACTORY_ACTIVE_STATUSES: readonly FactoryJobStatus[] = ['running', 'validating'];

/** Arbeitsphase innerhalb von `running`; in allen anderen Zuständen `null`. */
export const FACTORY_RUN_PHASES = ['analysis', 'planning', 'implementation'] as const;
export type FactoryRunPhase = (typeof FACTORY_RUN_PHASES)[number];

/**
 * Goal-Loop (SF-005) ist eine GETRENNTE State-Machine innerhalb eines laufenden
 * Jobs. Ein Loop-Status verändert nie den Job-Status; `review_required` im Loop
 * ist nur ein Hinweis, der Job wechselt ausschließlich über eine eigene
 * Transition mit Nachweisen.
 */
export const FACTORY_LOOP_STATUSES = [
  'ready',
  'awaiting_verification',
  'retry_required',
  'review_required',
  'blocked',
] as const;
export type FactoryLoopStatus = (typeof FACTORY_LOOP_STATUSES)[number];

export const FACTORY_EVIDENCE_KINDS = ['spec', 'checkout', 'typecheck', 'tests', 'security', 'other'] as const;
export type FactoryEvidenceKind = (typeof FACTORY_EVIDENCE_KINDS)[number];

/** Für `review_required` müssen diese Nachweisarten referenziert sein. */
export const FACTORY_REVIEW_EVIDENCE: readonly FactoryEvidenceKind[] = ['checkout', 'typecheck', 'tests', 'security'];

/** Budget ausschließlich als ganzzahlige Cent-Beträge in fester Währung. */
export interface FactoryBudget {
  readonly currency: 'EUR';
  readonly maxCents: number;
  readonly spentCents: number;
}

/** Zählt Eintritte in die Phase `implementation`. */
export interface FactoryAttempts {
  readonly max: number;
  readonly used: number;
}

/**
 * Referenz auf einen getrennt abgelegten, redigierten Nachweis. Der Hash ist
 * eine Behauptung des Absenders, bis ein Server ihn gegen den Speicher prüft.
 */
export interface FactoryEvidenceRef {
  readonly kind: FactoryEvidenceKind;
  readonly ref: string;
  readonly sha256: string;
}

export type FactoryProvenanceSource = 'canonical' | 'legacy-sf006' | 'legacy-pr2346';

export interface FactoryProvenance {
  readonly source: FactoryProvenanceSource;
  /** Ursprünglicher Statuswert der Legacy-Linie, sonst `null`. */
  readonly legacyStatus: string | null;
  /** Anzahl nicht übernommener, unauthentifizierter Legacy-Events. */
  readonly legacyEventCount: number;
  readonly importedAt: string | null;
}

export interface FactoryJobEvent {
  readonly sequence: number;
  readonly from: FactoryJobStatus;
  readonly to: FactoryJobStatus;
  readonly phase: FactoryRunPhase | null;
  readonly at: string;
  /** Spur-Label, KEINE Identität und keine Berechtigung. */
  readonly actorRef: string;
  readonly note: string;
  readonly costCents: number;
  readonly leaseEpoch: number;
}

export interface FactoryJob {
  readonly contractVersion: typeof FACTORY_CONTRACT_VERSION;
  readonly id: string;
  readonly tenantId: string;
  readonly repository: FactoryRepository;
  /** Arbeitsbranch, nie ein geschützter Branch. */
  readonly branch: string;
  /** Gepinnter Basis-Commit (40 Hex-Zeichen), getrennt vom Branch. */
  readonly baseCommitSha: string;
  readonly specSha256: string;
  readonly scopeId: string;
  readonly status: FactoryJobStatus;
  readonly phase: FactoryRunPhase | null;
  /** Compare-and-swap-Version; +1 je Transition. */
  readonly version: number;
  /** Fencing-Epoche; +1 bei jedem Start eines Laufs (`queued → running`). */
  readonly leaseEpoch: number;
  readonly budget: FactoryBudget;
  readonly attempts: FactoryAttempts;
  readonly evidence: readonly FactoryEvidenceRef[];
  readonly provenance: FactoryProvenance;
  readonly events: readonly FactoryJobEvent[];
}

/**
 * Jede Ausgabe dieses Moduls trägt diese Flags. Sie sind fest verdrahtet und
 * dürfen von keinem Aufrufer als Freigabe gelesen werden.
 */
export interface FactoryAuthority {
  readonly statusAuthenticated: false;
  readonly evidenceVerified: false;
  readonly repositoryBindingVerified: false;
  readonly checkoutAttested: false;
  readonly humanReviewStillRequired: true;
  readonly canStartWorker: false;
  readonly canCreatePullRequest: false;
  readonly canMerge: false;
  readonly canDeploy: false;
}

export const NO_AUTHORITY: FactoryAuthority = Object.freeze({
  statusAuthenticated: false,
  evidenceVerified: false,
  repositoryBindingVerified: false,
  checkoutAttested: false,
  humanReviewStillRequired: true,
  canStartWorker: false,
  canCreatePullRequest: false,
  canMerge: false,
  canDeploy: false,
});

export interface FactoryResult {
  readonly job: FactoryJob;
  readonly authority: FactoryAuthority;
}

export class FactoryContractError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = 'FactoryContractError';
    this.code = code;
  }
}
