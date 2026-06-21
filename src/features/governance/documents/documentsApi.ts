// Lese-API für erzeugte Compliance-Dokumente (Tabelle generated_documents).
// RLS erlaubt Tenant-Mitgliedern den SELECT ihrer eigenen Dokumente
// (tenant_id IS NOT NULL AND is_tenant_member).
import { getSupabase } from '../../../lib/supabase';

export type DocType = 'dse' | 'avv' | 'vvt' | 'tom';

export interface GeneratedDoc {
  id: string;
  doc_type: DocType;
  domain: string;
  company: string | null;
  created_at: string;
  methodology_version: string;
}

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  dse: 'Datenschutzerklärung',
  avv: 'Auftragsverarbeitungsvertrag',
  vvt: 'Verarbeitungsverzeichnis',
  tom: 'Technische & Org. Maßnahmen',
};

export const DOC_TYPE_REF: Record<DocType, string> = {
  dse: 'Art. 13/14 DSGVO',
  avv: 'Art. 28 DSGVO',
  vvt: 'Art. 30 DSGVO',
  tom: 'Art. 32 DSGVO',
};

export async function fetchTenantDocuments(tenantId: string): Promise<GeneratedDoc[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('generated_documents')
    .select('id,doc_type,domain,company,created_at,methodology_version')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as GeneratedDoc[];
}

/** Lädt den HTML-Inhalt eines Dokuments (on-demand, da potenziell groß). */
export async function fetchDocumentHtml(id: string): Promise<string> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('generated_documents')
    .select('html_content')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  return (data?.html_content as string) ?? '';
}
