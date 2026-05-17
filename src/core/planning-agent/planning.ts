// PlanningAgent — strategic plan decomposition + lifecycle.
//
// Phase A: in-memory store + optional persist-hook. No Postgres
// adapter in this file — the migration ships the schema, the hook
// makes the swap trivial later.
//
// Spec §12 hard safety (mirrors HermesAgent §11, TrainerAgent §12):
//   - Plans start as 'draft'.
//   - The only path to 'approved' is via recordReview() with
//     decision='approved' + a reviewer.
//   - The only path to 'active' is activatePlan() AFTER 'approved'.
//   - Every plan carries an explicit confidence_score (0..1).
//   - draftPlan() throws if objective is empty ("no plan without
//     a goal").
//   - activatePlan() throws if status != 'approved'.
//
// Bridge to AgentOS: activatePlan(orchestrator?) can OPTIONALLY
// materialise each milestone-with-assignee_agent as an AgentTask
// row in the supplied AgentOsStore. The plan stores the resulting
// task ids back into milestone.materialised_task_id for traceability.

import type { AgentOsStore } from '../agent-os/store';
import type {
  PlanRecord, PlanStatus, PlanPriority,
  MilestoneRecord, MilestoneStatus,
  ReviewRecord, ReviewDecision,
  PlanningPersistHook,
} from './types';

// ── Id generator (deterministic-ish within a process) ─────────────

