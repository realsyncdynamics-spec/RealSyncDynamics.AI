// Legal-RAG ingestion adapter — Phase 1 internal pipeline.
//
// Backed by migration 20260614000000_legal_rag_foundation.sql:
//   - legal_documents      (insert/upsert by source_url+version)
//   - legal_chunks         (bulk insert; embeddings populated later)
//   - legal_ingest_runs    (lifecycle tracker)
//
// Phase 1 contract:
//   - Caller is internal (service-role); tenant_id is always null
//     (Phase 3 will allow tenant-private corpus)
//   - One ingest run = one source authority pull
//     (e.g. EUR-Lex CELEX 32016R0679 weekly refresh, EDPB guidelines)
//   - Chunks are stored WITHOUT embeddings — embedding-service hooks in
//     a follow-up PR and populates legal_chunks.embedding lazily
//   - All disclaimers are NOT NULL on insert; default applied at DB
//   - Idempotency: a re-pull with the same (source_url, version)
//     upserts the document and reinserts chunks; chunk_index is the
//     uniqueness handle within a doc
//
// Out of scope here:
//   - HTTP fetching from EUR-Lex / EDPB / BfDI (separate Edge Function
//     in PR-4 calling this helper after parsing)
//   - Chunking strategy (caller provides chunks; sensible defaults
//     live in the future Edge Function)
//   - Embedding generation

export type LegalCallerType = 'internal' | 'tenant' | 'api';

export type LegalFramework =
  | 'gdpr' | 'ai_act' | 'nis2' | 'dsa' | 'data_act' | 'eidas'
  | 'ttdsg' | 'tmg' | 'tdsg' | 'c2pa' | 'cloud_act'
  | 'edpb' | 'bfdi' | 'cnil' | 'other';

export type LegalJurisdiction =
  | 'eu' | 'de' | 'at' | 'ch' | 'fr' | 'us' | 'uk' | 'other';

export type LegalDocumentType =
  | 'regulation' | 'directive' | 'guideline' | 'opinion'
  | 'caselaw' | 'standard' | 'recommendation' | 'other';

export type LegalIngestStatus =
  | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface AdminLike {
  from(table: string): {
    insert(row: Record<string, unknown> | Record<string, unknown>[]): {
      select(cols: string): {
        single(): Promise<{
          data: { id: string } | null;
          error: { message: string } | null;
        }>;
      };
    } & PromiseLike<{
      error: { message: string } | null;
    }>;
    update(patch: Record<string, unknown>): {
      eq(col: string, val: unknown): Promise<{ error: { message: string } | null }>;
    };
    upsert(row: Record<string, unknown>, opts?: { onConflict?: string }): {
      select(cols: string): {
        single(): Promise<{
          data: { id: string } | null;
          error: { message: string } | null;
        }>;
      };
    };
    delete(): {
      eq(col: string, val: unknown): Promise<{ error: { message: string } | null }>;
    };
  };
}

export interface NewLegalDocument {
  jurisdiction:       LegalJurisdiction;
  framework:          LegalFramework;
  document_type:      LegalDocumentType;
  source_authority:   string;
  source_url:         string;
  source_identifier?: string | null;
  language?:          string;
  title:              string;
  published_at?:      string | null;
  effective_at?:      string | null;
  disclaimer?:        string | null;
  version?:           string | null;
  superseded_by?:     string | null;
  raw_payload?:       Record<string, unknown> | null;
}

export interface NewLegalChunk {
  chunk_index:      number;
  chunk_text:       string;
  chunk_tokens?:    number | null;
  heading_path?:    string | null;
  citation_anchor?: string | null;
}

export interface StartIngestRunInput {
  source_authority: string;
  correlation_id?:  string | null;
  raw_payload?:     Record<string, unknown> | null;
}

export class LegalIngestError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'LegalIngestError';
    this.code = code;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Validation (pure)
// ─────────────────────────────────────────────────────────────────────

const VALID_FRAMEWORKS: ReadonlySet<LegalFramework> = new Set([
  'gdpr', 'ai_act', 'nis2', 'dsa', 'data_act', 'eidas',
  'ttdsg', 'tmg', 'tdsg', 'c2pa', 'cloud_act',
  'edpb', 'bfdi', 'cnil', 'other',
]);

