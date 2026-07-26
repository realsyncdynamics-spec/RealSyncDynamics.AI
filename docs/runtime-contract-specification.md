# Runtime Contract Specification (RCS) v1.0

**Single Source of Truth** für die Execution Lifecycle, State Transitions, und Approval Gates in RealSyncDynamics.AI.

**Status:** 🟡 DRAFT  
**Version:** 1.0-beta  
**Last Updated:** 2026-07-26  
**Scope:** Agent Execution, Tool Dispatch, Approval Workflows, State Management

---

## 1. Überblick

Eine **Runtime Contract** ist die Spezifikation für:
- **Execution Lifecycle** — State Transitions (pending → running → approved → completed)
- **Approval Gates** — Human-in-the-Loop Decision Points
- **State Management** — Durable Execution State (idempotency, replay)
- **Error Handling** — Retry Logic, Failure Paths
- **Timeout & Cancellation** — Resource Management

---

## 2. Execution Lifecycle State Machine

```typescript
type ExecutionState = 
  | 'pending'           // Created, not yet started
  | 'running'           // LLM/Tool executing
  | 'awaiting_approval' // Blocked on approval gate
  | 'approved'          // Gate granted, resuming
  | 'completed'         // Success
  | 'failed'            // Error (non-recoverable)
  | 'cancelled'         // User/system abort;

interface ExecutionRecord {
  // Identity
  id: string;                           // UUID (immutable execution ID)
  agent_id: string;
  agent_contract_version: string;
  
  // Lifecycle
  status: ExecutionState;
  created_at: string;                   // ISO 8601
  started_at?: string;
  approved_at?: string;
  completed_at?: string;
  
  // Inputs & Outputs
  input: Record<string, unknown>;
  input_hash: string;                   // SHA256
  output?: Record<string, unknown>;
  output_hash?: string;
  
  // Cost & Quota
  tokens_input?: number;
  tokens_output?: number;
  estimated_cost?: number;
  
  // Approval Gates (if any)
  approval_gates: ApprovalGate[];
  
  // Error Handling
  error?: {
    code: string;
    message: string;
    retriable: boolean;
    retry_count: number;
    max_retries: number;
  };
  
  // Idempotency
  idempotency_key?: string;             // For deduplication
  
  // Tracing
  trace_id: string;                     // Links to ESS events
  
  // Tenant Scope
  tenant_id: string;
}

interface ApprovalGate {
  id: string;                           // UUID
  trigger: string;                      // e.g., 'production_change', 'high_risk_tool'
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'granted' | 'denied' | 'expired';
  
  // Request
  requested_at: string;
  reason?: string;
  
  // Decision
  decided_by?: string;                  // user_id
  decided_at?: string;
  decision_reason?: string;
  
  // Timeout
  timeout_seconds: number;
  expires_at: string;
}
```

---

## 3. State Transition Diagram

```
                    ┌─────────────────────────────────────────────┐
                    │                                             │
                    ▼                                             │
             ┌────────────┐                                       │
             │  PENDING   │                                       │
             │            │                                       │
             │ Created,   │                                       │
             │ not start  │                                       │
             └─────┬──────┘                                       │
                   │                                              │
                   │ start() [quota OK, no gates]                │
                   ▼                                              │
             ┌────────────┐                                       │
             │  RUNNING   │ ◄──┐                                 │
             │            │    │                                 │
             │ LLM/Tool   │    │                                 │
             │ executing  │    │ approve() [gate → grant]        │
             └─────┬──────┘    │                                 │
                   │           └─────────────────────┐           │
                   │                                 │           │
                   │ [approval gate required?]       │           │
                   ├─ YES ────────┐                  │           │
                   │              ▼                  │           │
                   │         ┌──────────────────┐   │           │
                   │         │ AWAITING_APPROVAL│   │           │
                   │         │                  │   │           │
                   │         │ Human decision   │───┘           │
                   │         └────────┬─────────┘                │
                   │                  │                          │
                   │                  │ deny() [gate → denied]   │
                   │                  ▼                          │
                   │            ┌──────────┐                     │
                   │            │  FAILED  │                     │
                   │            │          │                     │
                   │            │ Approval │ ◄───────────────────┘
                   │            │ rejected │
                   │            └──────────┘
                   │
                   │ NO gate required
                   ▼
             ┌────────────┐
             │ COMPLETED  │
             │            │
             │ Success,   │
             │ output OK  │
             └────────────┘

Separate paths:
  RUNNING → FAILED [error, non-retriable]
  RUNNING → CANCELLED [user abort]
  AWAITING_APPROVAL → EXPIRED [timeout reached]
```

