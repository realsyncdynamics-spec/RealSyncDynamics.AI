// PlanningAgent — type system.
//
// Mirrors the 3 tables in supabase/migrations/<ts>_planning_agent.sql.
// Pure types only; operational verbs live in planning.ts.
//
// Spec §12 hard safety: plans start as 'draft' and need explicit
// human review before they can become 'active'. The state machine is:
//
//   draft → pending_review → approved → active → completed
//                          ↘ rejected
//                          ↘ needs_revision (back to draft via revise())
//   any non-terminal state can go to cancelled.

// ── Plan ──────────────────────────────────────────────────────────

export type PlanStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'active'
  | 'completed'
  | 'cancelled';

export type PlanPriority = 'low' | 'normal' | 'high' | 'critical';

export interface PlanRecord {
  id:                  string;
  tenant_id:           string;

  title:               string;
  objective:           string;
  rationale:           string | null;

  source_signal_ids:   string[];
  source_gap_ids:      string[];
  source_handoff_id:   string | null;

  priority:            PlanPriority;
  status:              PlanStatus;

  owner_role:          string | null;
  owner_agent:         string | null;

  start_date:          string | null;        // ISO date (YYYY-MM-DD)
  target_date:         string | null;

  success_metric:      string | null;
  confidence_score:    number;               // 0..1, 2dp

  approved_by:         string | null;        // auth user id
  approved_at:         string | null;        // ISO datetime
  rejected_reason:     string | null;

  created_by:          string | null;
  created_at:          string;
  updated_at:          string;
}

// ── Milestone ─────────────────────────────────────────────────────

export type MilestoneStatus = 'pending' | 'active' | 'done' | 'skipped' | 'failed';

export interface MilestoneRecord {
  id:                       string;
  plan_id:                  string;
  tenant_id:                string;

  sequence:                 number;          // 0-based
  title:                    string;
  description:              string | null;

  assignee_agent:           string | null;   // kebab-case agent name
  assignee_role:            string | null;   // human role (when no agent)

  depends_on_milestone_id:  string | null;
  target_date:              string | null;

  materialised_task_id:     string | null;   // agent_tasks.id once activated

  status:                   MilestoneStatus;
  requires_human_review:    boolean;
  evidence_required:        boolean;

  created_at:               string;
  updated_at:               string;
}

// ── Review ────────────────────────────────────────────────────────

export type ReviewDecision = 'approved' | 'rejected' | 'needs_revision';

export interface ReviewRecord {
  id:                string;
  plan_id:           string;
  tenant_id:         string;
  reviewer:          string;                 // user id | agent name | 'system'
  reviewer_user_id:  string | null;
  decision:          ReviewDecision;
  notes:             string | null;
  created_at:        string;
}

// ── Persistence hook (Phase B Postgres adapter) ───────────────────

export interface PlanningPersistHook {
  savePlan?:       (p: PlanRecord)      => Promise<void> | void;
  saveMilestone?:  (m: MilestoneRecord) => Promise<void> | void;
  saveReview?:     (r: ReviewRecord)    => Promise<void> | void;
}
