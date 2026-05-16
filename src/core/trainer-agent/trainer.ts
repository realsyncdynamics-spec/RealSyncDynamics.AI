// TrainerAgent — the public API.
//
// Composes qualityRubric + coaching + handoff + rotation + store
// into the trainer's six surface verbs:
//   - reviewOutput(output)            → QualityReview + Recommendation
//   - trainAgent(agent, review)       → TrainingSession
//   - requestPeerHelp(args)           → PeerHelpRequest + Recommendation
//   - rotateAgentRole(agent)          → RotationLog
//   - createLearningNote(args)        → LearningNote
//   - storeTrainingSession(session)   → TrainingSession (passthrough,
//                                        kept for symmetry with spec)
//
// HARD SAFETY RULE (spec §12):
// The trainer NEVER makes binding business decisions. Every output
// of TrainerAgent is a `TrainerRecommendation` — a suggestion with
// reasoning, never an action. The caller chooses whether to apply.

import type {
  AgentRole, AgentOutput, AgentProfile,
  QualityReview, TrainingSession,
  HandoffPacket, RotationLog, LearningNote, PeerHelpRequest,
  TrainerRecommendation, TrainerRecommendationKind,
} from './types';
import {
  defaultScoreOutput, aggregateScore, explainIssues,
  shouldApprove, APPROVE_THRESHOLD,
} from './qualityRubric';
import { createTrainingSession, improvementPlan } from './coaching';
import { createHandoff, type CreateHandoffArgs } from './handoff';
import { createRotationLog, suggestRotationRole } from './rotation';
import { TrainerStore } from './store';

