// evidence-export — generate the ZIP package for a tax_evidence_exports row.
//
// POST /functions/v1/evidence-export
// Body: { export_id: string }
//
// Flow:
//   1. Read the tax_evidence_exports row (must be status='preparing'
//      and belong to a tenant the caller is a member of — RLS enforces).
//   2. Read all tax_documents for the linked tax_year_id.
//   3. Build the ZIP in-memory:
//        /README.txt
//        /manifest.json
//        /index.csv
//        /documents/<source_type>/<doc_id>.json
//   4. Upload the ZIP to the `tax-evidence-exports` bucket at
//      `tenants/<tenant_id>/<tax_year>/<export_id>.zip`.
//   5. Compute sha256 over the ZIP bytes.
//   6. Update the row: status='ready', export_path, checksum,
//      document_count, total_amount, ready_at.
//
// Audit: every successful generation writes a tax_audit_events row.
//
// This function is auth-gated. The DB reads use the caller's JWT so
// tenant-scoped RLS is honoured for the read side; the storage upload
// and the tax_evidence_exports UPDATE use the service-role key.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { observeAal2 } from '../_shared/requireAal2.ts';
import {
  BlobReader, BlobWriter, TextReader, ZipWriter,
} from 'jsr:@zip-js/zip-js@2.7.45';
import {
  buildCsvIndex,
  buildManifest,
  buildReadme,
  buildDocumentJson,
  zipPathFor,
  type TaxDocument,
} from '../_shared/evidenceExport/index.ts';
import type { RedactionPolicy } from '../_shared/redact.ts';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

// Steuerberater muessen Beleg-Inhalte im Klartext sehen (Betraege,
// Rechnungsadressen, IBANs). Eine PII-Redaction wuerde die berufsrechtliche
// Pruefung nach § 32 StBerG unmoeglich machen. Wir protokollieren die
// 'never'-Entscheidung trotzdem fuer den DSB-Audit.
const REDACTION_POLICY: RedactionPolicy = 'never';

