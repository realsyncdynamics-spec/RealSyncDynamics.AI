/**
 * AI-Act Daten-Governance (Art. 10) — Client-API + Vollständigkeits-Heuristik.
 *
 * Liest/schreibt `ai_act_datasets` direkt über den Supabase-Client; RLS
 * (Migration 20260625100000_ai_act_data_governance.sql) beschränkt jede
 * Operation auf Tenant-Mitglieder. Bewusst ohne eigenen Edge-Function-Hop
 * — wie `countRiskInventory` in aiActRiskInventoryApi.ts.
 */
import { getSupabase } from '../../lib/supabase';

export type DatasetRole = 'training' | 'validation' | 'testing' | 'production_input' | 'other';

export interface Dataset {
  id: string;
  tenant_id: string;
  ai_system_ref: string | null;
  name: string;
  dataset_role: DatasetRole;
  source_description: string | null;
  origin_jurisdictions: string[];
  contains_personal_data: boolean;
  special_categories: boolean;
  legal_basis: string | null;
  data_steward: string | null;
  preprocessing_notes: string | null;
  bias_assessment: string | null;
  representativeness_note: string | null;
  known_gaps: string | null;
  collected_from: string | null;
  collected_to: string | null;
  evidence_id: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDatasetInput {
  tenant_id: string;
  name: string;
  ai_system_ref?: string;
  dataset_role?: DatasetRole;
  source_description?: string;
  origin_jurisdictions?: string[];
  contains_personal_data?: boolean;
  special_categories?: boolean;
  legal_basis?: string;
  data_steward?: string;
  preprocessing_notes?: string;
  bias_assessment?: string;
  representativeness_note?: string;
  known_gaps?: string;
  collected_from?: string;
  collected_to?: string;
  evidence_id?: string;
}

export const DATASET_ROLE_LABEL: Record<DatasetRole, string> = {
  training:         'Trainingsdaten',
  validation:       'Validierungsdaten',
  testing:          'Testdaten',
  production_input: 'Produktiv-Eingabedaten',
  other:            'Sonstige',
};

// ── CRUD über RLS ────────────────────────────────────────────────────────────

export async function listDatasets(tenant_id: string): Promise<Dataset[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('ai_act_datasets')
    .select('*')
    .eq('tenant_id', tenant_id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Dataset[];
}

export async function createDataset(input: CreateDatasetInput): Promise<Dataset> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('ai_act_datasets')
    .insert(input)
    .select('*')
    .single();
  if (error) throw error;
  return data as Dataset;
}

export async function deleteDataset(id: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from('ai_act_datasets').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Tenant-Zähler für Live-Widgets (Homepage-Agent-Card etc.). Direkt über RLS,
 * liefert null wenn Supabase nicht konfiguriert / Tenant nicht lesbar ist.
 */
export async function countDatasets(
  tenant_id: string,
): Promise<{ total: number; with_personal_data: number } | null> {
  try {
    const sb = getSupabase();
    const [allRes, pdRes] = await Promise.all([
      sb.from('ai_act_datasets')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant_id),
      sb.from('ai_act_datasets')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant_id)
        .eq('contains_personal_data', true),
    ]);
    if (allRes.error || pdRes.error) return null;
    return { total: allRes.count ?? 0, with_personal_data: pdRes.count ?? 0 };
  } catch {
    return null;
  }
}

// ── Art.-10-Vollständigkeit ──────────────────────────────────────────────────

/**
 * Die nach Art. 10 zu dokumentierenden Daten-Governance-Facetten. `legal_basis`
 * ist nur bei Personenbezug verpflichtend (DSGVO) und wird sonst übersprungen.
 */
export type Art10Facet =
  | 'source'
  | 'origin'
  | 'data_steward'
  | 'legal_basis'
  | 'preprocessing'
  | 'bias'
  | 'representativeness';

export const ART10_FACET_LABEL: Record<Art10Facet, string> = {
  source:             'Herkunft & Erhebung',
  origin:             'Geografische Herkunft',
  data_steward:       'Data Steward',
  legal_basis:        'Rechtsgrundlage (DSGVO)',
  preprocessing:      'Vorverarbeitung/Annotation',
  bias:               'Bias-Prüfung',
  representativeness: 'Repräsentativität',
};

export interface Art10Assessment {
  covered: Art10Facet[];
  missing: Art10Facet[];
  /** Erfüllungsgrad 0–100 über die anwendbaren Facetten. */
  score: number;
  complete: boolean;
}

const hasText = (v: string | null | undefined): boolean =>
  typeof v === 'string' && v.trim().length > 0;

/**
 * Bewertet, welche Art-10-Facetten ein Datensatz dokumentiert. `legal_basis`
 * zählt nur als anwendbare Facette, wenn der Datensatz personenbezogene Daten
 * enthält — andernfalls geht sie weder in `missing` noch in den Nenner ein.
 */
export function assessArt10Completeness(
  d: Pick<
    Dataset,
    | 'source_description'
    | 'origin_jurisdictions'
    | 'data_steward'
    | 'legal_basis'
    | 'preprocessing_notes'
    | 'bias_assessment'
    | 'representativeness_note'
    | 'contains_personal_data'
  >,
): Art10Assessment {
  const checks: Array<{ facet: Art10Facet; ok: boolean; applicable: boolean }> = [
    { facet: 'source',             ok: hasText(d.source_description),       applicable: true },
    { facet: 'origin',             ok: (d.origin_jurisdictions ?? []).length > 0, applicable: true },
    { facet: 'data_steward',       ok: hasText(d.data_steward),             applicable: true },
    { facet: 'legal_basis',        ok: hasText(d.legal_basis),              applicable: d.contains_personal_data },
    { facet: 'preprocessing',      ok: hasText(d.preprocessing_notes),      applicable: true },
    { facet: 'bias',               ok: hasText(d.bias_assessment),          applicable: true },
    { facet: 'representativeness', ok: hasText(d.representativeness_note),   applicable: true },
  ];

  const applicable = checks.filter((c) => c.applicable);
  const covered = applicable.filter((c) => c.ok).map((c) => c.facet);
  const missing = applicable.filter((c) => !c.ok).map((c) => c.facet);
  const score = applicable.length === 0
    ? 100
    : Math.round((covered.length / applicable.length) * 100);

  return { covered, missing, score, complete: missing.length === 0 };
}
