/**
 * Contract tests for the Legal-RAG ingestion adapter.
 *
 * Mocks the AdminLike client; no DB round-trips. Verifies:
 *   - validation rejects malformed documents/chunks before any DB call
 *   - lifecycle: start → complete / fail
 *   - ingestDocumentWithChunks: upsert doc, delete old chunks, insert new
 *   - error propagation from any DB step
 */
import { describe, it, expect } from 'vitest';
import {
  startIngestRun,
  completeIngestRun,
  failIngestRun,
  ingestDocumentWithChunks,
  validateDocument,
  validateChunks,
  buildDocumentRow,
  LegalIngestError,
  type AdminLike,
  type NewLegalDocument,
  type NewLegalChunk,
} from '../../supabase/functions/_shared/legal-ingest';

interface Call { kind: string; table: string; payload?: unknown; col?: string; val?: unknown; opts?: unknown }

function mockAdmin(opts: {
  insertSingleResult?: { data: { id: string } | null; error: { message: string } | null };
  insertBulkResult?:   { error: { message: string } | null };
  upsertResult?:       { data: { id: string } | null; error: { message: string } | null };
  updateResult?:       { error: { message: string } | null };
  deleteResult?:       { error: { message: string } | null };
} = {}): { admin: AdminLike; calls: Call[] } {
  const calls: Call[] = [];
  const admin: AdminLike = {
    from(table) {
      return {
        insert(payload) {
          calls.push({ kind: 'insert', table, payload });
          const bulkPromise: PromiseLike<{ error: { message: string } | null }> = {
            then(resolve, reject) {
              const result = opts.insertBulkResult ?? { error: null };
              return Promise.resolve(result).then(resolve, reject);
            },
          };
          return Object.assign(bulkPromise, {
            select() {
              return {
                single() {
                  return Promise.resolve(opts.insertSingleResult ?? {
                    data: { id: 'inserted-1' }, error: null,
                  });
                },
              };
            },
          });
        },
        upsert(payload, upsertOpts) {
          calls.push({ kind: 'upsert', table, payload, opts: upsertOpts });
          return {
            select() {
              return {
                single() {
                  return Promise.resolve(opts.upsertResult ?? {
                    data: { id: 'doc-upsert-1' }, error: null,
                  });
                },
              };
            },
          };
        },
        update(patch) {
          return {
            eq(col, val) {
              calls.push({ kind: 'update', table, payload: patch, col, val });
              return Promise.resolve(opts.updateResult ?? { error: null });
            },
          };
        },
        delete() {
          return {
            eq(col, val) {
              calls.push({ kind: 'delete', table, col, val });
              return Promise.resolve(opts.deleteResult ?? { error: null });
            },
          };
        },
      };
    },
  };
  return { admin, calls };
}

const validDoc: NewLegalDocument = {
  jurisdiction:     'eu',
  framework:        'gdpr',
  document_type:    'regulation',
  source_authority: 'eur-lex',
  source_url:       'https://eur-lex.europa.eu/eli/reg/2016/679/oj',
  source_identifier: 'CELEX:32016R0679',
  title:            'DSGVO',
  published_at:     '2016-04-27',
};

const validChunks: NewLegalChunk[] = [
  { chunk_index: 0, chunk_text: 'Art. 6 (1) lit. a DSGVO — Einwilligung.' },
  { chunk_index: 1, chunk_text: 'Art. 7 DSGVO — Bedingungen für die Einwilligung.' },
];

// ─── Validation ──────────────────────────────────────────────────────

describe('validateDocument', () => {
  it('accepts a complete valid document', () => {
    expect(() => validateDocument(validDoc)).not.toThrow();
  });
  it('rejects empty title', () => {
    expect(() => validateDocument({ ...validDoc, title: '   ' }))
      .toThrow(LegalIngestError);
  });
  it('rejects non-http source_url', () => {
    expect(() => validateDocument({ ...validDoc, source_url: 'file:///etc/passwd' }))
      .toThrow(/source_url/);
  });
  it('rejects unknown framework', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => validateDocument({ ...validDoc, framework: 'wibble' as any }))
      .toThrow(/framework/);
  });
  it('rejects unknown jurisdiction', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => validateDocument({ ...validDoc, jurisdiction: 'xx' as any }))
      .toThrow(/jurisdiction/);
  });
  it('rejects unknown document_type', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => validateDocument({ ...validDoc, document_type: 'tweet' as any }))
      .toThrow(/document_type/);
  });
});

