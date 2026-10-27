-- Bot-Kanäle: Kanalgrenzen, geschützte Kanalreserve, zentraler Fallback,
-- Telefon-Durchsetzung beim Anbieter (Nacharbeit PR #2044, Gate 1 + Gate 4)
--
-- ADDITIV auf 20261027120000_bot_usage_budget_hardening.sql:
--   * neue Tabelle bot_usage_channel_limits
--   * neue Spalte bot_usage_reservations.channel (+ Trigger, Backfill)
--   * neue Funktionen; bot_ai_budget_reserve und bot_voice_call_reserve
--     werden per CREATE OR REPLACE mit gleicher Signatur ersetzt
--   * ein pg_cron-Job (bot-voice-enforcer, jede Minute)
-- Keine Preis-, Stripe- oder Entitlement-Zeile wird verändert.
--
-- ⚠️ BUDGETWERTE UNBESCHLOSSEN — MERGE-BLOCKER
-- bot_usage_fallback() liefert die vorläufigen Sicherheitsobergrenzen
-- (5 USD/Tag, 50 USD/Monat, 2 parallele Anrufe, 600 s je Anruf). Sie sind
-- kein Preis, kein Kontingent und kein Kundenversprechen. Sie stehen in der Vorgängermigration an
-- GENAU EINER Stelle; Tabellen-Defaults und Reservierungsfunktionen lesen
-- sie von dort. Die Werte bleiben bis zur Entscheidung des Owners
-- unverändert (Option A: ohne Konfiguration keine kostenpflichtige Nutzung;
-- Option B: vorläufige Sicherheitsobergrenze). Fehlende oder ungültige
-- Konfiguration führt nie zu unbegrenzter Nutzung.
--
-- Kanalregeln (KI-Budget, Ressource ai_usd)
--   * Jede Reservierung trägt einen Kanal: chat | whatsapp | voice | workspace.
--     Fehlender oder unbekannter Kanal → Ablehnung ('invalid').
--   * Geprüft werden in EINER atomaren Reservierung (Advisory-Lock je Mandant
--     + Ressource) für Tag UND Monat jeweils:
--       1. Kanalgrenze (falls gesetzt)
--       2. Mandantengrenze abzüglich der noch nicht verbrauchten Reserven
--          ANDERER Kanäle
--   * Nicht verbrauchte Reserve eines Kanals =
--       Reserve − abgerechneter Verbrauch − offen reservierter Verbrauch
--     des Kanals in der jeweiligen Periode (nie < 0).
--   * Summe der Reserven > Mandantengrenze → Konfiguration wird beim
--     Schreiben abgewiesen und bei der Reservierung mit 'invalid_config'
--     abgelehnt.

BEGIN;

-- ============================================================
-- 1. Zentraler Fallback (vorläufig, unbeschlossen)
-- ============================================================
-- Bereits in 20261027120000 definiert; alle Defaults lesen dort.

-- ============================================================
-- 2. Kanalgrenzen und geschützte Reserven
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bot_usage_channel_limits (
  tenant_id             uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel               text NOT NULL CHECK (channel IN ('chat', 'whatsapp', 'voice', 'workspace')),
  -- NULL = keine eigene Kanalgrenze (die Mandantengrenze gilt immer).
  usd_daily             numeric(12,6) CHECK (usd_daily IS NULL OR usd_daily >= 0),
  usd_monthly           numeric(12,6) CHECK (usd_monthly IS NULL OR usd_monthly >= 0),
  -- Geschützter Anteil: andere Kanäle dürfen ihn nicht aufbrauchen.
  reserved_usd_daily    numeric(12,6) NOT NULL DEFAULT 0 CHECK (reserved_usd_daily >= 0),
  reserved_usd_monthly  numeric(12,6) NOT NULL DEFAULT 0 CHECK (reserved_usd_monthly >= 0),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, channel),
  CONSTRAINT bot_usage_channel_reserve_within_cap_daily
    CHECK (usd_daily IS NULL OR reserved_usd_daily <= usd_daily),
  CONSTRAINT bot_usage_channel_reserve_within_cap_monthly
    CHECK (usd_monthly IS NULL OR reserved_usd_monthly <= usd_monthly)
);

