# Phase 2d-β: Governance-Agent Integration Example

Complete concrete example of integrating ACS/ESS/RCS into governance-agent/index.ts.

---

## Step 1: Add Imports (Top of File)

**Before:**
```typescript
import { audit } from '../_shared/auditLog.ts';
import { AGENT_TOOLS, dispatchTool, SYSTEM_PROMPT } from '../_shared/agent-tools.ts';
import { checkTenantQuota, checkAnonQuota, recordChatHistory } from '../_shared/llm-quota.ts';
```

**After:**
```typescript
import { audit } from '../_shared/auditLog.ts';
import { AGENT_TOOLS, dispatchTool, SYSTEM_PROMPT } from '../_shared/agent-tools.ts';
import { checkTenantQuota, checkAnonQuota, recordChatHistory } from '../_shared/llm-quota.ts';

// NEW: ACS/ESS/RCS Integration
import { getAgentContract, validateAgentContract } from '../_shared/acs-runtime-integration.ts';
import {
  publishAgentStarted, publishAgentIteration, publishAgentCompleted, publishAgentFailed,
  publishToolRequested, publishToolCompleted, publishToolFailed,
  generateTraceId, generateSpanId,
} from '../_shared/ess-event-publisher.ts';
import {
  checkExecutionQuota, recordExecutionCost, updateExecutionState, estimateExecutionCost,
} from '../_shared/rcs-execution-manager.ts';
```

---

## Step 2: Add Contract Loading at Startup

**Add after `makeAdmin()` function (~line 150):**

```typescript
const AGENT_ID = 'governance-agent';

/**
 * Load and validate the agent's ACS contract.
 * Called once per Cold-Start to bind agent behavior to formal spec.
 */
async function loadAgentContract(admin: SupabaseAdminClient): Promise<{
  id: string;
  version: string;
  name: string;
} | null> {
  try {
    const contract = await getAgentContract(admin, AGENT_ID);
    if (!contract) {
      console.error(`ACS contract not found for agent: ${AGENT_ID}`);
      return null;
    }

    const validationError = validateAgentContract(contract.contract_json);
    if (validationError) {
      console.error(`ACS contract validation failed: ${validationError}`);
      return null;
    }

    console.log(`✓ Loaded ACS contract: ${AGENT_ID} v${contract.version} (${contract.status})`);
    return { id: contract.id, version: contract.version, name: contract.name };
  } catch (e) {
    console.error(`Failed to load ACS contract: ${(e as Error).message}`);
    return null;
  }
}

// Load contract on cold-start (outside Deno.serve)
let cachedAgentContract: { id: string; version: string; name: string } | null = null;
```

---

## Step 3: Update Main Handler (Deno.serve)

**Modify the main `Deno.serve` handler to load contract:**

```typescript
Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  // ... existing anon handlers ...

  // All other ops require a valid user JWT.
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  const userId = userResp.user.id;
  const userEmail = userResp.user.email ?? null;

  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  // NEW: Load agent contract on first auth-required request
  if (!cachedAgentContract) {
    cachedAgentContract = await loadAgentContract(admin) || { id: AGENT_ID, version: '0.0.0', name: 'governance-agent' };
  }

  try {
    switch (body.op) {
      case 'chat':         return await handleChat(admin, userId, userEmail, auth, body, cachedAgentContract);
      case 'reset':        return await handleReset(admin, userId, body);
      case 'history':      return await handleHistory(admin, userId, body);
      case 'chat_history': return await handleChatHistoryTenant(admin, userId, body);
      default:             return jsonError(400, 'BAD_REQUEST', 'unknown op');
    }
  } catch (e) {
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});
```

---

## Step 4: Update handleChat Signature & Add Quota Checks

**Replace the `handleChat` function signature:**