describe('validateChunks', () => {
  it('accepts a normal chunk list', () => {
    expect(() => validateChunks(validChunks)).not.toThrow();
  });
  it('rejects an empty list', () => {
    expect(() => validateChunks([])).toThrow(/at least one chunk/);
  });
  it('rejects duplicate chunk_index', () => {
    expect(() => validateChunks([
      { chunk_index: 0, chunk_text: 'a' },
      { chunk_index: 0, chunk_text: 'b' },
    ])).toThrow(/duplicate chunk_index/);
  });
  it('rejects negative chunk_index', () => {
    expect(() => validateChunks([{ chunk_index: -1, chunk_text: 'x' }]))
      .toThrow(/chunk_index/);
  });
  it('rejects empty chunk_text', () => {
    expect(() => validateChunks([{ chunk_index: 0, chunk_text: '' }]))
      .toThrow(/chunk_text/);
  });
  it('rejects chunk_text > 8000 chars', () => {
    expect(() => validateChunks([{ chunk_index: 0, chunk_text: 'x'.repeat(8001) }]))
      .toThrow(/8000/);
  });
});

describe('buildDocumentRow', () => {
  it('sets tenant_id null (Phase 1 internal-only)', () => {
    expect(buildDocumentRow(validDoc).tenant_id).toBeNull();
  });
  it('defaults language to "de"', () => {
    expect(buildDocumentRow(validDoc).language).toBe('de');
  });
  it('preserves explicit language', () => {
    expect(buildDocumentRow({ ...validDoc, language: 'en' }).language).toBe('en');
  });
  it('passes disclaimer undefined to let DB default fire', () => {
    expect(buildDocumentRow(validDoc).disclaimer).toBeUndefined();
  });
  it('trims explicit disclaimer', () => {
    expect(buildDocumentRow({ ...validDoc, disclaimer: '  custom  ' }).disclaimer)
      .toBe('custom');
  });
});

// ─── Lifecycle ───────────────────────────────────────────────────────

describe('startIngestRun', () => {
  it('inserts a row with status=running + started_at', async () => {
    const { admin, calls } = mockAdmin({
      insertSingleResult: { data: { id: 'run-1' }, error: null },
    });
    const runId = await startIngestRun(admin, { source_authority: 'eur-lex' });
    expect(runId).toBe('run-1');
    expect(calls).toHaveLength(1);
    const ins = calls[0];
    expect(ins.kind).toBe('insert');
    expect(ins.table).toBe('legal_ingest_runs');
    const row = ins.payload as Record<string, unknown>;
    expect(row.source_authority).toBe('eur-lex');
    expect(row.status).toBe('running');
    expect(row.tenant_id).toBeNull();
    expect(typeof row.started_at).toBe('string');
  });
  it('rejects empty source_authority', async () => {
    const { admin } = mockAdmin();
    await expect(startIngestRun(admin, { source_authority: '   ' }))
      .rejects.toThrow(LegalIngestError);
  });
});

describe('completeIngestRun', () => {
  it('updates status=completed + counts + completed_at', async () => {
    const { admin, calls } = mockAdmin();
    await completeIngestRun(admin, 'run-1', {
      documents_ingested: 3, chunks_ingested: 42,
    });
    const upd = calls.find((c) => c.kind === 'update');
    expect(upd?.table).toBe('legal_ingest_runs');
    expect(upd?.col).toBe('id');
    expect(upd?.val).toBe('run-1');
    const patch = upd?.payload as Record<string, unknown>;
    expect(patch.status).toBe('completed');
    expect(patch.documents_ingested).toBe(3);
    expect(patch.chunks_ingested).toBe(42);
  });
  it('rejects negative counts', async () => {
    const { admin } = mockAdmin();
    await expect(
      completeIngestRun(admin, 'r', { documents_ingested: -1, chunks_ingested: 0 }),
    ).rejects.toThrow(LegalIngestError);
  });
});

