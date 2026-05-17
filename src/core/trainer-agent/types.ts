// TrainerAgent — type system.
//
// The TrainerAgent observes, coaches and verifies all other agents
// on the RealSync Agent OS. It does NOT make business decisions —
// only recommendations, scores and approve-suggestions. Final
// approval rests with humans or with a designated DecisionAgent.

// ── Agent roles ────────────────────────────────────────────────────

export type AgentRole =
  | 'ResearchAgent'
  | 'MemoryAgent'
  | 'PlanningAgent'
  | 'SimulationAgent'
  | 'PromotionAgent'
  | 'MonitoringAgent'
  | 'DecisionAgent'
  | 'OutputAgent'
  | 'TrainerAgent';

export const ALL_AGENT_ROLES: readonly AgentRole[] = [
  'ResearchAgent', 'MemoryAgent', 'PlanningAgent', 'SimulationAgent',
  'PromotionAgent', 'MonitoringAgent', 'DecisionAgent', 'OutputAgent',
  'TrainerAgent',
] as const;

// ── Agent profile (registry row) ──────────────────────────────────

export interface AgentProfile {
  id: string;                          // ULID
  name: string;                        // kebab-case identifier
  role: AgentRole;
  strengths: string[];                 // free-text labels
  weaknesses: string[];
  /** 0..100 — relative competence at this role's core tasks. */
  current_skill_level: number;
  /** ISO-8601 of the agent's last training pass. */
  last_training_at: string | null;
  /** ISO-8601 — when the profile was first registered. */
  created_at: string;
}

// ── Quality review ─────────────────────────────────────────────────

export type QualityDimension =
  | 'correctness'
  | 'completeness'
  | 'evidence_quality'
  | 'clarity'
  | 'actionability'
  | 'risk_level'
  | 'confidence';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface QualityScores {
  /** Each dimension is scored 0..100. The aggregate `score` is the
   *  weighted mean used by the gate (<80 → block). */
  correctness:      number;
  completeness:     number;
  evidence_quality: number;
  clarity:          number;
  actionability:    number;
  /** Note: risk_level is INVERTED — lower risk = better. The rubric
   *  internally flips this when aggregating. */
  risk_level:       number;            // 0 (no risk) .. 100 (catastrophic)
  confidence:       number;
}

export interface QualityReview {
  id: string;
  agent_name: string;
  task_id: string;
  /** Per-dimension breakdown. */
  scores: QualityScores;
  /** Aggregate 0..100; gate: ≥ 80 = approved. */
  score: number;
  issues_found: string[];              // human-readable findings
  approved: boolean;
  /** Recommendation for the producing agent. */
  feedback: string;
  created_at: string;
}

// ── Training session ──────────────────────────────────────────────

export interface TrainingSession {
  id: string;
  agent_name: string;
  topic: string;
  lesson: string;                      // the content of the coaching
  mistakes_found: string[];
  improvement_plan: string[];
  score_before: number | null;
  score_after: number | null;
  created_at: string;
}

// ── Handoff packet (agent → agent) ────────────────────────────────

export interface HandoffPacket {
  id: string;
  source_agent: string;                // agent.name
  target_agent: string;
  task_id: string;
  context_summary: string;             // 1-2 sentences
  known_facts: string[];
  open_questions: string[];
  recommended_next_step: string;
  payload?: Record<string, unknown>;   // free-form domain data
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
  created_at: string;
  resolved_at?: string;
}

// ── Rotation log ──────────────────────────────────────────────────

export interface RotationLog {
  id: string;
  agent_name: string;
  original_role: AgentRole;
  rotated_role: AgentRole;
  task: string;
  result: string;                      // outcome summary
  trainer_feedback: string;
  /** Whether the rotation produced a usable result. The intent of
   *  rotation is LEARNING, not production — a successful rotation
   *  is one where the agent now understands the other role better,
   *  not necessarily one that produced shippable output. */
  produced_usable_output: boolean;
  created_at: string;
}

// ── Learning note (a piece of cross-agent knowledge) ──────────────

export interface LearningNote {
  id: string;
  /** Authoring agent (usually TrainerAgent, but other agents may
   *  contribute observations). */
  author_agent: string;
  /** The agent the note is about. Null when the note is general. */
  about_agent: string | null;
  title: string;
  content: string;
  /** Tags for retrieval — e.g. 'pre_consent_tracking', 'risk_framing'. */
  tags: string[];
  created_at: string;
}

// ── Peer-help request ─────────────────────────────────────────────

export interface PeerHelpRequest {
  id: string;
  requesting_agent: string;
  task_id: string;
  context: string;
  blocker: string;                     // what's stuck
  /** Roles the trainer SHOULD consider for help. Empty = trainer picks. */
  preferred_roles: AgentRole[];
  status: 'open' | 'resolved' | 'abandoned';
  assigned_to?: string;                // agent.name picked by trainer
  resolution?: string;
  created_at: string;
  resolved_at?: string;
}

// ── Trainer recommendations (the only thing trainer "emits") ─────

export type TrainerRecommendationKind =
  | 'approve_output'
  | 'block_output'
  | 'retrain_agent'
  | 'request_peer_help'
  | 'escalate_to_human'
  | 'rotate_role';

export interface TrainerRecommendation {
  id: string;
  kind: TrainerRecommendationKind;
  about_agent: string;
  task_id?: string;
  reason: string;
  /** TrainerAgent never makes binding decisions. This field always
   *  documents what the trainer SUGGESTS; a downstream actor decides. */
  suggested_action: string;
  created_at: string;
}

// ── Output the trainer reviews ────────────────────────────────────

/**
 * The shape the trainer expects to be given. Producing agents wrap
 * their domain-specific output in this envelope so the trainer can
 * score it uniformly.
 */
export interface AgentOutput {
  task_id: string;
  agent_name: string;
  /** Free-form domain content the agent produced. */
  content: unknown;
  /** Optional self-assessment. The trainer uses this as a prior. */
  self_confidence?: number;            // 0..100
  /** Sources / evidence URIs / chain-link ids backing the output. */
  evidence?: string[];
  /** What kind of risk this output could materialise (privacy /
   *  legal / financial / reputational / operational). */
  risk_dimensions?: string[];
  created_at: string;
}
