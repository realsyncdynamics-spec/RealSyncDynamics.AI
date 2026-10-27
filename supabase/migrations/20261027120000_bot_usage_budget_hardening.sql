-- Bot-Kanäle: Budget-Reservierung, Telefon-Kontingent, Rate-Limit (PR A)
--
-- Ziel: Öffentliche Bot-Kanäle (bot-chat, bot-voice-webhook, whatsapp-webhook)
-- dürfen das Budget eines Mandanten nicht überschreiten — auch nicht unter
-- parallelen Anfragen, wiederholten Webhooks oder fehlenden Abschluss-Events.
--
-- ADDITIV. Neue Tabellen, neue Funktionen, ein pg_cron-Job. Keine bestehende
-- Tabelle, Policy, Funktion, Preis-, Stripe- oder Entitlement-Zeile wird
-- verändert. Bestehende usage_events/usage_totals bleiben unberührt.
--
-- Bausteine
--   bot_usage_limits        Schutzwerte je Mandant (fehlende Zeile = Defaults)
--   bot_usage_reservations  Offene Reservierungen (Zustand: open → settled | released)
--   bot_usage_ledger        Append-only-Verbrauch mit Herkunft
--                           measured | estimated | corrected
--   bot_rate_buckets        Zähler je Schlüssel und Zeitfenster (Rate-Limit)
--
-- Regeln (Abnahmekriterien PR A)
--   * Reservierung atomar je (Mandant, Ressource) über pg_advisory_xact_lock.
--   * Budget = Summe ALLER Ledger-Einträge + Summe offener Reservierungen.
--   * Eine Reservierung wird höchstens einmal abgerechnet (Unique-Index).
--   * Wiederholte Webhooks: event_key ist eindeutig (Unique-Index).
--   * Freigabe ohne Ledger-Eintrag nur, wenn der Aufrufer nachweislich keinen
--     Verbrauch ausgelöst hat (bot_usage_release). Alles Unklare wird zum
--     reservierten Höchstbetrag als 'estimated' angerechnet.
--   * Abgelaufene offene Reservierungen schließt bot_usage_sweep_expired()
--     als 'estimated' (pg_cron, alle 5 Minuten).
--   * Korrektur = neuer Eintrag 'corrected' mit Verweis und Differenzbetrag
--     (nachgewiesen − geschätzt), höchstens eine je Ursprungseintrag.
--   * Abrechnungssicht bot_usage_billable: measured + korrigierte Ketten,
--     ohne unkorrigierte Schätzungen. Nicht mit Stripe verbunden.

BEGIN;

-- ============================================================
-- 1. Schutzwerte je Mandant
-- ============================================================
-- Die Default-Werte sind vorläufige Schutzwerte (Kostenbremse), keine Preise
-- und keine Entitlements. Änderung je Mandant nur per service_role.
CREATE TABLE IF NOT EXISTS public.bot_usage_limits (
  tenant_id                   uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  ai_usd_daily                numeric(12,6) NOT NULL DEFAULT 5     CHECK (ai_usd_daily >= 0),
  ai_usd_monthly              numeric(12,6) NOT NULL DEFAULT 50    CHECK (ai_usd_monthly >= 0),
  voice_max_concurrent_calls  integer       NOT NULL DEFAULT 2     CHECK (voice_max_concurrent_calls >= 0),
  voice_max_call_seconds      integer       NOT NULL DEFAULT 600   CHECK (voice_max_call_seconds > 0),
  updated_at                  timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE public.bot_usage_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bot_usage_limits tenant-read" ON public.bot_usage_limits;
CREATE POLICY "bot_usage_limits tenant-read" ON public.bot_usage_limits
  FOR SELECT USING (public.is_tenant_member(tenant_id));

COMMENT ON TABLE public.bot_usage_limits IS
  'Vorläufige Schutzwerte für Bot-Kanäle (KI-USD je Tag/Monat, parallele Anrufe, max. Anrufdauer). Keine Preise, keine Entitlements. Fehlende Zeile = Spalten-Defaults.';

-- ============================================================
-- 2. Reservierungen
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bot_usage_reservations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bot_id           uuid,
  resource         text NOT NULL CHECK (resource IN ('ai_usd', 'voice_seconds')),
  provider         text NOT NULL CHECK (provider IN ('llm', 'twilio', 'test')),
  external_ref     text NOT NULL CHECK (length(external_ref) BETWEEN 1 AND 200),
  reserved_amount  numeric(18,6) NOT NULL CHECK (reserved_amount > 0),
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'settled', 'released')),
  expires_at       timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  closed_at        timestamptz,
  close_reason     text,
  metadata         jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Idempotenz: dieselbe Call-ID/Anfrage reserviert nie zweimal.
  CONSTRAINT bot_usage_reservations_ref_unique UNIQUE (resource, provider, external_ref)
);

