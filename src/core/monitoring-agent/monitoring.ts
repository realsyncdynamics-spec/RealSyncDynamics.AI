// MonitoringAgent — SLO-defined observability over the AgentOS event stream.
//
// Pure observation. NEVER takes corrective action — only emits
// AgentObservation rows via the AgentOS store. Humans (or
// DecisionAgent) decide what to do about an alert.
//
// Phase A: in-memory SLO catalogue + persist-hook. evaluate() scans
// the store's task + decision lists, computes each metric, and emits
// one observation per breached SLO.
//
// Spec §14 hard safety:
//   - Never modifies a task / decision / memory.
//   - Never pauses an agent.
//   - Every breach produces exactly ONE observation (severity from SLO).
//   - Idempotent: evaluating twice in the same window with no state
//     change emits no duplicate observations.

import type { AgentOsStore } from '../agent-os/store';
import type {
  SloDefinition, SloMetric, SloComparator,
  EvaluationResult, MonitoringPersistHook,
} from './types';

let _seq = 0;
function nextId(prefix: string): string {
  _seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${_seq}`;
}
function nowIso(): string { return new Date().toISOString(); }

// ── Public input shapes ───────────────────────────────────────────

export interface DefineSloInput {
  tenant_id:       string;
  name:            string;
  description?:    string;
  agent?:          string;
  metric:          SloMetric;
  comparator:      SloComparator;
  threshold:       number;
  window_hours?:   number;
  alert_severity?: SloDefinition['alert_severity'];
  enabled?:        boolean;
}

// ── The agent ─────────────────────────────────────────────────────

export class MonitoringAgent {
  private slos    = new Map<string, SloDefinition>();
  private fired   = new Set<string>();           // slo_id-window keys already alerted on
  private hook: MonitoringPersistHook = {};

  setPersistHook(h: MonitoringPersistHook): void { this.hook = h; }

  // ── SLO management ─────────────────────────────────────────────

  defineSlo(input: DefineSloInput): SloDefinition {
    if (!input.name?.trim()) {
      throw new Error("MonitoringAgent.defineSlo: 'name' is required.");
    }
    if (input.window_hours !== undefined && (input.window_hours <= 0 || input.window_hours > 720)) {
      throw new Error(`MonitoringAgent.defineSlo: window_hours out of (0, 720] (got ${input.window_hours}).`);
    }
    // Enforce uniqueness on (tenant_id, name).
    for (const existing of this.slos.values()) {
      if (existing.tenant_id === input.tenant_id && existing.name === input.name) {
        throw new Error(`MonitoringAgent.defineSlo: SLO '${input.name}' already exists for tenant '${input.tenant_id}'.`);
      }
    }
    const now = nowIso();
    const slo: SloDefinition = {
      id:             nextId('slo'),
      tenant_id:      input.tenant_id,
      name:           input.name.trim(),
      description:    input.description?.trim() || null,
      agent:          input.agent ?? null,
      metric:         input.metric,
      comparator:     input.comparator,
      threshold:      input.threshold,
      window_hours:   input.window_hours ?? 24,
      alert_severity: input.alert_severity ?? 'high',
      enabled:        input.enabled ?? true,
      created_at:     now,
      updated_at:     now,
    };
    this.slos.set(slo.id, slo);
    this.hook.saveSlo?.(slo);
    return slo;
  }

  setEnabled(slo_id: string, enabled: boolean): SloDefinition {
    const s = this.slos.get(slo_id);
    if (!s) throw new Error(`MonitoringAgent.setEnabled: SLO '${slo_id}' not found.`);
    s.enabled = enabled;
    s.updated_at = nowIso();
    this.hook.saveSlo?.(s);
    return s;
  }

  listSlos(tenant_id: string): SloDefinition[] {
    return [...this.slos.values()].filter(s => s.tenant_id === tenant_id);
  }

  // ── Evaluation ─────────────────────────────────────────────────

  /**
   * Evaluate every enabled SLO for a tenant. Each breach emits one
   * AgentObservation via the store. Returns the per-SLO results
   * (whether breached or not) so callers can present a status panel.
   *
   * `decisionRoutingsByTenant`: optional escalation-rate source. When
   * provided as a function (delegated DecisionAgent.routingsByTenant),
   * MonitoringAgent uses its output to compute the rate; otherwise
   * the rate evaluates to 0/0 → not breached.
   */
  evaluate(
    store: AgentOsStore,
    tenant_id: string,
    opts: {
      now?: string;
      decisionRoutingsByTenant?: (tenant_id: string) => Array<{ action: string; created_at: string }>;
    } = {},
  ): EvaluationResult[] {
    const now = opts.now ?? nowIso();
    const out: EvaluationResult[] = [];

    for (const slo of this.slos.values()) {
      if (slo.tenant_id !== tenant_id) continue;
      if (!slo.enabled) continue;

      const observed = this.measure(store, slo, now, opts.decisionRoutingsByTenant);
      const breached = slo.comparator === 'gt'
        ? observed > slo.threshold
        : observed < slo.threshold;

      let observation_id: string | null = null;
      if (breached) {
        const windowBucket = this.bucket(now, slo.window_hours);
        const fireKey = `${slo.id}@${windowBucket}`;
        if (!this.fired.has(fireKey)) {
          const obs = store.recordObservation({
            tenant_id,
            agent: slo.agent ?? 'monitoring-agent',
            category: 'slo',
            severity: slo.alert_severity,
            title: `SLO breach: ${slo.name}`,
            detail: `metric=${slo.metric} ${slo.comparator} ${slo.threshold} | observed=${observed}` + (slo.agent ? ` | agent=${slo.agent}` : ''),
            data: {
              slo_id:      slo.id,
              slo_name:    slo.name,
              metric:      slo.metric,
              comparator:  slo.comparator,
              threshold:   slo.threshold,
              observed,
              window_hours: slo.window_hours,
              agent:       slo.agent,
            },
          });
          observation_id = obs.id;
          this.fired.add(fireKey);
        }
      }

      out.push({
        slo_id:        slo.id,
        slo_name:      slo.name,
        tenant_id,
        agent:         slo.agent,
        metric:        slo.metric,
        observed,
        threshold:     slo.threshold,
        comparator:    slo.comparator,
        breached,
        observation_id,
        evaluated_at:  now,
      });
    }
    return out;
  }

  // ── Metric computation ─────────────────────────────────────────

  private measure(
    store: AgentOsStore,
    slo: SloDefinition,
    now: string,
    decisionRoutings?: (tenant_id: string) => Array<{ action: string; created_at: string }>,
  ): number {
    const windowStart = new Date(new Date(now).getTime() - slo.window_hours * 3600_000).toISOString();
    const tasks = store.listTasks({ tenant_id: slo.tenant_id })
      .filter(t => slo.agent ? t.agent === slo.agent : true);

    switch (slo.metric) {
      case 'task_failure_rate': {
        const inWindow = tasks.filter(t =>
          (t.completed_at ?? t.created_at) >= windowStart &&
          (t.status === 'done' || t.status === 'failed')
        );
        if (inWindow.length === 0) return 0;
        const failed = inWindow.filter(t => t.status === 'failed').length;
        return Number((failed / inWindow.length).toFixed(4));
      }
      case 'task_open_count':
        return tasks.filter(t => t.status === 'open').length;
      case 'task_blocked_count':
        return tasks.filter(t => t.status === 'blocked').length;
      case 'observation_unack_count': {
        const obs = store.listObservations({ tenant_id: slo.tenant_id })
          .filter(o => slo.agent ? o.agent === slo.agent : true)
          .filter(o => !o.acknowledged)
          .filter(o => o.severity === 'high' || o.severity === 'critical');
        return obs.length;
      }
      case 'decision_escalation_rate': {
        if (!decisionRoutings) return 0;
        const routings = decisionRoutings(slo.tenant_id)
          .filter(r => r.created_at >= windowStart);
        if (routings.length === 0) return 0;
        const escalated = routings.filter(r => r.action === 'escalated').length;
        return Number((escalated / routings.length).toFixed(4));
      }
    }
  }

  private bucket(now: string, windowHours: number): string {
    // Map an ISO timestamp to a coarse window bucket so two
    // evaluations within the same window-hours stretch produce the
    // same key (idempotency anchor).
    const ms = new Date(now).getTime();
    const bucketMs = windowHours * 3600_000;
    return String(Math.floor(ms / bucketMs));
  }

  __resetForTests(): void {
    this.slos.clear();
    this.fired.clear();
    this.hook = {};
  }
}
