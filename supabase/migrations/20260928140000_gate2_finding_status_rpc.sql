-- Gate 2 · Kontrollierter Mutationspfad für den Finding-Status.
--
-- Befund: Der Client schrieb Statuswechsel per
--   supabase.from('findings').update({ status })
-- `findings` hat für `authenticated` aber nur eine SELECT-Policy. Unter RLS
-- traf das UPDATE 0 Zeilen und lieferte KEINEN Fehler — die UI meldete
-- „gespeichert", in der Datenbank änderte sich nichts.
--
-- Statt einer breiten UPDATE-Policy (die jede Spalte freigäbe: severity,
-- evidence_id, tenant_id …) gibt es genau einen Schreibpfad:
--   public.set_finding_status(p_finding_id, p_status)
--   - nur schreibende Mandantenrollen (is_tenant_writer: owner/admin/dpo/editor)
--   - fremder Mandant und unbekannte ID sind nicht unterscheidbar (P0002)
--   - Übergänge = FINDING_NEXT_STATUS in src/types/governance/finding.ts
--   - jede Änderung hängt einen Eintrag an raw_payload.status_history an
--     (von, nach, wer, wann) — nachvollziehbar, ohne neue Spalten
--   - resolved_at wird bei 'resolved' gesetzt und bei 'open' zurückgesetzt
--
-- Rein additiv: keine Tabelle, keine Spalte, keine Policy wird geändert.

CREATE OR REPLACE FUNCTION public.set_finding_status(p_finding_id uuid, p_status text)
RETURNS TABLE (id uuid, status text, updated_at timestamptz, resolved_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
#variable_conflict use_column
DECLARE
  v_uid    uuid := auth.uid();
  v_tenant  uuid;
  v_current text;
  v_allowed text[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT f.tenant_id, f.status INTO v_tenant, v_current
    FROM public.findings f
   WHERE f.id = p_finding_id
   FOR UPDATE;

  -- Fremder Mandant = nicht gefunden: keine Existenzauskunft über fremde IDs.
  IF NOT FOUND OR NOT public.is_tenant_member(v_tenant) THEN
    RAISE EXCEPTION 'finding not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.is_tenant_writer(v_tenant) THEN
    RAISE EXCEPTION 'role may not change finding status' USING ERRCODE = '42501';
  END IF;

  v_allowed := CASE v_current
    WHEN 'open'           THEN ARRAY['acknowledged', 'fixed', 'false_positive', 'ignored']
    WHEN 'acknowledged'   THEN ARRAY['fixed', 'false_positive', 'ignored', 'open']
    WHEN 'fixed'          THEN ARRAY['resolved', 'open']
    WHEN 'false_positive' THEN ARRAY['open']
    WHEN 'ignored'        THEN ARRAY['open']
    WHEN 'resolved'       THEN ARRAY['open']
    ELSE ARRAY[]::text[]
  END;
  IF p_status IS NULL OR NOT (p_status = ANY (v_allowed)) THEN
    RAISE EXCEPTION 'transition % -> % not allowed', v_current, coalesce(p_status, 'NULL')
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  UPDATE public.findings f
     SET status      = p_status,
         resolved_at = CASE
                         WHEN p_status = 'resolved' THEN now()
                         WHEN p_status = 'open'     THEN NULL
                         ELSE f.resolved_at
                       END,
         raw_payload = jsonb_set(
                         coalesce(f.raw_payload, '{}'::jsonb),
                         '{status_history}',
                         coalesce(f.raw_payload -> 'status_history', '[]'::jsonb)
                           || jsonb_build_array(jsonb_build_object(
                                'from', v_current, 'to', p_status,
                                'by', v_uid, 'at', now())),
                         true)
   WHERE f.id = p_finding_id
  RETURNING f.id, f.status, f.updated_at, f.resolved_at;
END;
$$;

COMMENT ON FUNCTION public.set_finding_status(uuid, text) IS
  'Gate 2: einziger Client-Schreibpfad für findings.status. Schreibende Rolle, '
  'erlaubter Übergang, Historie in raw_payload.status_history.';

REVOKE ALL     ON FUNCTION public.set_finding_status(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_finding_status(uuid, text) TO authenticated, service_role;
