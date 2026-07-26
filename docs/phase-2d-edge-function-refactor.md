# PHASE 2d – Edge Functions Refactor

**Objective:** Integrate governance-agent and agent-os-runner with ACS/ESS/RCS specifications.

**Timeline:** Phase 2c→2d (1–2 weeks for full refactor; can deploy incrementally)

**Scope:** 
- Load formal ACS contracts at startup
- Publish canonical ESS events for every agent action
- Enforce RCS quota limits before execution
- Track execution state through state machine
- Support approval gates for high-risk operations

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ Edge Function (governance-agent / agent-os-runner)              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─ Load ACS Contract ───────────────────────────────────────┐  │
│  │ • getAgentContract(admin, agentId)                        │  │
│  │ • validateAgentContract()                                 │  │
│  │ • resolveAgentCapabilities()                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                       │
│  ┌─ Check RCS Quota ─────┴────────────────────────────────────┐  │
│  │ • checkExecutionQuota() before starting                   │  │
│  │ • If over budget: reject with 429 Too Many Requests       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                       │
│  ┌─ Publish ESS Events ──┴────────────────────────────────────┐  │
│  │ • publishAgentStarted() – trace_id generation             │  │
│  │ • publishAgentIteration() – per LLM turn                  │  │
│  │ • publishToolRequested/Completed() – tool execution       │  │
│  │ • publishAgentCompleted/Failed() – final state            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                       │
│  ┌─ Record Costs & State ┴────────────────────────────────────┐  │
│  │ • updateExecutionState() → completed/failed               │  │
│  │ • recordExecutionCost() → execution_costs + quota update   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                       │
└──────────────────────────┼──────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
    agent_contracts   runtime_events_v2  runtime_executions
    (ACS registry)    (ESS audit trail)  (RCS state machine)
```

---

## Implementation Steps

### Step 1: Import Shared Utilities

```typescript
import { getAgentContract, validateAgentContract } from '../_shared/acs-runtime-integration.ts';
import { publishAgentStarted, publishAgentCompleted, publishAgentFailed, generateTraceId, generateSpanId } from '../_shared/ess-event-publisher.ts';
import { checkExecutionQuota, recordExecutionCost, updateExecutionState } from '../_shared/rcs-execution-manager.ts';
```

### Step 2: Load & Validate Contract (Startup)

**Before:** Agent runs with hardcoded capabilities in `AGENT_TOOLS`

**After:** Load formal ACS contract at startup:

```typescript
// In request handler
const agentId = 'governance-agent';
const contract = await getAgentContract(admin, agentId);
if (!contract) {
  return jsonError(400, 'CONTRACT_NOT_FOUND', `Agent contract not found: ${agentId}`);
}

const validationError = validateAgentContract(contract.contract_json);
if (validationError) {
  return jsonError(400, 'INVALID_CONTRACT', validationError);
}

// Agent is now formally versioned
console.log(`Running ${agentId} v${contract.version} (status: ${contract.status})`);
```

### Step 3: Check Quota (Pre-Execution)

**Before:** No quota check; token metering only for audit

**After:** Enforce monthly budget before execution:

```typescript
const tenantId = /* from auth */;
const estimatedTokens = 3000; // e.g., for Sonnet 4.6
const estimatedCost = estimateExecutionCost(LLM_MODEL, estimatedTokens, estimatedTokens * 0.3);

const quotaCheck = await checkExecutionQuota(admin, tenantId, agentId, contract.version, estimatedCost);
if (!quotaCheck.allowed) {
  console.warn(`Quota exceeded for ${tenantId}: ${quotaCheck.error}`);
  return jsonError(429, 'QUOTA_EXCEEDED', quotaCheck.error, { remaining_usd: quotaCheck.remaining_usd });
}

if (quotaCheck.warning) {
  console.warn(`Quota warning: ${quotaCheck.warning}`);
}
```

### Step 4: Initialize Execution Trace (ESS)

**Before:** No trace; event logging implicit in `ai_tool_runs` / `workflow_runs`

**After:** Create explicit trace for causality:

```typescript
const traceId = generateTraceId();
const sessionTraceSpan = generateSpanId();

