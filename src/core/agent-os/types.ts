// Agent OS — type system for the substrate.
//
// Mirrors the 7 tables in supabase/migrations/<ts>_agent_os_substrate.sql.
// Pure types only; the operational APIs live in memory.ts, tasks.ts,
// decisions.ts and orchestrator.ts.

// ── Agent roles (shared with trainer-agent — kept here to allow
//    agent-os to be consumed standalone) ─────────────────────────────

export type AgentName = string;  // kebab-case agent identifier

// ── 1. agent_memory ────────────────────────────────────────────────

export type MemoryStatus = 'active' | 'superseded' | 'redacted';

export interface MemoryItem {
  id:                 string;
  tenant_id:          string;
  source:             string | null;        // origin (agent | system | external)
  source_agent:       string | null;        // capturing agent
  topic:              string;
  content:            string;
  tags:               string[];
  importance:         1 | 2 | 3 | 4 | 5;
  status:             MemoryStatus;
  superseded_by:      string | null;
  decided_action:     string | null;
  responsible_agent:  string | null;
  created_at:         string;
  updated_at:         string;
}

export interface MemoryQuery {
  tenant_id:   string;
  topic?:      string;
  tag?:        string;
  status?:     MemoryStatus;
  min_importance?: number;
  limit?:      number;
}

// ── 2. agent_tasks ─────────────────────────────────────────────────

export type TaskStatus =
  | 'open' | 'in_progress' | 'blocked'
  | 'done' | 'failed' | 'cancelled';

export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

export interface AgentTask {
  id:             string;
  tenant_id:      string;
  agent:          AgentName;            // assignee
  task:           string;               // short description
  priority:       TaskPriority;
  status:         TaskStatus;
  input:          Record<string, unknown>;
  output:         Record<string, unknown> | null;
  blocker_reason: string | null;
  parent_task_id: string | null;
  created_by:     string | null;        // agent | user id | 'system'
  created_at:     string;
  started_at:     string | null;
  completed_at:   string | null;
}

// ── 3. agent_decisions ─────────────────────────────────────────────

export type DecisionStatus =
  | 'proposed' | 'approved' | 'rejected' | 'superseded' | 'withdrawn';

export type DecisionRisk = 'low' | 'medium' | 'high' | 'critical';

export type DecisionReversibility =
  | 'reversible' | 'partially_reversible' | 'irreversible';

export interface DecisionOption {
  label:    string;
  detail?:  string;
  pros?:    string[];
  cons?:    string[];
  cost?:    string;
  impact?:  string;
}

export interface DecisionProposal {
  id:               string;
  tenant_id:        string;
  decision_title:   string;
  problem:          string;
  options:          DecisionOption[];
  recommendation:   string;             // matches one of options[].label
  reason:           string;
  risk_level:       DecisionRisk;
  reversibility:    DecisionReversibility;
  status:           DecisionStatus;
  proposed_by:      AgentName;
  approved_by:      string | null;      // auth.users(id) when approved
  approved_at:      string | null;
  superseded_by:    string | null;
  created_at:       string;
}

// ── 4. agent_inputs ────────────────────────────────────────────────

export interface AgentInput {
  id:         string;
  tenant_id:  string;
  source:     string;                   // 'webhook','scan','upload', …
  source_id:  string | null;
  payload:    Record<string, unknown>;
  received_at: string;
}

// ── 5. agent_outputs ───────────────────────────────────────────────

export interface AgentOutputRecord {
  id:              string;
  tenant_id:       string;
  task_id:         string | null;
  agent:           AgentName;
  content:         unknown;
  self_confidence: number | null;       // 0..100
  evidence:        string[];
  risk_dimensions: string[];
  produced_at:     string;
}

// ── 6. agent_observations ──────────────────────────────────────────

export type ObservationSeverity =
  | 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface AgentObservation {
  id:            string;
  tenant_id:     string;
  agent:         AgentName;
  category:      string;                // 'health','traffic','competitor', …
  severity:      ObservationSeverity;
  title:         string;
  detail:        string | null;
  data:          Record<string, unknown>;
  acknowledged:  boolean;
  created_at:    string;
}

// ── 7. agent_events ────────────────────────────────────────────────

export type AgentEventType =
  | 'task.created' | 'task.started' | 'task.completed' | 'task.failed' | 'task.blocked' | 'task.unblocked' | 'task.cancelled'
  | 'memory.added' | 'memory.superseded' | 'memory.redacted'
  | 'decision.proposed' | 'decision.approved' | 'decision.rejected' | 'decision.withdrawn' | 'decision.superseded'
  | 'observation.recorded' | 'observation.acknowledged'
  | 'input.received'
  | 'output.produced';

export interface AgentEvent {
  /** Monotonic per tenant — backed by BIGSERIAL in Postgres. */
  id:           number;
  tenant_id:    string;
  event_type:   AgentEventType;
  subject_type: 'task' | 'memory' | 'decision' | 'observation' | 'input' | 'output';
  subject_id:   string;
  agent:        AgentName | null;
  payload:      Record<string, unknown>;
  created_at:   string;
}

// ── Persistence hook (for the in-memory → Postgres swap) ──────────

export interface AgentOsPersistHook {
  saveMemory?:       (m: MemoryItem)        => Promise<void> | void;
  saveTask?:         (t: AgentTask)         => Promise<void> | void;
  saveDecision?:     (d: DecisionProposal)  => Promise<void> | void;
  saveInput?:        (i: AgentInput)        => Promise<void> | void;
  saveOutput?:       (o: AgentOutputRecord) => Promise<void> | void;
  saveObservation?:  (o: AgentObservation)  => Promise<void> | void;
  saveEvent?:        (e: AgentEvent)        => Promise<void> | void;
}