CREATE INDEX IF NOT EXISTS bot_usage_reservations_open_idx
  ON public.bot_usage_reservations (tenant_id, resource, created_at)
  WHERE status = 'open';
CREATE INDEX IF NOT EXISTS bot_usage_reservations_expiry_idx
  ON public.bot_usage_reservations (expires_at)
  WHERE status = 'open';

ALTER TABLE public.bot_usage_reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bot_usage_reservations tenant-read" ON public.bot_usage_reservations;
CREATE POLICY "bot_usage_reservations tenant-read" ON public.bot_usage_reservations
  FOR SELECT USING (public.is_tenant_member(tenant_id));

-- ============================================================
-- 3. Ledger (append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bot_usage_ledger (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id          uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  resource           text NOT NULL CHECK (resource IN ('ai_usd', 'voice_seconds')),
  reservation_id     uuid REFERENCES public.bot_usage_reservations(id),
  origin             text NOT NULL CHECK (origin IN ('measured', 'estimated', 'corrected')),
  amount             numeric(18,6) NOT NULL,
  corrects_entry_id  bigint REFERENCES public.bot_usage_ledger(id),
  event_key          text,
  -- Zeitpunkt des Verbrauchs (Periodenzuordnung). Korrekturen erben ihn.
  usage_at           timestamptz NOT NULL DEFAULT now(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  evidence           jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT bot_usage_ledger_correction_link CHECK ((origin = 'corrected') = (corrects_entry_id IS NOT NULL)),
  CONSTRAINT bot_usage_ledger_non_negative CHECK (origin = 'corrected' OR amount >= 0)
);

-- Höchstens eine Abrechnung je Reservierung (Korrekturen ausgenommen).
CREATE UNIQUE INDEX IF NOT EXISTS bot_usage_ledger_one_settlement_per_reservation
  ON public.bot_usage_ledger (reservation_id)
  WHERE reservation_id IS NOT NULL AND origin <> 'corrected';
-- Höchstens eine Korrektur je Ursprungseintrag.
CREATE UNIQUE INDEX IF NOT EXISTS bot_usage_ledger_one_correction_per_entry
  ON public.bot_usage_ledger (corrects_entry_id)
  WHERE corrects_entry_id IS NOT NULL;
-- Wiederholte Webhooks (Call-ID + Ereignis) buchen nicht doppelt.
CREATE UNIQUE INDEX IF NOT EXISTS bot_usage_ledger_event_key_unique
  ON public.bot_usage_ledger (event_key)
  WHERE event_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS bot_usage_ledger_tenant_period_idx
  ON public.bot_usage_ledger (tenant_id, resource, usage_at);

ALTER TABLE public.bot_usage_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bot_usage_ledger tenant-read" ON public.bot_usage_ledger;
CREATE POLICY "bot_usage_ledger tenant-read" ON public.bot_usage_ledger
  FOR SELECT USING (public.is_tenant_member(tenant_id));

CREATE OR REPLACE FUNCTION public.bot_usage_ledger_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Einzige Ausnahme: Löschen des Mandanten (ON DELETE CASCADE). Dann ist
  -- die Mandantenzeile im selben Statement bereits entfernt. Sonst würde ein
  -- append-only-Ledger jede Mandantenlöschung blockieren.
  IF TG_OP = 'DELETE'
     AND NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = OLD.tenant_id) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'bot_usage_ledger ist append-only (% verboten)', TG_OP
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS bot_usage_ledger_no_update ON public.bot_usage_ledger;
CREATE TRIGGER bot_usage_ledger_no_update
  BEFORE UPDATE OR DELETE ON public.bot_usage_ledger
  FOR EACH ROW EXECUTE FUNCTION public.bot_usage_ledger_block_mutation();

COMMENT ON TABLE public.bot_usage_ledger IS
  'Append-only-Verbrauch der Bot-Kanäle. origin: measured (vom Anbieter gemeldet), estimated (unklarer Verbrauch zum reservierten Höchstbetrag, nur interne Budgetkontrolle), corrected (Differenzbuchung auf einen estimated-Eintrag). Nicht Stripe-Billing.';

-- ============================================================
-- 4. Rate-Limit-Zähler
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bot_rate_buckets (
  bucket_key    text        NOT NULL CHECK (length(bucket_key) BETWEEN 1 AND 300),
  window_start  timestamptz NOT NULL,
  hits          integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_start)
);
-- Keine Policies: nur service_role (bypasst RLS) liest und schreibt.
ALTER TABLE public.bot_rate_buckets ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. Interner Aufrufer-Check
-- ============================================================
-- Erlaubt: service_role (Edge Functions) und der Datenbank-Owner (pg_cron).
CREATE OR REPLACE FUNCTION public.bot_usage_assert_internal()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' OR session_user = 'postgres' THEN
    RETURN;
  END IF;
  RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
