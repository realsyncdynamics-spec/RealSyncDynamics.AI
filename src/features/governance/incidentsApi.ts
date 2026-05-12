import { getSupabase } from '../../lib/supabase';
import type { IncidentStatus, IncidentSeverity, IncidentTimelineEntry } from './types';

export interface DbIncident {
  id: string;
  tenant_id: string | null;
  triggering_event_id: string | null;
  asset_id: string | null;
  title: string;
  description: string | null;
  severity: IncidentSeverity;
  status: IncidentStatus;
  breach_confirmed: boolean;
  personal_data_affected: boolean;
  affected_data_types: string[];
  estimated_affected_subjects: number | null;
  detected_at: string;
  notification_deadline_at: string;
  contained_at: string | null;
  resolved_at: string | null;
  reported_to_authority_at: string | null;
  authority_reference: string | null;
  timeline: IncidentTimelineEntry[];
  assigned_to: string | null;
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('governance-incidents', { body });
  if (error) return { ok: false, error: { code: 'NETWORK', message: error.message } } as T;
  return data as T;
}

export const createIncident = (input: Record<string, unknown>) =>
  call<{ ok: boolean; incident?: DbIncident; error?: { code: string; message: string } }>({ op: 'create', ...input });

export const transitionIncident = (id: string, status: IncidentStatus, note?: string, authority_reference?: string) =>
  call<{ ok: boolean; incident?: DbIncident; error?: { code: string; message: string } }>({ op: 'transition', id, status, note, authority_reference });

export async function fetchTenantIncidents(tenantId: string): Promise<DbIncident[]> {
  const sb = getSupabase();
  const { data, error } = await sb.from('incidents').select('*')
    .eq('tenant_id', tenantId).order('detected_at', { ascending: false }).limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as DbIncident[];
}

export async function countOpenIncidents(tenantId: string): Promise<number> {
  const sb = getSupabase();
  const { count } = await sb.from('incidents').select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId).not('status', 'in', '("resolved","reported_to_authority")');
  return count ?? 0;
}