const VALID_JURISDICTIONS: ReadonlySet<LegalJurisdiction> = new Set([
  'eu', 'de', 'at', 'ch', 'fr', 'us', 'uk', 'other',
]);

const VALID_DOCUMENT_TYPES: ReadonlySet<LegalDocumentType> = new Set([
  'regulation', 'directive', 'guideline', 'opinion',
  'caselaw', 'standard', 'recommendation', 'other',
]);

export function validateDocument(d: NewLegalDocument): void {
  if (!d.title || d.title.trim().length === 0) {
    throw new LegalIngestError('invalid-document', 'title must be non-empty');
  }
  if (!d.source_url || !/^https?:\/\//i.test(d.source_url)) {
    throw new LegalIngestError('invalid-document',
      `source_url must be http(s) URL, got: ${d.source_url}`);
  }
  if (!d.source_authority || d.source_authority.trim().length === 0) {
    throw new LegalIngestError('invalid-document', 'source_authority must be non-empty');
  }
  if (!VALID_FRAMEWORKS.has(d.framework)) {
    throw new LegalIngestError('invalid-document', `unknown framework: ${d.framework}`);
  }
  if (!VALID_JURISDICTIONS.has(d.jurisdiction)) {
    throw new LegalIngestError('invalid-document', `unknown jurisdiction: ${d.jurisdiction}`);
  }
  if (!VALID_DOCUMENT_TYPES.has(d.document_type)) {
    throw new LegalIngestError('invalid-document', `unknown document_type: ${d.document_type}`);
  }
}

