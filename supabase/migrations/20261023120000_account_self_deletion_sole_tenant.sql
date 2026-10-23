-- Art. 17 Selbstlöschung: eigene Ein-Personen-Workspaces mitlöschen (R-03).
--
-- ── Ausgangslage (gemessen am 20./23.10.2026, Projekt RealSyncDynamicsLive) ──
--
-- * Jede Registrierung legt einen Workspace an, dessen einziger Owner der neue
--   Nutzer ist (auto_tenant_on_signup).
-- * `gdpr-delete` lehnt jede Löschung eines alleinigen Owners mit 409
--   SOLE_OWNER ab. Einen Workspace löschen kann der Nutzer nirgends.
--   Ergebnis: KEIN Konto mit eigenem Workspace ließ sich selbst löschen —
--   nachgewiesen mit einem frisch registrierten Testkonto.
-- * An `tenants` hängen 275 Fremdschlüssel: 247 CASCADE, 9 SET NULL,
--   19 NO ACTION. Dazu verhindern Lösch-Trigger auf den Nachweis-Tabellen
--   (Evidence, Runtime-Events, Kosten-Ledger …) jedes Löschen — gewollt,
--   diese Nachweise sind aufbewahrungspflichtig.
--
-- ── Was diese Migration tut (rein additiv) ─────────────────────────────────
--
-- `delete_sole_member_tenants(p_user_id, p_dry_run)` — der einzige Weg, auf
-- dem `gdpr-delete` einen Workspace löscht. Betroffen sind nur Workspaces,
-- deren EINZIGER Owner die Person ist. Für jeden davon:
--
--   other_members    weitere Mitglieder (memberships ODER tenant_memberships)
--                    → nicht löschen; Ownership muss erst übertragen werden.
--   billing_records  Abo mit Stripe-Bezug (stripe_subscription_id oder echter
--                    Kunde `cus_…`) → nicht löschen; die Abrechnung unterliegt
--                    HGB/AO, und `subscriptions` hängt per CASCADE am Workspace.
--   retained_records Löschen scheitert an Nachweisen (Trigger, NO-ACTION-FK)
--                    → nicht löschen; die Person bekommt einen klaren Hinweis.
--
-- Ist auch nur ein Workspace blockiert, wird KEINER gelöscht (alles oder
-- nichts). `p_dry_run = true` probiert die Löschung in einer Subtransaktion
-- und rollt sie zurück: Die Vorprüfung findet damit auch `retained_records`,
-- bevor gdpr-delete irgendetwas verändert.
--
-- Nebenläufigkeit: Die Workspaces werden FOR UPDATE gesperrt, bevor geprüft
-- wird. Eine gleichzeitige Einladung (INSERT in memberships braucht FOR KEY
-- SHARE auf den Workspace) wartet und scheitert danach am gelöschten
-- Workspace — es kann kein neues Mitglied mitgelöscht werden.
--
-- Rechte: nur service_role (gdpr-delete). Das Ergebnis nennt nur IDs und, bei
-- weiteren Mitgliedern, den Namen des eigenen Workspaces — keine Mitglieder.

CREATE OR REPLACE FUNCTION public.delete_sole_member_tenants(
  p_user_id uuid,
  p_dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_ids      uuid[] := '{}';
  v_blocked  jsonb  := '[]'::jsonb;
  v_deleted  integer := 0;
  v_state    text;
  r          record;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user required' USING ERRCODE = '22023';
  END IF;

  FOR r IN
    SELECT t.id, t.name
      FROM public.tenants t
     WHERE t.id IN (
             SELECT m.tenant_id FROM public.memberships m
              WHERE m.user_id = p_user_id AND m.role = 'owner'
             UNION
             SELECT tm.tenant_id FROM public.tenant_memberships tm
              WHERE tm.user_id = p_user_id AND tm.role = 'owner')
       AND NOT EXISTS (SELECT 1 FROM public.memberships m
                        WHERE m.tenant_id = t.id AND m.role = 'owner' AND m.user_id <> p_user_id)
       AND NOT EXISTS (SELECT 1 FROM public.tenant_memberships tm
                        WHERE tm.tenant_id = t.id AND tm.role = 'owner' AND tm.user_id <> p_user_id)
     ORDER BY t.id
       FOR UPDATE OF t
  LOOP
    IF EXISTS (SELECT 1 FROM public.memberships m WHERE m.tenant_id = r.id AND m.user_id <> p_user_id)
       OR EXISTS (SELECT 1 FROM public.tenant_memberships tm WHERE tm.tenant_id = r.id AND tm.user_id <> p_user_id) THEN
      -- Name des eigenen Workspaces: die Kontoeinstellungen zeigen ihn an.
      v_blocked := v_blocked || jsonb_build_object('tenant_id', r.id, 'name', r.name, 'reason', 'other_members');
    ELSIF EXISTS (SELECT 1 FROM public.subscriptions s
                   WHERE s.tenant_id = r.id
                     AND (s.stripe_subscription_id IS NOT NULL OR s.stripe_customer_id LIKE 'cus\_%')) THEN
      v_blocked := v_blocked || jsonb_build_object('tenant_id', r.id, 'reason', 'billing_records');
    ELSE
      v_ids := v_ids || r.id;
    END IF;
  END LOOP;

  IF jsonb_array_length(v_blocked) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'blocked', v_blocked);
  END IF;

  IF cardinality(v_ids) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'dry_run', p_dry_run, 'tenants', 0);
  END IF;

  -- Subtransaktion: Scheitert das Löschen (Nachweis-Trigger, NO-ACTION-FK),
  -- bleibt alles unverändert. Im Probelauf wird sie gezielt zurückgerollt.
  BEGIN
    DELETE FROM public.tenants WHERE id = ANY (v_ids);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    IF p_dry_run THEN
      RAISE EXCEPTION 'dry run' USING ERRCODE = 'RSDRY';
    END IF;
  EXCEPTION
    WHEN SQLSTATE 'RSDRY' THEN
      NULL;
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
      RETURN jsonb_build_object(
        'ok', false,
        'blocked', jsonb_build_array(jsonb_build_object('reason', 'retained_records', 'sqlstate', v_state)));
  END;

  RETURN jsonb_build_object('ok', true, 'dry_run', p_dry_run, 'tenants', v_deleted);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_sole_member_tenants(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_sole_member_tenants(uuid, boolean) TO service_role;

COMMENT ON FUNCTION public.delete_sole_member_tenants(uuid, boolean) IS
  'Art. 17: löscht die Ein-Personen-Workspaces einer Person (alles oder nichts). '
  'Blockiert bei weiteren Mitgliedern, Stripe-Abrechnung oder aufbewahrungspflichtigen Nachweisen. '
  'p_dry_run probiert und rollt zurück. Nur service_role (gdpr-delete).';
