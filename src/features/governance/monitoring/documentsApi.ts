// Lese-API für erzeugte Compliance-Dokumente eines Tenants
// (Tabelle generated_documents). RLS erlaubt Tenant-Mitgliedern den SELECT
// ihrer eigenen Dokumente (tenant_id IS NOT NULL AND is_tenant_member).
import { getSupabase } from '../../../lib/supabase';

export interface TenantDocument {
  id: string;
  doc_type: 'dse' | 'avv' | 'vvt' | 'tom';
  domain: string;
  company: string | null;
  created_at: string;
}

export const DOC_TYPE_LABEL: Record<TenantDocument['doc_type'], string> = {
  dse: 'Datenschutzerklärung',
  avv: 'Auftragsverarbeitungsvertrag',
  vvt: 'Verarbeitungsverzeichnis',
  tom: 'Technische & Org. Maßnahmen',
};

export async function fetchTenantDocuments(tenantId: string): Promise<TenantDocument[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('generated_documents')
    .select('id,doc_type,domain,company,created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as TenantDocument[];
}
