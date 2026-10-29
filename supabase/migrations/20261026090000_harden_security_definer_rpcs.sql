-- SECURITY-DEFINER-RPCs nachhaerten: drei Befunde aus dem Advisor-Review
-- vom 2026-10-26 (gemessen gegen Produktion, get_advisors + Funktionskoerper).
--
-- ENTWURF. Nicht direkt gegen Produktion anwenden, sondern ueber den
-- normalen Migrationsweg nach Review.
--
-- ── 1. onboarding_tenant_policy_packs(p_tenant_id, p_user_id) ───────────────
--
-- Befund: In Produktion fuer anon UND authenticated ausfuehrbar. Der Koerper
-- prueft nur, ob p_user_id Mitglied in p_tenant_id ist — beide Werte liefert
-- der Aufrufer. Gegen auth.uid() wird nicht geprueft. Wer eine Mandanten-ID
-- und die ID eines Mitglieds kennt, konnte also ohne Anmeldung
--   POST /rest/v1/rpc/onboarding_tenant_policy_packs
--   {"p_tenant_id": "<fremder Mandant>", "p_user_id": "<dessen Mitglied>"}
-- Policy Packs im fremden Mandanten aktivieren, mit gefaelschtem created_by.
-- Nebenbei verriet die Antwort (FORBIDDEN oder Ergebnis), ob ein Nutzer
-- Mitglied eines Mandanten ist.
--
-- `revoke all ... from public` in 20260829011038 hat das nicht verhindert:
-- Die Default Privileges des Schemas public berechtigen anon und
-- authenticated DIREKT (gleiches Muster wie 20260927114512, 20261020090000).
--
-- Kein Aufrufer: Im Repo ruft niemand rpc('onboarding_tenant_policy_packs')
-- auf. Die Edge Function onboarding-orchestrator schreibt
-- policy_pack_activations selbst per service_role, nachdem sie den Nutzer
-- ueber auth.getUser() und die Mitgliedschaft geprueft hat. Der Entzug
-- bricht also keinen bestehenden Pfad.
--
-- Zwei Schichten:
--   a) EXECUTE nur noch fuer service_role.
--   b) Im Koerper: Ein Aufrufer, der nicht service_role ist, darf nur fuer
--      sich selbst handeln (p_user_id = auth.uid()). Faellt (a) je durch
--      einen pauschalen Re-Grant weg, bleibt die Faelschung trotzdem zu.
-- Signatur, Branchenlogik und Rueckgabe bleiben wortgleich zu
-- 20260902000011.

create or replace function public.onboarding_tenant_policy_packs(p_tenant_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_industry text;
  v_pack text;
  v_packs text[] := array['dsgvo-essentials','iso-27001-foundation'];
  v_result jsonb := '[]'::jsonb;
begin
  -- Aufrufer binden: p_user_id kommt aus dem Request und ist ohne diese
  -- Pruefung frei waehlbar. Nur service_role (Edge Function nach eigener
  -- JWT-Pruefung) darf fuer einen anderen Nutzer handeln.
  if auth.role() is distinct from 'service_role'
     and (auth.uid() is null or auth.uid() <> p_user_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  -- Mandantentrennung: SECURITY DEFINER umgeht RLS, deshalb wird die
  -- Mitgliedschaft hier ausdrücklich geprüft, bevor irgendetwas passiert.
  if not exists (select 1 from memberships where tenant_id=p_tenant_id and user_id=p_user_id) then
    raise exception 'FORBIDDEN';
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
end $$;

revoke all on function public.onboarding_tenant_policy_packs(uuid, uuid) from public;
revoke all on function public.onboarding_tenant_policy_packs(uuid, uuid) from anon, authenticated;
grant execute on function public.onboarding_tenant_policy_packs(uuid, uuid) to service_role;

-- ── 2. report_unknown_tracker(host, url, domain) ────────────────────────────
--
-- Befund: Bewusst fuer anon geoeffnet (20260510010000: "damit anon-Calls
-- schreiben duerfen"). Damit konnte jeder ohne Anmeldung und ohne Mengen-
-- begrenzung beliebige script_host/customer_domains in unknown_trackers
-- schreiben — die Review-Liste des Compliance-Leads liess sich so fluten
-- und verfaelschen.
--
-- Der einzige Aufrufer, supabase/functions/cookie-scan (reportUnknownScripts),
-- ruft die RPC mit SUPABASE_SERVICE_ROLE_KEY auf, nicht mit dem anon-Key.
-- anon und authenticated brauchen das Recht also nicht. Danach landen nur
-- noch Hosts in der Tabelle, die ein echter cookie-scan-Lauf gefunden hat.
--
-- Begleitend: scripts/check-function-acl-drift.mjs fuehrt
-- report_unknown_tracker nicht mehr in REQUIRED_ANON, sondern in
-- FORBIDDEN_CLIENT.

revoke all on function public.report_unknown_tracker(text, text, text) from public;
revoke all on function public.report_unknown_tracker(text, text, text) from anon, authenticated;
grant execute on function public.report_unknown_tracker(text, text, text) to service_role;

-- ── 3. claim_gdpr_audit(p_audit_id) ─────────────────────────────────────────
--
-- Befund: Die Pruefung mit der Meldung 'email unverified' schaute nur, ob
-- auth.users.email leer ist — nicht, ob die Adresse bestaetigt wurde. Die
-- Autorisierung des Claims haengt aber genau an dieser Adresse (Audit-E-Mail
-- = Konto-E-Mail). Waere die E-Mail-Bestaetigung im Projekt je abgeschaltet,
-- koennte sich jemand mit einer fremden Adresse registrieren und deren
-- anonymes Audit an den eigenen Mandanten binden.
--
-- Heute gering: Die Bestaetigung ist aktiv, die zwei unbestaetigten Konten
-- in Produktion haben sich nie angemeldet (gemessen 2026-10-26). OAuth- und
-- Magic-Link-Anmeldungen setzen email_confirmed_at, bleiben also unberuehrt.
--
-- Einzige Aenderung gegenueber 20260830091500: email_confirmed_at wird mit
-- gelesen und muss gesetzt sein. Signatur, Rechte und Rueckgabe bleiben.

CREATE OR REPLACE FUNCTION public.claim_gdpr_audit(p_audit_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         uuid := auth.uid();
  v_email       text;
  v_confirmed   timestamptz;
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

  SELECT u.email, u.email_confirmed_at INTO v_email, v_confirmed
    FROM auth.users u
   WHERE u.id = v_uid;

  -- Die E-Mail ist hier der Berechtigungsnachweis — sie zaehlt nur bestaetigt.
  IF v_email IS NULL OR length(btrim(v_email)) = 0 OR v_confirmed IS NULL THEN
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

-- ── 4. search_path fuer zwei Trigger-Funktionen ─────────────────────────────
--
-- Advisor function_search_path_mutable (2 Treffer). Beide sind SECURITY
-- INVOKER und setzen nur NEW.updated_at; der feste search_path schliesst
-- den Lint und kostet nichts.

ALTER FUNCTION public.governance_activations_set_updated_at() SET search_path = public, pg_catalog;
ALTER FUNCTION public.fmt_set_updated_at() SET search_path = public, pg_catalog;
