// Legal-RAG retrieval adapter — internal Phase 1 surface.
//
// Backed by migration 20260614000000_legal_rag_foundation.sql:
//   - public.legal_documents / legal_chunks / legal_ingest_runs /
//     legal_retrieval_log (RLS deny-by-default + service-role-only)
//
// Hard guardrails enforced HERE, not at the DB:
//   1. Every result carries a source_url (anti-hallucination).
//   2. Every result carries the parent document's disclaimer.
//   3. Every retrieval call writes a legal_retrieval_log row BEFORE
//      returning to the caller (mandatory audit substrate).
//   4. Phase 1: caller_type must be 'internal' AND tenant_id must be
//      null. Phase 2 will relax this for authenticated tenant calls.
//   5. top_k is clamped to [1, 50].
//
// Out of scope:
//   - Embedding generation (separate service in a follow-up PR)
//   - Hybrid scoring with reranker (Phase 2)
//   - Public API exposure (Phase 3)

export type LegalCallerType = 'internal' | 'tenant' | 'api';

export type LegalFramework =
  | 'gdpr' | 'ai_act' | 'nis2' | 'dsa' | 'data_act' | 'eidas'
  | 'ttdsg' | 'tmg' | 'tdsg' | 'c2pa' | 'cloud_act'
  | 'edpb' | 'bfdi' | 'cnil' | 'other';

export type LegalJurisdiction =
  | 'eu' | 'de' | 'at' | 'ch' | 'fr' | 'us' | 'uk' | 'other';

