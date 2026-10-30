-- Bot-Kanäle: Tarifprofile automatisch anwenden (GO-Fix Dominik, 30.10.2026)
--
-- Befund (Prod, read-only): alle bot_usage_limits-Zeilen stehen auf
-- KI-USD / Sprachsekunden / EUR = 0. Der Seed aus 20261028100000 legt
-- Zeilen an, bot_usage_apply_plan_profile wird aber nirgends aufgerufen —
-- der erste Käufer bekäme einen Assistenten ohne Funktion.
--
-- ADDITIV auf 20261028100000_bot_usage_plan_caps:
--   1. Profil 'trial' (reduziertes Budget). Enterprise bleibt bewusst ohne
--      Profil (manuell je Kunde beim Onboarding).
--   2. bot_usage_apply_plan_profile: einheitliche EUR→USD-Umrechnung auf
--      Insert- UND Update-Pfad; Tageslimit = Monatsbudget / 10.
--   3. bot_usage_sync_plan_from_subscription(tenant, source): liest
--      subscriptions und wendet idempotent an (je source genau einmal):
--        active            → Tarifprofil
--        trialing          → 'trial'-Profil
--        canceled/past_due/unpaid/incomplete*/sonst → Budget 0
--        Tarif ohne Profil (z. B. enterprise) → KEIN stilles 0, sondern
--          Alarm in bot_usage_plan_alerts, bestehende Zeile bleibt
--   4. bot_usage_seed_missing_limits: trialing erhält das Trial-Profil;
--      bestehende Nullzeilen laufender Testphasen werden einmalig angehoben.
--   5. bot_usage_plan_reconcile_report(): tägliche Abweichungsliste,
--      KORRIGIERT NICHTS (pg_cron 04:15 UTC, schreibt nur Alarme).
--
-- Keine Preise, keine Stripe-Produkte, keine Entitlements werden verändert.
-- Werte (Owner 28.10.2026, verbindlich je Monat):
--   Starter 60 Min / 8 €, Growth 250 Min / 30 €, Agency 750 Min / 90 €.
-- Trial (reduziert, Vorschlag zur Bestätigung): 15 Min / 2 € (= ¼ Starter),
--   ohne Fixkostenanteil. Keine neue Testphase (E-P1): nur bereits laufende
--   Trials laufen damit aus.
--
-- NICHT automatisch auf Produktion anwenden (Draft-PR).

BEGIN;

-- ============================================================
-- 1. Trial-Profil
-- ============================================================
ALTER TABLE public.bot_usage_plan_profiles
  DROP CONSTRAINT IF EXISTS bot_usage_plan_profiles_plan_key_check;
ALTER TABLE public.bot_usage_plan_profiles
  ADD CONSTRAINT bot_usage_plan_profiles_plan_key_check
  CHECK (plan_key IN ('starter', 'growth', 'agency', 'trial'));

INSERT INTO public.bot_usage_plan_profiles
  (plan_key, voice_minutes_monthly, cost_eur_monthly, fixed_cost_usd_monthly, decided_at, decided_by, note)
VALUES
  ('trial', 15, 2, 0, DATE '2026-10-30', 'owner',
   'Reduziertes Budget für bereits laufende Testphasen (GO-Fix 30.10.2026); keine neue Testphase')
ON CONFLICT (plan_key) DO NOTHING;

