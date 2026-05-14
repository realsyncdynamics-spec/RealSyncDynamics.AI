import { getSupabase } from '../../lib/supabase';
import type {
  TaxYear, TaxYearStatus, TaxDocument, TaxSourceType, TaxClassificationStatus,
  TaxDocumentLink, TaxRelatedEntityType,
  TaxEvidenceExport, TaxExportType, TaxExportStatus,
  TaxReminder, TaxReminderType,
  TaxAuditEvent,
} from './types';

// Thin Supabase wrappers for the Tax Evidence Runtime. Every call is
// tenant-scoped via RLS; we still pass tenant_id explicitly so the
// query plans are tight and so the caller can't accidentally request
// the wrong tenant.

async function logAudit(input: {
  tenant_id: string;
  event_type: string;
  entity_type: string;
  entity_id?: string | null;
  before_state?: Record<string, unknown> | null;
  after_state?: Record<string, unknown> | null;
}): Promise<void> {
  const sb = getSupabase();
  await sb.from('tax_audit_events').insert({
    tenant_id:    input.tenant_id,
    event_type:   input.event_type,
    entity_type:  input.entity_type,
    entity_id:    input.entity_id ?? null,
    before_state: input.before_state ?? null,
    after_state:  input.after_state ?? null,
    source:       'ui',
  });
}

// ── Tax years ────────────────────────────────────────────────────

export async function listTaxYears(tenantId: string): Promise<TaxYear[]> {
  const sb = getSupabase();
  const { data } = await sb.from('tax_years')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('year', { ascending: false });
  return (data as TaxYear[] | null) ?? [];
}

export async function createTaxYear(tenantId: string, year: number, notes?: string): Promise<TaxYear> {
  const sb = getSupabase();
  const { data, error } = await sb.from('tax_years').insert({
    tenant_id: tenantId,
    year,
    notes: notes ?? null,
  }).select('*').single();
  if (error) throw new Error(error.message);
  await logAudit({
    tenant_id: tenantId,
    event_type: 'tax_year.create',
    entity_type: 'tax_year',
    entity_id: (data as TaxYear).id,
    after_state: data as unknown as Record<string, unknown>,
  });
  return data as TaxYear;
}

export async function updateTaxYearStatus(
  tenantId: string, taxYearId: string, status: TaxYearStatus,
): Promise<void> {
  const sb = getSupabase();
  const before = await sb.from('tax_years').select('*').eq('id', taxYearId).single();
  const { error } = await sb.from('tax_years').update({ status })
    .eq('tenant_id', tenantId).eq('id', taxYearId);
  if (error) throw new Error(error.message);
  await logAudit({
    tenant_id: tenantId,
    event_type: 'tax_year.status_change',
    entity_type: 'tax_year',
    entity_id: taxYearId,
    before_state: before.data as unknown as Record<string, unknown> | null,
    after_state: { status },
  });
}

// ── Tax documents ────────────────────────────────────────────────

export async function listTaxDocuments(
  tenantId: string, opts?: { taxYearId?: string; sourceType?: TaxSourceType; limit?: number },
): Promise<TaxDocument[]> {
  const sb = getSupabase();
  let q = sb.from('tax_documents').select('*').eq('tenant_id', tenantId);
  if (opts?.taxYearId)   q = q.eq('tax_year_id',  opts.taxYearId);
  if (opts?.sourceType)  q = q.eq('source_type',  opts.sourceType);
  const { data } = await q
    .order('document_date', { ascending: false })
    .limit(opts?.limit ?? 500);
  return (data as TaxDocument[] | null) ?? [];
}

export async function createTaxDocument(tenantId: string, payload: {
  tax_year_id: string;
  source_type: TaxSourceType;
  document_date: string;
  file_name: string;
  file_path?: string | null;
  mime_type?: string | null;
  amount_net?: number | null;
  amount_gross?: number | null;
  currency?: string;
  counterparty_name?: string | null;
  ai_summary?: string | null;
}): Promise<TaxDocument> {
  const sb = getSupabase();
  const { data, error } = await sb.from('tax_documents').insert({
    tenant_id:             tenantId,
    tax_year_id:           payload.tax_year_id,
    source_type:           payload.source_type,
    document_date:         payload.document_date,
    file_name:             payload.file_name,
    file_path:             payload.file_path ?? null,
    mime_type:             payload.mime_type ?? null,
    amount_net:            payload.amount_net ?? null,
    amount_gross:          payload.amount_gross ?? null,
    currency:              payload.currency ?? 'EUR',
    counterparty_name:     payload.counterparty_name ?? null,
    ai_summary:            payload.ai_summary ?? null,
    classification_status: 'pending',
  }).select('*').single();
  if (error) throw new Error(error.message);
  await logAudit({
    tenant_id: tenantId,
    event_type: 'tax_document.create',
    entity_type: 'tax_document',
    entity_id: (data as TaxDocument).id,
    after_state: data as unknown as Record<string, unknown>,
  });
  return data as TaxDocument;
}

export async function updateClassification(
  tenantId: string, documentId: string, status: TaxClassificationStatus,
): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from('tax_documents')
    .update({ classification_status: status })
    .eq('tenant_id', tenantId).eq('id', documentId);
  if (error) throw new Error(error.message);
  await logAudit({
    tenant_id: tenantId,
    event_type: 'tax_document.classify',
    entity_type: 'tax_document',
    entity_id: documentId,
    after_state: { classification_status: status },
  });
}

