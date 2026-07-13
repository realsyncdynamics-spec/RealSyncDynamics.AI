import { getSupabase } from '../../lib/supabase';
import type { ComplianceCheckWorkflowConfig } from './ComplianceCheckWorkflow';

const N8N_BASE = 'https://n8n.RealSyncDynamicsAI.de';

export interface WorkflowExecutionResult {
  success: boolean;
  execution_id: string;
  status: 'success' | 'error' | 'running';
  message?: string;
  data?: unknown;
}

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'timeout' | 'cancelled';
  input_payload: Record<string, unknown>;
  output_payload: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
}

export async function createComplianceCheckWorkflow(
  tenantId: string,
  config: Omit<ComplianceCheckWorkflowConfig, 'id' | 'run_count'>
): Promise<ComplianceCheckWorkflowConfig> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('create_workflow', {
    p_tenant_id: tenantId,
    p_workflow_type: 'compliance_check',
    p_config: config,
  });

  if (error) throw error;
  return data as ComplianceCheckWorkflowConfig;
}

export async function updateComplianceCheckWorkflow(
  workflowId: string,
  config: Partial<ComplianceCheckWorkflowConfig>
): Promise<ComplianceCheckWorkflowConfig> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('update_workflow', {
    p_workflow_id: workflowId,
    p_config: config,
  });

  if (error) throw error;
  return data as ComplianceCheckWorkflowConfig;
}

export async function triggerComplianceCheckWorkflow(
  workflowId: string,
  tenantId: string
): Promise<WorkflowExecutionResult> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('trigger-workflow', {
    body: {
      workflow_id: workflowId,
      tenant_id: tenantId,
      trigger_type: 'manual',
    },
  });

  if (error) {
    return {
      success: false,
      execution_id: '',
      status: 'error',
      message: error.message,
    };
  }

  return data as WorkflowExecutionResult;
}

export async function getWorkflowRuns(
  workflowId: string,
  limit: number = 10
): Promise<WorkflowRun[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('workflow_runs')
    .select('*')
    .eq('workflow_id', workflowId)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as WorkflowRun[];
}

export async function listComplianceCheckWorkflows(tenantId: string): Promise<ComplianceCheckWorkflowConfig[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('workflows')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('workflow_type', 'compliance_check')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as ComplianceCheckWorkflowConfig[];
}

export async function deleteComplianceCheckWorkflow(workflowId: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from('workflows').delete().eq('id', workflowId);

  if (error) throw error;
}

/**
 * Synchronize workflow status from n8n back to local DB.
 * Called periodically or after each execution.
 */
export async function syncWorkflowStatus(workflowId: string): Promise<ComplianceCheckWorkflowConfig> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('sync_workflow_status', {
    p_workflow_id: workflowId,
  });

  if (error) throw error;
  return data as ComplianceCheckWorkflowConfig;
}
