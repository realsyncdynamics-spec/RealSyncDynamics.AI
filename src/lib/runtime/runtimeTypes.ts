// Typed shapes for the Runtime UI surfaces.
//
// Diese Typen sind frontend-only und entkoppeln die UI von einem
// konkreten Backend. Sobald reale Quellen verfuegbar sind, werden
// Adapter (z. B. supabase -> RuntimeEvent) eingehaengt.

export type RuntimeSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type RuntimeEventCategory =
  | 'governance'
  | 'agent'
  | 'evidence'
  | 'audit'
  | 'infrastructure'
  | 'drift';

export type RuntimeKpiTrend = 'up' | 'down' | 'flat';

export interface RuntimeKpi {
  id:        string;
  label:     string;
  value:     string;
  unit?:     string;
  trend?:    RuntimeKpiTrend;
  delta?:    string;
  /** Honest state — keine production-Behauptung ohne Beleg. */
  state:     'demo' | 'partial' | 'review_required' | 'not_connected' | 'live';
  hint?:     string;
}

export interface RuntimeAgent {
  id:           string;
  name:         string;
  role:         string;
  status:       'idle' | 'running' | 'review_required' | 'paused' | 'offline';
  last_seen:    string;
  evidence_id?: string;
  notes?:       string;
}

export interface RuntimeIncident {
  id:            string;
  severity:      RuntimeSeverity;
  title:         string;
  rule_id?:      string;
  rule_version?: string;
  detected_at:   string;
  source_url?:   string;
  status:        'open' | 'review_required' | 'mitigated' | 'closed';
}

export interface RuntimeEvidenceEvent {
  id:           string;
  occurred_at:  string;
  subject:      string;
  hash?:        string;
  agent?:       string;
  category:     RuntimeEventCategory;
}

export interface RuntimeLogEntry {
  id:           string;
  occurred_at:  string;
  severity:     RuntimeSeverity;
  category:     RuntimeEventCategory;
  message:      string;
  source?:      string;
}

export interface RuntimeInfraSignal {
  id:       string;
  label:    string;
  state:    'ok' | 'warn' | 'fail' | 'unknown';
  detail?:  string;
}

export interface RuntimeOverview {
  generated_at: string;
  source_label: 'demo' | 'simulated' | 'live';
  kpis:         RuntimeKpi[];
  agents:       RuntimeAgent[];
  incidents:    RuntimeIncident[];
  evidence:     RuntimeEvidenceEvent[];
  infra:        RuntimeInfraSignal[];
  log:          RuntimeLogEntry[];
}
