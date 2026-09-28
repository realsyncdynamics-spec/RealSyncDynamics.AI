-- Gate 2 · Evidence-Kette pro Mandant ohne Verzweigung fortschreiben.
--
-- Befund (Review #1698): tenant-audit las den letzten content_hash und fügte
-- danach in einem zweiten Aufruf ein. Zwei gleichzeitige Scans desselben
-- Mandanten konnten denselben Vorgänger lesen und beide an ihn anhängen —
-- die Kette verzweigt. governance_evidence hat keine Sperre dagegen.
--
-- public.append_governance_evidence(p_row, p_expected_previous_hash):
--   - nimmt eine mandantenbezogene Transaktionssperre
--     (pg_advisory_xact_lock), liest darunter den aktuellen Kettenkopf
--   - stimmt er nicht mit p_expected_previous_hash überein, wird NICHTS
--     geschrieben und NULL geliefert; der Aufrufer liest neu, rechnet den
--     Hash neu (previous_hash ist Teil des Snapshots) und versucht es erneut
--   - sonst Insert unter derselben Sperre, created_at = clock_timestamp(),
--     damit die Reihenfolge der Kette der Reihenfolge der Sperre folgt
--   - nur service_role (tenant-audit läuft serverseitig)
--
-- Der Hash selbst bleibt in der Edge Function (RFC-8785-JCS aus
-- evidence-hash.ts); die Datenbank prüft nur, woran angehängt wird.
-- Rein additiv: keine Tabelle, Spalte oder Policy wird geändert. Nutzer:
-- tenant-audit und email-auth-rescan (beide schreiben dieselbe Kette pro
-- Mandant). governance-approvals und browser-execute schreiben weiterhin
-- direkt; sie auf diesen Pfad umzustellen ist ein eigener Schritt.

CREATE OR REPLACE FUNCTION public.append_governance_evidence(
  p_row jsonb,
  p_expected_previous_hash text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_tenant uuid := (p_row ->> 'tenant_id')::uuid;
  v_head   text;
  v_id     uuid;
BEGIN
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'tenant_id required' USING ERRCODE = '22023';
  END IF;
  IF (p_row ->> 'previous_hash') IS DISTINCT FROM p_expected_previous_hash THEN
    RAISE EXCEPTION 'row.previous_hash must equal p_expected_previous_hash' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('governance_evidence:' || v_tenant::text));

  SELECT e.content_hash INTO v_head
    FROM public.governance_evidence e
   WHERE e.tenant_id = v_tenant
     AND e.content_hash IS NOT NULL
   ORDER BY e.created_at DESC, e.id DESC
   LIMIT 1;

  IF v_head IS DISTINCT FROM p_expected_previous_hash THEN
    RETURN NULL;  -- Kettenkopf hat sich bewegt: neu lesen, neu hashen, erneut versuchen
  END IF;

  INSERT INTO public.governance_evidence (
    id, tenant_id, event_id, asset_id, evidence_type, title,
    storage_path, content_hash, previous_hash, metadata, created_at
  ) VALUES (
    coalesce((p_row ->> 'id')::uuid, gen_random_uuid()),
    v_tenant,
    (p_row ->> 'event_id')::uuid,
    (p_row ->> 'asset_id')::uuid,
    p_row ->> 'evidence_type',
    p_row ->> 'title',
    p_row ->> 'storage_path',
    p_row ->> 'content_hash',
    p_row ->> 'previous_hash',
    coalesce(p_row -> 'metadata', '{}'::jsonb),
    clock_timestamp()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.append_governance_evidence(jsonb, text) IS
  'Gate 2: hängt einen Evidence-Eintrag nur an, wenn p_expected_previous_hash noch der '
  'Kettenkopf des Mandanten ist (Advisory-Lock pro Mandant); sonst NULL. Nur service_role.';

REVOKE ALL     ON FUNCTION public.append_governance_evidence(jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.append_governance_evidence(jsonb, text) TO service_role;
