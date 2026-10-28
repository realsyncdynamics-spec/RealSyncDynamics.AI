-- claim_gdpr_audit: Mandant ausdruecklich waehlen statt raten.
--
-- Befund (Nebenbefund zu #1992): Die Funktion waehlte den Mandanten per
-- `ORDER BY CASE role … LIMIT 1`. Bei zwei owner-Mitgliedschaften gibt es
-- keinen Tie-Breaker. Das ist der Normalfall, sobald jemand eingeladen wird:
-- Der Signup-Trigger `on_auth_user_created` legt jedem Nutzer einen eigenen
-- Mandanten als owner an. Folgen:
--   1. Das Audit landet im falschen Mandanten. `gdpr_audits tenant_read`
--      verbirgt es dann dauerhaft vor dem richtigen.
--   2. Ein wiederholter Claim kann einen anderen Mandanten treffen und wirft
--      `already claimed`, statt `already_claimed: true` zu liefern.
--
-- Ein Tie-Breaker waere deterministisch, wuerde aber weiter raten. Deshalb
-- dieselbe Regel wie `resolveTenant` in der Edge Function `audit-claim`
-- (`supabase/functions/_shared/audit-claim.ts`):
--   - `p_tenant_id` gesetzt: Mitgliedschaft mit Rolle owner/admin pruefen.
--   - ohne Angabe: nur bei genau einer Mitgliedschaft, sonst `tenant ambiguous`.
--   - schon uebernommen: nur der zugeordnete Mandant zaehlt. Ist der Aufrufer
--     dort owner/admin, kommt `already_claimed: true`.
--
-- Signatur: neue Zwei-Argument-Variante OHNE Default. Die bestehende
-- Ein-Argument-Variante bleibt als Weiterleitung mit `p_tenant_id = NULL`.
-- So gibt es nie zwei Kandidaten fuer denselben Aufruf (PostgREST loest
-- `{p_audit_id}` eindeutig auf die Ein-Argument-Variante auf), und der
-- bestehende Client-Aufruf in `src/core/onboarding/claimAudit.ts` bleibt gueltig.
--
-- Uebernimmt die Pruefung `email_confirmed_at IS NOT NULL` aus
-- 20261026090000 (#1992). Reihenfolge beim Anwenden: erst 20261026090000,
-- dann diese Datei. Umgekehrt ersetzt 20261026090000 die Weiterleitung
-- wieder durch die alte Auswahl per LIMIT 1.

CREATE OR REPLACE FUNCTION public.claim_gdpr_audit(p_audit_id uuid, p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_uid         uuid := auth.uid();
  v_email       text;
  v_confirmed   timestamptz;
  v_tenant      uuid;
  v_role        text;
  v_candidates  integer;
  v_row         public.gdpr_audits%ROWTYPE;
  v_audit_email text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  IF p_audit_id IS NULL THEN
    RAISE EXCEPTION 'audit_id required' USING ERRCODE = '22023';
  END IF;

  SELECT u.email, u.email_confirmed_at INTO v_email, v_confirmed
    FROM auth.users u
   WHERE u.id = v_uid;

  -- Die E-Mail ist hier der Berechtigungsnachweis — sie zaehlt nur bestaetigt.
  IF v_email IS NULL OR length(btrim(v_email)) = 0 OR v_confirmed IS NULL THEN
    RAISE EXCEPTION 'email unverified' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row
    FROM public.gdpr_audits
   WHERE id = p_audit_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'audit not found' USING ERRCODE = 'P0002';
  END IF;

  v_audit_email := lower(btrim(v_row.email));
  IF v_audit_email IS DISTINCT FROM lower(btrim(v_email)) THEN
    RAISE EXCEPTION 'email mismatch' USING ERRCODE = '42501';
  END IF;

  -- Wiederholung: keine neue Auswahl, nur der bereits zugeordnete Mandant.
  IF v_row.claimed_at IS NOT NULL THEN
    IF (p_tenant_id IS NULL OR p_tenant_id = v_row.tenant_id)
       AND EXISTS (
         SELECT 1
           FROM public.memberships m
          WHERE m.user_id = v_uid
            AND m.tenant_id = v_row.tenant_id
            AND m.role IN ('owner', 'admin')
       ) THEN
      RETURN jsonb_build_object(
        'ok', true,
        'already_claimed', true,
        'audit_id', v_row.id,
        'tenant_id', v_row.tenant_id,
        'user_id', v_row.user_id,
        'claimed_at', v_row.claimed_at,
        'domain', v_row.domain
      );
    END IF;
    RAISE EXCEPTION 'already claimed' USING ERRCODE = '23505';
  END IF;

  IF p_tenant_id IS NOT NULL THEN
    v_tenant := p_tenant_id;
  ELSE
    SELECT count(*) INTO v_candidates
      FROM public.memberships m
     WHERE m.user_id = v_uid;

    IF v_candidates = 0 THEN
      RAISE EXCEPTION 'no tenant' USING ERRCODE = '42501';
    END IF;
    IF v_candidates > 1 THEN
      RAISE EXCEPTION 'tenant ambiguous' USING ERRCODE = '22023',
        HINT = 'p_tenant_id angeben';
    END IF;

    SELECT m.tenant_id INTO v_tenant
      FROM public.memberships m
     WHERE m.user_id = v_uid;
  END IF;

  SELECT m.role INTO v_role
    FROM public.memberships m
   WHERE m.user_id = v_uid
     AND m.tenant_id = v_tenant;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not a member' USING ERRCODE = '42501';
  END IF;
  IF v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'insufficient role' USING ERRCODE = '42501';
  END IF;

  UPDATE public.gdpr_audits
     SET user_id    = v_uid,
         tenant_id  = v_tenant,
         claimed_at = now()
   WHERE id = p_audit_id
     AND claimed_at IS NULL
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'claim raced' USING ERRCODE = '40001';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'already_claimed', false,
    'audit_id', v_row.id,
    'tenant_id', v_row.tenant_id,
    'user_id', v_row.user_id,
    'claimed_at', v_row.claimed_at,
    'domain', v_row.domain
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_gdpr_audit(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_gdpr_audit(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.claim_gdpr_audit(uuid, uuid) IS
  'Bindet ein anonymes gdpr_audits-Row an einen Mandanten des angemeldeten Nutzers (owner/admin). Ohne p_tenant_id nur bei genau einer Mitgliedschaft. Autorisierung ueber bestaetigte E-Mail. Idempotent fuer den bereits zugeordneten Mandanten.';

-- Bestehende Signatur: Weiterleitung ohne Mandantenangabe. SECURITY INVOKER,
-- denn alle Pruefungen stehen in der Zwei-Argument-Variante.
CREATE OR REPLACE FUNCTION public.claim_gdpr_audit(p_audit_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
  SELECT public.claim_gdpr_audit(p_audit_id, NULL::uuid);
$$;

REVOKE ALL ON FUNCTION public.claim_gdpr_audit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_gdpr_audit(uuid) TO authenticated;

COMMENT ON FUNCTION public.claim_gdpr_audit(uuid) IS
  'Weiterleitung auf claim_gdpr_audit(uuid, uuid) ohne Mandantenangabe. Bei mehreren Mitgliedschaften: tenant ambiguous.';