// Create or get runtime_executions record
const { data: execution, error: execErr } = await admin
  .from('runtime_executions')
  .insert({
    agent_id: agentId,
    tenant_id: tenantId,
    status: 'pending',
    agent_contract_version: contract.version,
    trace_id: traceId,
  })
  .select('id')
  .single();

if (execErr) {
  return jsonError(500, 'EXEC_INSERT_FAILED', execErr.message);
}

// Publish agent.started event
await publishAgentStarted(admin, {
  agentId,
  tenantId,
  traceId,
  spanId: sessionTraceSpan,
  sourceFunction: 'governance-agent',
  userId: user?.id,
});

// Update execution state: pending → running
await updateExecutionState(admin, execution.id, 'running', {
  agent_contract_version: contract.version,
  trace_id: traceId,
});
```

### Step 5: Publish Events During Execution

**Per LLM Turn:**

```typescript
// Before sending to Claude
const turnSpan = generateSpanId();
await publishAgentIteration(admin, {
  agentId,
  tenantId,
  traceId,
  spanId: turnSpan,
  userId: user?.id,
  iteration: turnCount,
  message: userMessage,
});

// LLM inference
const response = await anthropic.messages.create({
  // ...
});

// Track tokens per turn (for cost estimation)
const turnTokensInput = response.usage.input_tokens;
const turnTokensOutput = response.usage.output_tokens;
const turnCost = estimateExecutionCost(LLM_MODEL, turnTokensInput, turnTokensOutput);

// Update execution with this turn's tokens
await updateExecutionState(admin, execution.id, 'running', {
  tokens_input_tracked: (prevTokensInput ?? 0) + turnTokensInput,
  tokens_output_tracked: (prevTokensOutput ?? 0) + turnTokensOutput,
  estimated_cost_usd: turnCost,
});
```

**Per Tool Invocation:**

```typescript
// Before tool call
const toolSpan = generateSpanId();
await publishToolRequested(admin, {
  toolName: tool.name,
  tenantId,
  traceId,
  spanId: toolSpan,
  toolInput: tool.input,
  parentEventId: turnSpan, // links to iteration event
});

// Invoke tool (existing dispatch)
const result = await dispatchTool(tool.name, tool.input, ...);

// After tool completion
await publishToolCompleted(admin, {
  toolName: tool.name,
  tenantId,
  traceId,
  spanId: toolSpan,
  parentEventId: turnSpan,
  toolOutput: result,
  durationMs: Date.now() - toolStartTime,
});
```

### Step 6: Record Final Cost & State

**On Success:**

```typescript
const totalTokensInput = /* sum from all turns */;
const totalTokensOutput = /* sum from all turns */;
const totalCost = estimateExecutionCost(LLM_MODEL, totalTokensInput, totalTokensOutput);

// Record cost (updates execution_costs + execution_quotas)
await recordExecutionCost(
  admin,
  execution.id,
  tenantId,
  totalTokensInput,
  totalTokensOutput,
  totalCost,
);

// Mark as completed
await updateExecutionState(admin, execution.id, 'completed', {
  tokens_input_tracked: totalTokensInput,
  tokens_output_tracked: totalTokensOutput,
  estimated_cost_usd: totalCost,
});

// Publish completion event
const completionSpan = generateSpanId();
await publishAgentCompleted(admin, {
  agentId,
  tenantId,
  traceId,
  spanId: completionSpan,
  userId: user?.id,
  tokensInput: totalTokensInput,
  tokensOutput: totalTokensOutput,
  durationMs: Date.now() - sessionStartTime,
});
```

**On Failure:**

```typescript
const error = /* exception */;

// Record cost (partial, for what was attempted)
const partialCost = estimateExecutionCost(LLM_MODEL, tokensUsed.input, tokensUsed.output);
await recordExecutionCost(admin, execution.id, tenantId, tokensUsed.input, tokensUsed.output, partialCost);

// Mark as failed (with retry info if applicable)
await updateExecutionState(admin, execution.id, 'failed', {
  error_message: error.message,
  error_retriable: isRetriable(error),
  error_retry_count: 0,
});

