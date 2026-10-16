-- #1865 (P0): fail-closed audit ownership and explicit tenant selection.
--
-- Public Free Audit stays in gdpr_audits; no new identity/claim model.
-- Existing one-argument RPC remains available for users with exactly one
-- membership. For multiple memberships the caller MUST select a tenant and
-- use the two-argument overload. Never choose the first membership silently.
--
-- Deliberately conservative: the audit e-mail must equal the authenticated,
-- CONFIRMED account e-mail. Audits without a verifiable e-mail cannot be
-- imported through this RPC. A separate, reviewed proof-of-ownership flow is
-- needed for an e-mail-free optimizer scan or a different sign-up address.
--
-- No DML, no RLS change, no automatic deployment.

CREATE OR REPLACE FUNCTION public.claim_gdpr_audit(
  p_audit_id UUID,
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid              UUID := auth.uid();
  v_email            TEXT;
  v_email_confirmed  TIMESTAMPTZ;
  v_tenant           UUID;
  v_memberships      BIGINT;
  v_role             TEXT;
  v_row              public.gdpr_audits%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;
  IF p_audit_id IS NULL THEN
    RAISE EXCEPTION 'audit_id required' USING ERRCODE = '22023';
  END IF;

  SELECT u.email, u.email_confirmed_at
    INTO v_email, v_email_confirmed
    FROM auth.users AS u
   WHERE u.id = v_uid;
  IF v_email_confirmed IS NULL
     OR NULLIF(btrim(v_email), '') IS NULL THEN
    RAISE EXCEPTION 'verified account email required' USING ERRCODE = '42501';
  END IF;

  IF p_tenant_id IS NULL THEN
    SELECT count(*), min(m.tenant_id)
      INTO v_memberships, v_tenant
      FROM public.memberships AS m
     WHERE m.user_id = v_uid;
    IF v_memberships = 0 THEN
      RAISE EXCEPTION 'no tenant membership' USING ERRCODE = '42501';
    END IF;
    IF v_memberships > 1 THEN
      RAISE EXCEPTION 'explicit tenant selection required' USING ERRCODE = '42501';
    END IF;
  ELSE
    v_tenant := p_tenant_id;
  END IF;

  SELECT m.role INTO v_role
    FROM public.memberships AS m
   WHERE m.user_id = v_uid
     AND m.tenant_id = v_tenant;
  -- Importing a report changes ownership of a resource in the workspace.
  -- Mere read-only membership is not sufficient.
  IF v_role IS NULL OR v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'tenant claim not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row
    FROM public.gdpr_audits
   WHERE id = p_audit_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'audit not found' USING ERRCODE = 'P0002';
  END IF;

  -- Never equate possession of a shareable report UUID with ownership.
  -- Treat a missing e-mail as unverified, not as an automatic match.
  IF NULLIF(btrim(v_row.email), '') IS NULL
     OR lower(btrim(v_row.email)) <> lower(btrim(v_email)) THEN
    RAISE EXCEPTION 'audit ownership not verified' USING ERRCODE = '42501';
  END IF;

  IF v_row.claimed_at IS NOT NULL THEN
    IF v_row.tenant_id = v_tenant AND v_row.user_id = v_uid THEN
      RETURN jsonb_build_object(
        'ok', true, 'already_claimed', true,
        'audit_id', v_row.id, 'tenant_id', v_row.tenant_id,
        'user_id', v_row.user_id, 'claimed_at', v_row.claimed_at,
        'domain', v_row.domain
      );
    END IF;
    RAISE EXCEPTION 'already claimed' USING ERRCODE = '23505';
  END IF;

  -- Deny inconsistent partial ownership rather than overwriting it.
  IF v_row.tenant_id IS NOT NULL OR v_row.user_id IS NOT NULL THEN
    RAISE EXCEPTION 'audit ownership inconsistent' USING ERRCODE = '42501';
  END IF;

  UPDATE public.gdpr_audits
     SET user_id = v_uid,
         tenant_id = v_tenant,
         claimed_at = now()
   WHERE id = p_audit_id AND claimed_at IS NULL
     AND tenant_id IS NULL AND user_id IS NULL
  RETURNING * INTO v_row;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'claim raced' USING ERRCODE = '40001';
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'already_claimed', false,
    'audit_id', v_row.id, 'tenant_id', v_row.tenant_id,
    'user_id', v_row.user_id, 'claimed_at', v_row.claimed_at,
    'domain', v_row.domain
  );
END;
$$;

-- Backward-compatible one-argument wrapper. It must not silently choose a
-- workspace for a user with more than one tenant membership.
CREATE OR REPLACE FUNCTION public.claim_gdpr_audit(p_audit_id UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.claim_gdpr_audit(p_audit_id, NULL::UUID);
$$;

REVOKE ALL ON FUNCTION public.claim_gdpr_audit(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_gdpr_audit(UUID, UUID)
  TO authenticated;
REVOKE ALL ON FUNCTION public.claim_gdpr_audit(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_gdpr_audit(UUID)
  TO authenticated;

COMMENT ON FUNCTION public.claim_gdpr_audit(UUID, UUID) IS
  'Claim an anonymous gdpr_audit only after verified matching email, authorized owner/admin membership and explicit tenant selection.';
COMMENT ON FUNCTION public.claim_gdpr_audit(UUID) IS
  'Legacy single-tenant claim entry; rejects ambiguous memberships. Delegates to the verified two-argument RPC.';
