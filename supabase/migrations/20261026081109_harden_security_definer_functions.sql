-- SECURITY-DEFINER-Härtung (2026-10-26): IDOR-Fix onboarding_tenant_policy_packs,
-- email_confirmed_at in claim_gdpr_audit, search_path für zwei Trigger-Funktionen.

CREATE OR REPLACE FUNCTION public.onboarding_tenant_policy_packs(p_tenant_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_industry text;
  v_pack text;
  v_packs text[] := array['dsgvo-essentials','iso-27001-foundation'];
  v_result jsonb := '[]'::jsonb;
begin
  -- Aufrufer-Bindung: Ohne service_role darf nur der angemeldete Nutzer
  -- für sich selbst handeln. Sonst ließe sich p_user_id frei wählen.
  if coalesce(auth.role(), '') <> 'service_role' then
    if auth.uid() is null or p_user_id is distinct from auth.uid() then
      raise exception 'FORBIDDEN' using errcode = '42501';
    end if;
  end if;

  -- Mandantentrennung: SECURITY DEFINER umgeht RLS, deshalb wird die
  -- Mitgliedschaft hier ausdrücklich geprüft, bevor irgendetwas passiert.
  if not exists (select 1 from memberships where tenant_id=p_tenant_id and user_id=p_user_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select coalesce(industry,'all') into v_industry from tenants where id=p_tenant_id;
  -- Die Literale folgen TENANT_INDUSTRY_OPTIONS (src/lib/policy-packs/recommend.ts).
  -- Wer sie hier ändert, ändert sie dort mit — sonst greift die Regel wieder ins Leere.
  if v_industry in ('health','ai') then v_packs := v_packs || 'eu-ai-act-high-risk'::text; end if;
  if v_industry in ('critical-infrastructure','public-sector') then v_packs := v_packs || 'nis2-cybersecurity'::text; end if;
  if v_industry='automotive' then v_packs := v_packs || 'tisax-automotive'::text; end if;
  if v_industry='fintech' then v_packs := v_packs || 'fintech-compliance'::text; end if;
  foreach v_pack in array v_packs loop
    if exists(select 1 from policy_pack_catalog where id=v_pack) then
      insert into policy_pack_activations(tenant_id,pack_id,activated_at,created_by)
      values(p_tenant_id,v_pack,now(),p_user_id)
      on conflict do nothing;
      v_result := v_result || jsonb_build_array(v_pack);
    end if;
  end loop;
  return v_result;
end $function$;

REVOKE EXECUTE ON FUNCTION public.onboarding_tenant_policy_packs(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.onboarding_tenant_policy_packs(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.onboarding_tenant_policy_packs(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.claim_gdpr_audit(p_audit_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Nur eine bestätigte Adresse belegt, dass der Nutzer das Postfach besitzt.
  SELECT u.email INTO v_email
    FROM auth.users u
   WHERE u.id = v_uid
     AND u.email_confirmed_at IS NOT NULL;

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
$function$;

ALTER FUNCTION public.governance_activations_set_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.fmt_set_updated_at()                    SET search_path = public, pg_temp;