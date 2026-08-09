-- RFC-003 — Decay Worker Support (Phase 3 Follow-up)
-- Constraint-Fix, Decay-Tick-RPC, View-Refresh-RPC
--
-- Additiv zu 20260803000000_rfc003_memory_governance.sql.

-- ============================================================
-- §1 Constraint-Fix: purged war unerreichbar
-- ============================================================
-- memory_supersession_immutable verlangte supersedes_id IS NOT NULL für
-- state='purged', memory_purged_cannot_supersede verlangte das Gegenteil —
-- zusammen war der purged-Zustand für jede Zeile unerreichbar. Die
-- eigentliche Regel (purged darf nichts superseden) bleibt über
-- memory_purged_cannot_supersede erhalten.
ALTER TABLE governance_memory DROP CONSTRAINT IF EXISTS memory_supersession_immutable;

-- ============================================================
-- §2 Decay-Tick — alle Zustandsübergänge in einer Transaktion
-- ============================================================
-- Spiegelt exakt src/core/governance/rfc003-memory.ts (getNextStateAfterDecay):
--   active   → cooling  wenn freshness < 0.5 ODER confidence < 0.5
--   cooling  → archived wenn freshness < 0.2 UND relevance < 0.2
--   archived → expired  wenn automated_purge_date erreicht
--   expired  → purged   nach 7 Tagen Grace, Inhalt wird getilgt (Tombstone)
-- Holds (regulatory/incident) blockieren jeden Übergang.
-- Facts haben freshness = 1.0 (kein temporaler Decay) — sie kühlen nur
-- über confidence ab und werden nie über den Freshness-Pfad archiviert.

CREATE OR REPLACE FUNCTION governance_memory_decay_tick()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cooled   integer := 0;
  v_archived integer := 0;
  v_expired  integer := 0;
  v_purged   jsonb   := '[]'::jsonb;
BEGIN
  -- active → cooling
  WITH moved AS (
    UPDATE governance_memory m
    SET state = 'cooling', state_transitioned_at = now()
    WHERE m.state = 'active'
      AND NOT m.regulatory_hold AND NOT m.incident_hold
      AND (
        (m.classification != 'fact'
          AND exp(-extract(epoch FROM (now() - m.created_at))
                  / NULLIF(extract(epoch FROM m.freshness_half_life), 0)) < 0.5)
        OR m.confidence < 0.5
      )
    RETURNING m.id
  )
  SELECT count(*) INTO v_cooled FROM moved;

  -- cooling → archived
  WITH moved AS (
    UPDATE governance_memory m
    SET state = 'archived', state_transitioned_at = now()
    WHERE m.state = 'cooling'
      AND NOT m.regulatory_hold AND NOT m.incident_hold
      AND m.classification != 'fact'
      AND exp(-extract(epoch FROM (now() - m.created_at))
              / NULLIF(extract(epoch FROM m.freshness_half_life), 0)) < 0.2
      AND m.relevance < 0.2
    RETURNING m.id
  )
  SELECT count(*) INTO v_archived FROM moved;

  -- archived → expired
  WITH moved AS (
    UPDATE governance_memory m
    SET state = 'expired', state_transitioned_at = now()
    WHERE m.state = 'archived'
      AND NOT m.regulatory_hold AND NOT m.incident_hold
      AND m.automated_purge_date IS NOT NULL
      AND m.automated_purge_date < now()
    RETURNING m.id
  )
  SELECT count(*) INTO v_expired FROM moved;

  -- expired → purged (Tombstone: Inhalt getilgt, Metadaten bleiben für Prüfpfad)
  WITH moved AS (
    UPDATE governance_memory m
    SET state = 'purged',
        state_transitioned_at = now(),
        value = '{}'::jsonb,
        tags = '{}',
        supersedes_id = NULL
    WHERE m.state = 'expired'
      AND NOT m.regulatory_hold AND NOT m.incident_hold
      AND m.automated_purge_date IS NOT NULL
      AND m.automated_purge_date + INTERVAL '7 days' < now()
    RETURNING m.id, m.tenant_id, m.classification, m.subject_ref
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', moved.id,
    'tenant_id', moved.tenant_id,
    'classification', moved.classification,
    'subject_ref', moved.subject_ref
  )), '[]'::jsonb) INTO v_purged FROM moved;

  RETURN jsonb_build_object(
    'cooled',   v_cooled,
    'archived', v_archived,
    'expired',  v_expired,
    'purged',   v_purged
  );
END;
$$;

-- ============================================================
-- §3 Materialized-View-Refresh (60-min-Kadenz + on-demand)
-- ============================================================

CREATE OR REPLACE FUNCTION governance_memory_refresh_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW mv_memory_active_per_tenant;
  REFRESH MATERIALIZED VIEW mv_memory_decay_candidates;
END;
$$;

-- ============================================================
-- §4 Rechte: nur Service-Role (Edge Functions) darf ticken
-- ============================================================

REVOKE ALL ON FUNCTION governance_memory_decay_tick() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION governance_memory_refresh_views() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION governance_memory_decay_tick() TO service_role;
GRANT EXECUTE ON FUNCTION governance_memory_refresh_views() TO service_role;