let _counter = 0;
function nextId(prefix: string): string {
  _counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${_counter.toString(36)}`;
}

// ── TrainerAgent class ────────────────────────────────────────────

export interface TrainerAgentOptions {
  store?:           TrainerStore;
  /** Pluggable scorer. Default is the rule-based defaultScoreOutput.
   *  Phase B: pipe through ai-gateway for LLM-graded scores. */
  score?:           (o: AgentOutput) => ReturnType<typeof defaultScoreOutput>;
  approve_threshold?: number;
}

export class TrainerAgent {
  public readonly store: TrainerStore;
  private score:    (o: AgentOutput) => ReturnType<typeof defaultScoreOutput>;
  private threshold: number;

  constructor(opts: TrainerAgentOptions = {}) {
    this.store     = opts.store ?? new TrainerStore();
    this.score     = opts.score ?? defaultScoreOutput;
    this.threshold = opts.approve_threshold ?? APPROVE_THRESHOLD;
  }

  // ── Verb 1: reviewOutput ───────────────────────────────────────

  reviewOutput(output: AgentOutput): { review: QualityReview; recommendation: TrainerRecommendation } {
    const scores = this.score(output);
    const score  = aggregateScore(scores);
    const issues = explainIssues(scores);
    const approved = shouldApprove(score, this.threshold);

    const feedback = approved
      ? 'Output meets the approval threshold.'
      : `Output scored ${score}/100 (threshold ${this.threshold}). See improvement plan.`;

    const review: QualityReview = {
      id:          nextId('rev'),
      agent_name:  output.agent_name,
      task_id:     output.task_id,
      scores,
      score,
      issues_found: issues,
      approved,
      feedback,
      created_at:  new Date().toISOString(),
    };
    this.store.saveReview(review);

    const recommendation: TrainerRecommendation = approved
      ? this.makeRec('approve_output', output.agent_name, output.task_id,
                     `aggregate score ${score} ≥ ${this.threshold}`,
                     'Producer agent may proceed with this output.')
      : this.makeRec('block_output', output.agent_name, output.task_id,
                     `aggregate score ${score} < ${this.threshold}`,
                     'Block the output and run trainAgent() on the producer.');

    return { review, recommendation };
  }

  // ── Verb 2: trainAgent ─────────────────────────────────────────

  trainAgent(args: {
    agent_name: string;
    agent_role: AgentRole;
    review: QualityReview;
    task_brief?: string;
  }): TrainingSession {
    const session = createTrainingSession(args);
    this.store.saveTraining(session);
    // Bump the agent's profile's last_training_at if a profile
    // exists.
    const p = this.store.getProfile(args.agent_name);
    if (p) {
      this.store.upsertProfile({ ...p, last_training_at: session.created_at });
    }
    return session;
  }

  /** Called by the producer after retrying the task; updates the
   *  training session with the new score. */
  recordPostTrainingScore(training_id: string, score_after: number): TrainingSession | null {
    return this.store.setTrainingScoreAfter(training_id, score_after);
  }

  // ── Verb 3: requestPeerHelp ────────────────────────────────────

  requestPeerHelp(args: {
    requesting_agent: string;
    task_id: string;
    context: string;
    blocker: string;
    preferred_roles?: AgentRole[];
    /** Trainer picks the helper if `assigned_to` is omitted. The
     *  picker uses the first profile matching one of preferred_roles
     *  that is NOT the requesting agent. */
    candidate_profiles?: AgentProfile[];
  }): { request: PeerHelpRequest; recommendation: TrainerRecommendation } {
    const preferred = args.preferred_roles ?? [];
    const candidates = (args.candidate_profiles ?? this.store.listProfiles())
      .filter(p => p.name !== args.requesting_agent)
      .filter(p => preferred.length === 0 || preferred.includes(p.role));
    const assigned = candidates[0]?.name;

    const request: PeerHelpRequest = {
      id:               nextId('peer'),
      requesting_agent: args.requesting_agent,
      task_id:          args.task_id,
      context:          args.context,
      blocker:          args.blocker,
      preferred_roles:  preferred,
      status:           assigned ? 'open' : 'open',     // open either way; trainer surfaces if no candidate
      assigned_to:      assigned,
      created_at:       new Date().toISOString(),
    };
    this.store.savePeerHelp(request);

    const recommendation = this.makeRec(
      'request_peer_help',
      args.requesting_agent,
      args.task_id,
      `${args.requesting_agent} blocked: ${args.blocker}`,
      assigned
        ? `Pass the task context to ${assigned} via createHandoff() and compare both outputs.`
        : `No candidate agent found for roles [${preferred.join(', ') || 'any'}]; escalate to human.`,
    );

    return { request, recommendation };
  }

  // ── Verb 4: rotateAgentRole ────────────────────────────────────

  rotateAgentRole(args: {
    agent_name: string;
    original_role: AgentRole;
    /** Override the trainer's auto-pick. */
    rotated_role?: AgentRole;
    task: string;
    result: string;
    produced_usable_output: boolean;
  }): { rotation: RotationLog; recommendation: TrainerRecommendation } {
    const rotated = args.rotated_role ?? suggestRotationRole(args.original_role);
    if (!rotated) {
      throw new Error(`rotateAgentRole: no rotation target for role ${args.original_role}`);
    }
    const trainer_feedback = args.produced_usable_output
      ? `Rotation produced usable output. ${args.agent_name} now understands ${rotated} expectations.`
      : `Rotation produced non-shippable output, but that's expected — the rotation is for learning, not production.`;

    const rotation = createRotationLog({
      agent_name:       args.agent_name,
      original_role:    args.original_role,
      rotated_role:     rotated,
      task:             args.task,
      result:           args.result,
      trainer_feedback,
      produced_usable_output: args.produced_usable_output,
    });
    this.store.saveRotation(rotation);

    const recommendation = this.makeRec(
      'rotate_role',
      args.agent_name,
      undefined,
      `Rotation ${args.original_role} → ${rotated} executed.`,
      'Capture a learning note on the cross-role insight, then schedule the next rotation in 30 d.',
    );

    return { rotation, recommendation };
  }

  // ── Verb 5: createLearningNote ─────────────────────────────────

  createLearningNote(args: {
    author_agent: string;
    about_agent?: string | null;
    title: string;
    content: string;
    tags?: string[];
  }): LearningNote {
    const note: LearningNote = {
      id:           nextId('note'),
      author_agent: args.author_agent,
      about_agent:  args.about_agent ?? null,
      title:        args.title,
      content:      args.content,
      tags:         args.tags ?? [],
      created_at:   new Date().toISOString(),
    };
    this.store.saveNote(note);
    return note;
  }

  // ── Verb 6: storeTrainingSession (spec-symmetry passthrough) ───

  storeTrainingSession(session: TrainingSession): TrainingSession {
    return this.store.saveTraining(session);
  }

  // ── Convenience: full review-and-coach pipeline ────────────────

  /**
   * One-shot review + auto-train if approval fails. Used by an
   * orchestrator that wants a single call to handle the whole loop.
   */
  reviewAndMaybeCoach(args: {
    output: AgentOutput;
    agent_role: AgentRole;
    task_brief?: string;
  }): {
    review: QualityReview;
    recommendation: TrainerRecommendation;
    training?: TrainingSession;
  } {
    const { review, recommendation } = this.reviewOutput(args.output);
    if (review.approved) return { review, recommendation };
    const training = this.trainAgent({
      agent_name: args.output.agent_name,
      agent_role: args.agent_role,
      review,
      task_brief: args.task_brief,
    });
    return { review, recommendation, training };
  }

  // ── Handoff convenience (delegates to handoff.ts) ──────────────

  /** Trainer-blessed handoff between two agents. */
  prepareHandoff(args: CreateHandoffArgs): HandoffPacket {
    const packet = createHandoff(args);
    this.store.saveHandoff(packet);
    return packet;
  }

  // ── Private ────────────────────────────────────────────────────

  private makeRec(
    kind: TrainerRecommendationKind,
    about_agent: string,
    task_id: string | undefined,
    reason: string,
    suggested_action: string,
  ): TrainerRecommendation {
    return {
      id: nextId('rec'),
      kind,
      about_agent,
      task_id,
      reason,
      suggested_action,
      created_at: new Date().toISOString(),
    };
  }
}

// ── Module-level default trainer (optional convenience) ───────────

let _default: TrainerAgent | null = null;
export function getDefaultTrainer(): TrainerAgent {
  if (!_default) _default = new TrainerAgent();
  return _default;
}
export function __resetDefaultTrainerForTests(): void {
  _default?.store.__resetForTests();
  _default = null;
}

// Re-export the verb-named convenience functions the spec asks for.
export {
  improvementPlan,
  createHandoff,
  createRotationLog,
  suggestRotationRole,
  createTrainingSession,
};
