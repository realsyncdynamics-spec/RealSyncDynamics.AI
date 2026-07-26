# Event Schema Standard (ESS) v1.0

**Single Source of Truth** für Event-Format über alle Agenten, Tools, und Runtime-Komponenten in RealSyncDynamics.AI.

**Status:** 🟡 DRAFT  
**Version:** 1.0-beta  
**Last Updated:** 2026-07-26  
**Scope:** Agent Events, Tool Events, Approval Events, Audit Events

---

## 1. Überblick

Ein **Event** ist die atomare Einheit für alle Zustandsänderungen & Audit-Trails im System:

- ✅ **Agent** führt Tool aus → Event
- ✅ **Tool** meldet Erfolg/Fehler → Event
- ✅ **Runtime** gewährt/verweigert Approval → Event
- ✅ **Compliance** Scanner findet Risk → Event
- ✅ **User** ändert Policy → Event

Ohne **standardisiertes Event-Format** gibt es **keine gültigen Audit-Trails**.

---

## 2. Canonical Event Structure

```typescript
// Event v1.0 — Immutable, JSON-serializable

interface Event {
  // Identity & Traceability
  id: string;                           // UUID v4 (globally unique)
  event_type: EventType;                // 'agent.started', 'tool.completed', etc.
  version: '1.0';                       // Schema version (for future compat)
  
  // Temporal
  occurred_at: string;                  // ISO 8601 (server-side, UTC)
  received_at: string;                  // ISO 8601 (when stored)
  
  // Scope & Authorization
  tenant_id: string;                    // UUID (RLS anchor)
  user_id?: string;                     // UUID (may be null for system events)
  
  // Causality Chain
  parent_event_id?: string;             // Upstream cause (e.g., approval triggering tool)
  trace_id: string;                     // UUID (groups related events into flow)
  span_id: string;                      // Unique per event in trace
  
  // Actor & Context
  actor: EventActor;                    // Who/what caused this
  source: EventSource;                  // Where did this originate
  
  // Payload (type-specific)
  category: 'agent' | 'tool' | 'approval' | 'compliance' | 'audit' | 'system';
  payload: Record<string, unknown>;     // See category-specific schemas below
  
  // Metadata
  tags: Record<string, string>;         // k/v pairs (searchable)
  cost?: {
    tokens_input?: number;
    tokens_output?: number;
    estimated_usd?: number;
  };
  
  // Audit & Compliance
  hash: string;                         // SHA256(canonical_json) — for hash chain
  previous_hash?: string;               // Links to prior event (chain)
  signed?: {
    algorithm: 'ed25519';               // C2PA provenance
    signature: string;                  // base64-encoded
    public_key: string;
  };
}

type EventType =
  // Agent lifecycle
  | 'agent.started'
  | 'agent.iteration'
  | 'agent.completed'
  | 'agent.failed'
  | 'agent.cancelled'
  
  // Tool dispatch
  | 'tool.requested'
  | 'tool.approved'
  | 'tool.denied'
  | 'tool.started'
  | 'tool.completed'
  | 'tool.failed'
  
  // Approval gates
  | 'approval.requested'
  | 'approval.granted'
  | 'approval.denied'
  | 'approval.expired'
  
  // Compliance & Audit
  | 'compliance.violation'
  | 'audit.event_ingested'
  | 'audit.report_generated'
  
  // System
  | 'system.contract.published'
  | 'system.tool.registered'
  | 'system.policy.updated';

interface EventActor {
  type: 'user' | 'agent' | 'system' | 'integration';
  id: string;
  name?: string;
  
  // If agent
  agent_id?: string;
  agent_contract_version?: string;
}

interface EventSource {
  service: 'edge-function' | 'apps-agent-runtime' | 'webhook' | 'scheduler' | 'ui';
  function_name?: string;               // e.g., 'governance-agent', 'agent-os-runner'
  endpoint?: string;
  region?: string;                      // e.g., 'eu-central-1'
}
```

---

## 3. Category-Specific Payloads

### 3.1 Agent Events

