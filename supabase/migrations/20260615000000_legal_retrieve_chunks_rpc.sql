-- legal_retrieve_chunks(q, k, framework_filter, jurisdiction_filter, language_filter)
--
-- The DB-side retrieval RPC the Phase-1 helper
-- `supabase/functions/_shared/legal-retrieval.ts::retrieveLegalContext`
-- expects. Phase 1 contract:
--
--   - returns chunks joined with their parent legal_documents row
--   - ranks by FTS (tsv) when embeddings are not yet populated
--   - hybrid (vector + FTS) ranking is deferred to Phase 2 (after the
--     embedding service exists); the function shape is forward-
--     compatible — adding the vector path is a non-breaking ALTER FUNCTION
--   - respects optional framework / jurisdiction / language filters
--   - deprioritizes superseded documents (rank * 0.3)
--   - returns at most k rows
--
-- SECURITY DEFINER + service_role-only execute — RLS on the underlying
-- tables already gates the caller; SECURITY DEFINER lets the helper
-- ignore the joined-document RLS for the read path it owns.

CREATE OR REPLACE FUNCTION public.legal_retrieve_chunks(
  q                   TEXT,
  k                   INT     DEFAULT 5,
  framework_filter    TEXT    DEFAULT NULL,
  jurisdiction_filter TEXT    DEFAULT NULL,
  language_filter     TEXT    DEFAULT NULL
)
RETURNS TABLE (
  chunk_id          UUID,
  document_id       UUID,
  chunk_text        TEXT,
  heading_path      TEXT,
  citation_anchor   TEXT,
  source_url        TEXT,
  source_identifier TEXT,
  framework         TEXT,
  jurisdiction      TEXT,
  title             TEXT,
  published_at      DATE,
  disclaimer        TEXT,
  rank_score        REAL
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  k_clamped INT := GREATEST(1, LEAST(COALESCE(k, 5), 50));
  ts_query  tsquery;
BEGIN
  -- websearch_to_tsquery is the lenient parser — accepts "foo bar OR baz"
  -- without throwing on stray punctuation. Falls back to plain query
  -- when the input doesn't parse at all (e.g. only stopwords).
  BEGIN
    ts_query := websearch_to_tsquery('german', COALESCE(q, ''));
  EXCEPTION WHEN OTHERS THEN
    ts_query := plainto_tsquery('german', COALESCE(q, ''));
  END;

  RETURN QUERY
    SELECT
      lc.id,
      ld.id,
      lc.chunk_text,
      lc.heading_path,
      lc.citation_anchor,
      ld.source_url,
      ld.source_identifier,
      ld.framework,
      ld.jurisdiction,
      ld.title,
      ld.published_at,
      ld.disclaimer,
      (
        ts_rank_cd(lc.tsv, ts_query)
        * CASE WHEN ld.superseded_by IS NULL THEN 1.0 ELSE 0.3 END
      )::REAL AS rank_score
    FROM public.legal_chunks  lc
    JOIN public.legal_documents ld ON ld.id = lc.document_id
    WHERE lc.tsv @@ ts_query
      AND (framework_filter    IS NULL OR ld.framework    = framework_filter)
      AND (jurisdiction_filter IS NULL OR ld.jurisdiction = jurisdiction_filter)
      AND (language_filter     IS NULL OR ld.language     = language_filter)
    ORDER BY rank_score DESC, ld.published_at DESC NULLS LAST
    LIMIT k_clamped;
END $$;

COMMENT ON FUNCTION public.legal_retrieve_chunks(TEXT, INT, TEXT, TEXT, TEXT) IS
  'Phase 1 Legal-RAG retrieval. FTS-only ranking; hybrid (vector + FTS) pending embedding service. Called by supabase/functions/_shared/legal-retrieval.ts. SECURITY DEFINER + service_role-only execute.';

-- Lock down: only service_role can call this. anon / authenticated must
-- not reach it; the Phase 1 helper is internal-only.
REVOKE EXECUTE ON FUNCTION public.legal_retrieve_chunks(TEXT, INT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.legal_retrieve_chunks(TEXT, INT, TEXT, TEXT, TEXT) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.legal_retrieve_chunks(TEXT, INT, TEXT, TEXT, TEXT) TO service_role;
