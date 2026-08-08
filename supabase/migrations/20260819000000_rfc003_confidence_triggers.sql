-- RFC-003 §3.2 — Confidence Decay bei neuer Evidence + Cron-Registrierung
--
-- Additiv zu 20260818000000_rfc003_decay_worker.sql.
--
-- §3.2-Matrix (Trigger: evidence.created mit überlappendem subject_ref
-- oder correlation_id):
--   confidence ≥ 0.8        → bleibt active, Re-Validation einplanen
--   0.5 ≤ confidence < 0.8  → sofort cooling, Re-Validation einplanen
--   confidence < 0.5        → sofort archived, keine Re-Validation

BEGIN;

-- ============================================================
-- §1 Re-Validation-Planung
-- ============================================================
-- RFC-003 §3.2 verlangt "Re-Validation-Job einplanen" — die Fälligkeit
-- lebt am Item selbst, der Decay-Worker (stündlich) arbeitet sie ab.

ALTER TABLE governance_memory
  ADD COLUMN IF NOT EXISTS revalidation_due_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_gov_memory_revalidation_due
  ON governance_memory (revalidation_due_at)
  WHERE revalidation_due_at IS NOT NULL AND state IN ('active', 'cooling');

-- ============================================================
-- §2 Confidence-Reassess-RPC
-- ============================================================
-- Läuft asynchron zum auslösenden Event (Outbox-Variante aus §3.2):
-- p_trigger_event_id referenziert das evidence.created-Event, damit der
-- Prüfpfad die Kausalität abbilden kann. Facts sind ausgenommen (kein
-- Confidence-Decay), Holds blockieren jede Zustandsänderung.

CREATE OR REPLACE FUNCTION governance_memory_confidence_reassess(
  p_tenant_id UUID,
  p_subject_ref TEXT DEFAULT NULL,
  p_correlation_id TEXT DEFAULT NULL,
  p_trigger_event_id UUID DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affected jsonb := '[]'::jsonb;
BEGIN
  IF p_subject_ref IS NULL AND p_correlation_id IS NULL THEN
    RAISE EXCEPTION 'subject_ref or correlation_id required';
  END IF;

  WITH matched AS (
    SELECT m.id, m.state AS from_state, m.confidence, m.classification, m.subject_ref
    FROM governance_memory m
    WHERE m.tenant_id = p_tenant_id
      AND m.state IN ('active', 'cooling')
      AND m.classification != 'fact'
      AND NOT m.regulatory_hold AND NOT m.incident_hold
      AND (
        (p_subject_ref IS NOT NULL AND m.subject_ref = p_subject_ref)
        OR (p_correlation_id IS NOT NULL AND m.correlation_id = p_correlation_id)
      )
    FOR UPDATE
  ),
  updated AS (
    UPDATE governance_memory m
    SET
      state = CASE
        WHEN m.confidence < 0.5 THEN 'archived'::memory_state
        WHEN m.confidence < 0.8 THEN 'cooling'::memory_state
        ELSE m.state
      END,
      state_transitioned_at = CASE
        WHEN m.confidence < 0.8 AND m.state != (CASE
          WHEN m.confidence < 0.5 THEN 'archived'::memory_state
          ELSE 'cooling'::memory_state END)
        THEN now() ELSE m.state_transitioned_at
      END,
      revalidation_due_at = CASE
        WHEN m.confidence < 0.5 THEN NULL                    -- archiviert, keine Re-Validation
        WHEN m.confidence < 0.8 THEN now() + INTERVAL '24 hours'
        ELSE now() + INTERVAL '72 hours'
      END
    FROM matched
    WHERE m.id = matched.id
    RETURNING m.id, matched.from_state, m.state AS to_state,
              m.confidence, m.classification, m.subject_ref
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', u.id,
    'from_state', u.from_state,
    'to_state', u.to_state,
    'confidence', u.confidence,
    'classification', u.classification,
    'subject_ref', u.subject_ref
  )), '[]'::jsonb) INTO v_affected FROM updated u;

  RETURN jsonb_build_object(
    'affected', v_affected,
    'trigger_event_id', p_trigger_event_id
  );
END;
$$;

REVOKE ALL ON FUNCTION governance_memory_confidence_reassess(UUID, TEXT, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION governance_memory_confidence_reassess(UUID, TEXT, TEXT, UUID)
  TO service_role;

-- ============================================================
-- §3 Cron-Registrierung: Decay-Worker stündlich
-- ============================================================
-- Ohne diesen Job existiert der Worker, tickt aber nie.
-- cron.schedule ist Upsert-per-Name (siehe 20260624000003).

SELECT cron.schedule(
  'memory-decay-hourly',
  '0 * * * *',
  $$
    SELECT net.http_post(
      url     := current_setting('app.supabase_url') || '/functions/v1/memory-decay-worker',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body    := '{}'::jsonb
    )
  $$
);

COMMIT;
