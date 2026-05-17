// OrchestratorRunner — periodic agent operations.
//
// This module is the CRON ENTRY POINT for the multi-agent OS. It
// bundles three independent per-tenant operations into one report:
//
//   hourly cadence:
//     - monitoring.evaluate(store, tenant_id)   (SLO sweep)
//     - decision.sweepOverdue(store, tenant_id) (SLA sweep)
//
//   daily cadence:
//     - hermes.dailyHermesRun({ tenant_id })    (research+brief)
//     - monitoring.evaluate(store, tenant_id)
//     - decision.sweepOverdue(store, tenant_id)
//
// Tenant isolation: each tenant is run in its own try/catch so one
// tenant's failure can't poison the rest. Errors get folded into
// the PerTenantRunReport — the runner ALWAYS returns a report,
// never throws.
//
// Structural typing: the runner accepts ANY object that implements
// the verb subset it actually calls. That way this PR doesn't depend
// on hermes/monitoring/decision being merged into main — each agent's
// class is structurally compatible with the matching interface here.

import type { RunCadence, RunReport, PerTenantRunReport } from './types';

// ── Structural interfaces (duck-typed) ────────────────────────────

export interface HermesLike {
  dailyHermesRun(args: { tenant_id: string; inputs?: unknown[] }): Promise<{ id: string }>;
}

export interface MonitoringLike {
  evaluate(
    store: unknown,
    tenant_id: string,
    opts?: {
      now?: string;
      decisionRoutingsByTenant?: (tenant_id: string) => Array<{ action: string; created_at: string }>;
    },
  ): Array<{ breached: boolean }>;
}

export interface DecisionLike {
  sweepOverdue(store: unknown, tenant_id: string, now?: string): Array<unknown>;
  routingsByTenant(tenant_id: string): Array<{ action: string; created_at: string }>;
}

export interface RunnerAgents {
  hermes?:     HermesLike;
  monitoring?: MonitoringLike;
  decision?:   DecisionLike;
  store:       unknown;
}

export interface RunOptions {
  /** Tenants to process. Required — the runner refuses to iterate
   *  blindly because in-memory state isn't auto-keyed by tenant. */
  tenant_ids:  string[];
  /** Inputs to dailyHermesRun per tenant (optional). Keyed by
   *  tenant_id; tenants not listed get no input (Hermes will
   *  still emit a brief from whatever it already has). */
  hermes_inputs?: Record<string, unknown[]>;
  /** Override "now" for deterministic tests. */
  now?: string;
}

function nowIso(): string { return new Date().toISOString(); }

// ── Public verbs ──────────────────────────────────────────────────

export async function runHourly(
  agents: RunnerAgents,
  opts: RunOptions,
): Promise<RunReport> {
  return runImpl(agents, opts, 'hourly');
}

export async function runDaily(
  agents: RunnerAgents,
  opts: RunOptions,
): Promise<RunReport> {
  return runImpl(agents, opts, 'daily');
}

// ── Implementation ────────────────────────────────────────────────

async function runImpl(
  agents: RunnerAgents,
  opts: RunOptions,
  cadence: RunCadence,
): Promise<RunReport> {
  const started_at = opts.now ?? nowIso();
  const t0 = Date.now();
  const perTenant: PerTenantRunReport[] = [];

  for (const tenant_id of opts.tenant_ids) {
    const r: PerTenantRunReport = {
      tenant_id,
      hermes_brief_created:      false,
      hermes_brief_id:           null,
      monitoring_slos_evaluated: 0,
      monitoring_slos_breached:  0,
      decision_overdue_flagged:  0,
      errors:                    [],
    };

    // Hermes is daily-only. Skip if not provided.
    if (cadence === 'daily' && agents.hermes) {
      try {
        const inputs = opts.hermes_inputs?.[tenant_id] ?? [];
        const brief = await agents.hermes.dailyHermesRun({ tenant_id, inputs });
        if (brief) {
          r.hermes_brief_created = true;
          r.hermes_brief_id = brief.id;
        }
      } catch (e) {
        r.errors.push(`hermes: ${(e as Error).message ?? String(e)}`);
      }
    }

    // Monitoring SLO sweep (both cadences). Skip if not provided.
    if (agents.monitoring) {
      try {
        const results = agents.monitoring.evaluate(agents.store, tenant_id, {
          now: opts.now,
          decisionRoutingsByTenant: agents.decision
            ? (tid: string) => agents.decision!.routingsByTenant(tid)
            : undefined,
        });
        r.monitoring_slos_evaluated = results.length;
        r.monitoring_slos_breached  = results.filter(x => x.breached).length;
      } catch (e) {
        r.errors.push(`monitoring: ${(e as Error).message ?? String(e)}`);
      }
    }

    // Decision SLA sweep (both cadences). Skip if not provided.
    if (agents.decision) {
      try {
        const overdue = agents.decision.sweepOverdue(agents.store, tenant_id, opts.now);
        r.decision_overdue_flagged = overdue.length;
      } catch (e) {
        r.errors.push(`decision: ${(e as Error).message ?? String(e)}`);
      }
    }

    perTenant.push(r);
  }

  const completed_at = nowIso();
  return {
    cadence,
    started_at,
    completed_at,
    duration_ms:   Date.now() - t0,
    tenants:       perTenant,
    total_errors:  perTenant.reduce((acc, t) => acc + t.errors.length, 0),
  };
}