---

## 4. State Transitions – Formal Rules

### 4.1 PENDING → RUNNING
**Preconditions:**
- Execution is in PENDING state
- Agent contract is ACTIVE
- Tenant quota not exceeded
- No required approval gates, OR all gates already GRANTED

**Action:**
```typescript
async function startExecution(execution: ExecutionRecord): Promise<void> {
  // 1. Validate preconditions
  if (execution.status !== 'pending') {
    throw new Error('Can only start from PENDING');
  }
  
  const contract = await fetchContract(execution.agent_id, execution.agent_contract_version);
  if (contract.status !== 'active') {
    throw new Error('Agent contract not active');
  }
  
  const quota = await checkTenantQuota(execution.tenant_id);
  if (quota.remaining_usd < contract.cost_model.estimated_cost_per_run) {
    throw new Error('Insufficient quota');
  }
  
  // 2. Start execution
  execution.status = 'running';
  execution.started_at = new Date().toISOString();
  await persistExecution(execution);
  
  // 3. Publish event
  await publishEvent({
    event_type: 'agent.started',
    category: 'agent',
    trace_id: execution.trace_id,
    payload: {
      agent_id: execution.agent_id,
      input: execution.input,
    },
  });
}
```

### 4.2 RUNNING → AWAITING_APPROVAL (if gates triggered)
**Preconditions:**
- Execution is in RUNNING state
- Current tool call matches a required approval gate
- Gate is in PENDING state

**Action:**
```typescript
async function pauseForApproval(
  execution: ExecutionRecord,
  gate: ApprovalGate
): Promise<void> {
  if (execution.status !== 'running') {
    throw new Error('Can only request approval from RUNNING');
  }
  
  // Update gate status
  gate.status = 'pending';
  gate.requested_at = new Date().toISOString();
  gate.expires_at = new Date(Date.now() + gate.timeout_seconds * 1000).toISOString();
  
  // Pause execution
  execution.status = 'awaiting_approval';
  await persistExecution(execution);
  
  // Publish event
  await publishEvent({
    event_type: 'approval.requested',
    category: 'approval',
    payload: {
      approval_request_id: gate.id,
      agent_id: execution.agent_id,
      risk_level: gate.risk_level,
      reason: gate.reason,
    },
  });
  
  // Notify approvers (async, non-blocking)
  await notifyApprovers(execution.tenant_id, gate.id, gate.risk_level);
}
```

### 4.3 AWAITING_APPROVAL → APPROVED (→ RUNNING)
**Preconditions:**
- Execution is in AWAITING_APPROVAL state
- Gate is in PENDING state
- Approver has sufficient permissions
- Gate has not expired

**Action:**
```typescript
async function grantApproval(
  execution: ExecutionRecord,
  gate: ApprovalGate,
  approver_id: string,
  reason?: string
): Promise<void> {
  if (execution.status !== 'awaiting_approval') {
    throw new Error('Execution not awaiting approval');
  }
  
  if (gate.status !== 'pending') {
    throw new Error('Gate not pending');
  }
  
  const now = new Date();
  if (new Date(gate.expires_at) < now) {
    gate.status = 'expired';
    throw new Error('Gate has expired');
  }
  
  // Grant approval
  gate.status = 'granted';
  gate.decided_by = approver_id;
  gate.decided_at = now.toISOString();
  gate.decision_reason = reason;
  
  // Resume execution
  execution.status = 'approved';
  execution.approved_at = now.toISOString();
  await persistExecution(execution);
  
  // Publish event
  await publishEvent({
    event_type: 'approval.granted',
    category: 'approval',
    payload: {
      approval_request_id: gate.id,
      approved_by: approver_id,
      approval_timestamp: now.toISOString(),
    },
  });
  
  // Resume agent execution (return to RUNNING)
  execution.status = 'running';
  await resumeExecution(execution);
}
```

### 4.4 AWAITING_APPROVAL → DENIED (→ FAILED)
**Preconditions:**
- Execution is in AWAITING_APPROVAL state
- Gate is in PENDING state
- Approver has permission to deny