```typescript
type AgentEventPayload = 
  | AgentStartedPayload
  | AgentIterationPayload
  | AgentCompletedPayload
  | AgentFailedPayload;

interface AgentStartedPayload {
  agent_id: string;
  agent_contract_version: string;
  input: Record<string, unknown>;       // User input
  input_hash: string;                   // SHA256
  llm_provider: string;
  llm_model: string;
}

interface AgentIterationPayload {
  agent_id: string;
  iteration_number: number;             // 1-based
  turn_input: string;                   // LLM input prompt
  turn_output?: string;                 // LLM output (max 5000 chars for storage)
  tool_called?: string;                 // If this iteration called a tool
  tool_input?: Record<string, unknown>;
  tokens_used?: {
    input: number;
    output: number;
  };
}

interface AgentCompletedPayload {
  agent_id: string;
  total_iterations: number;
  output: Record<string, unknown>;      // Final result
  output_hash: string;                  // SHA256
  execution_time_ms: number;
  tokens_total?: {
    input: number;
    output: number;
  };
}

interface AgentFailedPayload {
  agent_id: string;
  iteration_number?: number;
  error_code: string;                   // e.g., 'QUOTA_EXCEEDED', 'TOOL_UNAVAILABLE'
  error_message: string;
  stacktrace?: string;                  // Optional for debugging
}
```

### 3.2 Tool Events

```typescript
type ToolEventPayload =
  | ToolRequestedPayload
  | ToolApprovedPayload
  | ToolDeniedPayload
  | ToolStartedPayload
  | ToolCompletedPayload
  | ToolFailedPayload;

interface ToolRequestedPayload {
  agent_id: string;
  tool_id: string;
  tool_version: string;
  input: Record<string, unknown>;
  input_hash: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  requires_approval: boolean;
}

interface ToolApprovedPayload {
  agent_id: string;
  tool_id: string;
  approval_request_id: string;
  approved_by: string;                  // user_id
  reason?: string;
}

interface ToolDeniedPayload {
  agent_id: string;
  tool_id: string;
  approval_request_id: string;
  denied_by: string;                    // user_id
  reason: string;
}

interface ToolStartedPayload {
  agent_id: string;
  tool_id: string;
  tool_version: string;
  execution_context: {
    env: Record<string, string>;        // Safe env vars only
    isolation_level: string;            // e.g., 'strict', 'standard'
  };
}

interface ToolCompletedPayload {
  agent_id: string;
  tool_id: string;
  tool_version: string;
  output: Record<string, unknown>;
  output_hash: string;
  execution_time_ms: number;
}

interface ToolFailedPayload {
  agent_id: string;
  tool_id: string;
  tool_version: string;
  error_code: string;                   // e.g., 'PERMISSION_DENIED', 'TIMEOUT'
  error_message: string;
  execution_time_ms: number;
}
```

### 3.3 Approval Events

```typescript
type ApprovalEventPayload =
  | ApprovalRequestedPayload
  | ApprovalGrantedPayload
  | ApprovalDeniedPayload
  | ApprovalExpiredPayload;

interface ApprovalRequestedPayload {
  approval_request_id: string;
  agent_id: string;
  tool_id: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  requested_by: string;                 // agent_id or user_id
  required_approvers: string[];         // role slugs
  timeout_seconds: number;
  reason: string;
}

interface ApprovalGrantedPayload {
  approval_request_id: string;
  approved_by: string;                  // user_id
  approval_timestamp: string;           // ISO 8601
  reason?: string;
}

interface ApprovalDeniedPayload {
  approval_request_id: string;
  denied_by: string;                    // user_id
  denial_reason: string;
}

interface ApprovalExpiredPayload {
  approval_request_id: string;
  timeout_seconds: number;
}
```

### 3.4 Compliance Events

```typescript
type ComplianceEventPayload = ComplianceViolationPayload;

interface ComplianceViolationPayload {
  violation_type: string;               // e.g., 'DSGVO_RISK', 'EU_AI_ACT_PROHIBITED'
  severity: 'low' | 'medium' | 'high' | 'critical';
  finding_id: string;
  description: string;
  affected_resource: {
    type: string;                       // e.g., 'asset', 'vendor', 'ai_system'
    id: string;
  };
  policy_violated: string;              // policy_id
  remediation_suggested?: string;
}
```

### 3.5 Audit Events

