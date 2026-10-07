import {
  deriveReviewDisposition,
  type IndependentSafetyReview,
  type ReviewDisposition,
} from '../../lib/enterprise-ai-os/safety-control-plane';

const SHA256_HEX = /^[a-f0-9]{64}$/;
const REVIEWER_COUNT = 3;

export type SafetyCaseStatus =
  | 'awaiting_reviews'
  | 'awaiting_human'
  | 'human_decided';

export interface SafetyReviewerSlot {
  reviewerId: string;
  isolationKey: string;
}

export interface OpenSafetyCaseInput {
  caseId?: string;
  tenantId: string;
  executionId: string;
  agentId: string;
  skillId: string;
  /** Exact action/version fingerprint being reviewed. */
  caseFingerprint: string;
  /** Hash of the proposed action body. */
  actionHash: string;
  /** Hash of the frozen evidence bundle. */
  evidenceHash: string;
  /** Opaque immutable evidence pointers. Raw evidence stays in the evidence store. */
  evidenceRefs: readonly string[];
  policyVersion: string;
  /** Optional human producer. HRP can use this to prevent self-review. */
  producerUserId?: string;
  reviewers: readonly SafetyReviewerSlot[];
}

export interface SafetyCaseSnapshot {
  caseId: string;
  version: 1;
  tenantId: string;
  executionId: string;
  agentId: string;
  skillId: string;
  caseFingerprint: string;
  actionHash: string;
  evidenceHash: string;
  evidenceRefs: readonly string[];
  policyVersion: string;
  producerUserId?: string;
  reviewers: readonly SafetyReviewerSlot[];
  status: SafetyCaseStatus;
  createdAt: string;
}

export interface SafetyReviewerPacket {
  caseId: string;
  version: 1;
  caseFingerprint: string;
  tenantId: string;
  executionId: string;
  agentId: string;
  skillId: string;
  actionHash: string;
  evidenceHash: string;
  evidenceRefs: readonly string[];
  policyVersion: string;
  reviewerId: string;
  isolationKey: string;
  /** Structural guarantee: reviewer packets never contain peer reports. */
  peerReportsVisible: false;
}

export interface SubmittedSafetyReview {
  caseId: string;
  caseVersion: 1;
  caseFingerprint: string;
  reportHash: string;
  submittedAt: string;
  review: IndependentSafetyReview;
}

export interface SubmitSafetyReviewInput {
  caseId: string;
  caseVersion: 1;
  caseFingerprint: string;
  reportHash: string;
  review: IndependentSafetyReview;
}

export interface SafetySynthesis {
  synthesisId: string;
  agentId: string;
  analysisHash: string;
  proposal: string;
  rationale: string;
  uncertainties: readonly string[];
  createdAt: string;
  /** Advisory only; it can never authorize execution. */
  authorizesExecution: false;
}

export interface RecordSafetySynthesisInput {
  caseId: string;
  caseVersion: 1;
  caseFingerprint: string;
  synthesisId: string;
  agentId: string;
  analysisHash: string;
  proposal: string;
  rationale: string;
  uncertainties?: readonly string[];
}

export type HumanSafetyDecision =
  | 'approve'
  | 'approve_with_conditions'
  | 'modify'
  | 'reject'
  | 'escalate';

export interface HumanSafetyDecisionRecord {
  userId: string;
  decision: HumanSafetyDecision;
  intent: string;
  conditions: readonly string[];
  decidedAt: string;
  caseVersion: 1;
  caseFingerprint: string;
}

export interface RecordHumanSafetyDecisionInput {
  caseId: string;
  caseVersion: 1;
  caseFingerprint: string;
  userId: string;
  decision: HumanSafetyDecision;
  intent: string;
  conditions?: readonly string[];
}

export interface HumanSafetyReviewBundle {
  caseSnapshot: SafetyCaseSnapshot;
  originalReviews: readonly SubmittedSafetyReview[];
  disposition: ReviewDisposition;
  synthesis?: SafetySynthesis;
  humanDecision?: HumanSafetyDecisionRecord;
}

