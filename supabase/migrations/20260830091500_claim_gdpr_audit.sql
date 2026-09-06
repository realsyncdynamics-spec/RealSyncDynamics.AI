-- Audit Claim: anonymes gdpr_audits-Row an den angemeldeten Mandanten binden.
--
-- Der einzige echte Neubau der Trichter-Kette
-- (`docs/product/canonical-funnel-decision.md` §3.1).
-- Spalten user_id / tenant_id / claimed_at existieren seit
-- 20260811020648; RLS `gdpr_audits tenant_read` wird sichtbar, sobald
-- tenant_id gesetzt ist. Es fehlte der Writer.
--
-- Autorisierung: verifizierte E-Mail des JWT gegen gdpr_audits.email.
-- Kein tenant_id und kein user_id aus dem Client.

CREATE OR REPLACE FUNCTION public.claim_gdpr_audit(p_audit_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         uuid := auth.uid();
  v_email       text;
  v_tenant      uuid;
  v_row         public.gdpr_audits%ROWTYPE;
  v_audit_email text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  IF p_audit_id IS NULL THEN
    RAISE EXCEPTION 'audit_id required' USING ERRCODE = '22023';
  END IF;

  SELECT u.email INTO v_email
    FROM auth.users u
   WHERE u.id = v_uid;

  IF v_email IS NULL OR length(btrim(v_email)) = 0 THEN
    RAISE EXCEPTION 'email unverified' USING ERRCODE = '42501';
  END IF;

  SELECT m.tenant_id INTO v_tenant
    FROM public.memberships m
   WHERE m.user_id = v_uid
   ORDER BY CASE m.role
              WHEN 'owner' THEN 0
              WHEN 'admin' THEN 1
              ELSE 2
            END
   LIMIT 1;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'no tenant' USING ERRCODE = '42501';
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

  IF v_row.claimed_at IS NOT NULL THEN
    IF v_row.tenant_id = v_tenant THEN
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

REVOKE ALL ON FUNCTION public.claim_gdpr_audit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_gdpr_audit(uuid) TO authenticated;

COMMENT ON FUNCTION public.claim_gdpr_audit(uuid) IS
  'Bindet ein anonymes gdpr_audits-Row an den Mandanten des angemeldeten Nutzers. Autorisierung über verifizierte E-Mail, nicht über clientgelieferte tenant_id. Idempotent für denselben Mandanten.';