ALTER TABLE public.bot_usage_channel_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bot_usage_channel_limits tenant-read" ON public.bot_usage_channel_limits;
CREATE POLICY "bot_usage_channel_limits tenant-read" ON public.bot_usage_channel_limits
  FOR SELECT USING (public.is_tenant_member(tenant_id));

COMMENT ON TABLE public.bot_usage_channel_limits IS
  'Kanalgrenzen und geschützte Reserven für das KI-Budget der Bot-Kanäle. Werte unbeschlossen; keine Preise, keine Entitlements. Änderung nur per service_role.';

-- Summe der Reserven darf die Mandantengrenze nicht übersteigen.
CREATE OR REPLACE FUNCTION public.bot_usage_config_valid(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH t AS (
    SELECT coalesce((SELECT l.ai_usd_daily   FROM public.bot_usage_limits l WHERE l.tenant_id = p_tenant_id),
                    public.bot_usage_fallback('ai_usd_daily'))   AS daily,
           coalesce((SELECT l.ai_usd_monthly FROM public.bot_usage_limits l WHERE l.tenant_id = p_tenant_id),
                    public.bot_usage_fallback('ai_usd_monthly')) AS monthly
  ), r AS (
    SELECT coalesce(sum(c.reserved_usd_daily), 0)   AS daily,
           coalesce(sum(c.reserved_usd_monthly), 0) AS monthly
      FROM public.bot_usage_channel_limits c WHERE c.tenant_id = p_tenant_id
  )
  SELECT r.daily <= t.daily AND r.monthly <= t.monthly FROM t, r;
$$;

CREATE OR REPLACE FUNCTION public.bot_usage_validate_config_trg()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT public.bot_usage_config_valid(NEW.tenant_id) THEN
    RAISE EXCEPTION 'bot usage config invalid: reserved channel budget exceeds tenant limit (tenant %)', NEW.tenant_id
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS bot_usage_channel_limits_validate ON public.bot_usage_channel_limits;
CREATE CONSTRAINT TRIGGER bot_usage_channel_limits_validate
  AFTER INSERT OR UPDATE ON public.bot_usage_channel_limits
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW EXECUTE FUNCTION public.bot_usage_validate_config_trg();

DROP TRIGGER IF EXISTS bot_usage_limits_validate ON public.bot_usage_limits;
CREATE CONSTRAINT TRIGGER bot_usage_limits_validate
  AFTER INSERT OR UPDATE ON public.bot_usage_limits
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW EXECUTE FUNCTION public.bot_usage_validate_config_trg();

-- ============================================================
-- 3. Kanal je Reservierung
-- ============================================================
ALTER TABLE public.bot_usage_reservations ADD COLUMN IF NOT EXISTS channel text;

CREATE OR REPLACE FUNCTION public.bot_usage_reservation_channel_trg()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.channel := coalesce(
    NEW.channel,
    NEW.metadata->>'channel',
    CASE WHEN NEW.resource = 'voice_seconds' THEN 'voice' END
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bot_usage_reservations_channel ON public.bot_usage_reservations;
CREATE TRIGGER bot_usage_reservations_channel
  BEFORE INSERT ON public.bot_usage_reservations
  FOR EACH ROW EXECUTE FUNCTION public.bot_usage_reservation_channel_trg();

-- Backfill für Reservierungen, die vor dieser Migration entstanden sind.
UPDATE public.bot_usage_reservations
   SET channel = coalesce(metadata->>'channel', CASE WHEN resource = 'voice_seconds' THEN 'voice' END)
 WHERE channel IS NULL;

CREATE INDEX IF NOT EXISTS bot_usage_reservations_channel_idx
  ON public.bot_usage_reservations (tenant_id, resource, channel, created_at);

-- ============================================================
-- 4. Verbrauch eines Kanals (Ledger + offene Reservierungen)
-- ============================================================
-- Ledger-Einträge (inkl. Korrekturen) erben den Kanal über reservation_id.
CREATE OR REPLACE FUNCTION public.bot_usage_used_channel(
  p_tenant_id uuid,
  p_resource  text,
  p_channel   text,
  p_since     timestamptz
) RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    coalesce((SELECT sum(l.amount)
                FROM public.bot_usage_ledger l
                JOIN public.bot_usage_reservations r ON r.id = l.reservation_id
               WHERE l.tenant_id = p_tenant_id AND l.resource = p_resource
                 AND r.channel = p_channel AND l.usage_at >= p_since), 0)
  + coalesce((SELECT sum(r.reserved_amount)
                FROM public.bot_usage_reservations r
               WHERE r.tenant_id = p_tenant_id AND r.resource = p_resource
                 AND r.channel = p_channel AND r.status = 'open'
                 AND r.created_at >= p_since), 0);
$$;

-- Noch nicht verbrauchte Reserven aller ANDEREN Kanäle in einer Periode.
CREATE OR REPLACE FUNCTION public.bot_usage_protected_reserve(
  p_tenant_id uuid,
  p_channel   text,
  p_period    text   -- 'day' | 'month'
) RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(sum(greatest(
           CASE WHEN p_period = 'day' THEN c.reserved_usd_daily ELSE c.reserved_usd_monthly END
           - public.bot_usage_used_channel(p_tenant_id, 'ai_usd', c.channel, date_trunc(p_period, now())),
           0)), 0)
    FROM public.bot_usage_channel_limits c
   WHERE c.tenant_id = p_tenant_id
     AND c.channel <> p_channel
     AND (CASE WHEN p_period = 'day' THEN c.reserved_usd_daily ELSE c.reserved_usd_monthly END) > 0;
$$;

-- ============================================================
-- 5. KI-Budget: Mandant + Kanal + geschützte Reserven (ersetzt PR-A-Fassung)
-- ============================================================
-- Gleiche Signatur und Rückgabe wie in 20261027120000. Neue deny-Gründe:
--   'channel_daily_budget' | 'channel_monthly_budget' | 'protected_reserve'
--   | 'invalid_config'
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
  v_daily          numeric;
  v_monthly        numeric;
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
BEGIN
  PERFORM public.bot_usage_assert_internal();

  IF v_channel IS NULL OR v_channel NOT IN ('chat', 'whatsapp', 'voice', 'workspace') THEN
    RETURN QUERY SELECT 'deny'::text, NULL::uuid, NULL::numeric, 'invalid'::text, NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  -- Derselbe Lock wie bot_usage_reserve (reentrant in derselben Transaktion):
  -- alle Prüfungen unten sehen einen konsistenten Stand.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || 'ai_usd', 0));

  -- Wiederholte Referenz: bestehende Reservierung zurückgeben, ohne erneut
  -- zu prüfen (bot_usage_reserve liefert 'existing').
  IF EXISTS (SELECT 1 FROM public.bot_usage_reservations r
              WHERE r.resource = 'ai_usd' AND r.provider = 'llm' AND r.external_ref = p_request_ref) THEN
    RETURN QUERY SELECT * FROM public.bot_usage_reserve(
      p_tenant_id, p_bot_id, 'ai_usd', 'llm', p_request_ref, p_max_usd, 600,
      0, 0, NULL, p_metadata);
    RETURN;
  END IF;

  SELECT l.ai_usd_daily, l.ai_usd_monthly INTO v_daily, v_monthly
    FROM public.bot_usage_limits l WHERE l.tenant_id = p_tenant_id;
  IF NOT FOUND THEN
    v_daily   := public.bot_usage_fallback('ai_usd_daily');
    v_monthly := public.bot_usage_fallback('ai_usd_monthly');
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

  IF v_used_day + p_max_usd > v_daily THEN
    RETURN QUERY SELECT 'deny'::text, NULL::uuid, NULL::numeric, 'daily_budget'::text, v_used_day, v_used_month;
    RETURN;
  END IF;
  IF v_used_month + p_max_usd > v_monthly THEN
    RETURN QUERY SELECT 'deny'::text, NULL::uuid, NULL::numeric, 'monthly_budget'::text, v_used_day, v_used_month;
    RETURN;
  END IF;
  IF v_used_day + p_max_usd > v_daily - v_protect_day
     OR v_used_month + p_max_usd > v_monthly - v_protect_month THEN
    RETURN QUERY SELECT 'deny'::text, NULL::uuid, NULL::numeric, 'protected_reserve'::text, v_used_day, v_used_month;
    RETURN;
  END IF;

  -- TTL 10 Minuten wie bisher. bot_usage_reserve prüft unter demselben Lock
  -- noch einmal gegen die um die Reserven verminderte Mandantengrenze.
  RETURN QUERY SELECT * FROM public.bot_usage_reserve(
    p_tenant_id, p_bot_id, 'ai_usd', 'llm', p_request_ref, p_max_usd, 600,
    v_daily - v_protect_day, v_monthly - v_protect_month, NULL,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('channel', v_channel));