interface MutableCaseRecord {
  snapshot: SafetyCaseSnapshot;
  reviews: Map<string, SubmittedSafetyReview>;
  synthesis?: SafetySynthesis;
  humanDecision?: HumanSafetyDecisionRecord;
}

/**
 * Domain coordinator for YELLOW safety cases.
 *
 * Important boundaries:
 * - it does not invoke models;
 * - it does not execute the reviewed action;
 * - it never exposes peer reports to reviewer packets;
 * - it requires exactly three distinct reviewer identities and isolation keys;
 * - it does not resume the original execution after a human decision.
 *
 * Persistence is intentionally not hidden here. This in-memory coordinator is
 * the domain/reference implementation; a durable store adapter must preserve
 * the same invariants before production wiring.
 */
export class SafetyReviewCoordinator {
  readonly #cases = new Map<string, MutableCaseRecord>();
  readonly #id: () => string;
  readonly #clock: () => Date;

  constructor(options?: { id?: () => string; clock?: () => Date }) {
    this.#id = options?.id ?? defaultId;
    this.#clock = options?.clock ?? (() => new Date());
  }

  openCase(input: OpenSafetyCaseInput): SafetyCaseSnapshot {
    validateOpenInput(input);

    const caseId = input.caseId ?? this.#id();
    if (this.#cases.has(caseId)) {
      throw new Error(`Safety case already exists: ${caseId}`);
    }

    const reviewers = freezeReviewerSlots(input.reviewers);
    const snapshot = freezeSnapshot({
      caseId,
      version: 1,
      tenantId: input.tenantId,
      executionId: input.executionId,
      agentId: input.agentId,
      skillId: input.skillId,
      caseFingerprint: input.caseFingerprint,
      actionHash: input.actionHash,
      evidenceHash: input.evidenceHash,
      evidenceRefs: Object.freeze([...input.evidenceRefs]),
      policyVersion: input.policyVersion,
      producerUserId: input.producerUserId,
      reviewers,
      status: 'awaiting_reviews',
      createdAt: this.#clock().toISOString(),
    });

    this.#cases.set(caseId, {
      snapshot,
      reviews: new Map(),
    });

    return snapshot;
  }

  getCase(caseId: string): SafetyCaseSnapshot | undefined {
    return this.#cases.get(caseId)?.snapshot;
  }

  /**
   * Reviewer packet deliberately contains no submitted reports.
   * Every reviewer receives the same frozen case/evidence identity.
   */
  getReviewerPacket(caseId: string, reviewerId: string): SafetyReviewerPacket {
    const record = this.#requireCase(caseId);
    const slot = record.snapshot.reviewers.find((candidate) => candidate.reviewerId === reviewerId);
    if (!slot) throw new Error('Reviewer is not assigned to this safety case.');

    return Object.freeze({
      caseId: record.snapshot.caseId,
      version: 1,
      caseFingerprint: record.snapshot.caseFingerprint,
      tenantId: record.snapshot.tenantId,
      executionId: record.snapshot.executionId,
      agentId: record.snapshot.agentId,
      skillId: record.snapshot.skillId,
      actionHash: record.snapshot.actionHash,
      evidenceHash: record.snapshot.evidenceHash,
      evidenceRefs: record.snapshot.evidenceRefs,
      policyVersion: record.snapshot.policyVersion,
      reviewerId: slot.reviewerId,
      isolationKey: slot.isolationKey,
      peerReportsVisible: false as const,
    });
  }

  submitReview(input: SubmitSafetyReviewInput): SubmittedSafetyReview {
    const record = this.#requireCase(input.caseId);
    assertCaseBinding(record.snapshot, input.caseVersion, input.caseFingerprint);

    if (record.snapshot.status !== 'awaiting_reviews') {
      throw new Error('Safety case is no longer accepting reviewer reports.');
    }

    if (!SHA256_HEX.test(input.reportHash)) {
      throw new Error('reportHash must be a lowercase SHA-256 hex digest.');
    }

    const slot = record.snapshot.reviewers.find(
      (candidate) => candidate.reviewerId === input.review.reviewerId,
    );
    if (!slot) throw new Error('Reviewer is not assigned to this safety case.');
    if (slot.isolationKey !== input.review.isolationKey) {
      throw new Error('Reviewer isolation context does not match its assigned slot.');
    }
    if (input.review.peerReportsVisible !== false) {
      throw new Error('Peer reports must never be visible to a safety reviewer.');
    }
    if (record.reviews.has(input.review.reviewerId)) {
      throw new Error('Reviewer already submitted a report for this case.');
    }

    const submitted = freezeSubmittedReview({
      caseId: input.caseId,
      caseVersion: 1,
      caseFingerprint: input.caseFingerprint,
      reportHash: input.reportHash,
      submittedAt: this.#clock().toISOString(),
      review: freezeReview(input.review),
    });
    record.reviews.set(input.review.reviewerId, submitted);

    if (record.reviews.size === REVIEWER_COUNT) {
      const disposition = deriveReviewDisposition(
        record.snapshot.reviewers.map((slot) => record.reviews.get(slot.reviewerId)!.review),
      );

      // The underlying validator fails invalid sets closed to RED. We should
      // never reach that state because slot assignment is validated at open,
      // but preserve the result and hand it to the human rather than guessing.
      void disposition;
      record.snapshot = freezeSnapshot({
        ...record.snapshot,
        status: 'awaiting_human',
      });
    }

    return submitted;
  }

  recordSynthesis(input: RecordSafetySynthesisInput): SafetySynthesis {
    const record = this.#requireCase(input.caseId);
    assertCaseBinding(record.snapshot, input.caseVersion, input.caseFingerprint);

    if (record.snapshot.status !== 'awaiting_human') {
      throw new Error('Synthesis is allowed only after all three original reviews exist.');
    }
    if (record.synthesis) {
      throw new Error('A synthesis already exists for this safety case.');
    }
    if (!input.synthesisId || !input.agentId) {
      throw new Error('synthesisId and agentId are required.');
    }
    if (!SHA256_HEX.test(input.analysisHash)) {
      throw new Error('analysisHash must be a lowercase SHA-256 hex digest.');
    }
    if (!input.proposal.trim() || !input.rationale.trim()) {
      throw new Error('Synthesis proposal and rationale are required.');
    }

    const synthesis: SafetySynthesis = Object.freeze({
      synthesisId: input.synthesisId,
      agentId: input.agentId,
      analysisHash: input.analysisHash,
      proposal: input.proposal,
      rationale: input.rationale,
      uncertainties: Object.freeze([...(input.uncertainties ?? [])]),
      createdAt: this.#clock().toISOString(),
      authorizesExecution: false as const,
    });
    record.synthesis = synthesis;
    return synthesis;
  }

  getHumanBundle(caseId: string): HumanSafetyReviewBundle {
    const record = this.#requireCase(caseId);
    if (record.reviews.size !== REVIEWER_COUNT) {
      throw new Error('Human review bundle is unavailable until all three reviews are submitted.');
    }

    const originalReviews = record.snapshot.reviewers.map((slot) => {
      const review = record.reviews.get(slot.reviewerId);
      if (!review) throw new Error('Safety review set is incomplete.');
      return review;
    });
    const disposition = deriveReviewDisposition(originalReviews.map((item) => item.review));

    return Object.freeze({
      caseSnapshot: record.snapshot,
      originalReviews: Object.freeze([...originalReviews]),
      disposition: Object.freeze({ ...disposition }),
      synthesis: record.synthesis,
      humanDecision: record.humanDecision,
    });
  }

  recordHumanDecision(input: RecordHumanSafetyDecisionInput): HumanSafetyDecisionRecord {
    const record = this.#requireCase(input.caseId);
    assertCaseBinding(record.snapshot, input.caseVersion, input.caseFingerprint);

    if (record.snapshot.status !== 'awaiting_human') {
      throw new Error('Safety case is not awaiting a human decision.');
    }
    if (record.humanDecision) {
      throw new Error('Human decision already recorded for this safety case.');
    }
    if (!input.userId) throw new Error('Human reviewer userId is required.');
    if (record.snapshot.producerUserId && input.userId === record.snapshot.producerUserId) {
      throw new Error('Producer and human reviewer must be different users.');
    }
    if (!input.intent.trim()) {
      throw new Error('Human decision intent is required and may not be auto-filled.');
    }

    const conditions = Object.freeze([...(input.conditions ?? [])]);
    if (input.decision === 'approve_with_conditions' && conditions.length === 0) {
      throw new Error('approve_with_conditions requires at least one explicit condition.');
    }

    const decision: HumanSafetyDecisionRecord = Object.freeze({
      userId: input.userId,
      decision: input.decision,
      intent: input.intent,
      conditions,
      decidedAt: this.#clock().toISOString(),
      caseVersion: 1,
      caseFingerprint: input.caseFingerprint,
    });

    record.humanDecision = decision;
    record.snapshot = freezeSnapshot({
      ...record.snapshot,
      status: 'human_decided',
    });

    return decision;
  }

  #requireCase(caseId: string): MutableCaseRecord {
    const record = this.#cases.get(caseId);
    if (!record) throw new Error(`Safety case not found: ${caseId}`);
    return record;
  }
}

