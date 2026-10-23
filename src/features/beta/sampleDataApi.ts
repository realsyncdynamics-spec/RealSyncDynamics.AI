/**
 * Beispieldaten für Beta-Mandanten (WP-4, docs/claude/BETA_V5_WORKPLAN.md).
 *
 * Laden/Entfernen läuft über die Edge Function `beta-sample-data`
 * (Service-Role nur dort; `governance_assets` ist im Browser nur lesbar).
 * Der Bestand wird direkt gelesen — RLS gibt Mitgliedern ihren Mandanten.
 *
 * Markierung: `metadata.sample = true` (supabase/functions/beta-sample-data/logic.ts).
 * Erkennung hier über die Metadaten, nicht über den Namen.
 */
import { postEdgeFunction } from '../../lib/edgeFunction';
import { getSupabase } from '../../lib/supabase';
import { notifyTenantDataChanged } from '../governance/tenantDataEvents';

export const SAMPLE_FLAG = 'sample';
export const SAMPLE_NAME_PREFIX = '[Beispiel] ';

export interface SampleDataResponse {
  ok: true;
  action: 'load' | 'remove';
  loaded?: number;
  removed?: number;
  alreadyLoaded?: boolean;
  count?: number;
}

export function isSampleAsset(row: { metadata?: unknown }): boolean {
  const m = row.metadata;
  return typeof m === 'object' && m !== null && (m as Record<string, unknown>)[SAMPLE_FLAG] === true;
}

/** Anzahl markierter Beispiel-Einträge des Mandanten (0 = keine). */
export async function countSampleAssets(tenantId: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from('governance_assets')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq(`metadata->>${SAMPLE_FLAG}`, 'true');
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function loadSampleData(tenantId: string): Promise<SampleDataResponse> {
  const res = await postEdgeFunction<SampleDataResponse>('beta-sample-data', { tenantId, action: 'load' });
  notifyTenantDataChanged(tenantId);
  return res;
}

export async function removeSampleData(tenantId: string): Promise<SampleDataResponse> {
  const res = await postEdgeFunction<SampleDataResponse>('beta-sample-data', { tenantId, action: 'remove' });
  notifyTenantDataChanged(tenantId);
  return res;
}
