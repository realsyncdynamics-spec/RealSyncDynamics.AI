-- Bot-Kostenbremsen an den Abo-Lebenszyklus koppeln (Fix Prod-Audit 30.10.2026)
--
-- ADDITIV auf 20261028100000_bot_usage_plan_caps.sql. NICHT in Produktion
-- anwenden ohne ausdrückliches Go des Inhabers.
--
-- Befund (Audit RealSyncDynamicsLive, eu-central-1):
--   * alle bot_usage_limits-Deckel = 0; ein Free-Mandant ohne Zeile
--   * bot_usage_apply_plan_profile / bot_usage_seed_missing_limits wurden von
--     keiner Funktion, keinem Trigger und keinem Cron aufgerufen
--   * Stripe-Webhook setzte keine Limits
--   * Trials erhielten immer 0 (Seed nur für status = 'active')
--   * EUR→USD inkonsistent (INSERT setzte EUR als USD, UPDATE teilte durch
--     eur_per_usd)
--   * Tagesdeckel = voller Monatsdeckel
--
-- Entscheidungen (Owner, 30.10.2026, verbindlich):
--   1. Profile vom 28.10. sind verbindliche Limits: Starter 60 Min./8 €,
--      Growth 250 Min./30 €, Agency 750 Min./90 €. Keine neuen Werte/Preise.
--   2. Enterprise erhält KEIN Profil (manuelles Onboarding). Ein aktives
--      Enterprise-Abo ohne manuelle Konfiguration ist ein ALARM, keine stille 0.
--   3. Trials erhalten ein REDUZIERTES Budget: 25 % des bezahlten Profils
--      (Starter 15 Min./2 €, Growth 62,5 Min./7,50 €, Agency 187,5 Min./22,50 €).
--      Hinweis E-P1: Testphasen sind langfristig nicht vorgesehen; die
--      bestehenden Trials laufen aus.
--   4. Tagesdeckel = 1/10 des Monatsdeckels.
--   5. past_due, canceled, unpaid, incomplete, incomplete_expired, paused → 0.
--
-- Umrechnung (einheitlich): cost_eur_monthly in EUR; ai_usd_* in USD
--   ai_usd_monthly = cost_eur_monthly / eur_per_usd
--   ai_usd_daily   = ai_usd_monthly / 10
-- eur_per_usd = Wert der bestehenden Zeile, sonst Spaltendefault (1).
--
-- Manuell gepflegte Zeilen (config_source LIKE 'manual:%') werden vom
-- Lebenszyklus NIE überschrieben (Enterprise-Onboarding).

BEGIN;

