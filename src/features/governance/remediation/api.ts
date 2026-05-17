import { getSupabase } from '../../../lib/supabase';
import type {
  RemediationPlan,
  CreateRemediationPlanArgs,
  RemediationSnippet,
} from './types';

// All calls go through the `remediation-agent` Edge Function which
// enforces auth + tenant membership server-side. Read paths go through
// PostgREST with the user's JWT; RLS handles tenant scoping.

export async function listRemediationPlans(tenant_id: string): Promise<RemediationPlan[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('remediation_plans')
    .select('*')
    .eq('tenant_id', tenant_id)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(`listRemediationPlans: ${error.message}`);
  return (data ?? []) as RemediationPlan[];
}

export async function getRemediationPlan(tenant_id: string, plan_id: string): Promise<RemediationPlan | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('remediation_plans')
    .select('*')
    .eq('tenant_id', tenant_id)
    .eq('id', plan_id)
    .maybeSingle();
  if (error) throw new Error(`getRemediationPlan: ${error.message}`);
  return (data as RemediationPlan | null) ?? null;
}

export async function createRemediationPlan(args: CreateRemediationPlanArgs): Promise<RemediationPlan> {
  const result = await invokeAgent({
    op: 'create_remediation_plan',
    ...args,
  });
  if (!result.ok) throw new Error(`createRemediationPlan: ${result.error?.message ?? 'unknown'}`);
  // The function returns a slim shape; refetch via the read path so the
  // UI sees the full row (including tenant_id, evidence_id, etc.).
  const planId = result.plan?.id as string | undefined;
  if (!planId) throw new Error('createRemediationPlan: missing plan id in response');
  const fetched = await getRemediationPlan(args.tenant_id, planId);
  if (!fetched) throw new Error('createRemediationPlan: plan persisted but not readable (RLS?)');
  return fetched;
}

export async function generateFixSnippet(tenant_id: string, plan_id: string): Promise<RemediationSnippet> {
  const result = await invokeAgent({
    op: 'generate_fix_snippet',
    tenant_id,
    plan_id,
  });
  if (!result.ok) throw new Error(`generateFixSnippet: ${result.error?.message ?? 'unknown'}`);
  return result.snippet as unknown as RemediationSnippet;
}

export async function prepareGithubIssue(tenant_id: string, plan_id: string): Promise<{ title: string; body: string; labels: string[] }> {
  const result = await invokeAgent({
    op: 'prepare_github_issue',
    tenant_id,
    plan_id,
  });
  if (!result.ok) throw new Error(`prepareGithubIssue: ${result.error?.message ?? 'unknown'}`);
  return result.issue as unknown as { title: string; body: string; labels: string[] };
}

export async function preparePrComment(tenant_id: string, plan_id: string, hunk_context?: string): Promise<{ body: string }> {
  const result = await invokeAgent({
    op: 'prepare_pr_comment',
    tenant_id,
    plan_id,
    hunk_context: hunk_context ?? '',
  });
  if (!result.ok) throw new Error(`preparePrComment: ${result.error?.message ?? 'unknown'}`);
  return result.comment as unknown as { body: string };
}

// ── shared invoke helper ───────────────────────────────────────────

interface AgentResult {
  ok: boolean;
  error?: { code: string; message: string };
  plan?:    Record<string, unknown>;
  snippet?: Record<string, unknown>;
  issue?:   Record<string, unknown>;
  comment?: Record<string, unknown>;
  [k: string]: unknown;
}

async function invokeAgent(body: Record<string, unknown>): Promise<AgentResult> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('remediation-agent', { body });
  if (error) {
    return { ok: false, error: { code: 'INVOKE_FAILED', message: error.message } };
  }
  return (data ?? { ok: false, error: { code: 'EMPTY', message: 'empty response' } }) as AgentResult;
}