**Action:**
```typescript
async function denyApproval(
  execution: ExecutionRecord,
  gate: ApprovalGate,
  denier_id: string,
  reason: string
): Promise<void> {
  if (execution.status !== 'awaiting_approval') {
    throw new Error('Execution not awaiting approval');
  }
  
  // Deny
  gate.status = 'denied';
  gate.decided_by = denier_id;
  gate.decided_at = new Date().toISOString();
  gate.decision_reason = reason;
  
  // Fail execution
  execution.status = 'failed';
  execution.error = {
    code: 'APPROVAL_DENIED',
    message: `Approval denied: ${reason}`,
    retriable: false,
  };
  execution.completed_at = new Date().toISOString();
  await persistExecution(execution);
  
  // Publish events
  await publishEvent({
    event_type: 'approval.denied',
    category: 'approval',
    payload: {
      approval_request_id: gate.id,
      denied_by: denier_id,
      reason,
    },
  });
  
  await publishEvent({
    event_type: 'agent.failed',
    category: 'agent',
    payload: {
      agent_id: execution.agent_id,
      error_code: 'APPROVAL_DENIED',
      error_message: reason,
    },
  });
}
```

### 4.5 RUNNING → COMPLETED (Success Path)
**Preconditions:**
- Execution is in RUNNING state
- Agent returned output successfully

**Action:**
```typescript
async function completeExecution(
  execution: ExecutionRecord,
  output: Record<string, unknown>
): Promise<void> {
  if (execution.status !== 'running') {
    throw new Error('Can only complete from RUNNING');
  }
  
  execution.output = output;
  execution.output_hash = sha256(JSON.stringify(output));
  execution.status = 'completed';
  execution.completed_at = new Date().toISOString();
  await persistExecution(execution);
  
  await publishEvent({
    event_type: 'agent.completed',
    category: 'agent',
    payload: {
      agent_id: execution.agent_id,
      output,
      output_hash: execution.output_hash,
      execution_time_ms: new Date(execution.completed_at).getTime() - new Date(execution.started_at).getTime(),
    },
  });
}
```

### 4.6 RUNNING → FAILED (Error Path)
**Preconditions:**
- Execution is in RUNNING state
- Agent encountered error

**Action:**
```typescript
async function failExecution(
  execution: ExecutionRecord,
  error: { code: string; message: string; retriable: boolean }
): Promise<void> {
  if (execution.status !== 'running') {
    throw new Error('Can only fail from RUNNING');
  }
  
  execution.error = {
    ...error,
    retry_count: execution.error?.retry_count ?? 0,
    max_retries: 3,
  };
  execution.status = 'failed';
  execution.completed_at = new Date().toISOString();
  await persistExecution(execution);
  
  // Publish event
  await publishEvent({
    event_type: 'agent.failed',
    category: 'agent',
    payload: {
      agent_id: execution.agent_id,
      error_code: error.code,
      error_message: error.message,
    },
  });
  
  // If retriable, schedule retry
  if (error.retriable && (execution.error.retry_count < execution.error.max_retries)) {
    const delay_ms = Math.pow(2, execution.error.retry_count) * 1000; // Exponential backoff
    await scheduleRetry(execution, delay_ms);
  }
}
```

### 4.7 RUNNING / AWAITING_APPROVAL → CANCELLED (User Abort)
**Preconditions:**
- Execution is in RUNNING or AWAITING_APPROVAL state
- User/system requests cancellation

**Action:**
```typescript
async function cancelExecution(
  execution: ExecutionRecord,
  cancelled_by: string,
  reason: string
): Promise<void> {
  if (!['running', 'awaiting_approval'].includes(execution.status)) {
    throw new Error('Can only cancel from RUNNING or AWAITING_APPROVAL');
  }
  
  // Kill any running processes
  await killRunningProcesses(execution.id);
  
  execution.status = 'cancelled';
  execution.error = {
    code: 'CANCELLED',
    message: reason,
    retriable: false,
  };
  execution.completed_at = new Date().toISOString();
  await persistExecution(execution);
  
  await publishEvent({
    event_type: 'agent.cancelled',
    category: 'agent',
    payload: {
      agent_id: execution.agent_id,
      cancelled_by,
      reason,
    },
  });
}
```

### 4.8 AWAITING_APPROVAL → EXPIRED (Timeout Path)
**Preconditions:**
- Gate is in PENDING state
- Current time >= gate.expires_at