describe('failIngestRun', () => {
  it('updates status=failed + error fields', async () => {
    const { admin, calls } = mockAdmin();
    await failIngestRun(admin, 'run-1', { code: 'parse-error', message: 'bad xml' });
    const upd = calls.find((c) => c.kind === 'update');
    const patch = upd?.payload as Record<string, unknown>;
    expect(patch.status).toBe('failed');
    expect(patch.error_code).toBe('parse-error');
    expect(patch.error_message).toBe('bad xml');
  });
  it('truncates long error messages to 500 chars', async () => {
    const { admin, calls } = mockAdmin();
    await failIngestRun(admin, 'run-1', { code: 'x', message: 'a'.repeat(2000) });
    const patch = (calls.find((c) => c.kind === 'update')?.payload) as Record<string, unknown>;
    expect((patch.error_message as string).length).toBe(500);
  });
});

// ─── Document + chunk ingestion ──────────────────────────────────────

describe('ingestDocumentWithChunks', () => {
  it('upserts the document, deletes existing chunks, inserts new chunks', async () => {
    const { admin, calls } = mockAdmin({
      upsertResult: { data: { id: 'doc-7' }, error: null },
    });
    const r = await ingestDocumentWithChunks(admin, validDoc, validChunks);
    expect(r.document_id).toBe('doc-7');
    expect(r.chunks_inserted).toBe(2);

    const upsert = calls.find((c) => c.kind === 'upsert');
    expect(upsert?.table).toBe('legal_documents');
    expect((upsert?.opts as { onConflict?: string }).onConflict).toBe('source_url');

    const del = calls.find((c) => c.kind === 'delete');
    expect(del?.table).toBe('legal_chunks');
    expect(del?.col).toBe('document_id');
    expect(del?.val).toBe('doc-7');

    const ins = calls.find((c) => c.kind === 'insert');
    expect(ins?.table).toBe('legal_chunks');
    const rows = ins?.payload as Record<string, unknown>[];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      document_id: 'doc-7',
      chunk_index: 0,
      chunk_text:  validChunks[0].chunk_text,
    });
  });

  it('propagates errors from the document upsert', async () => {
    const { admin } = mockAdmin({
      upsertResult: { data: null, error: { message: 'rls-blocked' } },
    });
    await expect(ingestDocumentWithChunks(admin, validDoc, validChunks))
      .rejects.toThrow(/rls-blocked/);
  });

  it('propagates errors from the chunk delete', async () => {
    const { admin } = mockAdmin({
      upsertResult: { data: { id: 'd1' }, error: null },
      deleteResult: { error: { message: 'fk-cascade-fail' } },
    });
    await expect(ingestDocumentWithChunks(admin, validDoc, validChunks))
      .rejects.toThrow(/fk-cascade-fail/);
  });

  it('propagates errors from the chunk bulk insert', async () => {
    const { admin } = mockAdmin({
      upsertResult:     { data: { id: 'd1' }, error: null },
      insertBulkResult: { error: { message: 'check-violation' } },
    });
    await expect(ingestDocumentWithChunks(admin, validDoc, validChunks))
      .rejects.toThrow(/check-violation/);
  });

  it('rejects invalid document before any DB call', async () => {
    const { admin, calls } = mockAdmin();
    await expect(
      ingestDocumentWithChunks(admin, { ...validDoc, title: '' }, validChunks),
    ).rejects.toThrow(LegalIngestError);
    expect(calls).toHaveLength(0);
  });

  it('rejects invalid chunks before any DB call', async () => {
    const { admin, calls } = mockAdmin();
    await expect(
      ingestDocumentWithChunks(admin, validDoc, []),
    ).rejects.toThrow(LegalIngestError);
    expect(calls).toHaveLength(0);
  });
});
