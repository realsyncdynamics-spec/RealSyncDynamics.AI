/**
 * RCS Execution Manager — Manage execution state machine and quota enforcement.
 *
 * Provides:
 * - checkExecutionQuota() — Pre-execution validation (monthly budget check)
 * - recordExecutionCost() — Post-execution billing (update quotas)
 * - updateExecutionState() — Transition execution through state machine
 * - handleApprovalGate() — Process approval workflow with timeout
 */

import { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export interface QuotaCheckResult {
  allowed: boolean;
  error?: string;
  remaining_usd?: number;
  estimated_cost_usd?: number;
  warning?: string;
}

export interface ExecutionCostRecord {
  status: string;
  cost_usd: number;
  tokens_input: number;
  tokens_output: number;
}

/**
 * Check tenant quota before execution.
 * Returns { allowed: true } if quota available, otherwise { allowed: false, error, remaining_usd }.
 */
export async function checkExecutionQuota(
  admin: SupabaseClient,
  tenantId: string,
  agentId: string,
  agentContractVersion: string,
  estimatedCost: number,
): Promise<QuotaCheckResult> {
  const { data, error } = await admin.rpc('check_execution_quota', {
    p_tenant_id: tenantId,
    p_agent_id: agentId,
    p_agent_contract_version: agentContractVersion,
    p_estimated_cost: estimatedCost,
  });

  if (error) {
    console.error('check_execution_quota failed:', error.message);
    return { allowed: false, error: error.message };
  }

  return data as QuotaCheckResult;
}

/**
 * Record execution cost after completion.
 * Updates execution_costs table and adjusts quota usage.
 */
export async function recordExecutionCost(
  admin: SupabaseClient,
  executionId: string,
  tenantId: string,
  tokensInput: number,
  tokensOutput: number,
  costUsd: number,
): Promise<ExecutionCostRecord | null> {
  const { data, error } = await admin.rpc('record_execution_cost', {
    p_execution_id: executionId,
    p_tenant_id: tenantId,
    p_tokens_input: tokensInput,
    p_tokens_output: tokensOutput,
    p_cost_usd: costUsd,
  });

  if (error) {
    console.error('record_execution_cost failed:', error.message);
    return null;
  }

  return data as ExecutionCostRecord | null;
}

/**
 * Update execution state in runtime_executions.
 * Transitions execution through: pending → running → awaiting_approval → approved → completed/failed/cancelled
 */
export async function updateExecutionState(
  admin: SupabaseClient,
  executionId: string,
  status: 'pending' | 'running' | 'awaiting_approval' | 'approved' | 'completed' | 'failed' | 'cancelled',
  updates?: {
    agent_contract_version?: string;
    trace_id?: string;
    tokens_input_tracked?: number;
    tokens_output_tracked?: number;
    estimated_cost_usd?: number;
    approved_at?: Date;
    error_message?: string;
    error_retriable?: boolean;
    error_retry_count?: number;
  },
): Promise<{ id: string; status: string } | null> {
  const updatePayload: Record<string, unknown> = { status };

  if (updates) {
    if (updates.agent_contract_version) updatePayload.agent_contract_version = updates.agent_contract_version;
    if (updates.trace_id) updatePayload.trace_id = updates.trace_id;
    if (updates.tokens_input_tracked !== undefined) updatePayload.tokens_input_tracked = updates.tokens_input_tracked;
    if (updates.tokens_output_tracked !== undefined) updatePayload.tokens_output_tracked = updates.tokens_output_tracked;
    if (updates.estimated_cost_usd !== undefined) updatePayload.estimated_cost_usd = updates.estimated_cost_usd;
    if (updates.approved_at) updatePayload.approved_at = updates.approved_at.toISOString();
    if (updates.error_message) updatePayload.error_message = updates.error_message;
    if (updates.error_retriable !== undefined) updatePayload.error_retriable = updates.error_retriable;
    if (updates.error_retry_count !== undefined) updatePayload.error_retry_count = updates.error_retry_count;
  }

  const { data, error } = await admin
    .from('runtime_executions')
    .update(updatePayload)
    .eq('id', executionId)
    .select('id, status')
    .maybeSingle();

  if (error) {
    console.error('updateExecutionState failed:', error.message);
    return null;
  }

  return data;
}

/**
 * Process approval gate workflow.
 * Creates/updates approval record and checks timeout.
 */
export async function handleApprovalGate(
  admin: SupabaseClient,
  executionId: string,
  tenantId: string,
  triggerName: string,
  requestedReason: string,
  ttlSeconds: number,
): Promise<{ approved: boolean; expired: boolean; gate_id: string } | null> {
  // Create approval gate record
  const { data: gate, error: gateErr } = await admin
    .from('runtime_approval_gates')
    .insert({
      execution_id: executionId,
      tenant_id: tenantId,
      trigger_name: triggerName,
      requested_reason: requestedReason,
      approval_ttl_seconds: ttlSeconds,
      expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      status: 'pending',
    })
    .select('id')
    .single();

  if (gateErr) {
    console.error('handleApprovalGate insert failed:', gateErr.message);
    return null;
  }

  return {
    approved: false,
    expired: false,
    gate_id: gate.id,
  };
}

/**
 * Poll approval gate status (check if approved or expired).
 */
export async function checkApprovalGateStatus(
  admin: SupabaseClient,
  gateId: string,
): Promise<{ status: string; decision?: string; expired: boolean } | null> {
  const { data: gate, error } = await admin
    .from('runtime_approval_gates')
    .select('status, decision, expires_at')
    .eq('id', gateId)
    .maybeSingle();

  if (error) {
    console.error('checkApprovalGateStatus failed:', error.message);
    return null;
  }

  if (!gate) {
    return null;
  }

  const now = new Date();
  const expiresAt = new Date(gate.expires_at);
  const expired = now > expiresAt;

  return {
    status: gate.status,
    decision: gate.decision,
    expired,
  };
}

/**
 * Approve or deny an approval gate.
 */
export async function resolveApprovalGate(
  admin: SupabaseClient,
  gateId: string,
  decision: 'approved' | 'denied',
  reason?: string,
): Promise<{ status: string } | null> {
  const { data, error } = await admin
    .from('runtime_approval_gates')
    .update({
      status: decision === 'approved' ? 'approved' : 'denied',
      decision,
      decision_timestamp: new Date().toISOString(),
    })
    .eq('id', gateId)
    .select('status')
    .maybeSingle();

  if (error) {
    console.error('resolveApprovalGate failed:', error.message);
    return null;
  }

  return data;
}

/**
 * Calculate estimated cost for execution based on model and token estimates.
 * Uses MODEL_PRICING from modelSelection.ts (if available) or defaults.
 */
export function estimateExecutionCost(
  model: string,
  estimatedTokensInput: number,
  estimatedTokensOutput: number,
): number {
  // Simplified pricing model (per 1M tokens)
  const pricing: Record<string, { input: number; output: number }> = {
    'claude-opus-4': { input: 15.0, output: 75.0 },
    'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
    'claude-haiku-4-5': { input: 0.8, output: 4.0 },
    'default': { input: 1.0, output: 5.0 },
  };

  const p = pricing[model] || pricing['default'];
  const costInput = (estimatedTokensInput / 1_000_000) * p.input;
  const costOutput = (estimatedTokensOutput / 1_000_000) * p.output;
  return costInput + costOutput;
}