const BUCKET = 'tax-evidence-exports';

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST')    return jsonError(405, 'METHOD_NOT_ALLOWED', 'POST required');

  let body: { export_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }
  const exportId = typeof body.export_id === 'string' ? body.export_id : '';
  if (!exportId) return jsonError(400, 'BAD_REQUEST', 'export_id required');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return jsonError(401, 'UNAUTHORIZED', 'bearer token required');
  }
  // P0d Phase 1 — OBSERVE ONLY: AAL2-Status protokollieren, NICHT blocken.
  observeAal2(authHeader, 'evidence-export');

  // Caller-scoped client for the reads (RLS enforces tenant isolation).
  const caller = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth:   { persistSession: false },
  });

  // Service-role client for the storage upload + row update.
  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  // 1. Load the export row + linked tax_year (RLS).
  const { data: exportRow, error: exportErr } = await caller
    .from('tax_evidence_exports')
    .select('id, tenant_id, tax_year_id, export_type, status')
    .eq('id', exportId)
    .single();
  if (exportErr || !exportRow) {
    return jsonError(404, 'NOT_FOUND', exportErr?.message ?? 'export not found');
  }
  // Allow re-running from `preparing` (initial) AND `failed` (retry).
  // Block once the row is already `ready` / `downloaded` so we don't
  // accidentally overwrite a sealed package + its checksum.
  if (exportRow.status !== 'preparing' && exportRow.status !== 'failed') {
    return jsonError(409, 'WRONG_STATE', `export already in status ${exportRow.status}`);
  }

  // SECURITY: a member of multiple tenants could otherwise craft a
  // tax_evidence_exports row in tenant A pointing at tenant B's
  // tax_year_id. RLS lets the user read both rows individually, but
  // the export must stay single-tenant. We pin every downstream read
  // to exportRow.tenant_id and verify the year matches.
  const expectedTenantId = exportRow.tenant_id;

  const { data: yearRow, error: yearErr } = await caller
    .from('tax_years')
    .select('year, tenant_id')
    .eq('id', exportRow.tax_year_id)
    .eq('tenant_id', expectedTenantId)
    .single();
  if (yearErr || !yearRow) {
    return jsonError(404, 'NOT_FOUND', yearErr?.message ?? 'tax_year not found for tenant');
  }

  // 2. Load all tax_documents for that year — pinned to the export's
  // tenant_id so cross-tenant year-IDs cannot pull in foreign docs.
  const { data: docsRaw, error: docsErr } = await caller
    .from('tax_documents')
    .select('*')
    .eq('tenant_id', expectedTenantId)
    .eq('tax_year_id', exportRow.tax_year_id)
    .order('document_date', { ascending: true });
  if (docsErr) {
    return jsonError(500, 'DB_ERROR', docsErr.message);
  }
  const docs = (docsRaw ?? []) as TaxDocument[];

  // 3. Build the ZIP.
  const generatedAt = new Date().toISOString();
  const manifest = buildManifest({
    tenant_id:   exportRow.tenant_id,
    tax_year:    yearRow.year,
    export_row:  { id: exportRow.id, export_type: exportRow.export_type },
    documents:   docs,
    generated_at: generatedAt,
  });
  const csv = buildCsvIndex(docs);
  const readme = buildReadme(manifest);

  const blobWriter = new BlobWriter('application/zip');
  const zip = new ZipWriter(blobWriter);
  await zip.add('README.txt',    new TextReader(readme));
  await zip.add('manifest.json', new TextReader(JSON.stringify(manifest, null, 2)));
  await zip.add('index.csv',     new TextReader(csv));
  for (const d of docs) {
    await zip.add(zipPathFor(d), new TextReader(buildDocumentJson(d)));
  }
  const zipBlob = await zip.close();
  const zipBytes = new Uint8Array(await zipBlob.arrayBuffer());

  // 4. sha256.
  const hashBuf = await crypto.subtle.digest('SHA-256', zipBytes);
  const checksum = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0')).join('');

  // 5. Upload via service-role.
  const exportPath = `tenants/${exportRow.tenant_id}/${yearRow.year}/${exportRow.id}.zip`;
  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(exportPath, new Blob([zipBytes], { type: 'application/zip' }), {
      contentType: 'application/zip',
      upsert: true,
    });
  if (uploadErr) {
    await markFailed(admin, exportId, `upload: ${uploadErr.message}`);
    return jsonError(500, 'UPLOAD_FAILED', uploadErr.message);
  }

  // 6. Mark row ready. `notes` is cleared in case this was a retry
  // from `failed` where markFailed() left an error reason there.
  const totalGross = manifest.total_gross;
  const { error: updErr } = await admin
    .from('tax_evidence_exports')
    .update({
      status:         'ready',
      export_path:    exportPath,
      checksum,
      document_count: manifest.document_count,
      total_amount:   totalGross,
      ready_at:       generatedAt,
      notes:          null,
    })
    .eq('id', exportId);
  if (updErr) {
    return jsonError(500, 'DB_UPDATE_FAILED', updErr.message);
  }

  // Audit event (best-effort).
  await admin.from('tax_audit_events').insert({
    tenant_id:    exportRow.tenant_id,
    event_type:   'export.generated',
    entity_type:  'tax_evidence_export',
    entity_id:    exportRow.id,
    after_state:  {
      status: 'ready',
      checksum,
      document_count: manifest.document_count,
      total_amount: totalGross,
    },
    source: 'agent',
  });
  // PII-Redaction-Audit: 'never' fuer Steuerberater-Bundle. Wichtig fuer
  // den DSB-Nachweis, dass die Klartext-Entscheidung bewusst getroffen wurde.
  await admin.from('pii_redaction_log').insert({
    tenant_id:       exportRow.tenant_id,
    function_name:   'evidence-export',
    policy_applied:  REDACTION_POLICY,
    correlation_id:  exportRow.id,
    hits_total:      0,
    hits_by_category: {},
    payload_bytes:   zipBytes.byteLength,
    notes:           '§ 32 StBerG — Steuerberater-Bundle benoetigt Klartext.',
  });

  return jsonResponse({
    ok: true,
    export_id:      exportId,
    status:         'ready',
    export_path:    exportPath,
    checksum,
    document_count: manifest.document_count,
    total_amount:   totalGross,
    bytes:          zipBytes.byteLength,
  });
});

// ── Helpers ────────────────────────────────────────────────────────

async function markFailed(
  admin: ReturnType<typeof createClient>, exportId: string, reason: string,
): Promise<void> {
  await admin.from('tax_evidence_exports')
    .update({ status: 'failed', notes: reason })
    .eq('id', exportId);
}
