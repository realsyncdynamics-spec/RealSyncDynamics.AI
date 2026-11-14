# Phase 2d-γ: Orchestration & Deprecation

**Objective:** Extend ACS/ESS/RCS to remaining agent orchestrators; deprecate old logging.

**Timeline:** 1–2 weeks (parallel with governance-agent beta validation)

**Scope:**
- Integrate agent-os-runner scheduler with ACS/ESS/RCS
- Integrate hermes-governance-brief with ACS/ESS/RCS  
- Deprecate old ai_tool_runs logging (keep table, stop writes)
- E2E test: trace replay with hash chain verification

---

## Architecture

### Before (Phase 2d-β)
```
governance-agent
  ├─ agent_sessions (old)
  ├─ agent_runs (old)
  └─ audit_log (old)
```

### After (Phase 2d-γ)
```
governance-agent + agent-os-runner + hermes-brief
  ├─ ESS: runtime_events_v2 (canonical, immutable, hash-chained)
  ├─ RCS: runtime_executions (state machine + quotas)
  ├─ ACS: agent_contracts (formal versioning)
  └─ Legacy (audit only, no new writes):
     ├─ agent_sessions (kept for backward compat)
     ├─ agent_runs (kept for audit, stopped writes)
     └─ audit_log (kept for audit, stopped writes)
```

---

## Implementation Steps

### Step 1: Extend agent-os-runner with ESS Orchestration Events

**Location:** `supabase/functions/agent-os-runner/index.ts`

```typescript
// Add imports
import { 
  publishAgentStarted, publishAgentCompleted, publishAgentFailed,
  generateTraceId, generateSpanId 
} from '../_shared/ess-event-publisher.ts';
import { updateExecutionState } from '../_shared/rcs-execution-manager.ts';

// Add at top
const SCHEDULER_AGENT_ID = 'agent-os-runner';

// Inside Deno.serve, after admin client creation:
const schedulerTraceId = generateTraceId();
const schedulerSpan = generateSpanId();

// Publish scheduler.started event
await publishAgentStarted(admin, {
  agentId: SCHEDULER_AGENT_ID,
  tenantId: 'system', // scheduler is system-wide, not per-tenant
  traceId: schedulerTraceId,
  spanId: schedulerSpan,
  sourceFunction: 'agent-os-runner',
  userId: null, // system job, no user
});

// For each tenant execution:
const tenantSpan = generateSpanId();
await publishAgentIteration(admin, {
  agentId: SCHEDULER_AGENT_ID,
  tenantId: tenant_id,
  traceId: schedulerTraceId,
  spanId: tenantSpan,
  userId: null,
  iteration: tenant_idx,
  message: `Running ${cadence} agents for tenant ${tenant_id}`,
});

// After tenant processing completes (success or error):
if (error) {
  await publishAgentFailed(admin, {
    agentId: SCHEDULER_AGENT_ID,
    tenantId: tenant_id,
    traceId: schedulerTraceId,
    spanId: tenantSpan,
    userId: null,
    error: error.message,
    durationMs: Date.now() - tenantStartTime,
  });
} else {
  await publishAgentCompleted(admin, {
    agentId: SCHEDULER_AGENT_ID,
    tenantId: tenant_id,
    traceId: schedulerTraceId,
    spanId: tenantSpan,
    userId: null,
    durationMs: Date.now() - tenantStartTime,
  });
}

// At end of function:
await publishAgentCompleted(admin, {
  agentId: SCHEDULER_AGENT_ID,
  tenantId: 'system',
  traceId: schedulerTraceId,
  spanId: schedulerSpan,
  userId: null,
  durationMs: Date.now() - startTime,
});
```

### Step 2: Integrate hermes-governance-brief with ACS/ESS/RCS

**Location:** `supabase/functions/_shared/agents/governanceBriefRunner.ts`

