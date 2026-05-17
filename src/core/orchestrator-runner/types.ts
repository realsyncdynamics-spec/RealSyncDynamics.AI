// OrchestratorRunner — type system.
//
// The runner bundles three periodic operations into one report:
//   - hermes  → dailyHermesRun() per tenant
//   - monitoring → evaluate() per tenant
//   - decision   → sweepOverdue() per tenant
//
// These shapes describe what each step emits so the runner result
// is machine-checkable in tests and observable in production.

export type RunCadence = 'hourly' | 'daily';

export interface PerTenantRunReport {
  tenant_id:                   string;
  hermes_brief_created:        boolean;
  hermes_brief_id:             string | null;
  monitoring_slos_evaluated:   number;
  monitoring_slos_breached:    number;
  decision_overdue_flagged:    number;
  errors:                      string[];
}

export interface RunReport {
  cadence:        RunCadence;
  started_at:     string;
  completed_at:   string;
  duration_ms:    number;
  tenants:        PerTenantRunReport[];
  total_errors:   number;
}