let _seq = 0;
function nextId(prefix: string): string {
  _seq += 1;
  const t = Date.now().toString(36);
  return `${prefix}_${t}_${_seq}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

// ── Public input shapes ───────────────────────────────────────────

export interface DraftPlanInput {
  tenant_id:           string;
  title:               string;
  objective:           string;
  rationale?:          string;
  source_signal_ids?:  string[];
  source_gap_ids?:     string[];
  source_handoff_id?:  string | null;
  priority?:           PlanPriority;
  owner_role?:         string;
  owner_agent?:        string;
  start_date?:         string;
  target_date?:        string;
  success_metric?:     string;
  confidence_score?:   number;
  created_by?:         string;
}

export interface AddMilestoneInput {
  plan_id:                  string;
  sequence?:                number;          // auto-assigned if omitted
  title:                    string;
  description?:             string;
  assignee_agent?:          string;
  assignee_role?:           string;
  depends_on_milestone_id?: string;
  target_date?:             string;
  requires_human_review?:   boolean;
  evidence_required?:       boolean;
}

export interface RequestReviewInput {
  plan_id:   string;
  reviewer?: string;                          // reviewer name/id (for the audit log)
}

export interface RecordReviewInput {
  plan_id:           string;
  decision:          ReviewDecision;
  reviewer:          string;
  reviewer_user_id?: string;
  notes?:            string;
}

export interface ActivatePlanOptions {
  /** Optional bridge to AgentOS — when provided, every milestone with
   *  an assignee_agent becomes one open agent_tasks row. */
  orchestratorStore?: AgentOsStore;
  /** Who is activating (recorded into the new task's created_by). */
  actor?: string;
}

// ── HermesHandoff bridge (decoupled — we don't import hermes types) ─

export interface HermesHandoffLike {
  id:               string;
  tenant_id:        string;
  target_agent:     string;
  task_kind?:       string;
  context_summary?: string;
  payload?:         { signal_ids?: string[]; gap_ids?: string[] } | Record<string, unknown>;
  source_signal_id?:    string | null;
  source_market_gap_id?: string | null;
}

// ── The agent ─────────────────────────────────────────────────────

export class PlanningAgent {
  private plans      = new Map<string, PlanRecord>();
  private milestones = new Map<string, MilestoneRecord>();
  private reviews:    ReviewRecord[] = [];
  private hook:       PlanningPersistHook = {};

  setPersistHook(hook: PlanningPersistHook): void {
    this.hook = hook;
  }

  // ── Draft / read ────────────────────────────────────────────────

  draftPlan(input: DraftPlanInput): PlanRecord {
    const objective = (input.objective ?? '').trim();
    const title     = (input.title ?? '').trim();
    if (!objective) {
      throw new Error("PlanningAgent.draftPlan: 'objective' is required (no plan without a goal).");
    }
    if (!title) {
      throw new Error("PlanningAgent.draftPlan: 'title' is required.");
    }
    const now = nowIso();
    const plan: PlanRecord = {
      id:                nextId('plan'),
      tenant_id:         input.tenant_id,
      title,
      objective,
      rationale:         input.rationale?.trim() || null,
      source_signal_ids: [...(input.source_signal_ids ?? [])],
      source_gap_ids:    [...(input.source_gap_ids ?? [])],
      source_handoff_id: input.source_handoff_id ?? null,
      priority:          input.priority ?? 'normal',
      status:            'draft',
      owner_role:        input.owner_role ?? null,
      owner_agent:       input.owner_agent ?? null,
      start_date:        input.start_date ?? null,
      target_date:       input.target_date ?? null,
      success_metric:    input.success_metric ?? null,
      confidence_score:  Number(clamp01(input.confidence_score ?? 0.5).toFixed(2)),
      approved_by:       null,
      approved_at:       null,
      rejected_reason:   null,
      created_by:        input.created_by ?? 'planning-agent',
      created_at:        now,
      updated_at:        now,
    };
    this.plans.set(plan.id, plan);
    this.hook.savePlan?.(plan);
    return plan;
  }

  getPlan(plan_id: string): PlanRecord | undefined {
    return this.plans.get(plan_id);
  }

  listPlans(query: { tenant_id: string; status?: PlanStatus } = { tenant_id: '' }): PlanRecord[] {
    return [...this.plans.values()].filter(p =>
      p.tenant_id === query.tenant_id &&
      (query.status ? p.status === query.status : true)
    );
  }

  // ── Milestones ──────────────────────────────────────────────────

  addMilestone(input: AddMilestoneInput): MilestoneRecord {
    const plan = this.plans.get(input.plan_id);
    if (!plan) throw new Error(`PlanningAgent.addMilestone: plan '${input.plan_id}' not found.`);
    if (plan.status === 'completed' || plan.status === 'cancelled' || plan.status === 'rejected') {
      throw new Error(`PlanningAgent.addMilestone: cannot add milestones to '${plan.status}' plan.`);
    }
    if (input.depends_on_milestone_id) {
      const dep = this.milestones.get(input.depends_on_milestone_id);
      if (!dep || dep.plan_id !== plan.id) {
        throw new Error(`PlanningAgent.addMilestone: depends_on_milestone_id '${input.depends_on_milestone_id}' not in plan '${plan.id}'.`);
      }
    }
    // Auto-assign sequence: max existing + 1 within this plan, or 0.
    const existing = this.milestonesByPlan(plan.id);
    const seq = input.sequence ?? (existing.length
      ? Math.max(...existing.map(m => m.sequence)) + 1
      : 0);
    if (existing.some(m => m.sequence === seq)) {
      throw new Error(`PlanningAgent.addMilestone: sequence ${seq} already used in plan '${plan.id}'.`);
    }
    const now = nowIso();
    const ms: MilestoneRecord = {
      id:                       nextId('ms'),
      plan_id:                  plan.id,
      tenant_id:                plan.tenant_id,
      sequence:                 seq,
      title:                    input.title.trim(),
      description:              input.description?.trim() || null,
      assignee_agent:           input.assignee_agent ?? null,
      assignee_role:            input.assignee_role  ?? null,
      depends_on_milestone_id:  input.depends_on_milestone_id ?? null,
      target_date:              input.target_date ?? null,
      materialised_task_id:     null,
      status:                   'pending',
      requires_human_review:    input.requires_human_review ?? false,
      evidence_required:        input.evidence_required ?? false,
      created_at:               now,
      updated_at:               now,
    };
    this.milestones.set(ms.id, ms);
    this.hook.saveMilestone?.(ms);
    return ms;
  }

  milestonesByPlan(plan_id: string): MilestoneRecord[] {
    return [...this.milestones.values()]
      .filter(m => m.plan_id === plan_id)
      .sort((a, b) => a.sequence - b.sequence);
  }

  // ── Review lifecycle ────────────────────────────────────────────

  requestReview(input: RequestReviewInput): PlanRecord {
    const plan = this.plans.get(input.plan_id);
    if (!plan) throw new Error(`PlanningAgent.requestReview: plan '${input.plan_id}' not found.`);
    if (plan.status !== 'draft') {
      throw new Error(`PlanningAgent.requestReview: only 'draft' plans can be sent for review (status='${plan.status}').`);
    }
    if (this.milestonesByPlan(plan.id).length === 0) {
      throw new Error(`PlanningAgent.requestReview: plan '${plan.id}' has zero milestones; cannot review an empty plan.`);
    }
    plan.status = 'pending_review';
    plan.updated_at = nowIso();
    this.hook.savePlan?.(plan);
    return plan;
  }

  recordReview(input: RecordReviewInput): { plan: PlanRecord; review: ReviewRecord } {
    const plan = this.plans.get(input.plan_id);
    if (!plan) throw new Error(`PlanningAgent.recordReview: plan '${input.plan_id}' not found.`);
    if (plan.status !== 'pending_review' && plan.status !== 'draft') {
      throw new Error(`PlanningAgent.recordReview: plan '${plan.id}' is in '${plan.status}', not reviewable.`);
    }
    const reviewer = (input.reviewer ?? '').trim();
    if (!reviewer) {
      throw new Error("PlanningAgent.recordReview: 'reviewer' is required (no anonymous reviews).");
    }
    if ((input.decision === 'rejected' || input.decision === 'needs_revision') && !input.notes?.trim()) {
      throw new Error(`PlanningAgent.recordReview: decision='${input.decision}' requires 'notes' explaining why.`);
    }
    const review: ReviewRecord = {
      id:               nextId('rev'),
      plan_id:          plan.id,
      tenant_id:        plan.tenant_id,
      reviewer,
      reviewer_user_id: input.reviewer_user_id ?? null,
      decision:         input.decision,
      notes:            input.notes?.trim() || null,
      created_at:       nowIso(),
    };
    this.reviews.push(review);
    this.hook.saveReview?.(review);

    // Apply the decision to the plan.
    if (input.decision === 'approved') {
      plan.status = 'approved';
      plan.approved_by = input.reviewer_user_id ?? reviewer;
      plan.approved_at = review.created_at;
      plan.rejected_reason = null;
    } else if (input.decision === 'rejected') {
      plan.status = 'rejected';
      plan.rejected_reason = review.notes;
    } else {
      // needs_revision → back to draft for further edits.
      plan.status = 'draft';
    }
    plan.updated_at = nowIso();
    this.hook.savePlan?.(plan);
    return { plan, review };
  }

  reviewsForPlan(plan_id: string): ReviewRecord[] {
    return this.reviews
      .filter(r => r.plan_id === plan_id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  // ── Activation + materialisation ────────────────────────────────

  activatePlan(plan_id: string, opts: ActivatePlanOptions = {}): PlanRecord {
    const plan = this.plans.get(plan_id);
    if (!plan) throw new Error(`PlanningAgent.activatePlan: plan '${plan_id}' not found.`);
    if (plan.status !== 'approved') {
      throw new Error(`PlanningAgent.activatePlan: plan must be 'approved' before activation (status='${plan.status}').`);
    }
    plan.status = 'active';
    plan.start_date = plan.start_date ?? new Date().toISOString().slice(0, 10);
    plan.updated_at = nowIso();
    this.hook.savePlan?.(plan);

    // Materialise: one AgentTask per milestone that has an
    // assignee_agent. Milestones with depends_on_milestone_id !=
    // null carry the dependency in their input.depends_on so the
    // orchestrator can later honour ordering.
    if (opts.orchestratorStore) {
      const orderedMilestones = this.milestonesByPlan(plan.id);
      for (const ms of orderedMilestones) {
        if (!ms.assignee_agent) continue;          // human-only milestone
        if (ms.materialised_task_id) continue;     // idempotent re-activate
        const task = opts.orchestratorStore.createTask({
          tenant_id:  plan.tenant_id,
          agent:      ms.assignee_agent,
          task:       ms.title,
          priority:   mapPriority(plan.priority),
          input: {
            plan_id:     plan.id,
            milestone_id: ms.id,
            sequence:    ms.sequence,
            description: ms.description ?? '',
            depends_on:  ms.depends_on_milestone_id ?? null,
            target_date: ms.target_date,
            requires_human_review: ms.requires_human_review,
            evidence_required:     ms.evidence_required,
          },
          created_by: opts.actor ?? 'planning-agent',
        });
        ms.materialised_task_id = task.id;
        ms.status = 'active';
        ms.updated_at = nowIso();
        this.hook.saveMilestone?.(ms);
      }
    }
    return plan;
  }

  // ── Milestone lifecycle (limited; humans drive completion) ──────

  markMilestone(milestone_id: string, status: MilestoneStatus): MilestoneRecord {
    const ms = this.milestones.get(milestone_id);
    if (!ms) throw new Error(`PlanningAgent.markMilestone: milestone '${milestone_id}' not found.`);
    ms.status = status;
    ms.updated_at = nowIso();
    this.hook.saveMilestone?.(ms);

    // If every milestone is terminal AND none failed, the plan
    // auto-flips to 'completed'. If any failed, the plan stays
    // 'active' (humans investigate).
    const plan = this.plans.get(ms.plan_id);
    if (plan && plan.status === 'active') {
      const all = this.milestonesByPlan(plan.id);
      const terminal = all.every(m =>
        m.status === 'done' || m.status === 'skipped' || m.status === 'failed'
      );
      const anyFailed = all.some(m => m.status === 'failed');
      if (terminal && !anyFailed) {
        plan.status = 'completed';
        plan.updated_at = nowIso();
        this.hook.savePlan?.(plan);
      }
    }
    return ms;
  }

  cancelPlan(plan_id: string, reason: string): PlanRecord {
    const plan = this.plans.get(plan_id);
    if (!plan) throw new Error(`PlanningAgent.cancelPlan: plan '${plan_id}' not found.`);
    if (plan.status === 'completed' || plan.status === 'cancelled') {
      throw new Error(`PlanningAgent.cancelPlan: plan '${plan.id}' is already '${plan.status}'.`);
    }
    plan.status = 'cancelled';
    plan.rejected_reason = reason.trim() || 'cancelled';
    plan.updated_at = nowIso();
    this.hook.savePlan?.(plan);
    return plan;
  }

  // ── Hermes handoff bridge ───────────────────────────────────────

  /** Convenience: turn a Hermes handoff into a draft plan. The plan
   *  is created in 'draft' (per safety rule); the caller must call
   *  addMilestone() + requestReview() + recordReview('approved') +
   *  activatePlan() to put it to work. */
  draftFromHermesHandoff(handoff: HermesHandoffLike, extras: Partial<DraftPlanInput> = {}): PlanRecord {
    const payload = (handoff.payload ?? {}) as { signal_ids?: string[]; gap_ids?: string[] };
    return this.draftPlan({
      tenant_id:         handoff.tenant_id,
      title:             extras.title ?? `From Hermes: ${handoff.task_kind ?? 'handoff'}`,
      objective:         extras.objective ?? handoff.context_summary ?? 'Address signals/gaps from Hermes handoff.',
      rationale:         extras.rationale,
      source_signal_ids: payload.signal_ids ?? (handoff.source_signal_id ? [handoff.source_signal_id] : []),
      source_gap_ids:    payload.gap_ids    ?? (handoff.source_market_gap_id ? [handoff.source_market_gap_id] : []),
      source_handoff_id: handoff.id,
      priority:          extras.priority ?? 'normal',
      owner_agent:       extras.owner_agent ?? handoff.target_agent,
      owner_role:        extras.owner_role,
      success_metric:    extras.success_metric,
      target_date:       extras.target_date,
      confidence_score:  extras.confidence_score,
      created_by:        extras.created_by ?? 'planning-agent',
    });
  }

  // ── Test helper ─────────────────────────────────────────────────

  __resetForTests(): void {
    this.plans.clear();
    this.milestones.clear();
    this.reviews = [];
    this.hook = {};
  }
}

function mapPriority(p: PlanPriority): 'low' | 'normal' | 'high' | 'critical' {
  return p;
}
