// Client-Wrapper für den AI Rebuild Workflow (siteos/rebuild-*).
//
// Schreibpfade laufen über die Edge Function — dort werden Mandant und
// Rolle geprüft, dort entsteht der Prüfpfad. Der Client hält nur die
// Kennung des Rebuilds und den Sperranker (`state_sha256`); jede Revision
// gibt ihn mit, ein veralteter Stand ergibt 409.
//
// Vorschauen werden **nicht** übertragen: Der Kern rendert sie im Browser
// aus demselben Zustand, deterministisch — der Hash, den der Server für
// die Freigabe bindet, ist derselbe, den der Browser zeigt.

import { getSupabase } from '../../../lib/supabase';
import type {
  ComponentOperation,
  PublishGateEvaluation,
  RebuildDirectionKey,
  RebuildWorkflowState,
  RevisionRecord,
} from '../../../../packages/siteos-core/src/index';
import { mapErrorDetailed, type SiteOsResult } from '../siteOsApi';

export interface RebuildResponse {
  ok: true;
  rebuild_id: string;
  version: number;
  state_sha256: string;
  stage: RebuildWorkflowState['stage'];
  state: RebuildWorkflowState;
  approved_at: string | null;
  blueprint_id: string | null;
  record?: RevisionRecord | null;
  gate?: PublishGateEvaluation;
  slug?: string;
  blueprint_version?: number;
}

export interface RebuildListRow {
  id: string;
  source_url: string;
  stage: RebuildWorkflowState['stage'];
  version: number;
  approved_at: string | null;
  blueprint_id: string | null;
  updated_at: string;
}

async function invoke(endpoint: string, body: Record<string, unknown>): Promise<SiteOsResult<RebuildResponse>> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke(`siteos/${endpoint}`, { body });
  if (error) return await mapErrorDetailed(error);
  return { kind: 'ok', data: data as RebuildResponse };
}

export function startRebuild(args: { tenant_id: string; url: string }): Promise<SiteOsResult<RebuildResponse>> {
  return invoke('rebuild-start', args);
}

export function getRebuild(args: { tenant_id: string; rebuild_id: string }): Promise<SiteOsResult<RebuildResponse>> {
  return invoke('rebuild-get', args);
}

export function refineRebuild(args: {
  tenant_id: string;
  rebuild_id: string;
  base_sha256: string;
  instruction?: string;
  operations?: ComponentOperation[];
  select?: RebuildDirectionKey;
}): Promise<SiteOsResult<RebuildResponse>> {
  return invoke('rebuild-refine', args);
}

export function checkRebuildReadiness(args: { tenant_id: string; rebuild_id: string }): Promise<SiteOsResult<RebuildResponse>> {
  return invoke('rebuild-readiness', args);
}

export function approveRebuild(args: { tenant_id: string; rebuild_id: string; artifact_sha256: string; reason: string }): Promise<SiteOsResult<RebuildResponse>> {
  return invoke('rebuild-approve', args);
}

/** Lesepfad, RLS-gesichert: die Rebuilds des Mandanten, jüngste zuerst. */
export async function listRebuilds(tenantId: string, limit = 12): Promise<RebuildListRow[]> {
  const sb = getSupabase();
  const { data } = await sb
    .from('siteos_rebuilds')
    .select('id, source_url, stage, version, approved_at, blueprint_id, updated_at')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as RebuildListRow[];
}