END;
$$;

-- ============================================================
-- 6. Verbrauch einer Periode (Ledger + offene Reservierungen)
-- ============================================================
CREATE OR REPLACE FUNCTION public.bot_usage_used(
  p_tenant_id uuid,
  p_resource  text,
  p_since     timestamptz
) RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    coalesce((SELECT sum(l.amount) FROM public.bot_usage_ledger l
               WHERE l.tenant_id = p_tenant_id AND l.resource = p_resource
                 AND l.usage_at >= p_since), 0)
  + coalesce((SELECT sum(r.reserved_amount) FROM public.bot_usage_reservations r
               WHERE r.tenant_id = p_tenant_id AND r.resource = p_resource
                 AND r.status = 'open' AND r.created_at >= p_since), 0);
$$;

-- ============================================================
-- 7. Reservieren (atomar je Mandant + Ressource)
-- ============================================================
-- decision: 'allow' | 'existing' | 'deny'
-- reason bei deny: 'daily_budget' | 'monthly_budget' | 'concurrency' | 'invalid'
CREATE OR REPLACE FUNCTION public.bot_usage_reserve(
  p_tenant_id        uuid,
  p_bot_id           uuid,
  p_resource         text,
  p_provider         text,
  p_external_ref     text,
  p_amount           numeric,
  p_ttl_seconds      integer,
  p_limit_daily      numeric,   -- NULL = kein Tageslimit
  p_limit_monthly    numeric,   -- NULL = kein Monatslimit
  p_max_concurrent   integer,   -- NULL = keine Grenze
  p_metadata         jsonb DEFAULT '{}'::jsonb
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
  v_existing   public.bot_usage_reservations%ROWTYPE;
  v_day        timestamptz := date_trunc('day', now());
  v_month      timestamptz := date_trunc('month', now());
  v_used_day   numeric;
  v_used_month numeric;
  v_open       integer;
  v_id         uuid;
BEGIN
  PERFORM public.bot_usage_assert_internal();

  IF p_tenant_id IS NULL OR p_external_ref IS NULL OR p_amount IS NULL OR p_amount <= 0
     OR p_ttl_seconds IS NULL OR p_ttl_seconds <= 0 THEN
    RETURN QUERY SELECT 'deny'::text, NULL::uuid, NULL::numeric, 'invalid'::text, NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  -- Serialisiert alle Reservierungen desselben Mandanten für dieselbe
  -- Ressource. Parallele Anfragen sehen jeweils den Stand inkl. der
  -- Reservierungen, die vor ihnen festgeschrieben wurden.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_resource, 0));

  SELECT * INTO v_existing FROM public.bot_usage_reservations r
   WHERE r.resource = p_resource AND r.provider = p_provider AND r.external_ref = p_external_ref;
  IF FOUND THEN
    IF v_existing.tenant_id <> p_tenant_id THEN
      RETURN QUERY SELECT 'deny'::text, NULL::uuid, NULL::numeric, 'invalid'::text, NULL::numeric, NULL::numeric;
      RETURN;
    END IF;
    RETURN QUERY SELECT 'existing'::text, v_existing.id, v_existing.reserved_amount,
                        v_existing.status, NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  v_used_day   := public.bot_usage_used(p_tenant_id, p_resource, v_day);
  v_used_month := public.bot_usage_used(p_tenant_id, p_resource, v_month);

  IF p_max_concurrent IS NOT NULL THEN
    SELECT count(*) INTO v_open FROM public.bot_usage_reservations r
     WHERE r.tenant_id = p_tenant_id AND r.resource = p_resource AND r.status = 'open';
    IF v_open >= p_max_concurrent THEN
      RETURN QUERY SELECT 'deny'::text, NULL::uuid, NULL::numeric, 'concurrency'::text, v_used_day, v_used_month;
      RETURN;
    END IF;
  END IF;

  IF p_limit_daily IS NOT NULL AND v_used_day + p_amount > p_limit_daily THEN
    RETURN QUERY SELECT 'deny'::text, NULL::uuid, NULL::numeric, 'daily_budget'::text, v_used_day, v_used_month;
    RETURN;
  END IF;
  IF p_limit_monthly IS NOT NULL AND v_used_month + p_amount > p_limit_monthly THEN
    RETURN QUERY SELECT 'deny'::text, NULL::uuid, NULL::numeric, 'monthly_budget'::text, v_used_day, v_used_month;
    RETURN;
  END IF;

  INSERT INTO public.bot_usage_reservations
    (tenant_id, bot_id, resource, provider, external_ref, reserved_amount, expires_at, metadata)
  VALUES
    (p_tenant_id, p_bot_id, p_resource, p_provider, p_external_ref, p_amount,
     now() + make_interval(secs => p_ttl_seconds), coalesce(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN QUERY SELECT 'allow'::text, v_id, p_amount, NULL::text, v_used_day, v_used_month;
END;
$$;

-- KI-Budget: Limits aus bot_usage_limits (fehlende Zeile = Defaults).
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
  v_daily   numeric := 5;
  v_monthly numeric := 50;
BEGIN
  PERFORM public.bot_usage_assert_internal();
  SELECT l.ai_usd_daily, l.ai_usd_monthly INTO v_daily, v_monthly
    FROM public.bot_usage_limits l WHERE l.tenant_id = p_tenant_id;
  IF NOT FOUND THEN
    v_daily := 5; v_monthly := 50;
  END IF;
  -- TTL 10 Minuten: deutlich über jeder Provider-Laufzeit. Danach rechnet
  -- der Sweep die Reservierung als 'estimated' ab.
  RETURN QUERY SELECT * FROM public.bot_usage_reserve(
    p_tenant_id, p_bot_id, 'ai_usd', 'llm', p_request_ref, p_max_usd, 600,
    v_daily, v_monthly, NULL, p_metadata);
END;
$$;

-- Telefon: Monatslimit kommt vom Aufrufer (Plan-Entitlement in Sekunden,
-- NULL = unbegrenzt laut Plan). Anrufdauer und Parallelität aus
-- bot_usage_limits. Reserviert wird min(max. Anrufdauer, Restkontingent).
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
  v_max_call   integer := 600;
  v_concurrent integer := 2;
  v_amount     numeric;
  v_remaining  numeric;
  v_existing   public.bot_usage_reservations%ROWTYPE;
BEGIN
  PERFORM public.bot_usage_assert_internal();

  -- Laufender Anruf (Folge-Hit derselben Call-ID): bestehende Reservierung
  -- zurückgeben, BEVOR das Restkontingent geprüft wird. Sonst zählte die
  -- eigene offene Reservierung gegen den Anruf selbst.
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
    v_max_call := 600; v_concurrent := 2;
  END IF;

  v_amount := v_max_call;
  IF p_plan_seconds_monthly IS NOT NULL THEN
    -- Vorab-Schätzung; die verbindliche Prüfung läuft unter Lock in
    -- bot_usage_reserve. Ein Rest unter 60 Sekunden wird nicht angebrochen.
    v_remaining := p_plan_seconds_monthly
                 - public.bot_usage_used(p_tenant_id, 'voice_seconds', date_trunc('month', now()));
    v_amount := least(v_amount, floor(v_remaining));
    IF v_amount < 60 THEN
      RETURN QUERY SELECT 'deny'::text, NULL::uuid, NULL::numeric, 'monthly_budget'::text, NULL::numeric, NULL::numeric;
      RETURN;
    END IF;
  END IF;

  -- TTL = reservierte Dauer + 15 Minuten Kulanz für den Abschluss-Webhook.
  RETURN QUERY SELECT * FROM public.bot_usage_reserve(
    p_tenant_id, p_bot_id, 'voice_seconds', p_provider, p_call_ref, v_amount,
    v_amount::integer + 900, NULL, p_plan_seconds_monthly, v_concurrent, p_metadata);
END;
$$;

-- ============================================================
-- 8. Abrechnen
-- ============================================================
-- p_origin = 'measured': p_amount ist der gemeldete Verbrauch.
-- p_origin = 'estimated': Betrag wird auf den reservierten Höchstbetrag gesetzt.
-- Idempotent: eine bereits abgerechnete Reservierung liefert den bestehenden
-- Eintrag mit duplicate = true.
CREATE OR REPLACE FUNCTION public.bot_usage_settle(
  p_reservation_id uuid,
  p_origin         text,
  p_amount         numeric,
  p_event_key      text,
  p_evidence       jsonb DEFAULT '{}'::jsonb
) RETURNS TABLE (ledger_id bigint, duplicate boolean, amount numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res    public.bot_usage_reservations%ROWTYPE;
  v_amount numeric;
  v_id     bigint;
BEGIN
  PERFORM public.bot_usage_assert_internal();
  IF p_origin NOT IN ('measured', 'estimated') THEN
    RAISE EXCEPTION 'invalid origin %', p_origin USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_res FROM public.bot_usage_reservations r
   WHERE r.id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'reservation % not found', p_reservation_id USING ERRCODE = 'no_data_found';
  END IF;

  IF v_res.status = 'settled' THEN
    RETURN QUERY SELECT l.id, true, l.amount FROM public.bot_usage_ledger l
      WHERE l.reservation_id = v_res.id AND l.origin <> 'corrected';
    RETURN;
  END IF;
  IF v_res.status = 'released' THEN
    RAISE EXCEPTION 'reservation % already released', p_reservation_id USING ERRCODE = '55000';
  END IF;

  IF p_origin = 'estimated' THEN
    v_amount := v_res.reserved_amount;
  ELSE
    IF p_amount IS NULL OR p_amount < 0 THEN
      RAISE EXCEPTION 'measured amount must be >= 0' USING ERRCODE = '22023';
    END IF;
    v_amount := p_amount;
  END IF;

  INSERT INTO public.bot_usage_ledger
    (tenant_id, resource, reservation_id, origin, amount, event_key, usage_at, evidence)
  VALUES
    (v_res.tenant_id, v_res.resource, v_res.id, p_origin, v_amount, p_event_key,
     v_res.created_at, coalesce(p_evidence, '{}'::jsonb))
  RETURNING id INTO v_id;

  UPDATE public.bot_usage_reservations
     SET status = 'settled', closed_at = now(),
         close_reason = CASE WHEN p_origin = 'estimated' THEN 'estimated' ELSE 'measured' END
   WHERE id = v_res.id;

  RETURN QUERY SELECT v_id, false, v_amount;
END;
$$;

-- Abrechnung über Provider-Referenz (z. B. Twilio-Status-Callback).
-- Ohne passende Reservierung (z. B. Anruf vor diesem Deploy begonnen) wird
-- der gemessene Verbrauch ohne Reservierung gebucht — idempotent über event_key.
CREATE OR REPLACE FUNCTION public.bot_usage_settle_by_ref(
  p_tenant_id     uuid,
  p_resource      text,
  p_provider      text,
  p_external_ref  text,
  p_amount        numeric,
  p_event_key     text,
  p_evidence      jsonb DEFAULT '{}'::jsonb
) RETURNS TABLE (ledger_id bigint, duplicate boolean, amount numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res_id uuid;
  v_id     bigint;
BEGIN
  PERFORM public.bot_usage_assert_internal();
  IF p_event_key IS NULL OR length(p_event_key) = 0 THEN
    RAISE EXCEPTION 'event_key required' USING ERRCODE = '22023';
  END IF;

  -- Dasselbe Ereignis bereits gebucht → keine zweite Buchung.
  SELECT l.id INTO v_id FROM public.bot_usage_ledger l WHERE l.event_key = p_event_key;
  IF FOUND THEN
    RETURN QUERY SELECT l.id, true, l.amount FROM public.bot_usage_ledger l WHERE l.id = v_id;
    RETURN;
  END IF;

  SELECT r.id INTO v_res_id FROM public.bot_usage_reservations r
   WHERE r.resource = p_resource AND r.provider = p_provider
     AND r.external_ref = p_external_ref AND r.tenant_id = p_tenant_id;

  -- Später Callback: Der Aufräumjob hat die Reservierung bereits als
  -- 'estimated' abgerechnet. Der gemeldete Wert wird dann als Korrektur
  -- (Differenzbuchung) nachgetragen — höchstens einmal je Eintrag.
  IF v_res_id IS NOT NULL THEN
    SELECT l.id INTO v_id FROM public.bot_usage_ledger l
     WHERE l.reservation_id = v_res_id AND l.origin = 'estimated';
    IF v_id IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.bot_usage_ledger c WHERE c.corrects_entry_id = v_id) THEN
        RETURN QUERY SELECT c.id, true, c.amount FROM public.bot_usage_ledger c WHERE c.corrects_entry_id = v_id;
        RETURN;
      END IF;
      IF p_amount IS NULL OR p_amount < 0 THEN
        RAISE EXCEPTION 'measured amount must be >= 0' USING ERRCODE = '22023';
      END IF;
      BEGIN
        v_id := public.bot_usage_correct(v_id, p_amount,
          coalesce(p_evidence, '{}'::jsonb) || jsonb_build_object('source', 'provider_callback', 'event_key', p_event_key));
      EXCEPTION WHEN unique_violation THEN
        RETURN QUERY SELECT c.id, true, c.amount FROM public.bot_usage_ledger c
          WHERE c.corrects_entry_id = (SELECT l.id FROM public.bot_usage_ledger l
                                        WHERE l.reservation_id = v_res_id AND l.origin = 'estimated');
        RETURN;
      END;
      RETURN QUERY SELECT l.id, false, l.amount FROM public.bot_usage_ledger l WHERE l.id = v_id;
      RETURN;
    END IF;
  END IF;

  IF v_res_id IS NOT NULL THEN
    RETURN QUERY SELECT * FROM public.bot_usage_settle(v_res_id, 'measured', p_amount, p_event_key, p_evidence);
    RETURN;
  END IF;

  IF p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'measured amount must be >= 0' USING ERRCODE = '22023';
  END IF;
  BEGIN
    INSERT INTO public.bot_usage_ledger (tenant_id, resource, origin, amount, event_key, evidence)
    VALUES (p_tenant_id, p_resource, 'measured', p_amount, p_event_key,
            coalesce(p_evidence, '{}'::jsonb) || jsonb_build_object('without_reservation', true))
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT l.id INTO v_id FROM public.bot_usage_ledger l WHERE l.event_key = p_event_key;
    RETURN QUERY SELECT l.id, true, l.amount FROM public.bot_usage_ledger l WHERE l.id = v_id;
    RETURN;
  END;
  RETURN QUERY SELECT v_id, false, p_amount;
END;
$$;

-- Freigabe ohne Verbrauch. Nur aufrufen, wenn nachweislich nichts
-- verbraucht wurde (z. B. Anfrage nie an den Anbieter gesendet).
CREATE OR REPLACE FUNCTION public.bot_usage_release(
  p_reservation_id uuid,
  p_reason         text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  PERFORM public.bot_usage_assert_internal();
  IF p_reason IS NULL OR length(p_reason) = 0 THEN
    RAISE EXCEPTION 'release reason required' USING ERRCODE = '22023';
  END IF;
  UPDATE public.bot_usage_reservations
     SET status = 'released', closed_at = now(), close_reason = p_reason
   WHERE id = p_reservation_id AND status = 'open';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END;
$$;

-- ============================================================
-- 9. Aufräumjob: abgelaufene offene Reservierungen → 'estimated'
-- ============================================================
CREATE OR REPLACE FUNCTION public.bot_usage_sweep_expired()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row   record;
  v_count integer := 0;
BEGIN
  PERFORM public.bot_usage_assert_internal();
  FOR v_row IN
    SELECT r.id FROM public.bot_usage_reservations r
     WHERE r.status = 'open' AND r.expires_at < now()
     ORDER BY r.expires_at
     LIMIT 1000
     FOR UPDATE SKIP LOCKED
  LOOP
    -- Ein fehlerhafter Datensatz darf den Lauf nicht für alle anderen blockieren.
    BEGIN
      PERFORM public.bot_usage_settle(v_row.id, 'estimated', NULL, NULL,
        jsonb_build_object('reason', 'expired_without_settlement', 'swept_at', now()));
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'bot_usage_sweep_expired: reservation % übersprungen: %', v_row.id, SQLERRM;
    END;
  END LOOP;

  -- Rate-Limit-Zähler älter als ein Tag sind wertlos (keine Abrechnungsdaten).
  DELETE FROM public.bot_rate_buckets WHERE window_start < now() - interval '1 day';

  RETURN v_count;
END;
$$;

-- ============================================================
-- 10. Korrektur (Differenzbuchung)
-- ============================================================
CREATE OR REPLACE FUNCTION public.bot_usage_correct(
  p_entry_id       bigint,
  p_proven_amount  numeric,
  p_evidence       jsonb
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry public.bot_usage_ledger%ROWTYPE;
  v_id    bigint;
BEGIN
  PERFORM public.bot_usage_assert_internal();
  IF p_proven_amount IS NULL OR p_proven_amount < 0 THEN
    RAISE EXCEPTION 'proven amount must be >= 0' USING ERRCODE = '22023';
  END IF;
  IF p_evidence IS NULL OR p_evidence = '{}'::jsonb THEN
    RAISE EXCEPTION 'evidence required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_entry FROM public.bot_usage_ledger WHERE id = p_entry_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ledger entry % not found', p_entry_id USING ERRCODE = 'no_data_found';
  END IF;
  IF v_entry.origin <> 'estimated' THEN
    RAISE EXCEPTION 'only estimated entries can be corrected' USING ERRCODE = '55000';
  END IF;

  INSERT INTO public.bot_usage_ledger
    (tenant_id, resource, reservation_id, origin, amount, corrects_entry_id, usage_at, evidence)
  VALUES
    (v_entry.tenant_id, v_entry.resource, v_entry.reservation_id, 'corrected',
     p_proven_amount - v_entry.amount, v_entry.id, v_entry.usage_at, p_evidence)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ============================================================
-- 11. Abrechnungsrelevante Sicht
-- ============================================================
-- measured + (estimated + corrected) je Kette; unkorrigierte Schätzungen
-- fehlen bewusst. security_invoker: RLS der Ledger-Tabelle gilt.
CREATE OR REPLACE VIEW public.bot_usage_billable
WITH (security_invoker = true) AS
SELECT
  l.tenant_id,
  l.resource,
  l.usage_at,
  l.id AS entry_id,
  l.origin,
  CASE WHEN l.origin = 'measured' THEN l.amount ELSE l.amount + c.amount END AS billable_amount,
  c.id AS correction_id
FROM public.bot_usage_ledger l
LEFT JOIN public.bot_usage_ledger c ON c.corrects_entry_id = l.id
WHERE l.origin = 'measured'
   OR (l.origin = 'estimated' AND c.id IS NOT NULL);

COMMENT ON VIEW public.bot_usage_billable IS
  'Abrechnungsrelevanter Verbrauch: gemessene Einträge plus korrigierte Schätzketten. Unkorrigierte Schätzungen sind ausgeschlossen. Nicht mit Stripe verbunden.';

-- ============================================================
-- 12. Rate-Limit (atomarer Zähler)
-- ============================================================
CREATE OR REPLACE FUNCTION public.bot_rate_hit(
  p_bucket_key     text,
  p_window_seconds integer,
  p_max            integer
) RETURNS TABLE (allowed boolean, hits integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window timestamptz;
  v_hits   integer;
BEGIN
  PERFORM public.bot_usage_assert_internal();
  IF p_window_seconds IS NULL OR p_window_seconds <= 0 OR p_max IS NULL OR p_max < 0 THEN
    RAISE EXCEPTION 'invalid rate limit arguments' USING ERRCODE = '22023';
  END IF;
  v_window := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);
  INSERT INTO public.bot_rate_buckets AS b (bucket_key, window_start, hits)
  VALUES (p_bucket_key, v_window, 1)
  ON CONFLICT (bucket_key, window_start) DO UPDATE SET hits = b.hits + 1
  RETURNING b.hits INTO v_hits;
  RETURN QUERY SELECT v_hits <= p_max, v_hits;
END;
$$;

-- ============================================================
-- 13. Rechte: nur service_role
-- ============================================================
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.bot_usage_assert_internal()',
    'public.bot_usage_used(uuid,text,timestamptz)',
    'public.bot_usage_reserve(uuid,uuid,text,text,text,numeric,integer,numeric,numeric,integer,jsonb)',
    'public.bot_ai_budget_reserve(uuid,uuid,text,numeric,jsonb)',
    'public.bot_voice_call_reserve(uuid,uuid,text,text,numeric,jsonb)',
    'public.bot_usage_settle(uuid,text,numeric,text,jsonb)',
    'public.bot_usage_settle_by_ref(uuid,text,text,text,numeric,text,jsonb)',
    'public.bot_usage_release(uuid,text)',
    'public.bot_usage_sweep_expired()',
    'public.bot_usage_correct(bigint,numeric,jsonb)',
    'public.bot_rate_hit(text,integer,integer)'
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
  REVOKE ALL ON public.bot_usage_reservations, public.bot_usage_ledger,
                public.bot_rate_buckets, public.bot_usage_limits FROM anon;
  GRANT SELECT ON public.bot_usage_reservations, public.bot_usage_ledger,
                  public.bot_usage_limits TO authenticated;
  REVOKE INSERT, UPDATE, DELETE ON public.bot_usage_reservations, public.bot_usage_ledger,
                public.bot_usage_limits, public.bot_rate_buckets FROM authenticated;
  REVOKE ALL ON public.bot_rate_buckets FROM authenticated;
  REVOKE ALL ON public.bot_usage_billable FROM anon, authenticated;
  GRANT SELECT ON public.bot_usage_billable TO authenticated;
EXCEPTION WHEN undefined_object THEN
  RAISE NOTICE 'Rollen anon/authenticated fehlen (lokale Testdatenbank) — Grants übersprungen.';
END $$;

COMMIT;

-- ============================================================
-- 14. pg_cron: Aufräumjob alle 5 Minuten
-- ============================================================
-- pg_cron ist im Projekt bereits im Einsatz (siehe 20260626000000). Der Job
-- ruft die SQL-Funktion direkt auf (läuft als Datenbank-Owner, kein Secret,
-- kein pg_net). In CI ohne pg_cron wird der Schritt übersprungen.
DO $$
BEGIN
  EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron nicht verfuegbar (CI-Umgebung) — Schedule uebersprungen.';
END $$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'bot-usage-sweep-expired',
    '*/5 * * * *',
    'SELECT public.bot_usage_sweep_expired()'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'cron.schedule (bot-usage-sweep-expired) uebersprungen (pg_cron nicht aktiv).';
END $$;