export interface AdminLike {
  rpc(fn: string, args: Record<string, unknown>): Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
  from(table: string): {
    insert(row: Record<string, unknown>): {
      select(cols: string): {
        single(): Promise<{
          data: { id: string } | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
}

export interface LegalRetrievalRequest {
  query:           string;
  top_k?:          number;
  framework?:      LegalFramework;
  jurisdiction?:   LegalJurisdiction;
  language?:       string;
  caller_type:     LegalCallerType;
  caller_ref?:     string;
  tenant_id?:      string | null;
  correlation_id?: string | null;
}

export interface LegalRetrievalResultItem {
  chunk_id:          string;
  document_id:       string;
  chunk_text:        string;
  heading_path:      string | null;
  citation_anchor:   string | null;
  source_url:        string;
  source_identifier: string | null;
  framework:         LegalFramework;
  jurisdiction:      LegalJurisdiction;
  title:             string;
  published_at:      string | null;
  disclaimer:        string;
  rank_score:        number;
}

export interface LegalRetrievalResult {
  query:        string;
  results:      LegalRetrievalResultItem[];
  caller_type:  LegalCallerType;
  retrieved_at: string;
  log_id:       string;
  disclaimer:   string;
}

export const LEGAL_PLATFORM_DISCLAIMER =
  'Diese Information stammt aus öffentlichen Quellen und ersetzt keine ' +
  'individuelle Rechtsberatung. Verbindliche Bewertung erfolgt durch ' +
  'qualifizierten Rechtsbeistand oder Datenschutzbeauftragte. ' +
  'RealSyncDynamics.AI erbringt keine Rechtsdienstleistung im Sinne ' +
  'des RDG.';

// Phase 1 boundary check — relaxes in later phases.
export class LegalRetrievalPhaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LegalRetrievalPhaseError';
  }
}

// Result-level guardrail violation — must never reach the caller.
export class LegalRetrievalGuardrailError extends Error {
  readonly violation: string;
  constructor(violation: string) {
    super(`Legal-retrieval guardrail violated: ${violation}`);
    this.name = 'LegalRetrievalGuardrailError';
    this.violation = violation;
  }
}

/**
 * Internal-phase retrieval. Phase 1 contract:
 *   - caller_type === 'internal'
 *   - tenant_id === null
 *   - returns log_id even when results=[] (audit-completeness)
 *   - throws on missing source_url or disclaimer on any returned chunk
 *
 * The actual ranking happens in the DB via `legal_retrieve_chunks` RPC
 * (defined in a follow-up PR alongside the embedding service); this
 * helper is the safety layer around that RPC call.
 *
 * For unit-testability, the RPC fan-out is on `admin.rpc(...)` and
 * the audit-log write is on `admin.from('legal_retrieval_log')`.
 * Both can be mocked structurally.
 */
export async function retrieveLegalContext(
  admin: AdminLike,
  req:   LegalRetrievalRequest,
): Promise<LegalRetrievalResult> {
  enforcePhase1(req);

  const top_k = clampTopK(req.top_k);
  const query = (req.query ?? '').trim();
  if (!query) {
    throw new LegalRetrievalGuardrailError('query must be non-empty');
  }

  const startedAt = Date.now();

  // The DB-side RPC accepts the same filter envelope; signature is
  // (q text, k int, framework text, jurisdiction text, lang text)
  // and returns rows already joined with parent legal_documents.
  const { data, error } = await admin.rpc('legal_retrieve_chunks', {
    q: query,
    k: top_k,
    framework_filter:    req.framework    ?? null,
    jurisdiction_filter: req.jurisdiction ?? null,
    language_filter:     req.language     ?? null,
  });

  if (error) {
    // Even on retrieval failure we still log the attempt so the audit
    // chain doesn't have silent holes.
    const failedLog = await writeAuditLog(admin, req, top_k, [], Date.now() - startedAt);
    throw new Error(
      `legal_retrieve_chunks rpc failed: ${error.message} (audit log_id=${failedLog})`,
    );
  }

  const rows = Array.isArray(data) ? data as RawChunkRow[] : [];
  const results = rows.map(toResultItem);

  enforceCitationGuardrails(results);

  const latencyMs = Date.now() - startedAt;
  const logId = await writeAuditLog(
    admin, req, top_k, results.map((r) => r.chunk_id), latencyMs,
  );

  return {
    query,
    results,
    caller_type:  req.caller_type,
    retrieved_at: new Date(startedAt).toISOString(),
    log_id:       logId,
    disclaimer:   LEGAL_PLATFORM_DISCLAIMER,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Internal helpers — exported for unit tests.
// ─────────────────────────────────────────────────────────────────────

interface RawChunkRow {
  chunk_id:          string;
  document_id:       string;
  chunk_text:        string;
  heading_path:      string | null;
  citation_anchor:   string | null;
  source_url:        string | null;
  source_identifier: string | null;
  framework:         LegalFramework;
  jurisdiction:      LegalJurisdiction;
  title:             string;
  published_at:      string | null;
  disclaimer:        string | null;
  rank_score:        number | null;
}

export function clampTopK(k: number | undefined): number {
  const v = typeof k === 'number' && Number.isFinite(k) ? Math.floor(k) : 5;
  return Math.min(Math.max(v, 1), 50);
}

export function enforcePhase1(req: LegalRetrievalRequest): void {
  if (req.caller_type !== 'internal') {
    throw new LegalRetrievalPhaseError(
      `Phase 1 accepts caller_type='internal' only (got '${req.caller_type}')`,
    );
  }
  if (req.tenant_id != null) {
    throw new LegalRetrievalPhaseError(
      'Phase 1 forbids tenant-scoped calls (tenant_id must be null)',
    );
  }
}

export function enforceCitationGuardrails(rows: LegalRetrievalResultItem[]): void {
  for (const r of rows) {
    if (!r.source_url || !/^https?:\/\//.test(r.source_url)) {
      throw new LegalRetrievalGuardrailError(
        `chunk ${r.chunk_id} missing valid source_url`,
      );
    }
    if (!r.disclaimer || r.disclaimer.length < 10) {
      throw new LegalRetrievalGuardrailError(
        `chunk ${r.chunk_id} missing disclaimer`,
      );
    }
    if (!r.chunk_text || r.chunk_text.length < 1) {
      throw new LegalRetrievalGuardrailError(
        `chunk ${r.chunk_id} missing chunk_text`,
      );
    }
  }
}

function toResultItem(row: RawChunkRow): LegalRetrievalResultItem {
  return {
    chunk_id:          row.chunk_id,
    document_id:       row.document_id,
    chunk_text:        row.chunk_text,
    heading_path:      row.heading_path,
    citation_anchor:   row.citation_anchor,
    source_url:        row.source_url ?? '',
    source_identifier: row.source_identifier,
    framework:         row.framework,
    jurisdiction:      row.jurisdiction,
    title:             row.title,
    published_at:      row.published_at,
    disclaimer:        row.disclaimer ?? '',
    rank_score:        row.rank_score ?? 0,
  };
}

async function writeAuditLog(
  admin:   AdminLike,
  req:     LegalRetrievalRequest,
  topK:    number,
  chunkIds: string[],
  latencyMs: number,
): Promise<string> {
  const { data, error } = await admin
    .from('legal_retrieval_log')
    .insert({
      tenant_id:        req.tenant_id ?? null,
      query_text:       req.query,
      query_filters:    buildFilterEnvelope(req),
      top_k:            topK,
      result_count:     chunkIds.length,
      result_chunk_ids: chunkIds,
      caller_type:      req.caller_type,
      caller_ref:       req.caller_ref ?? null,
      latency_ms:       latencyMs,
      correlation_id:   req.correlation_id ?? null,
    })
    .select('id')
    .single();
  if (error) {
    // Failing to write the audit log is FATAL — the whole point of
    // the Legal-RAG layer is that every retrieval is recorded.
    throw new LegalRetrievalGuardrailError(
      `audit-log write failed: ${error.message}`,
    );
  }
  if (!data || typeof data.id !== 'string') {
    throw new LegalRetrievalGuardrailError(
      'audit-log write returned no id',
    );
  }
  return data.id;
}

function buildFilterEnvelope(req: LegalRetrievalRequest): Record<string, unknown> | null {
  const f: Record<string, unknown> = {};
  if (req.framework)    f.framework    = req.framework;
  if (req.jurisdiction) f.jurisdiction = req.jurisdiction;
  if (req.language)     f.language     = req.language;
  return Object.keys(f).length > 0 ? f : null;
}