-- ============================================================
-- 2. Idempotenz und Alarme
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bot_usage_plan_applications (
  source       text PRIMARY KEY,
  tenant_id    uuid NOT NULL,
  plan_key     text,
  sub_status   text,
  outcome      text NOT NULL,
  applied_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bot_usage_plan_applications ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.bot_usage_plan_alerts (
  id           bigserial PRIMARY KEY,
  tenant_id    uuid,
  kind         text NOT NULL,
  detail       jsonb NOT NULL DEFAULT '{}'::jsonb,
  source       text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bot_usage_plan_alerts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS bot_usage_plan_alerts_created_idx
  ON public.bot_usage_plan_alerts (created_at DESC);
-- Keine Policies: nur service_role.

-- ============================================================
-- 3. apply_plan_profile: einheitliche Umrechnung, Tag = Monat/10
-- ============================================================
CREATE OR REPLACE FUNCTION public.bot_usage_apply_plan_profile(
  p_tenant_id uuid,
  p_plan_key  text,
  p_source    text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p    public.bot_usage_plan_profiles%ROWTYPE;
  v_rate numeric;
  v_eur  numeric;
BEGIN
  PERFORM public.bot_usage_assert_internal();
  IF p_tenant_id IS NULL OR p_source IS NULL OR length(p_source) = 0 THEN
    RAISE EXCEPTION 'tenant and source required' USING ERRCODE = '22023';
  END IF;

  IF p_plan_key IS NOT NULL THEN
    SELECT * INTO v_p FROM public.bot_usage_plan_profiles WHERE plan_key = p_plan_key;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'no bot usage profile for plan % (enterprise: configure explicitly)', p_plan_key
        USING ERRCODE = '22023';
    END IF;
  END IF;

  v_eur := coalesce(v_p.cost_eur_monthly, 0);
  -- Kurs der bestehenden Zeile, sonst Spaltenvorgabe (1).
  SELECT eur_per_usd INTO v_rate FROM public.bot_usage_limits WHERE tenant_id = p_tenant_id;
  v_rate := coalesce(v_rate, 1);

  INSERT INTO public.bot_usage_limits AS l
    (tenant_id, ai_usd_daily, ai_usd_monthly, voice_seconds_monthly, cost_eur_monthly,
     fixed_cost_usd_monthly, plan_profile, config_source, updated_at)
  VALUES
    (p_tenant_id,
     round(v_eur / v_rate / 10, 6), round(v_eur / v_rate, 6),
     coalesce(v_p.voice_minutes_monthly, 0) * 60, v_eur,
     coalesce(v_p.fixed_cost_usd_monthly, 0), p_plan_key, p_source, now())
  ON CONFLICT (tenant_id) DO UPDATE SET
    ai_usd_daily           = round(EXCLUDED.cost_eur_monthly / l.eur_per_usd / 10, 6),
    ai_usd_monthly         = round(EXCLUDED.cost_eur_monthly / l.eur_per_usd, 6),
    voice_seconds_monthly  = EXCLUDED.voice_seconds_monthly,
    cost_eur_monthly       = EXCLUDED.cost_eur_monthly,
    fixed_cost_usd_monthly = EXCLUDED.fixed_cost_usd_monthly,
    plan_profile           = EXCLUDED.plan_profile,
    config_source          = EXCLUDED.config_source,
    updated_at             = now();
END;
$$;

-- ============================================================
-- 4. Abo → Profil (Webhook-Einstieg), idempotent je source
-- ============================================================
-- Rückgabe: 'applied:<plan>' | 'zeroed:<status>' | 'duplicate'
--         | 'no_subscription' | 'alert:no_profile:<plan>'
CREATE OR REPLACE FUNCTION public.bot_usage_sync_plan_from_subscription(
  p_tenant_id uuid,
  p_source    text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan    text;
  v_status  text;
  v_target  text;
  v_outcome text;
BEGIN
  PERFORM public.bot_usage_assert_internal();
  IF p_tenant_id IS NULL OR p_source IS NULL OR length(p_source) = 0 THEN
    RAISE EXCEPTION 'tenant and source required' USING ERRCODE = '22023';
  END IF;

  -- Ein Ereignis wirkt genau einmal (doppelte Stripe-Zustellung).
  PERFORM pg_advisory_xact_lock(hashtextextended('bot_usage_plan:' || p_tenant_id::text, 0));
  IF EXISTS (SELECT 1 FROM public.bot_usage_plan_applications WHERE source = p_source) THEN
    RETURN 'duplicate';
  END IF;

  SELECT s.plan_key, s.status INTO v_plan, v_status
    FROM public.subscriptions s
   WHERE s.tenant_id = p_tenant_id
   ORDER BY s.updated_at DESC NULLS LAST
   LIMIT 1;

  IF NOT FOUND THEN
    v_outcome := 'no_subscription';
  ELSIF v_status = 'active' THEN
    v_target := v_plan;
  ELSIF v_status = 'trialing' THEN
    v_target := 'trial';
  ELSE
    v_target := NULL; -- canceled, past_due, unpaid, incomplete, …
  END IF;

  IF v_outcome IS NULL THEN
    IF v_target IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.bot_usage_plan_profiles WHERE plan_key = v_target) THEN
      IF v_status = 'active' AND v_plan IN ('free_audit', 'free') THEN
        -- Kostenloser Tarif: bewusst kein Bot-Budget.
        PERFORM public.bot_usage_apply_plan_profile(p_tenant_id, NULL, p_source);
        v_outcome := 'zeroed:free';
      ELSE
        -- Kein stilles 0: bestehende (ggf. manuell gesetzte) Zeile bleibt,
        -- Alarm für manuelle Konfiguration (Enterprise beim Onboarding).
        INSERT INTO public.bot_usage_plan_alerts (tenant_id, kind, detail, source)
        VALUES (p_tenant_id, 'no_profile',
                jsonb_build_object('plan_key', v_plan, 'status', v_status), p_source);
        v_outcome := 'alert:no_profile:' || coalesce(v_plan, 'null');
      END IF;
    ELSIF v_target IS NULL THEN
      PERFORM public.bot_usage_apply_plan_profile(p_tenant_id, NULL, p_source);
      v_outcome := 'zeroed:' || coalesce(v_status, 'null');
    ELSE
      PERFORM public.bot_usage_apply_plan_profile(p_tenant_id, v_target, p_source);
      v_outcome := 'applied:' || v_target;
    END IF;
  END IF;

  INSERT INTO public.bot_usage_plan_applications (source, tenant_id, plan_key, sub_status, outcome)
  VALUES (p_source, p_tenant_id, v_plan, v_status, v_outcome);
  RETURN v_outcome;
END;
$$;

-- ============================================================
-- 5. Seed: Trial nicht dauerhaft auf 0
-- ============================================================
CREATE OR REPLACE FUNCTION public.bot_usage_seed_missing_limits(p_source text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  PERFORM public.bot_usage_assert_internal();
  IF p_source IS NULL OR length(p_source) = 0 THEN
    RAISE EXCEPTION 'source required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.bot_usage_limits
    (tenant_id, ai_usd_daily, ai_usd_monthly, voice_seconds_monthly, cost_eur_monthly,
     fixed_cost_usd_monthly, plan_profile, config_source)
  SELECT t.id,
         round(coalesce(p.cost_eur_monthly, 0) / 10, 6),
         coalesce(p.cost_eur_monthly, 0),
         coalesce(p.voice_minutes_monthly, 0) * 60,
         coalesce(p.cost_eur_monthly, 0),
         coalesce(p.fixed_cost_usd_monthly, 0),
         p.plan_key,
         p_source || ':' || coalesce(s.plan_key, 'none') || ':' || coalesce(s.status, 'none')
    FROM public.tenants t
    LEFT JOIN LATERAL (
      SELECT sub.plan_key, sub.status
        FROM public.subscriptions sub
       WHERE sub.tenant_id = t.id
       ORDER BY sub.updated_at DESC NULLS LAST
       LIMIT 1
    ) s ON true
    LEFT JOIN public.bot_usage_plan_profiles p
      ON (s.status = 'active'   AND p.plan_key = s.plan_key)
      OR (s.status = 'trialing' AND p.plan_key = 'trial')
  ON CONFLICT (tenant_id) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================
-- 6. Tägliche Abgleichsliste — meldet nur, korrigiert nichts
-- ============================================================
CREATE OR REPLACE FUNCTION public.bot_usage_plan_reconcile_report()
RETURNS TABLE (
  tenant_id         uuid,
  plan_key          text,
  sub_status        text,
  expected_profile  text,
  row_profile       text,
  expected_eur      numeric,
  row_eur           numeric,
  expected_seconds  integer,
  row_seconds       integer,
  issue             text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH s AS (
    SELECT DISTINCT ON (sub.tenant_id) sub.tenant_id, sub.plan_key, sub.status
      FROM public.subscriptions sub
     ORDER BY sub.tenant_id, sub.updated_at DESC NULLS LAST
  ), e AS (
    SELECT s.tenant_id, s.plan_key, s.status,
           CASE WHEN s.status = 'active'   THEN s.plan_key
                WHEN s.status = 'trialing' THEN 'trial' END AS expected
      FROM s
  )
  SELECT e.tenant_id, e.plan_key, e.status, e.expected, l.plan_profile,
         coalesce(p.cost_eur_monthly, 0), l.cost_eur_monthly,
         coalesce(p.voice_minutes_monthly, 0) * 60, l.voice_seconds_monthly,
         CASE
           WHEN l.tenant_id IS NULL THEN 'missing_row'
           WHEN e.expected IS NOT NULL AND e.plan_key NOT IN ('free_audit','free') AND p.plan_key IS NULL
                AND l.cost_eur_monthly = 0 THEN 'no_profile_and_zero'
           WHEN p.plan_key IS NOT NULL AND (l.cost_eur_monthly <> p.cost_eur_monthly
                OR l.voice_seconds_monthly <> p.voice_minutes_monthly * 60) THEN 'mismatch'
           WHEN e.expected IS NULL AND l.cost_eur_monthly > 0 AND l.plan_profile IS NOT NULL THEN 'budget_after_end'
         END
    FROM e
    LEFT JOIN public.bot_usage_limits l ON l.tenant_id = e.tenant_id
    LEFT JOIN public.bot_usage_plan_profiles p ON p.plan_key = e.expected
   WHERE l.tenant_id IS NULL
      OR (e.expected IS NOT NULL AND e.plan_key NOT IN ('free_audit','free') AND p.plan_key IS NULL AND l.cost_eur_monthly = 0)
      OR (p.plan_key IS NOT NULL AND (l.cost_eur_monthly <> p.cost_eur_monthly
          OR l.voice_seconds_monthly <> p.voice_minutes_monthly * 60))
      OR (e.expected IS NULL AND l.cost_eur_monthly > 0 AND l.plan_profile IS NOT NULL);
$$;

-- Schreibt Abweichungen als Alarme. Ändert bot_usage_limits NICHT.
CREATE OR REPLACE FUNCTION public.bot_usage_plan_reconcile_log()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  PERFORM public.bot_usage_assert_internal();
  INSERT INTO public.bot_usage_plan_alerts (tenant_id, kind, detail, source)
  SELECT r.tenant_id, 'reconcile:' || r.issue, to_jsonb(r), 'cron:bot-usage-plan-reconcile'
    FROM public.bot_usage_plan_reconcile_report() r;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bot-usage-plan-reconcile') THEN
      PERFORM cron.unschedule('bot-usage-plan-reconcile');
    END IF;
    PERFORM cron.schedule('bot-usage-plan-reconcile', '15 4 * * *',
      'SELECT public.bot_usage_plan_reconcile_log()');
  ELSE
    RAISE NOTICE 'pg_cron fehlt (lokale Testdatenbank) — Zeitplan übersprungen.';
  END IF;
END
$do$;

-- ============================================================
-- 7. Einmalige Nachführung (nur beim Einspielen dieser Migration)
-- ============================================================
-- Aktive Tarife mit Profil und laufende Trials, deren Zeile noch die
-- Nullzeile aus dem Seed ist, erhalten ihr Profil. Manuell gesetzte Zeilen
-- (plan_profile/config_source abweichend) bleiben unberührt.
DO $do$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT l.tenant_id
      FROM public.bot_usage_limits l
     WHERE l.plan_profile IS NULL AND l.cost_eur_monthly = 0
       AND l.config_source LIKE 'seed:%'
  LOOP
    PERFORM public.bot_usage_sync_plan_from_subscription(r.tenant_id, 'migration:20261030120000:' || r.tenant_id);
  END LOOP;
END
$do$;
SELECT public.bot_usage_seed_missing_limits('seed:20261030120000');

-- ============================================================
-- 8. Rechte: nur service_role
-- ============================================================
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.bot_usage_apply_plan_profile(uuid,text,text)',
    'public.bot_usage_sync_plan_from_subscription(uuid,text)',
    'public.bot_usage_seed_missing_limits(text)',
    'public.bot_usage_plan_reconcile_report()',
    'public.bot_usage_plan_reconcile_log()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated', f);
    EXCEPTION WHEN undefined_object THEN NULL;
    END;
    BEGIN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    EXCEPTION WHEN undefined_object THEN NULL;
    END;
  END LOOP;
END $$;

DO $$
BEGIN
  REVOKE ALL ON public.bot_usage_plan_applications FROM anon, authenticated;
  REVOKE ALL ON public.bot_usage_plan_alerts FROM anon, authenticated;
EXCEPTION WHEN undefined_object THEN
  RAISE NOTICE 'Rollen anon/authenticated fehlen (lokale Testdatenbank) — Grants übersprungen.';
END $$;

COMMIT;
