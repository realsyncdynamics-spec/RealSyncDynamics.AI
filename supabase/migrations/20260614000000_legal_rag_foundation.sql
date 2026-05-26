-- Legal-RAG Phase 1 — Foundation for compliance knowledge retrieval.
--
-- Builds the storage substrate for a source-grounded compliance
-- knowledge layer (DSGVO, EU AI Act, NIS2, DSA, Data Act, eIDAS,
-- BfDI/EDPB/EUR-Lex updates). Phase 1 is **internal-only** — fed by
-- ingestion runs and queried by the governance-agent. Phase 2 opens
-- a tenant API; Phase 3 opens it as a PaaS surface. The schema below
-- is designed to be PaaS-ready (tenant_id columns, per-row source
-- attribution, audit log) but no public access is enabled here.
--
-- Hard constraints baked into the schema:
--   - source_url is NOT NULL  (every chunk is traceable to a source)
--   - disclaimer is NOT NULL  (no legal advice, ever)
--   - every retrieval lands in legal_retrieval_log
--   - RLS deny-by-default, service-role-only in Phase 1
--   - PUBLIC / anon / authenticated grants explicitly REVOKEd
--
-- Tables:
--   legal_documents     — top-level source registry
--   legal_chunks        — paragraph-level chunks with pgvector embeddings
--   legal_ingest_runs   — ingestion job tracker
--   legal_retrieval_log — audit log; one row per retrieval call

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────────────────────────────────
-- legal_documents — source-of-truth registry. One row per legal
-- artifact (a GDPR article, an EDPB guideline, a BfDI position paper,
-- a court ruling, …).
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.legal_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- tenant_id NULL = part of the shared/global corpus visible to all
  -- internal callers. Non-NULL = a tenant's private knowledge base
  -- (used in Phase 3 for the Enterprise PaaS tier). Phase 1 ingests
  -- only into the shared corpus.
  tenant_id         UUID REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Source classification
  jurisdiction      TEXT NOT NULL,
  framework         TEXT NOT NULL,
  document_type     TEXT NOT NULL,
  source_authority  TEXT NOT NULL,

  -- Citation handles — source_url is NOT NULL on purpose, this is
  -- the anti-hallucination guarantee at the storage layer.
  source_url        TEXT NOT NULL,
  source_identifier TEXT,
  language          TEXT NOT NULL DEFAULT 'de',

  title             TEXT NOT NULL,
  published_at      DATE,
  effective_at      DATE,

  -- Disclaimer attached to every document — surfaced by the retrieval
  -- helper on every response. Default text is intentionally cautious;
  -- ingest scripts can override per-source if needed (e.g. EDPB
  -- guidelines may carry a stronger non-binding disclaimer).
  disclaimer        TEXT NOT NULL DEFAULT
    'Kein Rechtsrat. Quelle dient nur der Information; verbindliche Auslegung erfolgt durch qualifizierten Rechtsbeistand oder Datenschutzbeauftragte.',

  -- Versioning — when a regulation is amended, the old row points
  -- forward via superseded_by; the retrieval helper deprioritizes
  -- superseded rows but still returns them when explicitly asked.
  version           TEXT,
  superseded_by     UUID REFERENCES public.legal_documents(id),

  raw_payload       JSONB,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT legal_documents_jurisdiction_check
    CHECK (jurisdiction IN ('eu', 'de', 'at', 'ch', 'fr', 'us', 'uk', 'other')),
  CONSTRAINT legal_documents_framework_check
    CHECK (framework IN (
      'gdpr', 'ai_act', 'nis2', 'dsa', 'data_act', 'eidas',
      'ttdsg', 'tmg', 'tdsg', 'c2pa', 'cloud_act',
      'edpb', 'bfdi', 'cnil', 'other'
    )),
  CONSTRAINT legal_documents_document_type_check
    CHECK (document_type IN (
      'regulation', 'directive', 'guideline', 'opinion',
      'caselaw', 'standard', 'recommendation', 'other'
    )),
  CONSTRAINT legal_documents_source_url_format
    CHECK (source_url ~ '^https?://')
);

COMMENT ON TABLE public.legal_documents IS
  'Source-grounded legal/compliance knowledge registry. Every chunk must trace to a row here. Phase 1: internal-only.';