```typescript
async function handleChat(
  admin: SupabaseAdminClient,
  userId: string,
  userEmail: string | null,
  bearerAuth: string,
  body: Record<string, unknown>,
  agentContract: { id: string; version: string; name: string }, // NEW
): Promise<Response> {
  const tenant_id = body.tenant_id as string;
  const message = (body.message as string ?? '').trim();
  if (!tenant_id || !message) return jsonError(400, 'BAD_REQUEST', 'tenant_id and message required');

  // Membership check
  const { data: mem } = await admin.from('memberships')
    .select('role').eq('tenant_id', tenant_id).eq('user_id', userId).maybeSingle();
  if (!mem) return jsonError(403, 'FORBIDDEN', 'no membership in this tenant');

  // Plan-coupled monthly LLM quota
  const quotaResp = await enforceTenantQuota(admin, tenant_id);
  if (quotaResp) return quotaResp;

  // EU-routing guard
  const tenantEffectiveProvider = LLM_PROVIDER === 'ai_gateway' ? 'anthropic' : LLM_PROVIDER;
  if (tenantEffectiveProvider === 'anthropic' && !ALLOW_US_ROUTING && body.acknowledge_us_routing !== true) {
    return jsonError(412, 'US_ROUTING_NOT_ACKNOWLEDGED', '...');
  }

  const apiKey = await getLlmApiKey(admin);
  if (!apiKey) {
    return jsonError(503, 'LLM_NOT_CONFIGURED', '...');
  }

  // NEW: Check RCS quota (execution-level, per agent)
  const selectedTier = selectModel(message, 0, false); // Rough estimate for first turn
  const estimatedTokensPerTurn = selectedTier === 'haiku' ? 2000 : 4000;
  const estimatedCost = estimateExecutionCost(LLM_MODEL, estimatedTokensPerTurn, estimatedTokensPerTurn * 0.3);
  const quotaCheckRcs = await checkExecutionQuota(
    admin,
    tenant_id,
    agentContract.id,
    agentContract.version,
    estimatedCost,
  );
  if (!quotaCheckRcs.allowed) {
    console.warn(`RCS quota exceeded for ${tenant_id}/${agentContract.id}: ${quotaCheckRcs.error}`);
    return jsonError(429, 'QUOTA_EXCEEDED', quotaCheckRcs.error ?? 'Monthly quota exceeded');
  }
  if (quotaCheckRcs.warning) {
    console.warn(`RCS quota warning: ${quotaCheckRcs.warning}`);
  }

  // NEW: Initialize execution trace (ESS)
  const traceId = generateTraceId();
  const sessionSpanId = generateSpanId();

  // NEW: Create runtime_executions record
  const { data: execution, error: execErr } = await admin
    .from('runtime_executions')
    .insert({
      agent_id: agentContract.id,
      tenant_id,
      status: 'pending',
      agent_contract_version: agentContract.version,
      trace_id: traceId,
    })
    .select('id')
    .single();

  if (execErr) {
    return jsonError(500, 'EXEC_INSERT_FAILED', execErr.message);
  }

  // NEW: Publish agent.started event
  await publishAgentStarted(admin, {
    agentId: agentContract.id,
    tenantId: tenant_id,
    traceId,
    spanId: sessionSpanId,
    sourceFunction: 'governance-agent',
    userId,
  });

  // NEW: Update execution state: pending → running
  await updateExecutionState(admin, execution.id, 'running', {
    agent_contract_version: agentContract.version,
    trace_id: traceId,
  });

  // ... existing session loading code ...

  const client = new Anthropic({ apiKey });
  const toolCallsLog: Array<{ tool: string; input: unknown; output: unknown; iter: number }> = [];
  let totalIn = 0;
  let totalOut = 0;
  let finalText = '';
  let outcome: 'success' | 'tool_error' | 'llm_error' | 'budget_exceeded' | 'timeout' = 'success';
  let errorMessage: string | null = null;
  const startedAt = Date.now();

  try {
    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      // NEW: Generate span for this turn
      const turnSpan = generateSpanId();

      // NEW: Publish agent.iteration event
      await publishAgentIteration(admin, {
        agentId: agentContract.id,
        tenantId: tenant_id,
        traceId,
        spanId: turnSpan,
        userId,
        iteration: iter,
        message: iter === 0 ? message : `[tool results from iteration ${iter - 1}]`,
      });

      const resp = await client.messages.create({
        model: effectiveModel,
        max_tokens: maxTokens,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        tools: AGENT_TOOLS.map((t, i) =>
          i === AGENT_TOOLS.length - 1
            ? { ...t, cache_control: { type: 'ephemeral' as const } }
            : t,
        ),
        messages: history,
      });
      totalIn += resp.usage.input_tokens;
      totalOut += resp.usage.output_tokens;

      if (resp.stop_reason === 'end_turn') {
        finalText = resp.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n');
        history.push({ role: 'assistant', content: resp.content });
        break;
      }

      if (resp.stop_reason === 'tool_use') {
        history.push({ role: 'assistant', content: resp.content });
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of resp.content) {
          if (block.type !== 'tool_use') continue;

          // NEW: Publish tool.requested event
          const toolSpan = generateSpanId();
          await publishToolRequested(admin, {
            toolName: block.name,
            tenantId: tenant_id,
            traceId,
            spanId: toolSpan,
            toolInput: block.input as Record<string, unknown>,
            parentEventId: turnSpan,
          });

          const toolStartTime = Date.now();
          const result = await dispatchTool({
            name: block.name,
            input: block.input as Record<string, unknown>,
            admin,
            bearerAuth,
            tenantId: tenant_id,
            userId,
            userEmail,
          });
          const toolDuration = Date.now() - toolStartTime;

          // NEW: Publish tool.completed/failed event
          if ((result as { error?: unknown }).error) {
            await publishToolFailed(admin, {
              toolName: block.name,
              tenantId: tenant_id,
              traceId,
              spanId: toolSpan,
              parentEventId: turnSpan,
              error: JSON.stringify((result as { error?: unknown }).error),
              durationMs: toolDuration,
            });
          } else {
            await publishToolCompleted(admin, {
              toolName: block.name,
              tenantId: tenant_id,
              traceId,
              spanId: toolSpan,
              parentEventId: turnSpan,
              toolOutput: result as Record<string, unknown>,
              durationMs: toolDuration,
            });
          }

          toolCallsLog.push({ tool: block.name, input: block.input, output: result, iter });
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
            is_error: !!(result as { error?: unknown }).error,
          });
        }
        history.push({ role: 'user', content: toolResults });
        continue;
      }

      outcome = 'llm_error';
      errorMessage = `unexpected stop_reason: ${resp.stop_reason}`;
      break;
    }

    if (!finalText && outcome === 'success') {
      outcome = 'budget_exceeded';
      errorMessage = `MAX_ITERATIONS (${MAX_ITERATIONS}) reached without end_turn`;
    }
  } catch (e) {
    outcome = 'llm_error';
    errorMessage = (e as Error).message;
  }

  const durationMs = Date.now() - startedAt;

  // NEW: Record costs and update execution state
  if (outcome === 'success') {
    const totalCost = estimateExecutionCost(effectiveModel, totalIn, totalOut);
    
    // Record cost (updates execution_costs + execution_quotas)
    await recordExecutionCost(
      admin,
      execution.id,
      tenant_id,
      totalIn,
      totalOut,
      totalCost,
    );

    // Mark as completed
    await updateExecutionState(admin, execution.id, 'completed', {
      tokens_input_tracked: totalIn,
      tokens_output_tracked: totalOut,
      estimated_cost_usd: totalCost,
    });

    // Publish completion event
    const completionSpan = generateSpanId();
    await publishAgentCompleted(admin, {
      agentId: agentContract.id,
      tenantId: tenant_id,
      traceId,
      spanId: completionSpan,
      userId,
      tokensInput: totalIn,
      tokensOutput: totalOut,
      durationMs,
    });
  } else {
    // Mark as failed
    const partialCost = estimateExecutionCost(effectiveModel, totalIn, totalOut);
    await recordExecutionCost(admin, execution.id, tenant_id, totalIn, totalOut, partialCost);
    
    await updateExecutionState(admin, execution.id, 'failed', {
      error_message: errorMessage ?? 'Unknown error',
      error_retriable: false,
    });

    // Publish failure event
    const errorSpan = generateSpanId();
    await publishAgentFailed(admin, {
      agentId: agentContract.id,
      tenantId: tenant_id,
      traceId,
      spanId: errorSpan,
      userId,
      error: errorMessage ?? 'Unknown error',
      durationMs,
    });
  }

  // Persist session (existing code)
  await admin.from('agent_sessions').upsert({
    id: sessionId,
    tenant_id,
    user_id: userId,
    history,
    last_turn_at: new Date().toISOString(),
  });

  // Persist run trace (existing code)
  await admin.from('agent_runs').insert({
    session_id: sessionId,
    tenant_id,
    actor_user_id: userId,
    actor_email: userEmail,
    user_message: message.slice(0, 4000),
    final_response: finalText.slice(0, 8000),
    tool_calls: toolCallsLog,
    iterations: toolCallsLog.length > 0 ? Math.max(...toolCallsLog.map((t) => t.iter)) + 1 : 1,
    llm_provider: LLM_PROVIDER,
    llm_model: effectiveModel,
    input_tokens: totalIn,
    output_tokens: totalOut,
    cost_usd: estimateCostUsFromModel(effectiveModel, totalIn, totalOut),
    duration_ms: durationMs,
    outcome,
    error_message: errorMessage,
  });

  // Audit log (existing code)
  await audit(admin, {
    tenant_id,
    actor_user_id: userId,
    actor_email: userEmail,
    action: 'agent.chat',
    target_type: 'agent_session',
    target_id: sessionId,
    payload: { iterations: toolCallsLog.length, outcome, tools: toolCallsLog.map((t) => t.tool) },
  });

  // Chat history (existing code, only on success)
  if (outcome === 'success') {
    await logChatToHistory(admin, {
      tenant_id,
      user_id: userId,
      session_id: sessionId,
      op: 'chat',
      provider: LLM_PROVIDER,
      model: effectiveModel,
      query_text: message.slice(0, 4000),
      response_summary: finalText,
      input_tokens: totalIn,
      output_tokens: totalOut,
    });
  }

  // NEW: Add execution details to response
  return jsonResponse({
    ok: outcome === 'success',
    session_id: sessionId,
    response: finalText,
    tool_calls: toolCallsLog.length,
    actions_taken: toolCallsLog.map((t) => t.tool),
    outcome,
    error: errorMessage,
    tokens: { input: totalIn, output: totalOut },
    duration_ms: durationMs,
    // NEW: Trace info for audit trail
    trace_id: traceId,
    execution_id: execution.id,
    agent_version: agentContract.version,
  });
}
```