**Action (Async Cron)**
```typescript
async function expireApprovalGates(): Promise<void> {
  // Run periodically (e.g., every 5 minutes)
  const expiredGates = await supabase
    .from('runtime_approval_gates')
    .select('*')
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString());
  
  for (const gate of expiredGates) {
    gate.status = 'expired';
    await persistGate(gate);
    
    // Find execution
    const execution = await fetchExecution(gate.execution_id);
    if (execution.status === 'awaiting_approval') {
      execution.status = 'failed';
      execution.error = {
        code: 'APPROVAL_EXPIRED',
        message: `Approval gate expired after ${gate.timeout_seconds} seconds`,
        retriable: false,
      };
      execution.completed_at = new Date().toISOString();
      await persistExecution(execution);
      
      await publishEvent({
        event_type: 'approval.expired',
        category: 'approval',
        payload: {
          approval_request_id: gate.id,
          timeout_seconds: gate.timeout_seconds,
        },
      });
    }
  }
}
```

---

## 5. Idempotency & Deduplication

Executions support **idempotency keys** to prevent duplicate runs:

```typescript
interface ExecutionRequest {
  agent_id: string;
  input: Record<string, unknown>;
  idempotency_key?: string;  // Client-provided
}

async function executeAgent(req: ExecutionRequest): Promise<ExecutionRecord> {
  let execution: ExecutionRecord;
  
  // Check for existing execution with same idempotency key
  if (req.idempotency_key) {
    const existing = await supabase
      .from('runtime_executions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('idempotency_key', req.idempotency_key)
      .maybeSingle();
    
    if (existing) {
      // Return cached result
      return existing;
    }
  }
  
  // Create new execution
  execution = {
    id: uuidv4(),
    agent_id: req.agent_id,
    input: req.input,
    idempotency_key: req.idempotency_key,
    status: 'pending',
    created_at: new Date().toISOString(),
    trace_id: req.trace_id,
    tenant_id: tenantId,
  };
  
  await persistExecution(execution);
  
  // Start
  await startExecution(execution);
  
  return execution;
}
```

---

## 6. Retry Logic & Exponential Backoff

Retriable errors are retried with exponential backoff:

```typescript
async function scheduleRetry(
  execution: ExecutionRecord,
  delay_ms: number
): Promise<void> {
  // Update retry count
  execution.error.retry_count = (execution.error.retry_count ?? 0) + 1;
  
  // Rewind status to PENDING
  execution.status = 'pending';
  execution.started_at = undefined;
  await persistExecution(execution);
  
  // Schedule via Supabase Cron / n8n
  await scheduleDelayedExecution(execution.id, delay_ms);
  
  await publishEvent({
    event_type: 'agent.retry_scheduled',
    category: 'system',
    payload: {
      execution_id: execution.id,
      retry_number: execution.error.retry_count,
      delay_ms,
      max_retries: execution.error.max_retries,
    },
  });
}
```

**Backoff formula:**
```
delay_ms = min(base_ms * (2 ^ retry_count), max_delay_ms)
         = min(1000 * (2 ^ retry_count), 60000)

Retry 1: 2s
Retry 2: 4s
Retry 3: 8s
Retry 4: 16s
Retry 5+: 60s (cap)
```

---

## 7. Timeout Management

Executions have **max_execution_time_seconds** from contract:

```typescript
async function enforceExecutionTimeout(execution: ExecutionRecord): Promise<void> {
  const contract = await fetchContract(execution.agent_id, execution.agent_contract_version);
  const max_time_ms = contract.execution_model.max_execution_time_seconds * 1000;
  
  const elapsed_ms = Date.now() - new Date(execution.started_at).getTime();
  
  if (elapsed_ms > max_time_ms) {
    await cancelExecution(execution, 'system', 'Execution timeout exceeded');
  }
}

// Check periodically (e.g., every 30 seconds)
async function monitorExecutionTimeouts(): Promise<void> {
  const runningExecutions = await supabase
    .from('runtime_executions')
    .select('*')
    .eq('status', 'running');
  
  for (const execution of runningExecutions) {
    await enforceExecutionTimeout(execution);
  }
}
```

---

## 8. State Persistence & Durability