```typescript
// Add imports
import { 
  getAgentContract, validateAgentContract 
} from '../acs-runtime-integration.ts';
import { 
  publishAgentStarted, publishAgentIteration, publishAgentCompleted, publishAgentFailed,
  generateTraceId, generateSpanId 
} from '../ess-event-publisher.ts';
import { 
  checkExecutionQuota, recordExecutionCost, updateExecutionState, estimateExecutionCost 
} from '../rcs-execution-manager.ts';

// Update function signature
export async function generateGovernanceBriefForTenant(
  admin: SupabaseClient,
  tenantId: string,
  now: Date,
  parentTraceId?: string, // from agent-os-runner orchestration trace
): Promise<{ id: string; trace_id: string } | null> {
  const AGENT_ID = 'hermes-governance-brief';
  
  // Load ACS contract
  const contract = await getAgentContract(admin, AGENT_ID);
  if (!contract) {
    console.error(`ACS contract not found for ${AGENT_ID}`);
    return null;
  }

  // Initialize trace
  const traceId = parentTraceId || generateTraceId();
  const briefSpan = generateSpanId();

  // Create runtime_executions record
  const { data: execution, error: execErr } = await admin
    .from('runtime_executions')
    .insert({
      agent_id: AGENT_ID,
      tenant_id: tenantId,
      status: 'pending',
      agent_contract_version: contract.version,
      trace_id: traceId,
    })
    .select('id')
    .single();

  if (execErr) {
    console.error(`Failed to create execution: ${execErr.message}`);
    return null;
  }

  const executionId = (execution as unknown as { id: string }).id;

  // Publish agent.started
  await publishAgentStarted(admin, {
    agentId: AGENT_ID,
    tenantId,
    traceId,
    spanId: briefSpan,
    sourceFunction: 'agent-os-runner',
    userId: null,
  });

  const startedAt = Date.now();
  let outcome: 'success' | 'error' = 'success';
  let errorMessage: string | null = null;
  let briefTokens = { input: 0, output: 0 };

  try {
    // ... existing generateGovernanceBrief logic ...
    // If LLM call: track tokens and publish events
    
    // On LLM call:
    const turnSpan = generateSpanId();
    await publishAgentIteration(admin, {
      agentId: AGENT_ID,
      tenantId,
      traceId,
      spanId: turnSpan,
      userId: null,
      iteration: 0,
      message: 'Generating governance brief',
    });

    // LLM inference
    // briefTokens.input = resp.usage.input_tokens;
    // briefTokens.output = resp.usage.output_tokens;

    // Update execution state to completed
    const totalCost = estimateExecutionCost('claude-sonnet-4-6', briefTokens.input, briefTokens.output);
    
    await recordExecutionCost(admin, executionId, tenantId, briefTokens.input, briefTokens.output, totalCost);
    
    await updateExecutionState(admin, executionId, 'completed', {
      tokens_input_tracked: briefTokens.input,
      tokens_output_tracked: briefTokens.output,
      estimated_cost_usd: totalCost,
    });

    // Publish agent.completed
    await publishAgentCompleted(admin, {
      agentId: AGENT_ID,
      tenantId,
      traceId,
      spanId: briefSpan,
      userId: null,
      tokensInput: briefTokens.input,
      tokensOutput: briefTokens.output,
      durationMs: Date.now() - startedAt,
    });

  } catch (e) {
    outcome = 'error';
    errorMessage = (e as Error).message;

    // Update execution state to failed
    const partialCost = estimateExecutionCost('claude-sonnet-4-6', briefTokens.input, briefTokens.output);
    await recordExecutionCost(admin, executionId, tenantId, briefTokens.input, briefTokens.output, partialCost);
    
    await updateExecutionState(admin, executionId, 'failed', {
      error_message: errorMessage,
      error_retriable: true,
      error_retry_count: 0,
    });

    // Publish agent.failed
    await publishAgentFailed(admin, {
      agentId: AGENT_ID,
      tenantId,
      traceId,
      spanId: briefSpan,
      userId: null,
      error: errorMessage,
      durationMs: Date.now() - startedAt,
    });

    return null;
  }

  return { id: executionId, trace_id: traceId };
}
```

### Step 3: Deprecate Old Logging (ai_tool_runs)

**Approach:** Stop writing to `ai_tool_runs`; redirect flow to `runtime_events_v2` only.

**In governance-agent/index.ts:**
```typescript
// Remove or comment out this block (line ~680):
// await admin.from('agent_runs').insert({ ... });

// Migration: governance-agent audit stays in audit_log (RLS-enabled, good for compliance)
// but agent execution metrics now exclusive to runtime_executions + runtime_events_v2
```

**In governanceBriefRunner.ts:**
```typescript
// Stop logging to legacy tables; ESS events are the canonical record now
// No changes to agent_sessions / agent_runs — those are session state
// (orthogonal to execution metering)
```

### Step 4: E2E Test — Trace Replay with Hash Chain Verification

**Location:** `test/phase-2d-trace-replay.test.ts` (new file)

