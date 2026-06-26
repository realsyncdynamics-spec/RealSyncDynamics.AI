// Frontend wrapper around the `generate-document` Edge Function and direct
// RLS-scoped reads of `public.generated_documents` for the active tenant.
//
// Reads gehen direkt über supabase-js (RLS „generated_documents tenant_read"
// beschränkt auf Tenant-Mitglieder). Der Schreibpfad (Generierung) läuft
// ausschließlich über die Edge Function, die den Audit-Befund als Grundlage
// nutzt und das Dokument in public.generated_documents persistiert.

import { getSupabase } from '../../../lib/supabase';

// Vom Generator unterstützte Dokumenttypen (siehe generate-document/index.ts
// und CHECK-Constraint der Tabelle generated_documents).
export type GeneratableDocType = 'dse' | 'avv' | 'vvt' | 'tom';

export const GENERATABLE_DOC_TYPES: GeneratableDocType[] = ['dse', 'avv', 'vvt', 'tom'];

export const DOC_TYPE_LABELS: Record<GeneratableDocType, string> = {
  dse: 'Datenschutzerklärung',
  avv: 'Auftragsverarbeitungsvertrag',
  vvt: 'Verarbeitungsverzeichnis',
  tom: 'Technische & Org. Maßnahmen',
};

export const DOC_TYPE_REFERENCES: Record<GeneratableDocType, string> = {
  dse: 'Art. 13/14 DSGVO',
  avv: 'Art. 28 DSGVO',
  vvt: 'Art. 30 DSGVO',
  tom: 'Art. 32 DSGVO',
};

export interface DbGeneratedDocument {
  id: string;
  tenant_id: string | null;
  audit_id: string | null;
  doc_type: GeneratableDocType;
  domain: string;
  company: string | null;
  html_content: string;
  methodology_version: string;
  created_at: string;
}

export interface GenerateDocumentResult {
  ok: boolean;
  error?: { code: string; message: string };
  document_id?: string;
  doc_type?: GeneratableDocType;
  domain?: string;
  html_content?: string;
  methodology_version?: string;
}

/** Type-Guard für die per Generator unterstützten Doc-Typen. */
export function isGeneratableDocType(value: string): value is GeneratableDocType {
  return (GENERATABLE_DOC_TYPES as string[]).includes(value);
}

/**
 * Liefert einen sicheren Dateinamen für den HTML-Download eines Dokuments.
 * Beispiel: buildDocFilename('dse', 'example.com', '2026.05.0')
 *   → 'dse_example-com_2026.05.0.html'
 */
export function buildDocFilename(
  docType: string,
  domain: string,
  methodologyVersion?: string,
): string {
  const safeDomain = (domain || 'dokument')
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const version = methodologyVersion ? `_${methodologyVersion}` : '';
  return `${docType}_${safeDomain}${version}.html`;
}

/**
 * Reads the latest generated document per doc_type for the tenant, sorted
 * newest first. RLS limitiert die Sichtbarkeit auf Tenant-Mitglieder.
 */
export async function fetchTenantDocuments(tenantId: string): Promise<DbGeneratedDocument[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('generated_documents')
    .select(
      'id, tenant_id, audit_id, doc_type, domain, company, html_content, methodology_version, created_at',
    )
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DbGeneratedDocument[];
}

/**
 * Calls the `generate-document` Edge Function. Erfordert eine audit_id
 * (gdpr_audits) als Befund-Grundlage; tenant_id ist optional und ordnet
 * das Ergebnis dem Mandanten zu.
 */
export async function generateDocument(input: {
  audit_id: string;
  doc_type: GeneratableDocType;
  tenant_id?: string;
}): Promise<GenerateDocumentResult> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('generate-document', { body: input });
  if (error) return { ok: false, error: { code: 'NETWORK', message: error.message } };
  return data as GenerateDocumentResult;
}

/** Öffnet HTML-Inhalt in einem neuen Browser-Tab (Druck → PDF möglich). */
export function openHtmlInNewTab(html: string): void {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Lädt HTML-Inhalt als Datei herunter. */
export function downloadHtml(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