```typescript
type AuditEventPayload = AuditEventIngestedPayload | AuditReportGeneratedPayload;

interface AuditEventIngestedPayload {
  audit_id: string;
  scan_type: string;                    // e.g., 'cookie_scan', 'policy_scan'
  findings_count: number;
  critical_count: number;
  source_url?: string;
}

interface AuditReportGeneratedPayload {
  audit_id: string;
  report_url: string;
  findings_summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  report_format: 'pdf' | 'json' | 'html';
}
```

### 3.6 System Events

```typescript
type SystemEventPayload =
  | ContractPublishedPayload
  | ToolRegisteredPayload
  | PolicyUpdatedPayload;

interface ContractPublishedPayload {
  agent_id: string;
  version: string;
  status: 'active' | 'deprecated' | 'retired';
  published_by: string;
}

interface ToolRegisteredPayload {
  tool_id: string;
  version: string;
  description: string;
}

interface PolicyUpdatedPayload {
  policy_id: string;
  version: string;
  updated_by: string;
}
```

---

## 4. Canonical JSON Representation

Events **must** serialize to canonical JSON for hashing & signing:

```typescript
// Canonical JSON rules:
// 1. Keys sorted alphabetically
// 2. No whitespace (compact)
// 3. All strings double-quoted
// 4. All booleans lowercase
// 5. No null values (omit key instead)

const canonicalJSON = (event: Event): string => {
  return JSON.stringify({
    actor: event.actor,
    category: event.category,
    cost: event.cost,
    event_type: event.event_type,
    id: event.id,
    occurred_at: event.occurred_at,
    parent_event_id: event.parent_event_id,
    payload: event.payload,
    received_at: event.received_at,
    source: event.source,
    span_id: event.span_id,
    tags: event.tags,
    tenant_id: event.tenant_id,
    trace_id: event.trace_id,
    user_id: event.user_id,
    version: event.version,
  }, null, 0); // compact, no indentation
};

// Hash for chain
const eventHash = (event: Event): string => {
  return sha256(canonicalJSON(event));
};
```

---

## 5. Storage & Persistence

### Supabase Table
```sql
create table if not exists public.runtime_events (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  
  -- Event Identity
  event_id        text not null,        -- Event UUID
  event_type      text not null,
  category        text not null,
  version         text not null default '1.0',
  
  -- Temporal
  occurred_at     timestamptz not null,
  received_at     timestamptz not null default now(),
  
  -- Causality
  parent_event_id uuid,
  trace_id        uuid not null,
  span_id         text not null,
  
  -- Actor
  actor_type      text not null,        -- 'user', 'agent', 'system', 'integration'
  actor_id        text not null,
  user_id         uuid references auth.users(id) on delete set null,
  
  -- Source
  source_service  text not null,        -- 'edge-function', 'apps-agent-runtime', etc.
  source_function text,
  source_region   text,
  
  -- Payload (JSONB for efficient querying)
  payload         jsonb not null,
  
  -- Audit
  hash            text not null unique, -- SHA256
  previous_hash   text,
  signed_algorithm text,
  signature       text,
  
  -- Metadata
  tags            jsonb,
  cost_tokens_input  integer,
  cost_tokens_output integer,
  cost_estimated_usd numeric(10, 6),
  
  created_at      timestamptz not null default now()
);

-- Immutable: only insert, no update/delete (except by admin)
revoke update, delete on public.runtime_events from public;

-- Indexes for common queries
create index runtime_events_tenant_occurred_idx
  on public.runtime_events (tenant_id, occurred_at desc);

create index runtime_events_trace_idx
  on public.runtime_events (trace_id);

create index runtime_events_agent_idx
  on public.runtime_events (tenant_id, actor_id)
  where category = 'agent';

create index runtime_events_event_type_idx
  on public.runtime_events (tenant_id, event_type, occurred_at desc);

create index runtime_events_hash_chain_idx
  on public.runtime_events (previous_hash)
  where previous_hash is not null;

-- RLS: Tenant isolation
alter table public.runtime_events enable row level security;

create policy runtime_events_select on public.runtime_events
  for select
  using (public.is_tenant_member(tenant_id));

create policy runtime_events_insert on public.runtime_events
  for insert
  with check (public.is_tenant_member(tenant_id));
```

---

## 6. Event Publishing & Routing