```typescript
import { describe, it, expect } from 'vitest';
import { 
  getEventTrace, 
  verifyEventTrace, 
  generateTraceId 
} from '../supabase/functions/_shared/ess-event-publisher.ts';

describe('Phase 2d-γ: ESS Trace Replay & Hash Chain', () => {
  
  it('should publish complete execution trace', async () => {
    // Simulate governance-agent execution with ACS/ESS/RCS
    const traceId = generateTraceId();
    
    // Expected events in sequence:
    // 1. agent.started
    // 2. agent.iteration (per LLM turn)
    // 3. tool.requested (per tool)
    // 4. tool.completed (per tool)
    // 5. agent.completed
    
    // Fetch full trace
    const trace = await getEventTrace(admin, traceId);
    expect(trace).toBeDefined();
    expect(trace?.length).toBeGreaterThan(0);
    
    // Verify causality: parent/span relationships
    const eventMap = new Map(trace.map(e => [e.event_id, e]));
    trace.forEach(event => {
      if (event.parent_event_id) {
        expect(eventMap.has(event.parent_event_id)).toBe(true);
      }
    });
  });

  it('should verify hash chain integrity', async () => {
    const traceId = generateTraceId();
    
    // Publish a known set of events
    // ...
    
    // Verify hash chain
    const result = await verifyEventTrace(admin, traceId);
    expect(result?.valid).toBe(true);
    expect(result?.integrity_errors).toBe(0);
  });

  it('should detect hash chain tampering', async () => {
    const traceId = generateTraceId();
    
    // Publish events
    // ...
    
    // Tamper with an event's previous_hash
    // (Would require direct DB access; simulate as expected behavior test)
    
    // Verify should fail
    const result = await verifyEventTrace(admin, traceId);
    expect(result?.integrity_errors).toBeGreaterThan(0);
  });

  it('should replay execution from trace', async () => {
    const traceId = generateTraceId();
    
    // Publish governance-agent execution trace
    // ...
    
    // Fetch trace
    const trace = await getEventTrace(admin, traceId);
    
    // Reconstruct execution flow
    const timeline = trace
      .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime())
      .map(e => ({ event: e.event_type, duration: e.payload.duration_ms }));
    
    // Verify causality and ordering
    expect(timeline[0].event).toBe('agent.started');
    expect(timeline[timeline.length - 1].event).toMatch(/agent\.(completed|failed)/);
  });
});
```

---

## Testing Checklist

### Unit Tests
- [ ] `acs-runtime-integration.test.ts` — contract loading, validation (reuse from 2d-β)
- [ ] `ess-event-publisher.test.ts` — event publishing, trace verification (reuse from 2d-β)
- [ ] `rcs-execution-manager.test.ts` — quota checks, cost recording (reuse from 2d-β)
- [ ] `phase-2d-trace-replay.test.ts` — hash chain, causality, tampering detection

### Integration Tests
- [ ] agent-os-runner with orchestration trace (daily + hourly cadence)
- [ ] hermes-governance-brief with execution metrics
- [ ] Deprecation: ai_tool_runs no longer written; runtime_events_v2 canonical
- [ ] Trace replay: verify full causal flow from orchestration event
- [ ] Hash chain: verify_event_trace passes for all traces

### E2E Tests (Playwright)
- [ ] /app/governance with new trace_id in responses
- [ ] /app/traces shows orchestration + execution hierarchy
- [ ] /settings/billing reflects hermes-brief costs from execution_costs
- [ ] No errors in audit_log for ESS publishing (check /app/admin/logs)

### Backward Compatibility
- [ ] agent_sessions table still populated (session state)
- [ ] Existing governance-agent chats unaffected
- [ ] audit_log still records security events (unchanged)
- [ ] Client code using session_id continues to work

---

## Rollout Strategy

### Phase 2d-γ-α (Immediate — Agent-OS-Runner Only)
- [ ] Add ESS events to agent-os-runner scheduler
- [ ] No changes to agent logic (deadline-sentinel, monitoring-slo)
- [ ] Publish orchestration.started/completed events only

### Phase 2d-γ-β (Incremental — Hermes Integration)
- [ ] Add ACS/ESS/RCS to hermes-governance-brief
- [ ] Start recording brief execution metrics in runtime_executions
- [ ] Keep legacy logging (ai_tool_runs still writes, for comparison)
- [ ] Beta test: daily breads appear in traces with costs

### Phase 2d-γ-γ (Full Deprecation)
- [ ] Stop writing ai_tool_runs (flag in env: `STOP_LEGACY_LOGGING=true`)
- [ ] Archive old data (ai_tool_runs → historical_agent_runs if audit needed)
- [ ] Update UI to reference runtime_executions + runtime_events_v2 only
- [ ] E2E test: trace replay with full causality verification

---

## Deployment Checklist

Before production:
- [ ] All CI checks pass (unit + integration + E2E)
- [ ] Cloudflare Pages deployment successful
- [ ] Edge Function logs show ESS events publishing
- [ ] runtime_executions records created for each agent execution
- [ ] execution_costs properly metered for LLM calls
- [ ] Hash chain verification passes for 100% of traces
- [ ] No regressions: governance-agent response quality unchanged
- [ ] Audit logging still works (audit_log populated)
- [ ] Database performance: runtime_events_v2 query time < 100ms for trace lookup

---

## References

- Phase 2d-β: `docs/phase-2d-governance-agent-integration.md`
- ACS Spec: `docs/agent-contract-specification.md`
- ESS Spec: `docs/event-schema-standard.md`
- RCS Spec: `docs/runtime-contract-specification.md`
- Agent-OS-Runner: `supabase/functions/agent-os-runner/index.ts`
- Hermes Brief: `supabase/functions/_shared/agents/governanceBriefRunner.ts`