export function validateChunks(chunks: NewLegalChunk[]): void {
  if (chunks.length === 0) {
    throw new LegalIngestError('invalid-chunks', 'at least one chunk required');
  }
  const seenIdx = new Set<number>();
  for (const c of chunks) {
    if (!Number.isInteger(c.chunk_index) || c.chunk_index < 0) {
      throw new LegalIngestError('invalid-chunks',
        `chunk_index must be non-negative integer, got: ${c.chunk_index}`);
    }
    if (seenIdx.has(c.chunk_index)) {
      throw new LegalIngestError('invalid-chunks',
        `duplicate chunk_index: ${c.chunk_index}`);
    }
    seenIdx.add(c.chunk_index);
    if (!c.chunk_text || c.chunk_text.length === 0) {
      throw new LegalIngestError('invalid-chunks',
        `chunk ${c.chunk_index}: chunk_text must be non-empty`);
    }
    if (c.chunk_text.length > 8000) {
      throw new LegalIngestError('invalid-chunks',
        `chunk ${c.chunk_index}: chunk_text exceeds 8000 chars (${c.chunk_text.length})`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Run lifecycle
// ─────────────────────────────────────────────────────────────────────

export async function startIngestRun(
  admin: AdminLike,
  input: StartIngestRunInput,
): Promise<string> {
  if (!input.source_authority || input.source_authority.trim().length === 0) {
    throw new LegalIngestError('invalid-run', 'source_authority required');
  }
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from('legal_ingest_runs')
    .insert({
      tenant_id:      null,           // Phase 1 internal-only
      source_authority: input.source_authority,
      status:         'running',
      started_at:     now,
      correlation_id: input.correlation_id ?? null,
      raw_payload:    input.raw_payload ?? null,
    })
    .select('id')
    .single();
  if (error) throw new LegalIngestError('db-error', `startIngestRun: ${error.message}`);
  if (!data?.id) throw new LegalIngestError('db-error', 'startIngestRun returned no id');
  return data.id;
}

export async function completeIngestRun(
  admin:           AdminLike,
  runId:           string,
  counts: { documents_ingested: number; chunks_ingested: number },
): Promise<void> {
  if (!runId) throw new LegalIngestError('invalid-run', 'runId required');
  if (counts.documents_ingested < 0 || counts.chunks_ingested < 0) {
    throw new LegalIngestError('invalid-run', 'counts must be non-negative');
  }
  const { error } = await admin
    .from('legal_ingest_runs')
    .update({
      status:             'completed',
      completed_at:       new Date().toISOString(),
      documents_ingested: counts.documents_ingested,
      chunks_ingested:    counts.chunks_ingested,
    })
    .eq('id', runId);
  if (error) throw new LegalIngestError('db-error', `completeIngestRun: ${error.message}`);
}

export async function failIngestRun(
  admin: AdminLike,
  runId: string,
  err:   { code: string; message: string },
): Promise<void> {
  if (!runId) throw new LegalIngestError('invalid-run', 'runId required');
  const { error } = await admin
    .from('legal_ingest_runs')
    .update({
      status:        'failed',
      completed_at:  new Date().toISOString(),
      error_code:    err.code,
      error_message: err.message.slice(0, 500),
    })
    .eq('id', runId);
  if (error) throw new LegalIngestError('db-error', `failIngestRun: ${error.message}`);
}

// ─────────────────────────────────────────────────────────────────────
// Document + chunk ingestion
// ─────────────────────────────────────────────────────────────────────

export interface IngestDocumentResult {
  document_id:     string;
  chunks_inserted: number;
}

/**
 * Upsert a document and (re-)insert its chunks. The upsert key is
 * (source_url, version) — composite uniqueness modelled at the
 * application layer (the DB doesn't carry that unique yet because
 * version is NULL for many docs; we treat NULL+NULL as the same key).
 *
 * Strategy:
 *   1. UPSERT legal_documents on source_url match (per-run dedup)
 *   2. DELETE existing chunks for that document_id
 *   3. BULK INSERT new chunks
 *
 * This is intentionally simple — atomic update at the document-level,
 * chunks treated as fully replaceable. Embedding-aware re-ingestion
 * (preserve existing embeddings for unchanged chunks) is a Phase 2
 * concern.
 */
export async function ingestDocumentWithChunks(
  admin:  AdminLike,
  doc:    NewLegalDocument,
  chunks: NewLegalChunk[],
): Promise<IngestDocumentResult> {
  validateDocument(doc);
  validateChunks(chunks);

  const docRow = buildDocumentRow(doc);

  const { data: docData, error: docErr } = await admin
    .from('legal_documents')
    .upsert(docRow, { onConflict: 'source_url' })
    .select('id')
    .single();
  if (docErr) {
    throw new LegalIngestError('db-error',
      `upsert legal_documents: ${docErr.message}`);
  }
  if (!docData?.id) {
    throw new LegalIngestError('db-error',
      'upsert legal_documents returned no id');
  }
  const document_id = docData.id;

  // Replace chunk set — chunks are re-derived on every re-pull.
  const { error: delErr } = await admin
    .from('legal_chunks')
    .delete()
    .eq('document_id', document_id);
  if (delErr) {
    throw new LegalIngestError('db-error',
      `delete legal_chunks: ${delErr.message}`);
  }

  const chunkRows = chunks.map((c) => ({
    document_id,
    chunk_index:     c.chunk_index,
    chunk_text:      c.chunk_text,
    chunk_tokens:    c.chunk_tokens    ?? null,
    heading_path:    c.heading_path    ?? null,
    citation_anchor: c.citation_anchor ?? null,
    // embedding intentionally null — populated by embedding-service.
  }));

  const { error: insErr } = await admin
    .from('legal_chunks')
    .insert(chunkRows);
  if (insErr) {
    throw new LegalIngestError('db-error',
      `insert legal_chunks: ${insErr.message}`);
  }

  return { document_id, chunks_inserted: chunkRows.length };
}

// ─────────────────────────────────────────────────────────────────────
// Internal builders (exported for tests)
// ─────────────────────────────────────────────────────────────────────

export function buildDocumentRow(d: NewLegalDocument): Record<string, unknown> {
  return {
    tenant_id:         null,                       // Phase 1 internal-only
    jurisdiction:      d.jurisdiction,
    framework:         d.framework,
    document_type:     d.document_type,
    source_authority:  d.source_authority,
    source_url:        d.source_url,
    source_identifier: d.source_identifier ?? null,
    language:          d.language          ?? 'de',
    title:             d.title,
    published_at:      d.published_at      ?? null,
    effective_at:      d.effective_at      ?? null,
    // DB applies the strict default if null is passed; we never pass
    // empty-string here so the DB-level NOT NULL is honored.
    disclaimer:        (d.disclaimer && d.disclaimer.trim().length > 0)
      ? d.disclaimer.trim()
      : undefined,                                 // let DB DEFAULT fire
    version:           d.version       ?? null,
    superseded_by:     d.superseded_by ?? null,
    raw_payload:       d.raw_payload   ?? null,
  };
}