function validateOpenInput(input: OpenSafetyCaseInput): void {
  if (!input.tenantId || !input.executionId || !input.agentId || !input.skillId) {
    throw new Error('tenantId, executionId, agentId and skillId are required.');
  }
  if (!input.policyVersion) throw new Error('policyVersion is required.');

  for (const [field, value] of [
    ['caseFingerprint', input.caseFingerprint],
    ['actionHash', input.actionHash],
    ['evidenceHash', input.evidenceHash],
  ] as const) {
    if (!SHA256_HEX.test(value)) {
      throw new Error(`${field} must be a lowercase SHA-256 hex digest.`);
    }
  }

  if (input.reviewers.length !== REVIEWER_COUNT) {
    throw new Error('Exactly three safety reviewers are required.');
  }

  const reviewerIds = new Set(input.reviewers.map((reviewer) => reviewer.reviewerId));
  if (reviewerIds.size !== REVIEWER_COUNT || [...reviewerIds].some((id) => !id)) {
    throw new Error('Safety reviewer identities must be three distinct non-empty values.');
  }

  const isolationKeys = new Set(input.reviewers.map((reviewer) => reviewer.isolationKey));
  if (isolationKeys.size !== REVIEWER_COUNT || [...isolationKeys].some((key) => !key)) {
    throw new Error('Safety reviewer isolation keys must be three distinct non-empty values.');
  }
}