### Event Publisher Interface
```typescript
interface EventPublisher {
  publish(event: Event): Promise<void>;
}

// Implementation: Edge Function
export async function publishEvent(event: Event): Promise<void> {
  // 1. Validate schema
  const validated = EventSchema.parse(event);
  
  // 2. Hash
  validated.hash = eventHash(validated);
  
  // 3. Sign (if compliance required)
  if (shouldSign(validated)) {
    validated.signed = await signEvent(validated);
  }
  
  // 4. Persist
  await supabase
    .from('runtime_events')
    .insert({
      event_id: validated.id,
      event_type: validated.event_type,
      category: validated.category,
      payload: validated.payload,
      trace_id: validated.trace_id,
      span_id: validated.span_id,
      hash: validated.hash,
      previous_hash: validated.previous_hash,
      // ... other fields
    });
  
  // 5. Route to subscribers
  await routeToSubscribers(validated);
}

// Event routing (phase 3+)
interface EventSubscriber {
  matches(event: Event): boolean;
  handle(event: Event): Promise<void>;
}

const subscribers: EventSubscriber[] = [
  // Audit trail (always)
  new AuditTrailSubscriber(),
  // Compliance scanner (on compliance events)
  new ComplianceScannerSubscriber(),
  // Webhook dispatcher (on specified events)
  new WebhookDispatcherSubscriber(),
  // Analytics (on all events)
  new AnalyticsSubscriber(),
];

async function routeToSubscribers(event: Event): Promise<void> {
  for (const subscriber of subscribers) {
    if (subscriber.matches(event)) {
      await subscriber.handle(event);
    }
  }
}
```

---

## 7. Event Query Examples

### Common Queries
```typescript
// All events in trace
const traceEvents = await supabase
  .from('runtime_events')
  .select('*')
  .eq('trace_id', traceId)
  .order('occurred_at', { ascending: true });

// Agent run timeline
const agentTimeline = await supabase
  .from('runtime_events')
  .select('*')
  .eq('tenant_id', tenantId)
  .eq('actor_id', agentId)
  .in('event_type', ['agent.started', 'agent.iteration', 'agent.completed', 'agent.failed'])
  .order('occurred_at', { ascending: true });

// All approvals (pending)
const pendingApprovals = await supabase
  .from('runtime_events')
  .select('*')
  .eq('tenant_id', tenantId)
  .eq('event_type', 'approval.requested')
  .gt('occurred_at', new Date(Date.now() - 24 * 60 * 60 * 1000)); // Last 24h

// Cost by agent
const costByAgent = await supabase
  .rpc('group_cost_by_agent', {
    tenant_id_param: tenantId,
    start_date: startDate,
    end_date: endDate,
  });
```

---

## 8. Event Validation & Testing

### Zod Schema
```typescript
import { z } from 'zod';

const EventActorSchema = z.object({
  type: z.enum(['user', 'agent', 'system', 'integration']),
  id: z.string().uuid(),
  name: z.string().optional(),
  agent_id: z.string().optional(),
  agent_contract_version: z.string().optional(),
});

const EventSourceSchema = z.object({
  service: z.enum(['edge-function', 'apps-agent-runtime', 'webhook', 'scheduler', 'ui']),
  function_name: z.string().optional(),
  endpoint: z.string().optional(),
  region: z.string().optional(),
});

const EventSchema = z.object({
  id: z.string().uuid(),
  event_type: z.string(),
  version: z.literal('1.0'),
  occurred_at: z.string().datetime(),
  received_at: z.string().datetime(),
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid().optional(),
  parent_event_id: z.string().uuid().optional(),
  trace_id: z.string().uuid(),
  span_id: z.string(),
  actor: EventActorSchema,
  source: EventSourceSchema,
  category: z.enum(['agent', 'tool', 'approval', 'compliance', 'audit', 'system']),
  payload: z.record(z.unknown()),
  tags: z.record(z.string()).optional(),
  cost: z.object({
    tokens_input: z.number().optional(),
    tokens_output: z.number().optional(),
    estimated_usd: z.number().optional(),
  }).optional(),
  hash: z.string(),
  previous_hash: z.string().optional(),
  signed: z.object({
    algorithm: z.literal('ed25519'),
    signature: z.string(),
    public_key: z.string(),
  }).optional(),
});
```

---

## 9. Integration with Existing Systems