### Supabase Tables
```sql
-- Track execution state
create table public.runtime_executions (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id),
  agent_id        text not null,
  agent_contract_version text not null,
  status          text not null check (status in ('pending', 'running', 'awaiting_approval', 'approved', 'completed', 'failed', 'cancelled')),
  
  created_at      timestamptz not null default now(),
  started_at      timestamptz,
  approved_at     timestamptz,
  completed_at    timestamptz,
  
  input           jsonb,
  input_hash      text,
  output          jsonb,
  output_hash     text,
  
  tokens_input    integer,
  tokens_output   integer,
  estimated_cost  numeric(10, 6),
  
  error_code      text,
  error_message   text,
  error_retriable boolean,
  error_retry_count integer default 0,
  
  idempotency_key text,
  trace_id        uuid not null,
  
  unique (tenant_id, idempotency_key)
);

-- Track approval gates
create table public.runtime_approval_gates (
  id              uuid primary key default gen_random_uuid(),
  execution_id    uuid not null references public.runtime_executions(id) on delete cascade,
  
  trigger         text not null,
  risk_level      text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  status          text not null check (status in ('pending', 'granted', 'denied', 'expired')),
  
  requested_at    timestamptz not null default now(),
  decided_at      timestamptz,
  
  decided_by      uuid references auth.users(id) on delete set null,
  decision_reason text,
  
  timeout_seconds integer not null,
  expires_at      timestamptz not null,
  
  reason          text
);

-- Immutable append-only audit
create table public.runtime_events (
  ... (see ESS for schema)
);

-- Indexes
create index runtime_executions_status_idx on public.runtime_executions (status) where status in ('running', 'awaiting_approval');
create index runtime_executions_tenant_created_idx on public.runtime_executions (tenant_id, created_at desc);
create index runtime_approval_gates_pending_idx on public.runtime_approval_gates (execution_id) where status = 'pending';
create index runtime_approval_gates_expires_idx on public.runtime_approval_gates (expires_at) where status = 'pending';
```

---

## 9. Integration with ACS & ESS

### Contract Binding
```typescript
async function executeAgent(execution: ExecutionRecord): Promise<void> {
  // 1. Resolve contract (ACS)
  const contract = await fetchContract(execution.agent_id, execution.agent_contract_version);
  
  // 2. Check approval gates (RCS)
  const triggeringGates = contract.required_approval_gates
    .filter(g => g.trigger === 'execution_requested' || g.trigger === 'always');
  
  if (triggeringGates.length > 0) {
    for (const gate of triggeringGates) {
      await pauseForApproval(execution, gate);
    }
  }
  
  // 3. Publish events (ESS)
  await publishEvent({
    event_type: 'agent.started',
    category: 'agent',
    trace_id: execution.trace_id,
    payload: {
      agent_id: execution.agent_id,
      agent_contract_version: execution.agent_contract_version,
      input: execution.input,
    },
  });
  
  // 4. Execute with RLS & cost tracking
  const result = await runAgent(contract, execution);
  
  // 5. Complete
  await completeExecution(execution, result);
}
```

---

## 10. FAQ & Gotchas

### Q: What if approval expires while agent is running?
**A:** Execution is in AWAITING_APPROVAL state, not RUNNING. Expiry cron marks gate as EXPIRED → execution transitions to FAILED.

### Q: Can I retry after FAILED?
**A:** Only if `error.retriable === true`. Otherwise, must create new execution with new input.

### Q: What's the difference between APPROVED and RUNNING?
**A:** APPROVED = gate was granted, now resuming. RUNNING = actually executing agent code.

### Q: Can I manually trigger approval expiry?
**A:** Yes, but prefer the automatic cron. Manual expiry should only be done by admins.

### Q: Can I change a gate's timeout after it's requested?
**A:** No. Create a new gate with a new timeout (separate approval cycle).

---

## 11. Governance Roadmap

| Component | Status | Phase |
|-----------|--------|-------|
| Audit | ✅ | 1 |
| ACS (Agent Contract) | ✅ | 2 |
| ESS (Event Schema) | ✅ | 2 |
| RCS (Runtime Contract) | ✅ | 2 |
| Implementation | ⏳ | 2–3 |

---

## Sign-Off

| Aspect | Status |
|--------|--------|
| **State Machine** | ✅ Formally defined, all transitions specified |
| **Approval Gates** | ✅ Human-in-the-loop with timeout enforcement |
| **Idempotency** | ✅ Deduplication via idempotency keys |
| **Retry Logic** | ✅ Exponential backoff with max retries |
| **Durability** | ✅ Persisted in Supabase with RLS |
| **Integration** | ✅ Binds ACS + ESS |

**Next:** PHASE 2 Implementation — migrate existing Edge Functions to ACS/ESS/RCS contracts.
