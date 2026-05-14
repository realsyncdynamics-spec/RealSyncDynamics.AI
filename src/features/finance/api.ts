import { getSupabase } from '../../lib/supabase';
import type {
  TaxYear, TaxYearStatus, TaxDocument, TaxSourceType, TaxClassificationStatus,
  TaxDocumentLink, TaxRelatedEntityType,
  TaxEvidenceExport, TaxExportType, TaxExportStatus,
  TaxReminder, TaxReminderType,
  TaxAuditEvent,
  UstCadence, LegalForm,
} from './types';
import { buildAnnualDeadlines, type FilingProfile, type CatalogReminder } from './deadlineCatalog';

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

/**
 * Trigger ZIP generation for a `preparing` export row. Calls the
 * `evidence-export` Edge Function, which reads the year's documents,
 * builds the ZIP, uploads to storage, and flips the row to `ready`.
 * Returns the updated row's metadata. On failure, the row is set to
 * `failed` and the error is surfaced.
 */
export async function generateEvidenceExport(exportId: string): Promise<{
  status: TaxExportStatus;
  export_path: string;
  checksum: string;
  document_count: number;
  total_amount: number;
  bytes: number;
}> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('evidence-export', {
    body: { export_id: exportId },
  });
  if (error) {
    throw new Error(error.message ?? 'evidence-export failed');
  }
  const body = data as { ok?: boolean; error?: { code: string; message: string } } & Record<string, unknown>;
  if (body?.ok === false) {
    const err = body.error;
    throw new Error(err ? `${err.code}: ${err.message}` : 'evidence-export failed');
  }
  return {
    status:         body.status as TaxExportStatus,
    export_path:    body.export_path as string,
    checksum:       body.checksum as string,
    document_count: Number(body.document_count ?? 0),
    total_amount:   Number(body.total_amount ?? 0),
    bytes:          Number(body.bytes ?? 0),
  };
}

/**
 * Mint a signed download URL for the generated ZIP. The bucket is
 * private; signed URLs are the only public read path.
 */
export async function getExportDownloadUrl(
  exportPath: string, expiresInSeconds = 300,
): Promise<string> {
  const sb = getSupabase();
  const { data, error } = await sb.storage
    .from('tax-evidence-exports')
    .createSignedUrl(exportPath, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? 'could not sign export url');
  }
  return data.signedUrl;
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
  catalog_key?: string;
  metadata?: Record<string, unknown>;
}): Promise<TaxReminder> {
  const sb = getSupabase();
  const { data, error } = await sb.from('tax_reminders').insert({
    tenant_id:     tenantId,
    tax_year_id:   payload.tax_year_id,
    reminder_type: payload.reminder_type,
    title:         payload.title,
    due_at:        payload.due_at,
    catalog_key:   payload.catalog_key ?? null,
    metadata:      payload.metadata ?? null,
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

/**
 * Update the filing profile on a tax year — drives which deadlines
 * the catalog generator emits. Profile changes do NOT retroactively
 * regenerate; call generateDeadlinesForYear() after.
 */
export async function updateTaxYearProfile(
  tenantId: string, taxYearId: string, profile: FilingProfile,
): Promise<void> {
  const sb = getSupabase();
  const before = await sb.from('tax_years').select('*').eq('id', taxYearId).single();
  const { error } = await sb.from('tax_years').update({
    ust_cadence:     profile.ust_cadence,
    has_tax_advisor: profile.has_tax_advisor,
    legal_form:      profile.legal_form,
  }).eq('tenant_id', tenantId).eq('id', taxYearId);
  if (error) throw new Error(error.message);
  await logAudit({
    tenant_id: tenantId,
    event_type: 'tax_year.profile_update',
    entity_type: 'tax_year',
    entity_id: taxYearId,
    before_state: before.data as unknown as Record<string, unknown> | null,
    after_state: profile as unknown as Record<string, unknown>,
  });
}

/**
 * Generate the statutory-deadline catalog for the given tax year and
 * insert every entry as a new reminder. Idempotent: existing rows
 * with matching `catalog_key` are skipped (unique index in DB).
 * Returns counts so the UI can render a useful summary.
 */
export async function generateDeadlinesForYear(
  tenantId: string, taxYear: TaxYear,
): Promise<{ inserted: number; skipped: number; total: number }> {
  const profile: FilingProfile = {
    ust_cadence:     taxYear.ust_cadence,
    has_tax_advisor: taxYear.has_tax_advisor,
    legal_form:      taxYear.legal_form,
  };
  const catalog: CatalogReminder[] = buildAnnualDeadlines(taxYear.year, profile);

  const sb = getSupabase();
  // Read existing catalog_keys for this year so we can compute the
  // skipped/inserted split before INSERT (the unique index prevents
  // dupes, but we want a useful UI summary).
  const { data: existing, error: exErr } = await sb
    .from('tax_reminders')
    .select('catalog_key')
    .eq('tenant_id', tenantId)
    .eq('tax_year_id', taxYear.id)
    .not('catalog_key', 'is', null);
  if (exErr) throw new Error(exErr.message);
  const have = new Set((existing ?? []).map((r) => (r as { catalog_key: string }).catalog_key));

  const toInsert = catalog.filter((c) => !have.has(c.catalog_key));
  if (toInsert.length === 0) {
    return { inserted: 0, skipped: catalog.length, total: catalog.length };
  }

  const rows = toInsert.map((c) => ({
    tenant_id:     tenantId,
    tax_year_id:   taxYear.id,
    reminder_type: c.reminder_type,
    title:         c.title,
    due_at:        c.due_at,
    catalog_key:   c.catalog_key,
    metadata:      c.metadata,
  }));

  const { error: insErr } = await sb.from('tax_reminders').insert(rows);
  if (insErr) throw new Error(insErr.message);

  await logAudit({
    tenant_id: tenantId,
    event_type: 'reminder.catalog_generated',
    entity_type: 'tax_year',
    entity_id: taxYear.id,
    after_state: {
      year: taxYear.year,
      inserted: toInsert.length,
      skipped: catalog.length - toInsert.length,
    },
  });

  return {
    inserted: toInsert.length,
    skipped:  catalog.length - toInsert.length,
    total:    catalog.length,
  };
}

export type { FilingProfile };
export { type UstCadence, type LegalForm };

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