END;
$$;

-- ============================================================
-- 6. Telefon-Reservierung: Fallback zentral (ersetzt PR-A-Fassung)
-- ============================================================
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
  v_max_call   integer;
  v_concurrent integer;
  v_amount     numeric;
  v_remaining  numeric;
  v_existing   public.bot_usage_reservations%ROWTYPE;
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

  SELECT l.voice_max_call_seconds, l.voice_max_concurrent_calls INTO v_max_call, v_concurrent
    FROM public.bot_usage_limits l WHERE l.tenant_id = p_tenant_id;
  IF NOT FOUND THEN
    v_max_call   := public.bot_usage_fallback('voice_max_call_seconds')::integer;
    v_concurrent := public.bot_usage_fallback('voice_max_concurrent_calls')::integer;
  END IF;

  v_amount := v_max_call;
  IF p_plan_seconds_monthly IS NOT NULL THEN
    v_remaining := p_plan_seconds_monthly
                 - public.bot_usage_used(p_tenant_id, 'voice_seconds', date_trunc('month', now()));
    v_amount := least(v_amount, floor(v_remaining));
    IF v_amount < 60 THEN
      RETURN QUERY SELECT 'deny'::text, NULL::uuid, NULL::numeric, 'monthly_budget'::text, NULL::numeric, NULL::numeric;
      RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT * FROM public.bot_usage_reserve(
    p_tenant_id, p_bot_id, 'voice_seconds', p_provider, p_call_ref, v_amount,
    v_amount::integer + 900, NULL, p_plan_seconds_monthly, v_concurrent,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('channel', 'voice'));