// ── Links ────────────────────────────────────────────────────────

export async function listDocumentLinks(
  tenantId: string, documentId: string,
): Promise<TaxDocumentLink[]> {
  const sb = getSupabase();
  const { data } = await sb.from('tax_document_links')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('tax_document_id', documentId);
  return (data as TaxDocumentLink[] | null) ?? [];
}

export async function createDocumentLink(tenantId: string, payload: {
  tax_document_id: string;
  related_entity_type: TaxRelatedEntityType;
  related_entity_id: string;
  note?: string | null;
}): Promise<TaxDocumentLink> {
  const sb = getSupabase();
  const { data, error } = await sb.from('tax_document_links').insert({
    tenant_id:           tenantId,
    tax_document_id:     payload.tax_document_id,
    related_entity_type: payload.related_entity_type,
    related_entity_id:   payload.related_entity_id,
    note:                payload.note ?? null,
  }).select('*').single();
  if (error) throw new Error(error.message);
  await logAudit({
    tenant_id: tenantId,
    event_type: 'tax_document.link',
    entity_type: 'tax_document_link',
    entity_id: (data as TaxDocumentLink).id,
    after_state: data as unknown as Record<string, unknown>,
  });
  return data as TaxDocumentLink;
}

// ── Exports ──────────────────────────────────────────────────────

export async function listExports(
  tenantId: string, taxYearId?: string,
): Promise<TaxEvidenceExport[]> {
  const sb = getSupabase();
  let q = sb.from('tax_evidence_exports').select('*').eq('tenant_id', tenantId);
  if (taxYearId) q = q.eq('tax_year_id', taxYearId);
  const { data } = await q.order('created_at', { ascending: false });
  return (data as TaxEvidenceExport[] | null) ?? [];
}

export async function createExport(tenantId: string, payload: {
  tax_year_id: string;
  export_type: TaxExportType;
  notes?: string;
}): Promise<TaxEvidenceExport> {
  const sb = getSupabase();
  const { data, error } = await sb.from('tax_evidence_exports').insert({
    tenant_id:   tenantId,
    tax_year_id: payload.tax_year_id,
    export_type: payload.export_type,
    status:      'preparing',
    notes:       payload.notes ?? null,
  }).select('*').single();
  if (error) throw new Error(error.message);
  await logAudit({
    tenant_id: tenantId,
    event_type: 'export.create',
    entity_type: 'tax_evidence_export',
    entity_id: (data as TaxEvidenceExport).id,
    after_state: data as unknown as Record<string, unknown>,
  });
  return data as TaxEvidenceExport;
}

export async function markExportStatus(
  tenantId: string, exportId: string, status: TaxExportStatus,
): Promise<void> {
  const sb = getSupabase();
  const patch: Record<string, unknown> = { status };
  if (status === 'ready') patch.ready_at = new Date().toISOString();
  if (status === 'downloaded') patch.downloaded_at = new Date().toISOString();
  const { error } = await sb.from('tax_evidence_exports')
    .update(patch)
    .eq('tenant_id', tenantId).eq('id', exportId);
  if (error) throw new Error(error.message);
  await logAudit({
    tenant_id: tenantId,
    event_type: `export.${status}`,
    entity_type: 'tax_evidence_export',
    entity_id: exportId,
    after_state: patch,
  });
}

// ── Reminders ────────────────────────────────────────────────────

export async function listReminders(
  tenantId: string, opts?: { taxYearId?: string; openOnly?: boolean },
): Promise<TaxReminder[]> {
  const sb = getSupabase();
  let q = sb.from('tax_reminders').select('*').eq('tenant_id', tenantId);
  if (opts?.taxYearId) q = q.eq('tax_year_id', opts.taxYearId);
  if (opts?.openOnly)  q = q.eq('status', 'open');
  const { data } = await q.order('due_at', { ascending: true });
  return (data as TaxReminder[] | null) ?? [];
}

export async function createReminder(tenantId: string, payload: {
  tax_year_id: string;
  reminder_type: TaxReminderType;
  title: string;
  due_at: string;
}): Promise<TaxReminder> {
  const sb = getSupabase();
  const { data, error } = await sb.from('tax_reminders').insert({
    tenant_id:     tenantId,
    tax_year_id:   payload.tax_year_id,
    reminder_type: payload.reminder_type,
    title:         payload.title,
    due_at:        payload.due_at,
  }).select('*').single();
  if (error) throw new Error(error.message);
  await logAudit({
    tenant_id: tenantId,
    event_type: 'reminder.create',
    entity_type: 'tax_reminder',
    entity_id: (data as TaxReminder).id,
    after_state: data as unknown as Record<string, unknown>,
  });
  return data as TaxReminder;
}

export async function dismissReminder(tenantId: string, reminderId: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from('tax_reminders')
    .update({ status: 'dismissed' })
    .eq('tenant_id', tenantId).eq('id', reminderId);
  if (error) throw new Error(error.message);
  await logAudit({
    tenant_id: tenantId,
    event_type: 'reminder.dismiss',
    entity_type: 'tax_reminder',
    entity_id: reminderId,
  });
}

// ── Audit events ─────────────────────────────────────────────────

export async function listAuditEvents(tenantId: string, limit = 200): Promise<TaxAuditEvent[]> {
  const sb = getSupabase();
  const { data } = await sb.from('tax_audit_events')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data as TaxAuditEvent[] | null) ?? [];
}
