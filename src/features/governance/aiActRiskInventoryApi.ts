import { getSupabase } from '../../lib/supabase';

export type Severity = 'prohibited' | 'high' | 'limited' | 'minimal';

export interface InventoryItem {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  severity: Severity;
  matched_use_cases: Array<{ id: string; title: string; category: string }>;
  prohibited_triggers: Array<{ norm: string; rationale: string }>;
  limited_triggers: Array<{ norm: string; rationale: string }>;
  has_prohibited_overlay: boolean;
  confidence_score: number | null;
  registry_version: string | null;
  notes: string | null;
  classified_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateInput {
  tenant_id: string;
  name: string;
  description?: string;
  severity: Severity;
  matched_use_cases?: InventoryItem['matched_use_cases'];
  prohibited_triggers?: InventoryItem['prohibited_triggers'];
  limited_triggers?: InventoryItem['limited_triggers'];
  has_prohibited_overlay?: boolean;
  confidence_score?: number;
  registry_version?: string;
  notes?: string;
}

export interface UpdateInput {
  id: string;
  name?: string;
  description?: string;
  severity?: Severity;
  matched_use_cases?: InventoryItem['matched_use_cases'];
  prohibited_triggers?: InventoryItem['prohibited_triggers'];
  limited_triggers?: InventoryItem['limited_triggers'];
  has_prohibited_overlay?: boolean;
  confidence_score?: number;
  registry_version?: string;
  notes?: string;
}

interface ApiErr  { code: string; message: string }
interface ListRes { ok: boolean; items?: InventoryItem[]; error?: ApiErr }
interface OneRes  { ok: boolean; item?:  InventoryItem;   error?: ApiErr }
interface AckRes  { ok: boolean; error?: ApiErr }

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('ai-act-risk-inventory', { body });
  if (error) return { ok: false, error: { code: 'NETWORK', message: error.message } } as T;
  return data as T;
}

export const listRiskInventory   = (tenant_id: string)        => call<ListRes>({ op: 'list',   tenant_id });
export const getRiskInventoryItem = (id: string)               => call<OneRes>({  op: 'get',    id });
export const createRiskInventory  = (input: CreateInput)        => call<OneRes>({  op: 'create', ...input });
export const updateRiskInventory  = (input: UpdateInput)        => call<OneRes>({  op: 'update', ...input });
export const deleteRiskInventory  = (id: string)               => call<AckRes>({  op: 'delete', id });

export const SEVERITY_LABEL: Record<Severity, string> = {
  prohibited: 'Verboten (Art. 5)',
  high:       'Hohes Risiko (Annex III)',
  limited:    'Begrenztes Risiko (Art. 50)',
  minimal:    'Minimales Risiko',
};

export const SEVERITY_ORDER: Record<Severity, number> = {
  prohibited: 0, high: 1, limited: 2, minimal: 3,
};