---

## Summary of Changes

| Item | Type | Purpose |
|------|------|---------|
| Imports | 3 new modules | ACS/ESS/RCS integration utilities |
| `loadAgentContract()` | New function | Load formal ACS contract at startup |
| `AGENT_ID` constant | New | Agent identifier for contract lookup |
| Handler signature | Updated | Pass agent contract to handleChat |
| Quota check | New (RCS) | Check execution-level budget before LLM |
| Trace init | New (ESS) | Generate unique trace_id per execution |
| `execution` record | New (RCS) | Create runtime_executions entry |
| Events (agent.started) | New (ESS) | Publish at execution start |
| Events (agent.iteration) | New (ESS) | Publish per LLM turn |
| Events (tool.*) | New (ESS) | Publish per tool invocation |
| Cost recording | New (RCS) | Track tokens and update quotas |
| State update | New (RCS) | Transition through state machine |
| Events (agent.completed/failed) | New (ESS) | Publish at execution end |
| Response payload | Enhanced | Include trace_id, execution_id, agent_version |

---

## Backward Compatibility

✅ **All existing functionality preserved:**
- Session history still persists to `agent_sessions`
- Run traces still logged to `agent_runs`
- Audit logs still written to `governance_admin_audit_log`
- Chat history still recorded in `llm_query_history`
- Quota checking uses existing `checkTenantQuota()` + new RCS layer

