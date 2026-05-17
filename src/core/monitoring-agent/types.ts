// MonitoringAgent — type system.

import type { ObservationSeverity } from '../agent-os/types';

export type SloMetric =
  | 'task_failure_rate'
  | 'decision_escalation_rate'
  | 'task_open_count'
  | 'task_blocked_count'
  | 'observation_unack_count';

export type SloComparator = 'gt' | 'lt';

export interface SloDefinition {
  id:              string;
  tenant_id:       string;
  name:            string;
  description:     string | null;
  agent:           string | null;       // null = tenant-wide
  metric:          SloMetric;
  comparator:      SloComparator;
  threshold:       number;
  window_hours:    number;
  alert_severity:  ObservationSeverity;
  enabled:         boolean;
  created_at:      string;
  updated_at:      string;
}

export interface EvaluationResult {
  slo_id:           string;
  slo_name:         string;
  tenant_id:        string;
  agent:            string | null;
  metric:           SloMetric;
  observed:         number;
  threshold:        number;
  comparator:       SloComparator;
  breached:         boolean;
  /** Set when breached=true and an observation was emitted. */
  observation_id:   string | null;
  evaluated_at:     string;
}

export interface MonitoringPersistHook {
  saveSlo?: (s: SloDefinition) => Promise<void> | void;
}
