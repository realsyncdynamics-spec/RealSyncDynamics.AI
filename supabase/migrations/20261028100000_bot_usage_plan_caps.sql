-- Bot-Kanäle: Eurodeckel und Tarifprofile auf Option A (Blocker 2 aus PR #2044)
--
-- ADDITIV auf 20261027120000 / 20261027140000 (Option A, Stand #2044 43202ce)
-- und 20261027160000 (#2046):
--   * neue Spalten in bot_usage_limits (Eurodeckel, Kostensätze, Herkunft)
--   * neue Tabelle bot_usage_plan_profiles (beschlossene Tarifwerte)
--   * bot_ai_budget_reserve und bot_voice_call_reserve per CREATE OR REPLACE
--     mit unveränderter Signatur ersetzt; Option-A-Verhalten aus #2044 bleibt
--     unverändert ('invalid_config' ohne Zeile bzw. ohne Telefonkontingent)
--   * neue Funktionen bot_usage_cost_eur_used, bot_usage_apply_plan_profile,
--     bot_usage_seed_missing_limits
--   * neue Sicht bot_voice_call_costs (Kosten je Gespräch)
--   * Seed: genau eine explizite Zeile je bestehendem Mandanten
-- Keine Preis-, Stripe- oder Entitlement-Zeile wird verändert. Nichts hier
-- wird fakturiert: Alle Euro-Werte sind interne Kostenbremsen.
--
-- Entscheidung (Owner, 28.10.2026)
--   Starter  60 Min./Monat,  max.  8 € KI- + Telefoniekosten/Monat
--   Growth  250 Min./Monat,  max. 30 €
--   Agency  750 Min./Monat,  max. 90 €
--   Enterprise: nur ausdrücklich konfigurierte Werte, nie unbegrenzt
--   Minuten und Euro sind zwei unabhängige Obergrenzen; maßgeblich sind die
--   Anbieterkosten, nicht der Verkaufspreis. Keine verkauften Inklusivminuten.
--
-- Lesart der am 28.10. noch offenen Punkte (jeweils die strengere Variante,
-- per service_role je Mandant änderbar):
--   * Testphasen ('trialing') erhalten die Nullzeile: keine kostenpflichtige
--     Nutzung vor der ersten Zahlung.
--   * Minuten wirken als Minimum aus Entitlement und voice_seconds_monthly
--     (Logik aus #2044). Entitlements bleiben unverändert.
--   * Umrechnung 1 USD = 1 EUR (eur_per_usd = 1): überschätzt Eurokosten.
--   * Kostensätze sind Schätzungen: Telefonie 0,12 USD/Min., KI-Anteil
--     0,05 USD/Min. nur zur Planung der Anrufdauer (die KI wird je Schritt
--     gemessen), Fixkosten 1,35 USD/Monat je Tarifzeile (lokale Nummer).
--
-- Regeln
--   * Eurodeckel = eur_per_usd × (KI-USD gemessen/geschätzt/offen
--     + Telefonie-Sekunden/60 × voice_cost_usd_per_minute
--     + fixed_cost_usd_monthly). Gilt kanalübergreifend. Ablehnung
--     'cost_budget'.
--   * Ein Anruf reserviert höchstens so viele Sekunden, wie Minutenkontingent
--     UND Eurodeckel (zum Satz Telefonie + KI-Schätzung) hergeben; unter 60 s
--     Ablehnung 'cost_budget'.
--   * KI- und Telefon-Reservierungen desselben Mandanten serialisieren über
--     einen gemeinsamen Advisory-Lock ':cost' (immer VOR dem Ressourcen-Lock).

BEGIN;

-- ============================================================
-- 1. Eurodeckel und Kostensätze je Mandant
-- ============================================================
-- cost_eur_monthly DEFAULT 0: Eine Zeile ohne ausdrücklichen Eurodeckel
-- erlaubt keine kostenpflichtige Nutzung (fail-closed wie Option A).
ALTER TABLE public.bot_usage_limits
  ADD COLUMN IF NOT EXISTS cost_eur_monthly numeric(12,6) NOT NULL DEFAULT 0
    CHECK (cost_eur_monthly >= 0),
  ADD COLUMN IF NOT EXISTS eur_per_usd numeric(10,6) NOT NULL DEFAULT 1
    CHECK (eur_per_usd > 0),
  ADD COLUMN IF NOT EXISTS voice_cost_usd_per_minute numeric(10,6) NOT NULL DEFAULT 0.12
    CHECK (voice_cost_usd_per_minute >= 0),
  ADD COLUMN IF NOT EXISTS ai_cost_usd_per_minute_estimate numeric(10,6) NOT NULL DEFAULT 0.05
    CHECK (ai_cost_usd_per_minute_estimate >= 0),
  ADD COLUMN IF NOT EXISTS fixed_cost_usd_monthly numeric(12,6) NOT NULL DEFAULT 0
    CHECK (fixed_cost_usd_monthly >= 0),
  ADD COLUMN IF NOT EXISTS plan_profile text,
  ADD COLUMN IF NOT EXISTS config_source text;

COMMENT ON COLUMN public.bot_usage_limits.cost_eur_monthly IS
  'Interne Obergrenze der Anbieterkosten (KI + Telefonie + Fixkosten) je Kalendermonat in EUR. 0 = keine kostenpflichtige Nutzung. Kein Preis, nicht fakturiert.';
COMMENT ON COLUMN public.bot_usage_limits.eur_per_usd IS
  'Fester Umrechnungssatz für die Kostenbremse. 1 = vorsichtig (überschätzt EUR-Kosten).';
COMMENT ON COLUMN public.bot_usage_limits.voice_cost_usd_per_minute IS
  'Geschätzte Telefoniekosten je Minute (Anbieter). Schätzung, nicht gemessen.';
COMMENT ON COLUMN public.bot_usage_limits.ai_cost_usd_per_minute_estimate IS
  'Geschätzter KI-Anteil je Gesprächsminute, nur zur Planung der Anrufdauer. Die KI wird je Schritt gemessen.';

-- ============================================================
-- 2. Beschlossene Tarifwerte
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bot_usage_plan_profiles (
  plan_key               text PRIMARY KEY CHECK (plan_key IN ('starter', 'growth', 'agency')),
  voice_minutes_monthly  integer       NOT NULL CHECK (voice_minutes_monthly > 0),
  cost_eur_monthly       numeric(12,6) NOT NULL CHECK (cost_eur_monthly > 0),
  fixed_cost_usd_monthly numeric(12,6) NOT NULL DEFAULT 0 CHECK (fixed_cost_usd_monthly >= 0),
  decided_at             date          NOT NULL,
  decided_by             text          NOT NULL,
  note                   text
);

ALTER TABLE public.bot_usage_plan_profiles ENABLE ROW LEVEL SECURITY;
-- Keine Policies: nur service_role.

COMMENT ON TABLE public.bot_usage_plan_profiles IS
  'Beschlossene Kostenbremsen je Tarif (Owner 28.10.2026). Enterprise bewusst nicht enthalten: nur ausdrücklich konfigurierte Werte. Keine Preise, keine Entitlements.';

INSERT INTO public.bot_usage_plan_profiles
  (plan_key, voice_minutes_monthly, cost_eur_monthly, fixed_cost_usd_monthly, decided_at, decided_by, note)
VALUES
  ('starter',  60,  8, 1.35, DATE '2026-10-28', 'owner', 'Freigabe zur technischen Vorbereitung, nicht zur Abrechnung'),
  ('growth',  250, 30, 1.35, DATE '2026-10-28', 'owner', 'Freigabe zur technischen Vorbereitung, nicht zur Abrechnung'),
  ('agency',  750, 90, 1.35, DATE '2026-10-28', 'owner', 'Freigabe zur technischen Vorbereitung, nicht zur Abrechnung')
ON CONFLICT (plan_key) DO NOTHING;

-- Tarifwerte (oder Nullzeile) auf einen Mandanten anwenden.
-- p_plan_key NULL → Nullzeile (keine kostenpflichtige Nutzung).
-- Behält voice_max_* und die Kostensätze einer bestehenden Zeile.
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

  INSERT INTO public.bot_usage_limits AS l
    (tenant_id, ai_usd_daily, ai_usd_monthly, voice_seconds_monthly, cost_eur_monthly,
     fixed_cost_usd_monthly, plan_profile, config_source, updated_at)
  VALUES
    (p_tenant_id,
     coalesce(v_p.cost_eur_monthly, 0), coalesce(v_p.cost_eur_monthly, 0),
     coalesce(v_p.voice_minutes_monthly, 0) * 60, coalesce(v_p.cost_eur_monthly, 0),
     coalesce(v_p.fixed_cost_usd_monthly, 0), p_plan_key, p_source, now())
  ON CONFLICT (tenant_id) DO UPDATE SET
    -- KI-USD-Deckel = Eurodeckel umgerechnet (KI ist Teil der Gesamtkosten).
    ai_usd_daily           = EXCLUDED.cost_eur_monthly / l.eur_per_usd,
    ai_usd_monthly         = EXCLUDED.cost_eur_monthly / l.eur_per_usd,
    voice_seconds_monthly  = EXCLUDED.voice_seconds_monthly,
    cost_eur_monthly       = EXCLUDED.cost_eur_monthly,
    fixed_cost_usd_monthly = EXCLUDED.fixed_cost_usd_monthly,
    plan_profile           = EXCLUDED.plan_profile,
    config_source          = EXCLUDED.config_source,
    updated_at             = now();
END;
$$;

-- ============================================================
-- 3. Eurokosten einer Periode
-- ============================================================
-- NULL, wenn der Mandant keine Zeile hat (Aufrufer lehnen dann ab).
CREATE OR REPLACE FUNCTION public.bot_usage_cost_eur_used(
  p_tenant_id uuid,
  p_since     timestamptz
) RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.eur_per_usd * (
           public.bot_usage_used(p_tenant_id, 'ai_usd', p_since)
         + public.bot_usage_used(p_tenant_id, 'voice_seconds', p_since) / 60.0 * l.voice_cost_usd_per_minute
         + l.fixed_cost_usd_monthly)
    FROM public.bot_usage_limits l
   WHERE l.tenant_id = p_tenant_id;
$$;

-- ============================================================
-- 4. KI-Budget: Option A (#2044) + Eurodeckel
-- ============================================================
-- Gleiche Signatur und Rückgabe. Neuer deny-Grund: 'cost_budget'.
CREATE OR REPLACE FUNCTION public.bot_ai_budget_reserve(
  p_tenant_id     uuid,
  p_bot_id        uuid,
  p_request_ref   text,
  p_max_usd       numeric,
  p_metadata      jsonb DEFAULT '{}'::jsonb
) RETURNS TABLE (
  decision        text,
  reservation_id  uuid,
  reserved_amount numeric,
  reason          text,
  used_day        numeric,
  used_month      numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_channel        text := p_metadata->>'channel';
  v_lim            public.bot_usage_limits%ROWTYPE;
  v_cap_daily      numeric;
  v_cap_monthly    numeric;
  v_day            timestamptz := date_trunc('day', now());
  v_month          timestamptz := date_trunc('month', now());
  v_used_day       numeric;
  v_used_month     numeric;
  v_ch_day         numeric;
  v_ch_month       numeric;
  v_protect_day    numeric;
  v_protect_month  numeric;
  v_cost_used      numeric;
BEGIN
  PERFORM public.bot_usage_assert_internal();

  IF v_channel IS NULL OR v_channel NOT IN ('chat', 'whatsapp', 'voice', 'workspace') THEN
    RETURN QUERY SELECT 'deny'::text, NULL::uuid, NULL::numeric, 'invalid'::text, NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  -- Lock-Reihenfolge: erst Kosten (gemeinsam mit Telefon), dann Ressource
  -- (derselbe Lock wie bot_usage_reserve, reentrant).
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || 'cost', 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || 'ai_usd', 0));

  -- Wiederholte Referenz: bestehende Reservierung zurückgeben.
  IF EXISTS (SELECT 1 FROM public.bot_usage_reservations r
              WHERE r.resource = 'ai_usd' AND r.provider = 'llm' AND r.external_ref = p_request_ref) THEN
    RETURN QUERY SELECT * FROM public.bot_usage_reserve(
      p_tenant_id, p_bot_id, 'ai_usd', 'llm', p_request_ref, p_max_usd, 600,
      0, 0, NULL, p_metadata);
    RETURN;
  END IF;

  -- Option A: ohne ausdrückliche Konfiguration keine kostenpflichtige Nutzung.
  SELECT * INTO v_lim FROM public.bot_usage_limits l WHERE l.tenant_id = p_tenant_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'deny'::text, NULL::uuid, NULL::numeric, 'invalid_config'::text, NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  IF NOT public.bot_usage_config_valid(p_tenant_id) THEN
    RETURN QUERY SELECT 'deny'::text, NULL::uuid, NULL::numeric, 'invalid_config'::text, NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  IF p_max_usd IS NULL OR p_max_usd <= 0 THEN
    RETURN QUERY SELECT 'deny'::text, NULL::uuid, NULL::numeric, 'invalid'::text, NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  v_used_day   := public.bot_usage_used(p_tenant_id, 'ai_usd', v_day);
  v_used_month := public.bot_usage_used(p_tenant_id, 'ai_usd', v_month);

  -- 1. Eigene Kanalgrenze (Tag und Monat)
  SELECT c.usd_daily, c.usd_monthly INTO v_cap_daily, v_cap_monthly
    FROM public.bot_usage_channel_limits c
   WHERE c.tenant_id = p_tenant_id AND c.channel = v_channel;
  IF v_cap_daily IS NOT NULL THEN
    v_ch_day := public.bot_usage_used_channel(p_tenant_id, 'ai_usd', v_channel, v_day);
    IF v_ch_day + p_max_usd > v_cap_daily THEN
      RETURN QUERY SELECT 'deny'::text, NULL::uuid, NULL::numeric, 'channel_daily_budget'::text, v_used_day, v_used_month;
      RETURN;
    END IF;
  END IF;
  IF v_cap_monthly IS NOT NULL THEN
    v_ch_month := public.bot_usage_used_channel(p_tenant_id, 'ai_usd', v_channel, v_month);
    IF v_ch_month + p_max_usd > v_cap_monthly THEN
      RETURN QUERY SELECT 'deny'::text, NULL::uuid, NULL::numeric, 'channel_monthly_budget'::text, v_used_day, v_used_month;
      RETURN;
    END IF;
  END IF;

  -- 2. Mandantengrenze abzüglich geschützter Reserven anderer Kanäle
  v_protect_day   := public.bot_usage_protected_reserve(p_tenant_id, v_channel, 'day');
  v_protect_month := public.bot_usage_protected_reserve(p_tenant_id, v_channel, 'month');

  IF v_used_day + p_max_usd > v_lim.ai_usd_daily THEN
    RETURN QUERY SELECT 'deny'::text, NULL::uuid, NULL::numeric, 'daily_budget'::text, v_used_day, v_used_month;
    RETURN;
  END IF;
  IF v_used_month + p_max_usd > v_lim.ai_usd_monthly THEN
    RETURN QUERY SELECT 'deny'::text, NULL::uuid, NULL::numeric, 'monthly_budget'::text, v_used_day, v_used_month;
    RETURN;
  END IF;
  IF v_used_day + p_max_usd > v_lim.ai_usd_daily - v_protect_day
     OR v_used_month + p_max_usd > v_lim.ai_usd_monthly - v_protect_month THEN
    RETURN QUERY SELECT 'deny'::text, NULL::uuid, NULL::numeric, 'protected_reserve'::text, v_used_day, v_used_month;
    RETURN;
  END IF;

  -- 3. Eurodeckel über alle Kosten des Monats (KI + Telefonie + fix)
  v_cost_used := public.bot_usage_cost_eur_used(p_tenant_id, v_month);
  IF v_cost_used + p_max_usd * v_lim.eur_per_usd > v_lim.cost_eur_monthly THEN
    RETURN QUERY SELECT 'deny'::text, NULL::uuid, NULL::numeric, 'cost_budget'::text, v_used_day, v_used_month;
    RETURN;
  END IF;

  RETURN QUERY SELECT * FROM public.bot_usage_reserve(
    p_tenant_id, p_bot_id, 'ai_usd', 'llm', p_request_ref, p_max_usd, 600,
    v_lim.ai_usd_daily - v_protect_day, v_lim.ai_usd_monthly - v_protect_month, NULL,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('channel', v_channel));
END;
$$;

-- ============================================================
-- 5. Telefon: Option A (#2044) + Eurodeckel
-- ============================================================
-- Gleiche Signatur und Rückgabe. Neuer deny-Grund: 'cost_budget'.
CREATE OR REPLACE FUNCTION public.bot_voice_call_reserve(
  p_tenant_id             uuid,
  p_bot_id                uuid,
  p_provider              text,
  p_call_ref              text,
  p_plan_seconds_monthly  numeric,
  p_metadata              jsonb DEFAULT '{}'::jsonb
) RETURNS TABLE (
  decision        text,
  reservation_id  uuid,
  reserved_amount numeric,
  reason          text,
  used_day        numeric,
  used_month      numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lim         public.bot_usage_limits%ROWTYPE;
  v_month       timestamptz := date_trunc('month', now());
  v_cap         numeric;
  v_amount      numeric;
  v_remaining   numeric;
  v_rate        numeric;
  v_cost_left   numeric;
  v_affordable  numeric;
  v_existing    public.bot_usage_reservations%ROWTYPE;
BEGIN
  PERFORM public.bot_usage_assert_internal();

  SELECT * INTO v_existing FROM public.bot_usage_reservations r
   WHERE r.resource = 'voice_seconds' AND r.provider = p_provider AND r.external_ref = p_call_ref;
  IF FOUND THEN
    IF v_existing.tenant_id <> p_tenant_id THEN
      RETURN QUERY SELECT 'deny'::text, NULL::uuid, NULL::numeric, 'invalid'::text, NULL::numeric, NULL::numeric;
    ELSE
      RETURN QUERY SELECT 'existing'::text, v_existing.id, v_existing.reserved_amount,
                          v_existing.status, NULL::numeric, NULL::numeric;
    END IF;
    RETURN;
  END IF;

  -- Lock-Reihenfolge wie bei der KI: erst Kosten, dann Ressource (in
  -- bot_usage_reserve).
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || 'cost', 0));

  -- Option A: ohne Mandantenzeile oder ohne Kontingent kein Anruf. Das gilt
  -- auch bei Plan „unbegrenzt“ (p_plan_seconds_monthly IS NULL).
  SELECT * INTO v_lim FROM public.bot_usage_limits l WHERE l.tenant_id = p_tenant_id;
  IF NOT FOUND OR v_lim.voice_seconds_monthly IS NULL OR v_lim.voice_seconds_monthly <= 0 THEN
    RETURN QUERY SELECT 'deny'::text, NULL::uuid, NULL::numeric, 'invalid_config'::text, NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  -- Es gilt der kleinere Wert aus Plan und Mandantenkonfiguration.
  v_cap := CASE WHEN p_plan_seconds_monthly IS NULL THEN v_lim.voice_seconds_monthly
                ELSE least(p_plan_seconds_monthly, v_lim.voice_seconds_monthly) END;

  -- Ein Rest unter 60 Sekunden wird nicht angebrochen.
  v_remaining := v_cap - public.bot_usage_used(p_tenant_id, 'voice_seconds', v_month);
  v_amount := least(v_lim.voice_max_call_seconds, floor(v_remaining));
  IF v_amount < 60 THEN
    RETURN QUERY SELECT 'deny'::text, NULL::uuid, NULL::numeric, 'monthly_budget'::text, NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  -- Euro: Dauer so begrenzen, dass Telefonie UND geschätzte KI je Minute in
  -- den Restdeckel passen. Reserviert wird nur die Telefonie (Sekunden); die
  -- KI reserviert je Schritt selbst gegen denselben Deckel.
  v_rate := v_lim.voice_cost_usd_per_minute + v_lim.ai_cost_usd_per_minute_estimate;
  v_cost_left := v_lim.cost_eur_monthly - public.bot_usage_cost_eur_used(p_tenant_id, v_month);
  IF v_rate > 0 THEN
    v_affordable := floor(greatest(v_cost_left, 0) / v_lim.eur_per_usd / v_rate * 60);
  ELSE
    -- Ohne Kostensatz begrenzt nur ein positiver Restdeckel überhaupt.
    v_affordable := CASE WHEN v_cost_left > 0 THEN v_amount ELSE 0 END;
  END IF;
  IF v_affordable < 60 THEN
    RETURN QUERY SELECT 'deny'::text, NULL::uuid, NULL::numeric, 'cost_budget'::text, NULL::numeric, NULL::numeric;
    RETURN;
  END IF;
  v_amount := least(v_amount, v_affordable);

  RETURN QUERY SELECT * FROM public.bot_usage_reserve(
    p_tenant_id, p_bot_id, 'voice_seconds', p_provider, p_call_ref, v_amount,
    v_amount::integer + 900, NULL, v_cap, v_lim.voice_max_concurrent_calls,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'channel', 'voice',
      -- Kostensätze zum Reservierungszeitpunkt: Grundlage der Kostensicht.
      'voice_cost_usd_per_minute', v_lim.voice_cost_usd_per_minute,
      'eur_per_usd', v_lim.eur_per_usd));
END;
$$;

-- ============================================================
-- 6. Kosten je Gespräch
-- ============================================================
-- Je Telefon-Reservierung: Sekunden aus dem Ledger, Telefonie zum Satz der
-- Reservierung (SCHÄTZUNG, bis der Anbieterpreis nachgebucht wird) und
-- gemessene KI-Kosten der Schritte mit derselben call_ref. Nicht fakturiert.
CREATE OR REPLACE VIEW public.bot_voice_call_costs
WITH (security_invoker = true) AS
SELECT
  r.tenant_id,
  r.bot_id,
  r.external_ref                                   AS call_ref,
  r.provider,
  r.created_at,
  r.status,
  r.close_reason,
  coalesce(v.seconds, 0)                           AS seconds,
  v.origin                                         AS seconds_origin,
  round(coalesce(v.seconds, 0) / 60.0
        * coalesce((r.metadata->>'voice_cost_usd_per_minute')::numeric, 0), 6) AS telephony_usd_estimated,
  coalesce(a.ai_usd, 0)                            AS ai_usd,
  round(coalesce((r.metadata->>'eur_per_usd')::numeric, 1) * (
          coalesce(v.seconds, 0) / 60.0 * coalesce((r.metadata->>'voice_cost_usd_per_minute')::numeric, 0)
        + coalesce(a.ai_usd, 0)), 6)               AS total_eur_estimated
FROM public.bot_usage_reservations r
LEFT JOIN LATERAL (
  SELECT sum(l.amount) AS seconds,
         string_agg(DISTINCT l.origin, '+' ORDER BY l.origin) AS origin
    FROM public.bot_usage_ledger l
   WHERE l.reservation_id = r.id
) v ON true
LEFT JOIN LATERAL (
  SELECT sum(l.amount) AS ai_usd
    FROM public.bot_usage_reservations ar
    JOIN public.bot_usage_ledger l ON l.reservation_id = ar.id
   WHERE ar.tenant_id = r.tenant_id
     AND ar.resource = 'ai_usd'
     AND ar.metadata->>'call_ref' = r.external_ref
) a ON true
WHERE r.resource = 'voice_seconds';

COMMENT ON VIEW public.bot_voice_call_costs IS
  'Kosten je Gespräch: Sekunden aus dem Ledger, Telefonie zum Satz der Reservierung (Schätzung), KI gemessen. Interne Kostenkontrolle, nicht fakturiert, nicht mit Stripe verbunden.';

CREATE INDEX IF NOT EXISTS bot_usage_reservations_call_ref_idx
  ON public.bot_usage_reservations (tenant_id, (metadata->>'call_ref'))
  WHERE resource = 'ai_usd';

-- ============================================================
-- 7. Seed: genau eine explizite Zeile je bestehendem Mandanten
-- ============================================================
-- Tarifwerte nur bei status 'active' und Tarif mit Profil (starter, growth,
-- agency). Alle anderen → Nullzeile. Bestehende Zeilen bleiben unverändert.
-- Der Seed bucht nichts. Idempotent; liefert die Zahl neu angelegter Zeilen.
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
         coalesce(p.cost_eur_monthly, 0),
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
      ON p.plan_key = s.plan_key AND s.status = 'active'
  ON CONFLICT (tenant_id) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Migration läuft als Datenbank-Owner (bot_usage_assert_internal erlaubt
-- session_user = postgres).
SELECT public.bot_usage_seed_missing_limits('seed:20261028100000');

-- ============================================================
-- 8. Rechte: nur service_role
-- ============================================================
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.bot_usage_apply_plan_profile(uuid,text,text)',
    'public.bot_usage_cost_eur_used(uuid,timestamptz)',
    'public.bot_usage_seed_missing_limits(text)',
    'public.bot_ai_budget_reserve(uuid,uuid,text,numeric,jsonb)',
    'public.bot_voice_call_reserve(uuid,uuid,text,text,numeric,jsonb)'
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
  REVOKE ALL ON public.bot_usage_plan_profiles FROM anon, authenticated;
  REVOKE ALL ON public.bot_voice_call_costs FROM anon, authenticated;
  GRANT SELECT ON public.bot_voice_call_costs TO authenticated;
EXCEPTION WHEN undefined_object THEN
  RAISE NOTICE 'Rollen anon/authenticated fehlen (lokale Testdatenbank) — Grants übersprungen.';
END $$;

COMMIT;