END;
$$;

-- ============================================================
-- 7. Telefon: Durchsetzung beim Anbieter (Gate 1)
-- ============================================================
-- Liefert offene Twilio-Anrufe, deren reservierte Dauer abzüglich
-- p_lead_seconds erreicht ist. Der Worker beendet sie beim Anbieter,
-- unabhängig davon, ob noch ein Gesprächsschritt eintrifft.
-- Abrechnung bleibt beim Status-Callback bzw. beim Aufräumjob — hier wird
-- weder abgerechnet noch freigegeben.
CREATE OR REPLACE FUNCTION public.bot_voice_overdue_calls(
  p_lead_seconds  integer,
  p_max_attempts  integer,
  p_limit         integer
) RETURNS TABLE (
  reservation_id  uuid,
  tenant_id       uuid,
  call_ref        text,
  account_sid     text,
  attempts        integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.bot_usage_assert_internal();
  IF p_lead_seconds IS NULL OR p_lead_seconds < 0 OR p_max_attempts IS NULL OR p_max_attempts < 1
     OR p_limit IS NULL OR p_limit < 1 THEN
    RAISE EXCEPTION 'invalid arguments' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT r.id, r.tenant_id, r.external_ref, r.metadata->>'account_sid',
           coalesce((r.metadata->>'hangup_attempts')::integer, 0)
      FROM public.bot_usage_reservations r
     WHERE r.resource = 'voice_seconds' AND r.provider = 'twilio' AND r.status = 'open'
       AND r.created_at + make_interval(secs => greatest(r.reserved_amount - p_lead_seconds, 0)) <= now()
       AND coalesce((r.metadata->>'hangup_done')::boolean, false) = false
       AND coalesce((r.metadata->>'hangup_attempts')::integer, 0) < p_max_attempts
     ORDER BY r.created_at
     LIMIT p_limit;
END;
$$;

-- Protokolliert einen Beendigungsversuch an der Reservierung (nur metadata;
-- Status, Betrag und Ledger bleiben unberührt).
CREATE OR REPLACE FUNCTION public.bot_voice_record_hangup(
  p_reservation_id uuid,
  p_done           boolean,
  p_result         text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  PERFORM public.bot_usage_assert_internal();
  UPDATE public.bot_usage_reservations
     SET metadata = metadata || jsonb_build_object(
           'hangup_attempts', coalesce((metadata->>'hangup_attempts')::integer, 0) + 1,
           'hangup_done', coalesce((metadata->>'hangup_done')::boolean, false) OR coalesce(p_done, false),
           'hangup_last_result', left(coalesce(p_result, ''), 120),
           'hangup_last_at', now())
   WHERE id = p_reservation_id AND resource = 'voice_seconds';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END;
$$;

-- ============================================================
-- 8. Rechte: nur service_role
-- ============================================================
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.bot_usage_config_valid(uuid)',
    'public.bot_usage_used_channel(uuid,text,text,timestamptz)',
    'public.bot_usage_protected_reserve(uuid,text,text)',
    'public.bot_ai_budget_reserve(uuid,uuid,text,numeric,jsonb)',
    'public.bot_voice_call_reserve(uuid,uuid,text,text,numeric,jsonb)',
    'public.bot_voice_overdue_calls(integer,integer,integer)',
    'public.bot_voice_record_hangup(uuid,boolean,text)'
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
  REVOKE ALL ON public.bot_usage_channel_limits FROM anon;
  GRANT SELECT ON public.bot_usage_channel_limits TO authenticated;
  REVOKE INSERT, UPDATE, DELETE ON public.bot_usage_channel_limits FROM authenticated;
EXCEPTION WHEN undefined_object THEN
  RAISE NOTICE 'Rollen anon/authenticated fehlen (lokale Testdatenbank) — Grants übersprungen.';
END $$;

COMMIT;

-- ============================================================
-- 9. pg_cron: Telefon-Durchsetzung jede Minute
-- ============================================================
-- Muster wie 20260912180000_cron_trio_dedicated_keys.sql: dispatch_cron_function
-- mit dediziertem Vault-Secret, NICHT service_role_key.
--
--   Job                 Function             Vault-Secret                  Function Secret
--   bot-voice-enforcer  bot-voice-enforcer   cron_bot_voice_enforcer_key   CRON_BOT_VOICE_ENFORCER_KEY
--
-- Betreiberschritt vor Aktivierung (nur Namen, keine Werte): beide Secrets
-- mit demselben Wert anlegen (docs/runbooks/cron-vault-secrets.md). Fehlt
-- eines, antwortet die Function fail-closed mit 500/401 — dann greift nur
-- die TimeLimit-Ebene und die Zeitprüfung je Gesprächsschritt.
DO $$
BEGIN
  PERFORM cron.schedule(
    'bot-voice-enforcer',
    '* * * * *',
    $job$ SELECT public.dispatch_cron_function(
            'bot-voice-enforcer',
            'cron_bot_voice_enforcer_key') $job$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'cron.schedule (bot-voice-enforcer) uebersprungen (pg_cron nicht aktiv).';
END $$;
