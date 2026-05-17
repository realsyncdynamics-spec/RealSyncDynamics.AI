// Coaching — converts a QualityReview into a TrainingSession plan.

import type {
  AgentRole, QualityReview, TrainingSession,
} from './types';

let _counter = 0;
function nextId(): string {
  _counter += 1;
  return `train_${Date.now().toString(36)}_${_counter.toString(36)}`;
}

// ── Role-aware lesson templates ────────────────────────────────────

const ROLE_LESSONS: Record<AgentRole, string> = {
  ResearchAgent:
    'You research. Every claim must come from a citable source. ' +
    'If the source contradicts a tenant-internal assumption, surface ' +
    'the contradiction explicitly — do not paper over it.',
  MemoryAgent:
    'You hold context. Compress without omission. Tag every memory ' +
    'with retrieval keys so other agents can find it. Stale memory > ' +
    'no memory only when stamped with an as-of date.',
  PlanningAgent:
    'You decompose. A plan with no measurable next step is a wish. ' +
    'Each step must have a verifiable success criterion and a clear ' +
    'owner role.',
  SimulationAgent:
    'You imagine outcomes. State every assumption explicitly. A ' +
    'simulation without listed assumptions cannot be falsified, and ' +
    'a non-falsifiable scenario is not evidence.',
  PromotionAgent:
    'You frame. Strong claims need strong evidence. Hedged claims need ' +
    'no evidence but lose impact. Match the framing to the evidence at ' +
    'hand — never the other way around.',
  MonitoringAgent:
    'You watch. False alarms cost trust as much as missed events. ' +
    'Tune thresholds to the cost of the action they trigger.',
  DecisionAgent:
    'You commit. State the reversibility class of the decision and ' +
    'who can reverse it. Irreversible decisions warrant a co-signer.',
  OutputAgent:
    'You package. The same content is a press release, an internal ' +
    'memo and a dashboard line — choose the format the consumer ' +
    'actually has time to read.',
  TrainerAgent:
    'You observe, score and recommend. You never decide. Your ' +
    'recommendations carry weight only because they are auditable.',
};

// ── Coaching lesson generator ─────────────────────────────────────

export interface CoachingArgs {
  agent_name: string;
  agent_role: AgentRole;
  review: QualityReview;
  /** What the agent was asked to do, in 1-2 sentences. */
  task_brief?: string;
}

/**
 * Convert a low-score QualityReview into a TrainingSession the
 * trainer can store and replay. The returned session captures:
 *   - what the agent did wrong (from review.issues_found)
 *   - the role-aware lesson template
 *   - concrete improvement steps
 *
 * The `lesson` field is what the trainer would relay to the
 * producing agent — a downstream LLM-driven trainer can use this
 * as a system prompt for the retrain pass.
 */
export function createTrainingSession(args: CoachingArgs): TrainingSession {
  const { review, agent_role, agent_name } = args;
  const baseLesson = ROLE_LESSONS[agent_role];

  const lessonParts = [
    `Coaching for ${agent_name} (role: ${agent_role})`,
    '',
    'Role principle:',
    baseLesson,
  ];

  if (args.task_brief) {
    lessonParts.push('', 'Task brief:', args.task_brief);
  }

  if (review.issues_found.length > 0) {
    lessonParts.push('', 'Issues observed in your last output:');
    for (const i of review.issues_found) lessonParts.push(`  - ${i}`);
  }

  lessonParts.push(
    '',
    'Improvement plan:',
    ...improvementPlan(review).map(s => `  - ${s}`),
    '',
    `Score before training: ${review.score}/100. Target: ≥ 80.`,
  );

  return {
    id: nextId(),
    agent_name,
    topic: `coach:${review.task_id}`,
    lesson: lessonParts.join('\n'),
    mistakes_found: [...review.issues_found],
    improvement_plan: improvementPlan(review),
    score_before: review.score,
    score_after: null,                 // set after the agent retries
    created_at: new Date().toISOString(),
  };
}

/**
 * Derive a list of concrete next-step instructions from a review.
 * Pure function of the score breakdown — same review → same plan.
 */
export function improvementPlan(review: QualityReview): string[] {
  const plan: string[] = [];
  const s = review.scores;

  if (s.correctness < 70)
    plan.push('Verify the core claim against the source before re-submitting.');
  if (s.completeness < 50)
    plan.push('Expand the output to cover every part of the brief; no implicit omissions.');
  if (s.evidence_quality < 60)
    plan.push('Cite at least two independent sources or chain-link IDs.');
  if (s.clarity < 70)
    plan.push('Shorten sentences. Replace jargon with plain words.');
  if (s.actionability < 60)
    plan.push('Add explicit next steps with concrete verbs and an owner role.');
  if (s.risk_level > 60)
    plan.push('Soften risk vocabulary — replace "fine certain" with "possible fine" until evidence justifies the stronger framing.');
  if (s.confidence < 60)
    plan.push('Either gather more evidence or hand off to a peer agent for a second opinion.');

  // Always include a humility instruction — the trainer agent is a
  // coach, not a critic.
  plan.push('Submit the revised output along with a one-line note describing what changed.');

  return plan;
}

export const ROLE_LESSONS_BY_ROLE = ROLE_LESSONS;