COMMENT ON COLUMN public.legal_documents.disclaimer IS
  'Mandatory disclaimer surfaced on every retrieval. Cannot be NULL — anti-legal-advice guardrail.';

-- ─────────────────────────────────────────────────────────────────────
-- legal_chunks — paragraph-level slices with vector embeddings and
-- full-text search vectors. A retrieval call returns chunks plus
-- their parent document's citation handle.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.legal_chunks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID NOT NULL REFERENCES public.legal_documents(id) ON DELETE CASCADE,

  chunk_index     INTEGER NOT NULL,
  chunk_text      TEXT NOT NULL,
  chunk_tokens    INTEGER,

  -- Vector embedding — 1024 dims keeps the helper model-agnostic
  -- (works for Cohere embed-multilingual-light, BAAI bge-m3, etc.).
  -- Embeddings populated by a separate ingestion-time service in a
  -- follow-up PR; rows are insertable without embeddings (the
  -- retrieval helper falls back to keyword if embedding IS NULL).
  embedding       vector(1024),
  embedding_model TEXT,

  -- Heading path within the document (e.g. 'Art. 6 (1) lit. a',
  -- 'Annex III · §4'). Used by the citation formatter.
  heading_path    TEXT,

  -- Citation anchor — the exact handle a reader can click to reach
  -- this passage in the source. May be a URL fragment, a paragraph
  -- number, or an XPath into the source HTML.
  citation_anchor TEXT,

  -- German-language FTS. Multi-language support arrives in Phase 2
  -- by adding parallel tsv_en, tsv_fr columns. Phase 1 corpus is
  -- predominantly German DSGVO/BfDI material.
  tsv             tsvector GENERATED ALWAYS AS (to_tsvector('german', chunk_text)) STORED,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (document_id, chunk_index),

  CONSTRAINT legal_chunks_text_length CHECK (length(chunk_text) BETWEEN 1 AND 8000)
);

COMMENT ON COLUMN public.legal_chunks.embedding IS
  '1024-dim vector; model name in embedding_model column. NULL until ingest+embed pass; retrieval falls back to FTS.';

-- ─────────────────────────────────────────────────────────────────────
-- legal_ingest_runs — one row per scheduled or ad-hoc ingestion job
-- (e.g. weekly EUR-Lex pull, on-demand EDPB guideline import). The
-- ingestion pipeline itself lives in a follow-up PR; this table is
-- the contract that pipeline writes against.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.legal_ingest_runs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID REFERENCES public.tenants(id) ON DELETE CASCADE,

  source_authority    TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'queued',

  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,

  documents_ingested  INTEGER NOT NULL DEFAULT 0,
  chunks_ingested     INTEGER NOT NULL DEFAULT 0,

  error_code          TEXT,
  error_message       TEXT,

  raw_payload         JSONB,
  correlation_id      UUID,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT legal_ingest_runs_status_check
    CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  CONSTRAINT legal_ingest_runs_counts_nonneg
    CHECK (documents_ingested >= 0 AND chunks_ingested >= 0),
  CONSTRAINT legal_ingest_runs_terminal_has_completed_at
    CHECK (
      status NOT IN ('completed', 'failed', 'cancelled')
      OR completed_at IS NOT NULL
    )
);

-- ─────────────────────────────────────────────────────────────────────
-- legal_retrieval_log — every retrieval call writes one row here.
-- This is the audit substrate that makes the PaaS tier defensible:
-- a tenant can produce a deterministic record of "what the system
-- told me on date X, citing sources Y and Z". Non-skippable.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.legal_retrieval_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- tenant_id NULL = internal call (governance-agent on behalf of
  -- the platform). Non-NULL = a tenant's retrieval (Phase 2+).
  tenant_id        UUID REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Query payload
  query_text       TEXT NOT NULL,
  query_filters    JSONB,

  -- Result envelope (chunk-id list is the receipt; the chunks
  -- themselves stay in legal_chunks for re-fetch / re-render).
  top_k            INTEGER NOT NULL,
  result_count     INTEGER NOT NULL DEFAULT 0,
  result_chunk_ids UUID[] NOT NULL DEFAULT '{}',

  -- Caller attribution for PaaS billing / rate-limit policies.
  caller_type      TEXT NOT NULL,
  caller_ref       TEXT,

  -- Performance + correlation
  latency_ms       INTEGER,
  correlation_id   UUID,

  retrieved_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT legal_retrieval_log_caller_type_check
    CHECK (caller_type IN ('internal', 'tenant', 'api')),
  CONSTRAINT legal_retrieval_log_top_k_range
    CHECK (top_k BETWEEN 1 AND 50),
  CONSTRAINT legal_retrieval_log_result_count_nonneg
    CHECK (result_count >= 0)
);