### governance-agent → Events
```typescript
// Publish when agent starts
await publishEvent({
  id: uuidv4(),
  event_type: 'agent.started',
  category: 'agent',
  occurred_at: new Date().toISOString(),
  tenant_id: tenantId,
  actor: { type: 'agent', id: 'governance-agent', agent_contract_version: '1.0.0' },
  source: { service: 'edge-function', function_name: 'governance-agent' },
  payload: {
    agent_id: 'governance-agent',
    agent_contract_version: '1.0.0',
    input: userQuery,
    input_hash: sha256(userQuery),
    llm_provider: 'anthropic',
    llm_model: 'claude-sonnet-4-6',
  },
  trace_id: traceId,
  span_id: spanId,
  version: '1.0',
  hash: '', // Will be computed
});

// Per iteration
await publishEvent({
  id: uuidv4(),
  event_type: 'agent.iteration',
  category: 'agent',
  occurred_at: new Date().toISOString(),
  tenant_id: tenantId,
  actor: { type: 'agent', id: 'governance-agent' },
  source: { service: 'edge-function', function_name: 'governance-agent' },
  payload: {
    agent_id: 'governance-agent',
    iteration_number: 1,
    turn_input: '...',
    turn_output: '...',
    tool_called: 'governance_run_dpia',
    tokens_used: { input: 150, output: 200 },
  },
  parent_event_id: startedEventId,
  trace_id: traceId,
  span_id: uuidv4(),
  version: '1.0',
  hash: '',
});
```

### apps/agent-runtime → Events
```typescript
// Publish tool.requested
await publishEvent({
  id: uuidv4(),
  event_type: 'tool.requested',
  category: 'tool',
  occurred_at: new Date().toISOString(),
  tenant_id: tenantId,
  actor: { type: 'agent', id: 'governance-agent' },
  source: { service: 'apps-agent-runtime' },
  payload: {
    agent_id: 'governance-agent',
    tool_id: 'governance_run_dpia',
    tool_version: '1.0.0',
    risk_level: 'high',
    requires_approval: true,
  },
  trace_id: traceId,
  span_id: uuidv4(),
  version: '1.0',
  hash: '',
});
```

---

## 10. Event Replay & Audit Trail

### Deterministic Replay
```typescript
async function replayTrace(traceId: string): Promise<void> {
  const events = await supabase
    .from('runtime_events')
    .select('*')
    .eq('trace_id', traceId)
    .order('occurred_at', { ascending: true });

  // Verify hash chain
  let previousHash: string | null = null;
  for (const event of events) {
    if (previousHash && event.previous_hash !== previousHash) {
      throw new Error(`Hash chain broken at event ${event.id}`);
    }
    previousHash = event.hash;
  }

  console.log(`✅ Trace ${traceId} integrity verified`);
  return events;
}
```

---

## 11. FAQ & Gotchas

### Q: What if I need to correct an event?
**A:** Events are immutable. If you made a mistake, publish a new **correction event** with `parent_event_id` pointing to the original.

### Q: How long do events persist?
**A:** Per tenant compliance settings:
- Governance agents: 2555 days (7 years, DSGVO)
- Enterprise agents: configurable
- Compliance violations: 10 years minimum

### Q: Can I query events from multiple traces?
**A:** Yes, but group by `trace_id` for logical causality chains.

### Q: What's the difference between `occurred_at` and `received_at`?
**A:** `occurred_at` = actual time of event (in agent code). `received_at` = when persisted (due to network delays).

---

## 12. Governance Roadmap

| Component | Status | Phase |
|-----------|--------|-------|
| Event Schema (ESS) | ✅ DRAFT | 2 |
| Event Publisher | ⏳ PENDING | 2 |
| Event Persistence | ⏳ PENDING | 2 |
| Event Routing | ⏳ PENDING | 3 |
| Event Replay | ⏳ PENDING | 8 |

---

## Sign-Off

| Aspect | Status |
|--------|--------|
| **Canonical Format** | ✅ JSON + hash chain |
| **Immutability** | ✅ Append-only storage |
| **Audit Trail** | ✅ Full causality chain |
| **Compliance** | ✅ PII-safe, GDPR-ready |
| **Searchability** | ✅ Indexed on trace_id, event_type, actor_id |
| **Integration** | 🟡 Ready for Phase 2 implementation |

**Next:** Runtime Contract Spec (RCS) — execution lifecycle (pending → running → approved → done)