function assertCaseBinding(
  snapshot: SafetyCaseSnapshot,
  version: 1,
  fingerprint: string,
): void {
  if (version !== snapshot.version) {
    throw new Error('Safety case version differs from the frozen reviewed version.');
  }
  if (fingerprint !== snapshot.caseFingerprint) {
    throw new Error('Safety case fingerprint differs from the frozen reviewed action.');
  }
}

function freezeReviewerSlots(
  reviewers: readonly SafetyReviewerSlot[],
): readonly SafetyReviewerSlot[] {
  return Object.freeze(
    reviewers.map((reviewer) =>
      Object.freeze({
        reviewerId: reviewer.reviewerId,
        isolationKey: reviewer.isolationKey,
      }),
    ),
  );
}

function freezeReview(review: IndependentSafetyReview): IndependentSafetyReview {
  return Object.freeze({
    ...review,
    reasons: Object.freeze([...review.reasons]),
    uncertainties: Object.freeze([...review.uncertainties]),
    peerReportsVisible: false as const,
  });
}

function freezeSubmittedReview(review: SubmittedSafetyReview): SubmittedSafetyReview {
  return Object.freeze({ ...review });
}

function freezeSnapshot(snapshot: SafetyCaseSnapshot): SafetyCaseSnapshot {
  return Object.freeze({
    ...snapshot,
    evidenceRefs: Object.freeze([...snapshot.evidenceRefs]),
    reviewers: freezeReviewerSlots(snapshot.reviewers),
  });
}

function defaultId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `safety_case_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