COMMENT ON TABLE public.legal_retrieval_log IS
  'Mandatory audit log for every legal-context retrieval. Phase-1 internal, Phase-2+ exposes tenant rows via API.';

-- ─────────────────────────────────────────────────────────────────────
-- Indexes — covering the access paths the retrieval helper needs.
-- ─────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS legal_documents_framework_idx
  ON public.legal_documents (framework, published_at DESC);

CREATE INDEX IF NOT EXISTS legal_documents_jurisdiction_idx
  ON public.legal_documents (jurisdiction, framework);

CREATE INDEX IF NOT EXISTS legal_documents_tenant_idx
  ON public.legal_documents (tenant_id)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS legal_chunks_document_idx
  ON public.legal_chunks (document_id, chunk_index);

-- HNSW vector index — cosine distance is the most robust default for
-- multilingual embedding models. Built without payload to keep size
-- bounded; the helper joins back to legal_chunks for full rows.
CREATE INDEX IF NOT EXISTS legal_chunks_embedding_hnsw_idx
  ON public.legal_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS legal_chunks_tsv_idx
  ON public.legal_chunks USING GIN (tsv);

CREATE INDEX IF NOT EXISTS legal_retrieval_log_tenant_time_idx
  ON public.legal_retrieval_log (tenant_id, retrieved_at DESC)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS legal_retrieval_log_caller_idx
  ON public.legal_retrieval_log (caller_type, retrieved_at DESC);

-- ─────────────────────────────────────────────────────────────────────
-- updated_at triggers — match the convention from findings / scan_runs.
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.legal_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS legal_documents_update_modtime ON public.legal_documents;
CREATE TRIGGER legal_documents_update_modtime
  BEFORE UPDATE ON public.legal_documents
  FOR EACH ROW EXECUTE FUNCTION public.legal_set_updated_at();

DROP TRIGGER IF EXISTS legal_ingest_runs_update_modtime ON public.legal_ingest_runs;
CREATE TRIGGER legal_ingest_runs_update_modtime
  BEFORE UPDATE ON public.legal_ingest_runs
  FOR EACH ROW EXECUTE FUNCTION public.legal_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- RLS — deny-by-default. Phase 1 has only the service-role policy.
-- Phase 2 will add a tenant-member-read policy on the shared corpus
-- and tenant-scoped policies on tenant-private rows.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.legal_documents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_chunks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_ingest_runs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_retrieval_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "legal_documents service-role full"     ON public.legal_documents;
DROP POLICY IF EXISTS "legal_chunks service-role full"        ON public.legal_chunks;
DROP POLICY IF EXISTS "legal_ingest_runs service-role full"   ON public.legal_ingest_runs;
DROP POLICY IF EXISTS "legal_retrieval_log service-role full" ON public.legal_retrieval_log;

CREATE POLICY "legal_documents service-role full"
  ON public.legal_documents FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "legal_chunks service-role full"
  ON public.legal_chunks FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "legal_ingest_runs service-role full"
  ON public.legal_ingest_runs FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "legal_retrieval_log service-role full"
  ON public.legal_retrieval_log FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Defense-in-depth: REVOKE direct table grants from PUBLIC / anon /
-- authenticated. Even if RLS were misconfigured later, callers without
-- service_role cannot touch the rows.
REVOKE ALL ON public.legal_documents,
              public.legal_chunks,
              public.legal_ingest_runs,
              public.legal_retrieval_log
  FROM PUBLIC;
REVOKE ALL ON public.legal_documents,
              public.legal_chunks,
              public.legal_ingest_runs,
              public.legal_retrieval_log
  FROM anon, authenticated;

GRANT ALL ON public.legal_documents,
             public.legal_chunks,
             public.legal_ingest_runs,
             public.legal_retrieval_log
  TO service_role;