// Publish failure event
const errorSpan = generateSpanId();
await publishAgentFailed(admin, {
  agentId,
  tenantId,
  traceId,
  spanId: errorSpan,
  userId: user?.id,
  error: error.message,
  durationMs: Date.now() - sessionStartTime,
});

return jsonError(500, 'AGENT_FAILED', error.message);
```

---

## Approval Gate Integration (Future)

For high-risk operations (production changes, vendor onboarding), add:

```typescript
// Check if approval is required
if (contractRequiresApproval(contract, operation)) {
  // Create approval gate
  const gate = await handleApprovalGate(
    admin,
    execution.id,
    tenantId,
    'production_change',
    'Agent attempting to modify production settings',
    300, // 5 minute timeout
  );

  // Update state to awaiting_approval
  await updateExecutionState(admin, execution.id, 'awaiting_approval');

  // Return 202 Accepted, wait for approval
  return jsonResponse({
    status: 'awaiting_approval',
    gate_id: gate.gate_id,
    expires_at: new Date(Date.now() + 300000).toISOString(),
  }, 202);
}
```

---

## Rollout Strategy

### Phase 2d-α (Immediate – Utilities Only)
- ✅ Deploy shared utilities (`acs-runtime-integration.ts`, etc.)
- No changes to existing functions (backward compatible)
- Allows testing utilities in isolation

### Phase 2d-β (Incremental – Governance Agent)
- [ ] Add ACS contract loading (startup validation)
- [ ] Add quota checking (pre-execution)
- [ ] Add trace generation + agent.started event
- [ ] Keep existing event logging (don't remove yet)
- [x] Beta test with governance-agent only
- [x] Verify ESS events appear in runtime_events_v2
- [x] Verify cost tracking is accurate

### Phase 2d-γ (Full Integration)
- [ ] Add per-turn event publishing (publishAgentIteration)
- [ ] Add tool event publishing (publishToolRequested/Completed)
- [ ] Add final state + cost recording
- [ ] Deprecate old event logging in `ai_tool_runs` (keep for audit)
- [ ] Update agent-os-runner similarly
- [x] E2E test: trace replay with hash chain verification

### Phase 2d-δ (Approval Gates)
- [ ] Implement approval gate workflow
- [ ] Add timeout enforcement (cron-based)
- [ ] Wire approval decisions to execution state

---

## Testing Checklist

### Unit Tests
- [ ] `acs-runtime-integration.test.ts` – contract loading, validation, capability resolution
- [ ] `ess-event-publisher.test.ts` – event publishing, trace verification, replay
- [ ] `rcs-execution-manager.test.ts` – quota checks, cost recording, state transitions

### Integration Tests
- [ ] governance-agent with ACS contract + ESS events
- [ ] agent-os-runner with quota enforcement
- [ ] Trace replay (verify causality from get_event_trace)
- [ ] Hash chain integrity (verify_event_trace passes)
- [ ] Cost accuracy (execution_costs matches actual tokens)
- [ ] Quota update (execution_quotas.used_this_month_usd increases)

### E2E Tests (Playwright)
- [ ] Governance chat with trace in DB (/app/governance/traces)
- [ ] Cost visible in billing (/settings/billing)
- [ ] Quota near-limit triggers warning
- [ ] Over-quota request rejected with 429

---

## Deployment Checklist

Before deploying to production:

- [ ] All CI checks pass (migrations, unit tests, E2E)
- [ ] Cloudflare Pages deployment successful
- [ ] Edge Function logs show ESS events publishing
- [ ] runtime_events_v2 table populated with agent events
- [ ] execution_costs records created for each execution
- [ ] execution_quotas tracking monthly usage
- [ ] No regressions in governance-agent response quality
- [ ] API response times within SLA (<2s)
- [ ] Sentry error rate < 1%

---

## References

- ACS Spec: `docs/agent-contract-specification.md`
- ESS Spec: `docs/event-schema-standard.md`
- RCS Spec: `docs/runtime-contract-specification.md`
- Shared Utilities: `supabase/functions/_shared/{acs,ess,rcs}*.ts`
- governance-agent: `supabase/functions/governance-agent/index.ts`
- agent-os-runner: `supabase/functions/agent-os-runner/index.ts`