**New paths in parallel:**
- ACS contract loaded but doesn't block execution if missing
- ESS events published asynchronously (failures don't break chat)
- RCS quota checks before execution (can reject over-budget requests)
- Execution state tracked in `runtime_executions` + `runtime_events_v2`

**Deprecation plan:**
- Phase 2d-γ: Evaluate existing event logging, deprecate old tables gradually
- Phase 2e: Full migration to ESS as canonical event trail

---

## Testing Checklist

- [ ] Contract loads and caches correctly
- [ ] Quota check prevents over-budget execution
- [ ] ESS events publish without breaking chat flow
- [ ] Tokens tracked accurately (totalIn, totalOut)
- [ ] Cost calculated and recorded correctly
- [ ] Execution state transitions properly (pending → running → completed/failed)
- [ ] Old event logging still works (session_history, agent_runs, etc.)
- [ ] Anon chat paths unaffected (no ACS contract required for public mode)
- [ ] E2E: trace_id appears in response and runtime_events_v2

---

## Deployment

1. Apply changes to `governance-agent/index.ts`
2. Ensure `_shared/acs-runtime-integration.ts`, `_shared/ess-event-publisher.ts`, `_shared/rcs-execution-manager.ts` are in place
3. Run existing test suite (should pass — backward compatible)
4. Deploy to staging
5. Verify ESS events in `runtime_events_v2` table
6. Monitor token tracking and cost accuracy
7. Check quota enforcement (create test agent with low budget)
8. Deploy to production