-- ============================================================
-- 1. Alarmtabelle (nachvollziehbar statt stiller 0)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bot_usage_limit_alarms (
  id          bigserial PRIMARY KEY,
  tenant_id   uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_key    text,
  status      text,
  reason      text NOT NULL,
  source      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
ALTER TABLE public.bot_usage_limit_alarms ENABLE ROW LEVEL SECURITY;
-- Keine Policies: nur service_role.
-- Ein offener Alarm je Mandant und Grund (Webhook-Wiederholungen erzeugen
-- keine Duplikate).
CREATE UNIQUE INDEX IF NOT EXISTS bot_usage_limit_alarms_open_uq
  ON public.bot_usage_limit_alarms (tenant_id, reason) WHERE resolved_at IS NULL;

COMMENT ON TABLE public.bot_usage_limit_alarms IS
  'Alarme der Bot-Kostenbremsen (z. B. Enterprise ohne manuelle Konfiguration). Nur service_role.';

-- ============================================================
-- 2. Sollwerte je Tarif und Status (eine Quelle für Sync, Seed, Abgleich)
-- ============================================================
-- kind: 'paid' | 'trial' | 'zero' | 'missing_profile'
CREATE OR REPLACE FUNCTION public.bot_usage_expected_limits(
  p_plan_key text,
  p_status   text
) RETURNS TABLE (
  kind                  text,
  profile_key           text,
  factor                numeric,
  voice_seconds_monthly integer,
  cost_eur_monthly      numeric,
  fixed_cost_usd_monthly numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_p      public.bot_usage_plan_profiles%ROWTYPE;
  v_factor numeric;
BEGIN
  IF p_status = 'active' THEN
    v_factor := 1;
  ELSIF p_status = 'trialing' THEN
    v_factor := 0.25;  -- Trial-Budget: 25 % des bezahlten Profils
  ELSE
    RETURN QUERY SELECT 'zero'::text, NULL::text, 0::numeric, 0, 0::numeric, 0::numeric;
    RETURN;
  END IF;

  SELECT * INTO v_p FROM public.bot_usage_plan_profiles WHERE plan_key = p_plan_key;
  IF FOUND THEN
    RETURN QUERY SELECT
      CASE WHEN v_factor = 1 THEN 'paid' ELSE 'trial' END,
      v_p.plan_key, v_factor,
      floor(v_p.voice_minutes_monthly * 60 * v_factor)::integer,
      round(v_p.cost_eur_monthly * v_factor, 6),
      v_p.fixed_cost_usd_monthly;
  ELSIF p_plan_key = 'enterprise' THEN
    RETURN QUERY SELECT 'missing_profile'::text, NULL::text, 0::numeric, 0, 0::numeric, 0::numeric;
  ELSE
    -- free_audit / free_tier u. a.: keine kostenpflichtige Bot-Nutzung.
    RETURN QUERY SELECT 'zero'::text, NULL::text, 0::numeric, 0, 0::numeric, 0::numeric;
  END IF;
END;
$$;

-- ============================================================
-- 3. Werte schreiben (einheitliche Umrechnung, Tag = Monat/10)
-- ============================================================
CREATE OR REPLACE FUNCTION public.bot_usage_write_limits(
  p_tenant_id   uuid,
  p_profile_key text,
  p_seconds     integer,
  p_cost_eur    numeric,
  p_fixed_usd   numeric,
  p_source      text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate    numeric;
  v_monthly numeric;
BEGIN
  SELECT l.eur_per_usd INTO v_rate FROM public.bot_usage_limits l WHERE l.tenant_id = p_tenant_id;
  v_rate := coalesce(v_rate, 1);  -- Spaltendefault eur_per_usd
  v_monthly := round(p_cost_eur / v_rate, 6);

  INSERT INTO public.bot_usage_limits AS l
    (tenant_id, ai_usd_daily, ai_usd_monthly, voice_seconds_monthly, cost_eur_monthly,
     fixed_cost_usd_monthly, plan_profile, config_source, updated_at)
  VALUES
    (p_tenant_id, round(v_monthly / 10, 6), v_monthly, p_seconds, p_cost_eur,
     p_fixed_usd, p_profile_key, p_source, now())
  ON CONFLICT (tenant_id) DO UPDATE SET
    ai_usd_daily           = EXCLUDED.ai_usd_daily,
    ai_usd_monthly         = EXCLUDED.ai_usd_monthly,
    voice_seconds_monthly  = EXCLUDED.voice_seconds_monthly,
    cost_eur_monthly       = EXCLUDED.cost_eur_monthly,
    fixed_cost_usd_monthly = EXCLUDED.fixed_cost_usd_monthly,
    plan_profile           = EXCLUDED.plan_profile,
    config_source          = EXCLUDED.config_source,
    updated_at             = now();
END;
$$;

-- Bestehende Signatur bleibt; Fehler für unbekannte Profile bleibt (22023).
-- p_plan_key NULL → Nullzeile.
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
  v_p public.bot_usage_plan_profiles%ROWTYPE;
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
  PERFORM public.bot_usage_write_limits(
    p_tenant_id, p_plan_key,
    coalesce(v_p.voice_minutes_monthly, 0) * 60,
    coalesce(v_p.cost_eur_monthly, 0),
    coalesce(v_p.fixed_cost_usd_monthly, 0),
    p_source);
END;
$$;

-- ============================================================
-- 4. Lebenszyklus: aus dem aktuellen Abo des Mandanten ableiten
-- ============================================================
-- Liest subscriptions (nach syncSubscription), nicht das Event-Payload →
-- verspätete/doppelte Events sind wirkungsgleich (idempotent).
-- Rückgabe: 'paid' | 'trial' | 'zero' | 'manual_kept' | 'alarm_missing_profile'
CREATE OR REPLACE FUNCTION public.bot_usage_sync_from_subscription(
  p_tenant_id uuid,
  p_source    text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan   text;
  v_status text;
  v_e      record;
  v_cur    text;
  v_exists boolean;
BEGIN
  PERFORM public.bot_usage_assert_internal();
  IF p_tenant_id IS NULL OR p_source IS NULL OR length(p_source) = 0 THEN
    RAISE EXCEPTION 'tenant and source required' USING ERRCODE = '22023';
  END IF;

  -- Serialisiert parallele Webhooks desselben Mandanten.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':limits', 0));

  SELECT s.plan_key, s.status INTO v_plan, v_status
    FROM public.subscriptions s
   WHERE s.tenant_id = p_tenant_id
   ORDER BY s.updated_at DESC NULLS LAST
   LIMIT 1;

  SELECT l.config_source INTO v_cur FROM public.bot_usage_limits l WHERE l.tenant_id = p_tenant_id;
  v_exists := FOUND;

  SELECT * INTO v_e FROM public.bot_usage_expected_limits(v_plan, coalesce(v_status, 'none'));

  IF v_e.kind = 'missing_profile' THEN
    INSERT INTO public.bot_usage_limit_alarms (tenant_id, plan_key, status, reason, source)
    VALUES (p_tenant_id, v_plan, v_status, 'missing_profile', p_source)
    ON CONFLICT (tenant_id, reason) WHERE resolved_at IS NULL DO NOTHING;
    RAISE WARNING 'ALARM bot_usage: tenant % plan % status % has no profile and no manual config',
      p_tenant_id, v_plan, v_status;
    IF v_exists AND v_cur LIKE 'manual:%' THEN
      RETURN 'manual_kept';
    END IF;
    IF NOT v_exists THEN
      -- fail-closed, aber mit Alarm (nicht still).
      PERFORM public.bot_usage_write_limits(p_tenant_id, NULL, 0, 0, 0, p_source || ':alarm');
    END IF;
    RETURN 'alarm_missing_profile';
  END IF;

  IF v_exists AND v_cur LIKE 'manual:%' THEN
    RETURN 'manual_kept';
  END IF;

  PERFORM public.bot_usage_write_limits(
    p_tenant_id, v_e.profile_key, v_e.voice_seconds_monthly, v_e.cost_eur_monthly,
    v_e.fixed_cost_usd_monthly,
    p_source || ':' || coalesce(v_plan, 'none') || ':' || coalesce(v_status, 'none'));
  RETURN v_e.kind;
END;
$$;

-- ============================================================
-- 5. Seed: fehlende Zeilen über denselben Lebenszyklus (Trials reduziert)
-- ============================================================
-- Bestehende Zeilen bleiben unverändert. Idempotent. Bucht nichts.
CREATE OR REPLACE FUNCTION public.bot_usage_seed_missing_limits(p_source text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_t     uuid;
BEGIN
  PERFORM public.bot_usage_assert_internal();
  IF p_source IS NULL OR length(p_source) = 0 THEN
    RAISE EXCEPTION 'source required' USING ERRCODE = '22023';
  END IF;
  FOR v_t IN
    SELECT t.id FROM public.tenants t
     WHERE NOT EXISTS (SELECT 1 FROM public.bot_usage_limits l WHERE l.tenant_id = t.id)
  LOOP
    PERFORM public.bot_usage_sync_from_subscription(v_t, p_source);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- ============================================================
-- 6. Täglicher Abgleich: NUR finden und melden, nichts korrigieren
-- ============================================================
CREATE OR REPLACE FUNCTION public.bot_usage_find_limit_mismatches()
RETURNS TABLE (
  tenant_id        uuid,
  plan_key         text,
  status           text,
  issue            text,
  expected_seconds integer,
  actual_seconds   integer,
  expected_eur     numeric,
  actual_eur       numeric,
  config_source    text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  PERFORM public.bot_usage_assert_internal();
  RETURN QUERY
  WITH s AS (
    SELECT DISTINCT ON (sub.tenant_id) sub.tenant_id, sub.plan_key, sub.status
      FROM public.subscriptions sub
     ORDER BY sub.tenant_id, sub.updated_at DESC NULLS LAST
  ), x AS (
    SELECT t.id AS tid, s.plan_key, s.status, l.*, e.kind, e.voice_seconds_monthly AS e_sec,
           e.cost_eur_monthly AS e_eur
      FROM public.tenants t
      LEFT JOIN s ON s.tenant_id = t.id
      LEFT JOIN public.bot_usage_limits l ON l.tenant_id = t.id
      CROSS JOIN LATERAL public.bot_usage_expected_limits(s.plan_key, coalesce(s.status, 'none')) e
  )
  SELECT x.tid, x.plan_key, x.status,
         CASE
           WHEN x.tenant_id IS NULL THEN 'missing_row'
           WHEN x.kind = 'missing_profile' AND coalesce(x.config_source, '') NOT LIKE 'manual:%' THEN 'enterprise_unconfigured'
           WHEN coalesce(x.config_source, '') LIKE 'manual:%' THEN NULL
           WHEN x.voice_seconds_monthly <> x.e_sec OR x.cost_eur_monthly <> x.e_eur THEN 'value_mismatch'
           WHEN x.ai_usd_daily <> round(x.ai_usd_monthly / 10, 6) THEN 'daily_not_tenth'
           WHEN x.ai_usd_monthly <> round(x.cost_eur_monthly / x.eur_per_usd, 6) THEN 'eur_usd_mismatch'
         END,
         x.e_sec, x.voice_seconds_monthly, x.e_eur, x.cost_eur_monthly, x.config_source
    FROM x
   WHERE CASE
           WHEN x.tenant_id IS NULL THEN true
           WHEN x.kind = 'missing_profile' THEN coalesce(x.config_source, '') NOT LIKE 'manual:%'
           WHEN coalesce(x.config_source, '') LIKE 'manual:%' THEN false
           ELSE x.voice_seconds_monthly <> x.e_sec OR x.cost_eur_monthly <> x.e_eur
             OR x.ai_usd_daily <> round(x.ai_usd_monthly / 10, 6)
             OR x.ai_usd_monthly <> round(x.cost_eur_monthly / x.eur_per_usd, 6)
         END;
END;
$$;

-- Optionaler Cron (NICHT aktiviert; erst nach Go und Prod-Migration):
--   SELECT cron.schedule('bot-usage-limit-reconcile', '15 5 * * *',
--     $$SELECT count(*) FROM public.bot_usage_find_limit_mismatches()$$);
-- Auswertung/Benachrichtigung liest die Funktion; es wird nichts korrigiert.

-- ============================================================
-- 7. Rechte: nur service_role
-- ============================================================
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.bot_usage_expected_limits(text,text)',
    'public.bot_usage_write_limits(uuid,text,integer,numeric,numeric,text)',
    'public.bot_usage_apply_plan_profile(uuid,text,text)',
    'public.bot_usage_sync_from_subscription(uuid,text)',
    'public.bot_usage_seed_missing_limits(text)',
    'public.bot_usage_find_limit_mismatches()'
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
  REVOKE ALL ON public.bot_usage_limit_alarms FROM anon, authenticated;
EXCEPTION WHEN undefined_object THEN
  RAISE NOTICE 'Rollen anon/authenticated fehlen (lokale Testdatenbank) — Grants übersprungen.';
END $$;

-- ============================================================
-- 8. Bestand korrigieren (wirkt erst bei Prod-Anwendung nach Go)
-- ============================================================
-- Nur automatisch erzeugte Zeilen (seed:/stripe:/sync:) werden neu
-- berechnet; manuelle und unbekannte Zeilen bleiben unverändert.
DO $$
DECLARE v_t uuid;
BEGIN
  FOR v_t IN
    SELECT l.tenant_id FROM public.bot_usage_limits l
     WHERE l.config_source LIKE 'seed:%' OR l.config_source LIKE 'stripe:%' OR l.config_source LIKE 'sync:%'
  LOOP
    PERFORM public.bot_usage_sync_from_subscription(v_t, 'sync:20261030120000');
  END LOOP;
END $$;
SELECT public.bot_usage_seed_missing_limits('seed:20261030120000');

COMMIT;
