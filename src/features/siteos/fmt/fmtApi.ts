/** Client CRUD for fmt_* (RLS: members read; owner/admin write). */

import { getSupabase } from '../../../lib/supabase';
import type { FmtProject, FmtSourceSite, FmtWizardStep } from './fmtTypes';

export async function listFmtProjects(tenantId: string): Promise<FmtProject[]> {
  const { data, error } = await getSupabase()
    .from('fmt_projects')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as FmtProject[];
}

export async function getFmtProject(projectId: string): Promise<FmtProject | null> {
  const { data, error } = await getSupabase()
    .from('fmt_projects')
    .select('*')
    .eq('id', projectId)
    .maybeSingle();
  if (error) throw error;
  return data as FmtProject | null;
}

export async function createFmtProject(args: {
  tenantId: string;
  userId: string;
  name: string;
}): Promise<FmtProject> {
  const { data, error } = await getSupabase()
    .from('fmt_projects')
    .insert({
      tenant_id: args.tenantId,
      created_by: args.userId,
      name: args.name.trim() || 'Modernisierungsprojekt',
      status: 'draft',
      wizard_step: 1,
      product_track: 'modernize_frontend',
      metadata: {},
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as FmtProject;
}

export async function setFmtWizardStep(
  projectId: string,
  step: FmtWizardStep,
  status?: FmtProject['status'],
): Promise<FmtProject> {
  const patch: Record<string, unknown> = { wizard_step: step };
  if (status) patch.status = status;
  else if (step > 1) patch.status = 'in_progress';
  const { data, error } = await getSupabase()
    .from('fmt_projects')
    .update(patch)
    .eq('id', projectId)
    .select('*')
    .single();
  if (error) throw error;
  return data as FmtProject;
}

export async function upsertFmtSourceSite(args: {
  tenantId: string;
  projectId: string;
  sourceUrl: string;
}): Promise<FmtSourceSite> {
  let host: string | null = null;
  try {
    host = new URL(args.sourceUrl).hostname;
  } catch {
    host = null;
  }
  const { data, error } = await getSupabase()
    .from('fmt_source_sites')
    .upsert(
      {
        tenant_id: args.tenantId,
        project_id: args.projectId,
        source_url: args.sourceUrl.trim(),
        normalized_host: host,
        fetch_status: 'pending',
        raw_meta: {},
      },
      { onConflict: 'project_id,source_url' },
    )
    .select('*')
    .single();
  if (error) throw error;
  return data as FmtSourceSite;
}

export async function listFmtSourceSites(projectId: string): Promise<FmtSourceSite[]> {
  const { data, error } = await getSupabase()
    .from('fmt_source_sites')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as FmtSourceSite[];
}

export async function appendFmtGovernanceEvent(args: {
  tenantId: string;
  projectId: string;
  eventType: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await getSupabase().from('fmt_governance_events').insert({
    tenant_id: args.tenantId,
    project_id: args.projectId,
    event_type: args.eventType,
    payload: args.payload ?? {},
  });
  if (error) throw error;
}
