-- Legal-RAG hybrid retrieval RPC — Phase 2.
-- Ersetzt `legal_retrieve_chunks` durch eine hybride Variante, die
-- bei vorhandenem query-Vektor FTS + Vektor-Similarity per RRF kombiniert.
-- Wenn q_vec NULL ist, verhält sich die Funktion identisch zur Phase-1-RPC.

-- Schritt 1: Sicherheitskopie des alten RPC-Namens für Rückwärtskompatibilität
-- (governance-agent ruft weiterhin `legal_retrieve_chunks` — wir ersetzen
--  die Funktion in-place ohne Umbenennungs-Breaking-Change).

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
  rank_score        FLOAT
)
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT chunk_id, document_id, chunk_text, heading_path, citation_anchor,
         source_url, source_identifier, framework, jurisdiction, title,
         published_at, disclaimer, rank_score
    FROM public.legal_retrieve_chunks_hybrid(q, NULL, k, framework_filter, jurisdiction_filter, language_filter);
$$;

REVOKE ALL ON FUNCTION public.legal_retrieve_chunks(TEXT, INT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.legal_retrieve_chunks(TEXT, INT, TEXT, TEXT, TEXT)
  TO   service_role;

-- Schritt 2: Hybride RPC — nimmt optionalen vorberechneten Query-Vektor.
CREATE OR REPLACE FUNCTION public.legal_retrieve_chunks_hybrid(
  q                   TEXT,
  q_vec               vector(1024) DEFAULT NULL,
  k                   INT          DEFAULT 5,
  framework_filter    TEXT         DEFAULT NULL,
  jurisdiction_filter TEXT         DEFAULT NULL,
  language_filter     TEXT         DEFAULT NULL
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
  rank_score        FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_k   INT := GREATEST(1, LEAST(COALESCE(k, 5), 50));
  v_rrf FLOAT := 60.0; -- RRF constant
BEGIN
  -- Hybrid-Path: FTS + Vektor-Similarity mit RRF-Fusion
  IF q_vec IS NOT NULL THEN
    RETURN QUERY
    WITH
    fts_ranks AS (
      SELECT
        lc.id                    AS cid,
        ROW_NUMBER() OVER (ORDER BY ts_rank_cd(lc.tsv,
          COALESCE(
            websearch_to_tsquery('german', q),
            plainto_tsquery('german', q)
          ), 32) DESC
        ) AS fts_rank
      FROM public.legal_chunks     lc
      JOIN public.legal_documents  ld ON ld.id = lc.document_id
      WHERE lc.tsv @@ COALESCE(
              websearch_to_tsquery('german', q),
              plainto_tsquery('german', q)
            )
        AND (framework_filter    IS NULL OR ld.framework    = framework_filter)
        AND (jurisdiction_filter IS NULL OR ld.jurisdiction = jurisdiction_filter)
        AND (language_filter     IS NULL OR ld.language     = language_filter)
        AND ld.superseded_by IS NULL
      LIMIT v_k * 5
    ),
    vec_ranks AS (
      SELECT
        lc.id                   AS cid,
        ROW_NUMBER() OVER (ORDER BY lc.embedding <=> q_vec ASC) AS vec_rank
      FROM public.legal_chunks     lc
      JOIN public.legal_documents  ld ON ld.id = lc.document_id
      WHERE lc.embedding IS NOT NULL
        AND (framework_filter    IS NULL OR ld.framework    = framework_filter)
        AND (jurisdiction_filter IS NULL OR ld.jurisdiction = jurisdiction_filter)
        AND (language_filter     IS NULL OR ld.language     = language_filter)
        AND ld.superseded_by IS NULL
      LIMIT v_k * 5
    ),
    combined AS (
      SELECT
        COALESCE(f.cid, v.cid) AS cid,
        COALESCE(1.0 / (v_rrf + f.fts_rank), 0.0) +
        COALESCE(1.0 / (v_rrf + v.vec_rank), 0.0) AS rrf_score
      FROM fts_ranks f
      FULL JOIN vec_ranks v ON v.cid = f.cid
    )
    SELECT
      lc.id, lc.document_id, lc.chunk_text, lc.heading_path, lc.citation_anchor,
      ld.source_url, ld.source_identifier, ld.framework, ld.jurisdiction,
      ld.title, ld.published_at::DATE, ld.disclaimer,
      c.rrf_score::FLOAT AS rank_score
    FROM combined c
    JOIN public.legal_chunks    lc ON lc.id = c.cid
    JOIN public.legal_documents ld ON ld.id = lc.document_id
    ORDER BY c.rrf_score DESC
    LIMIT v_k;
  ELSE
    -- FTS-only path (Phase 1 kompatibel)
    RETURN QUERY
    SELECT
      lc.id, lc.document_id, lc.chunk_text, lc.heading_path, lc.citation_anchor,
      ld.source_url, ld.source_identifier, ld.framework, ld.jurisdiction,
      ld.title, ld.published_at::DATE, ld.disclaimer,
      CASE WHEN ld.superseded_by IS NULL THEN 1.0 ELSE 0.3 END *
        ts_rank_cd(lc.tsv,
          COALESCE(
            websearch_to_tsquery('german', q),
            plainto_tsquery('german', q)
          ), 32
        )::FLOAT AS rank_score
    FROM public.legal_chunks     lc
    JOIN public.legal_documents  ld ON ld.id = lc.document_id
    WHERE lc.tsv @@ COALESCE(
            websearch_to_tsquery('german', q),
            plainto_tsquery('german', q)
          )
      AND (framework_filter    IS NULL OR ld.framework    = framework_filter)
      AND (jurisdiction_filter IS NULL OR ld.jurisdiction = jurisdiction_filter)
      AND (language_filter     IS NULL OR ld.language     = language_filter)
    ORDER BY rank_score DESC, ld.published_at DESC NULLS LAST
    LIMIT v_k;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.legal_retrieve_chunks_hybrid(TEXT, vector, INT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.legal_retrieve_chunks_hybrid(TEXT, vector, INT, TEXT, TEXT, TEXT)
  TO   service_role;
