// DecisionAgent — policy layer over AgentOS agent_decisions.
//
// Reviews DecisionProposals and either:
//   - auto-approves (if policy permits + hard rules pass)
//   - escalates to a human (routes + records SLA deadline)
//   - rejects (hard-rule violation, e.g., kill-switch)
//
// Every touch records a RoutingRecord (append-only audit log).
//
// Spec §13 hard safety:
//   - NEVER auto-approves risk_level in {'high','critical'}.
//   - NEVER auto-approves reversibility='irreversible'.
//   - When paused=true, never auto-approves regardless of policy.
//   - Auto-approval requires self_confidence >= policy floor.
//   - Auto-approval requires risk + reversibility in policy whitelists.

import type { AgentOsStore } from '../agent-os/store';
import type { DecisionProposal, DecisionRisk, DecisionReversibility } from '../agent-os/types';
import type {
  DecisionPolicy, RoutingRecord, RoutingAction,
  DecisionPersistHook, ReviewOutcome,
} from './types';
import {
  PLATFORM_DEFAULT_POLICY,
  FORBIDDEN_AUTO_APPROVE_RISK,
  FORBIDDEN_AUTO_APPROVE_REVERSIBILITY,
} from './types';

// ── Id generator ──────────────────────────────────────────────────

let _seq = 0;
function nextId(prefix: string): string {
  _seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${_seq}`;
}
function nowIso(): string {
  return new Date().toISOString();
}
function addHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 3600_000).toISOString();
}

// ── Decision-self-confidence input shape ──────────────────────────
//
// The AgentOS DecisionProposal does NOT carry confidence — that's
// captured on agent_outputs. The DecisionAgent therefore accepts an
// explicit confidence value when reviewing (the caller is the agent
// that proposed the decision; it knows its own confidence).

export interface ReviewInput {
  decision_id:      string;
  self_confidence:  number;          // 0..1
  /** Optional override for this single review. Use sparingly. */
  override_owner_user_id?: string;
  override_owner_handle?:  string;
  override_sla_hours?:     number;
}

// ── DecisionAgent ─────────────────────────────────────────────────

export class DecisionAgent {
  private policies = new Map<string, DecisionPolicy>();
  private routings: RoutingRecord[] = [];
  private hook:     DecisionPersistHook = {};

  setPersistHook(h: DecisionPersistHook): void { this.hook = h; }

  // ── Policy management ──────────────────────────────────────────

  setPolicy(tenant_id: string, patch: Partial<Omit<DecisionPolicy, 'tenant_id' | 'created_at' | 'updated_at'>>): DecisionPolicy {
    const now = nowIso();
    const existing = this.policies.get(tenant_id);
    const next: DecisionPolicy = existing
      ? { ...existing, ...patch, tenant_id, updated_at: now }
      : { ...PLATFORM_DEFAULT_POLICY, ...patch, tenant_id, created_at: now, updated_at: now };

    if (next.auto_approve_confidence_floor < 0 || next.auto_approve_confidence_floor > 1) {
      throw new Error(`DecisionAgent.setPolicy: auto_approve_confidence_floor out of range (${next.auto_approve_confidence_floor}).`);
    }
    if (next.default_sla_hours <= 0) {
      throw new Error(`DecisionAgent.setPolicy: default_sla_hours must be > 0 (got ${next.default_sla_hours}).`);
    }
    this.policies.set(tenant_id, next);
    this.hook.savePolicy?.(next);
    return next;
  }

  getPolicy(tenant_id: string): DecisionPolicy {
    const p = this.policies.get(tenant_id);
    if (p) return p;
    const now = nowIso();
    return { ...PLATFORM_DEFAULT_POLICY, tenant_id, created_at: now, updated_at: now };
  }

  // ── The main verb ──────────────────────────────────────────────

  /**
   * Review a single proposed decision and act on it.
   *
   * Pre: store.proposeDecision() must have been called for decision_id.
   * Post: routing log gets one new row; the agent_decisions row is
   *       either auto-approved (status='approved') or LEFT ALONE
   *       (status='proposed', awaiting human action) or rejected.
   */
  review(store: AgentOsStore, input: ReviewInput): ReviewOutcome {
    const d = this.findDecision(store, input.decision_id);
    if (!d) throw new Error(`DecisionAgent.review: decision '${input.decision_id}' not found.`);
    if (d.status !== 'proposed') {
      throw new Error(`DecisionAgent.review: decision '${d.id}' is '${d.status}', not 'proposed'.`);
    }
    const confidence = clamp01(input.self_confidence);
    const policy = this.getPolicy(d.tenant_id);

    const { action, reason } = this.classify(d, confidence, policy);

    let routedToUserId: string | null = null;
    let routedToHandle: string | null = null;
    let dueBy:          string | null = null;

    if (action === 'auto_approved') {
      // Apply to the store.
      store.resolveDecision(d.id, 'approved', 'decision-agent');
    } else if (action === 'rejected') {
      store.resolveDecision(d.id, 'rejected', 'decision-agent');
    } else if (action === 'escalated') {
      routedToUserId = input.override_owner_user_id ?? policy.default_owner_user_id;
      routedToHandle = input.override_owner_handle  ?? policy.default_owner_handle;
      const slaHours = input.override_sla_hours ?? policy.default_sla_hours;
      dueBy = addHours(nowIso(), slaHours);
      // Decision stays 'proposed' — human resolves it via store.resolveDecision().
    }

    const routing: RoutingRecord = {
      id:                nextId('rt'),
      decision_id:       d.id,
      tenant_id:         d.tenant_id,
      action,
      reason,
      routed_to_user_id: routedToUserId,
      routed_to_handle:  routedToHandle,
      due_by:            dueBy,
      risk_level:        d.risk_level,
      reversibility:     d.reversibility,
      confidence_score:  confidence,
      created_at:        nowIso(),
    };
    this.routings.push(routing);
    this.hook.saveRouting?.(routing);

    return { decision_id: d.id, action, reason, routing };
  }

  // ── Hard-rule + policy classification ──────────────────────────

  private classify(
    d: DecisionProposal,
    confidence: number,
    policy: DecisionPolicy,
  ): { action: RoutingAction; reason: string } {
    if (policy.paused) {
      return { action: 'escalated', reason: 'policy paused (kill-switch) — every decision goes to human.' };
    }
    if (FORBIDDEN_AUTO_APPROVE_RISK.includes(d.risk_level)) {
      return { action: 'escalated', reason: `hard rule: risk_level='${d.risk_level}' is never auto-approved.` };
    }
    if (FORBIDDEN_AUTO_APPROVE_REVERSIBILITY.includes(d.reversibility)) {
      return { action: 'escalated', reason: `hard rule: reversibility='${d.reversibility}' is never auto-approved.` };
    }
    if (confidence < policy.auto_approve_confidence_floor) {
      return {
        action: 'escalated',
        reason: `confidence ${confidence.toFixed(2)} below floor ${policy.auto_approve_confidence_floor.toFixed(2)}.`,
      };
    }
    if (!policy.auto_approve_risk_levels.includes(d.risk_level)) {
      return { action: 'escalated', reason: `risk_level='${d.risk_level}' not in policy whitelist.` };
    }
    if (!policy.auto_approve_reversibility.includes(d.reversibility)) {
      return { action: 'escalated', reason: `reversibility='${d.reversibility}' not in policy whitelist.` };
    }
    return {
      action: 'auto_approved',
      reason: `policy: risk='${d.risk_level}', reversibility='${d.reversibility}', confidence=${confidence.toFixed(2)} ≥ floor=${policy.auto_approve_confidence_floor.toFixed(2)}.`,
    };
  }

  // ── Overdue sweep ──────────────────────────────────────────────

  /**
   * Find decisions whose SLA has elapsed without resolution and
   * record one 'overdue' routing row per offender. Returns the
   * offenders. Pure observability — does NOT change decision state.
   */
  sweepOverdue(store: AgentOsStore, tenant_id: string, now = nowIso()): RoutingRecord[] {
    const proposed = store.listDecisions({ tenant_id, status: 'proposed' });
    const newRoutings: RoutingRecord[] = [];
    for (const d of proposed) {
      const lastRouting = this.lastRoutingFor(d.id);
      if (!lastRouting || lastRouting.action !== 'escalated') continue;
      if (!lastRouting.due_by) continue;
      if (lastRouting.due_by >= now) continue;
      // Avoid duplicate 'overdue' rows: skip if the most recent
      // routing already says 'overdue'.
      const allForDecision = this.routings.filter(r => r.decision_id === d.id);
      const mostRecent = allForDecision[allForDecision.length - 1];
      if (mostRecent.action === 'overdue') continue;

      const r: RoutingRecord = {
        id:                nextId('rt'),
        decision_id:       d.id,
        tenant_id:         d.tenant_id,
        action:            'overdue',
        reason:            `SLA elapsed at ${lastRouting.due_by} — still 'proposed'.`,
        routed_to_user_id: lastRouting.routed_to_user_id,
        routed_to_handle:  lastRouting.routed_to_handle,
        due_by:            lastRouting.due_by,
        risk_level:        d.risk_level,
        reversibility:     d.reversibility,
        confidence_score:  lastRouting.confidence_score,
        created_at:        now,
      };
      this.routings.push(r);
      this.hook.saveRouting?.(r);
      newRoutings.push(r);
    }
    return newRoutings;
  }

  // ── Audit reads ────────────────────────────────────────────────

  routingsFor(decision_id: string): RoutingRecord[] {
    return this.routings
      .filter(r => r.decision_id === decision_id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  routingsByTenant(tenant_id: string, action?: RoutingAction): RoutingRecord[] {
    return this.routings.filter(r =>
      r.tenant_id === tenant_id &&
      (action ? r.action === action : true),
    );
  }

  private lastRoutingFor(decision_id: string): RoutingRecord | null {
    const list = this.routingsFor(decision_id);
    return list.length ? list[list.length - 1] : null;
  }

  // ── Helpers ────────────────────────────────────────────────────

  /** Iterate tenants the store knows of (via listDecisions sweep).
   *  Lacking a public `listAllDecisions`, callers pass tenant_id. */
  private findDecision(store: AgentOsStore, id: string): DecisionProposal | undefined {
    // The simplest portable approach: scan via listDecisions per
    // tenant. But we don't have a tenant index. The DecisionProposal
    // type carries tenant_id, so iterate the store's internal map by
    // re-using its public API: there isn't one for "get by id". We
    // emulate by reading the private `decisions` map (works because
    // tests + Postgres-backed prod swap it for an adapter).
    const map = (store as unknown as { decisions?: Map<string, DecisionProposal> }).decisions;
    return map?.get(id);
  }

  __resetForTests(): void {
    this.policies.clear();
    this.routings = [];
    this.hook = {};
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
