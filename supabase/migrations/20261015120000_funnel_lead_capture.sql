-- Funnel-Lead-Erfassung: Domain + E-Mail aus dem Governance-Scan zuverlässig,
-- dedupliziert und mit Audit, Mandant und Abo verknüpft speichern.
--
-- ── Ausgangslage (gemessen am Code, 2026-10-15) ─────────────────────────────
--
-- * `gdpr-audit` legte nach JEDEM Scan eine neue Zeile in `sales_leads` an —
--   erst NACH dem Abruf der fremden Seite. Ein Absturz im Scan verlor den
--   Lead, ein zweiter Scan derselben Person erzeugte ein Duplikat.
-- * `gdpr_audits.sales_lead_id` verknüpft Audit → Lead; die Gegenrichtung,
--   der Mandant nach der Registrierung und das Abo fehlten.
-- * `sales_leads.converted_at` ist dokumentiert („stripe-webhook setzt …“),
--   wird aber von keinem Code geschrieben.
--
-- ── Was diese Migration tut (rein additiv) ─────────────────────────────────
--
-- 1. Spalten auf `sales_leads`: lead_key, funnel_stage, audit_id, tenant_id,
--    user_id, last_activity_at, submission_count. KEINE neue Lead-Tabelle.
--    Bestandszeilen behalten lead_key = NULL und sind von der Deduplizierung
--    ausgenommen (NULL ist in einem UNIQUE-Index nie gleich).
-- 2. `capture_funnel_lead()` — der einzige Schreibweg für Funnel-Leads.
--    Deterministische Deduplizierung über (E-Mail, Domain): dieselbe Person
--    mit derselben Domain → dieselbe Zeile. Zwei Ansprechpartner derselben
--    Domain → zwei Zeilen. Nur service_role.
-- 3. `mark_funnel_lead_scan()` — Scan-Status und Audit-ID nachtragen, ohne
--    den Lead zu überschreiben oder im Trichter zurückzustufen.
-- 4. Trigger auf `gdpr_audits`: Übernahme eines Audits (claim) trägt Mandant
--    und Nutzer am verknüpften Lead nach — egal ob über `claim_gdpr_audit`
--    oder die Edge Function `audit-claim`.
-- 5. Trigger auf `subscriptions`: Testphase → `pilot_started`, bezahltes Abo
--    → `subscription_activated` in `marketing_events`; bezahltes Abo setzt
--    `converted_at` am Lead. Fehlertolerant: ein Fehler hier darf nie einen
--    Abrechnungs-Schreibvorgang verhindern.
-- 6. `admin_funnel_leads()` / `admin_funnel_kpis()` — Lesezugriff für die
--    Lead-Verwaltung, nur für Plattform-Operatoren (`is_platform_operator()`,
--    ADR 0011), geprüft in der Funktion.
-- 7. Double-Opt-in für Follow-up-E-Mails: Token am Lead,
--    `request_followup_doi()` / `confirm_followup_doi()`.
-- 8. Follow-up-Mail-Serie (audit_email_drip) nur noch fällig mit Einwilligung
--    am Audit UND bestätigtem Double-Opt-in am Lead — ein Scan allein ist
--    kein Opt-in. Abgesichert gegen fehlende Drip-Objekte im Live-Projekt.
-- 9. Art. 17: `erase_lead_data()` (Konto-Löschung, gdpr-delete) und
--    `admin_erase_lead_data()` (Anfrage ohne Konto, nur Plattform-Operatoren).
-- 10. `purge_stale_funnel_leads()` — Löschkonzept: Leads ohne Konto, Kauf und
--    bestätigte Einwilligung nach Inaktivität löschen, alte anonyme Scans
--    anonymisieren. Die Einplanung liegt in einer eigenen Migration
--    (20261015130000), damit Frist und Zeitplan getrennt freigegeben werden.
--
-- RLS bleibt unverändert: keine anon/authenticated-Policy für INSERT/UPDATE
-- auf `sales_leads`; Lesen weiterhin nur super_admin. Mandanten sehen
-- `sales_leads` nie — auch nicht „ihren“ Lead.

BEGIN;

-- ── 1. Spalten ──────────────────────────────────────────────────────────────

ALTER TABLE public.sales_leads
  ADD COLUMN IF NOT EXISTS lead_key          text,
  ADD COLUMN IF NOT EXISTS funnel_stage      text,
  ADD COLUMN IF NOT EXISTS audit_id          uuid,
  ADD COLUMN IF NOT EXISTS tenant_id         uuid,
  ADD COLUMN IF NOT EXISTS user_id           uuid,
  ADD COLUMN IF NOT EXISTS last_activity_at  timestamptz,
  ADD COLUMN IF NOT EXISTS submission_count  integer NOT NULL DEFAULT 1,
  -- Double-Opt-in für Follow-up-E-Mails (UWG § 7). Getrennt von den
  -- Einwilligungs-Spalten aus 20261008133000, deren Nachweis unveränderlich ist.
  ADD COLUMN IF NOT EXISTS followup_doi_token        uuid,
  ADD COLUMN IF NOT EXISTS followup_doi_sent_at      timestamptz,
  ADD COLUMN IF NOT EXISTS followup_doi_confirmed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS sales_leads_followup_doi_token_uidx
  ON public.sales_leads (followup_doi_token)
  WHERE followup_doi_token IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_leads_audit_id_fkey') THEN
    ALTER TABLE public.sales_leads
      ADD CONSTRAINT sales_leads_audit_id_fkey
      FOREIGN KEY (audit_id) REFERENCES public.gdpr_audits(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_leads_tenant_id_fkey') THEN
    ALTER TABLE public.sales_leads
      ADD CONSTRAINT sales_leads_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.sales_leads
  DROP CONSTRAINT IF EXISTS sales_leads_funnel_stage_chk;
ALTER TABLE public.sales_leads
  ADD CONSTRAINT sales_leads_funnel_stage_chk
  CHECK (funnel_stage IS NULL OR funnel_stage IN (
    'captured', 'scan_started', 'scan_failed', 'scan_completed', 'registered'
  ));

-- lead_key = lower(email) || '|' || domain. Nur Funnel-Leads tragen ihn.
ALTER TABLE public.sales_leads
  DROP CONSTRAINT IF EXISTS sales_leads_lead_key_shape_chk;
ALTER TABLE public.sales_leads
  ADD CONSTRAINT sales_leads_lead_key_shape_chk
  CHECK (lead_key IS NULL OR (lead_key = lower(lead_key) AND position('|' IN lead_key) > 1));

CREATE UNIQUE INDEX IF NOT EXISTS sales_leads_lead_key_uidx
  ON public.sales_leads (lead_key);

CREATE INDEX IF NOT EXISTS idx_sales_leads_funnel_activity
  ON public.sales_leads (last_activity_at DESC)
  WHERE lead_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_leads_tenant
  ON public.sales_leads (tenant_id)
  WHERE tenant_id IS NOT NULL;

-- Rate-Limit-Lookup des Funnels (ip_hash + letzte Aktivität).
CREATE INDEX IF NOT EXISTS idx_sales_leads_ip_activity
  ON public.sales_leads (ip_hash, last_activity_at DESC)
  WHERE lead_key IS NOT NULL;

COMMENT ON COLUMN public.sales_leads.lead_key IS
  'Deduplizierungsschlüssel für Funnel-Leads: lower(email)|domain. NULL für Bestands- und Sales-Formular-Leads.';
COMMENT ON COLUMN public.sales_leads.funnel_stage IS
  'Technischer Trichterstand: captured → scan_started → scan_completed|scan_failed → registered. Pilot/Kunde werden aus subscriptions abgeleitet (admin_funnel_leads).';
COMMENT ON COLUMN public.sales_leads.audit_id IS
  'Letzter abgeschlossener Governance-Scan dieses Leads. Gegenrichtung zu gdpr_audits.sales_lead_id.';
COMMENT ON COLUMN public.sales_leads.tenant_id IS
  'Mandant nach Übernahme des Audits (Trigger auf gdpr_audits.claimed_at). Kein Lesezugriff für den Mandanten.';
COMMENT ON COLUMN public.sales_leads.submission_count IS
  'Wie oft derselbe lead_key erfasst wurde. Wiederholungen erzeugen keine neue Zeile.';

-- ── 2. Trichter-Rang (monoton, nie zurückstufen) ───────────────────────────

CREATE OR REPLACE FUNCTION public.funnel_stage_merge(p_current text, p_next text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  -- scan_failed → scan_started ist erlaubt (neuer Versuch); alles andere
  -- folgt dem Rang. Ein registrierter Lead bleibt registriert.
  SELECT CASE
    WHEN p_current IS NULL THEN p_next
    WHEN p_next IS NULL THEN p_current
    WHEN p_current = 'scan_failed' AND p_next = 'scan_started' THEN p_next
    WHEN (CASE p_next
            WHEN 'captured' THEN 10 WHEN 'scan_started' THEN 20
            WHEN 'scan_failed' THEN 25 WHEN 'scan_completed' THEN 30
            WHEN 'registered' THEN 40 ELSE 0 END)
       > (CASE p_current
            WHEN 'captured' THEN 10 WHEN 'scan_started' THEN 20
            WHEN 'scan_failed' THEN 25 WHEN 'scan_completed' THEN 30
            WHEN 'registered' THEN 40 ELSE 0 END)
      THEN p_next
    ELSE p_current
  END
$$;

REVOKE ALL ON FUNCTION public.funnel_stage_merge(text, text) FROM PUBLIC, anon, authenticated;

-- ── 3. capture_funnel_lead — der einzige Schreibweg ────────────────────────

CREATE OR REPLACE FUNCTION public.capture_funnel_lead(
  p_email              text,
  p_domain             text,
  p_company            text    DEFAULT NULL,
  p_source             text    DEFAULT 'governance_scan',
  p_stage              text    DEFAULT 'captured',
  p_path               text    DEFAULT NULL,
  p_ip_hash            text    DEFAULT NULL,
  p_user_agent         text    DEFAULT NULL,
  p_marketing_consent  boolean DEFAULT false,
  p_consent_version    text    DEFAULT NULL,
  p_metadata           jsonb   DEFAULT '{}'::jsonb
)
RETURNS TABLE (lead_id uuid, is_new boolean)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_email   text := lower(btrim(coalesce(p_email, '')));
  v_domain  text := lower(btrim(coalesce(p_domain, '')));
  v_key     text;
BEGIN
  -- Serverseitige Validierung, unabhängig vom aufrufenden Code.
  IF length(v_email) < 6 OR length(v_email) > 254
     OR v_email !~ '^[^[:space:]@|]+@[^[:space:]@|]+\.[^[:space:]@|]{2,}$' THEN
    RAISE EXCEPTION 'invalid email' USING ERRCODE = '22023';
  END IF;
  IF length(v_domain) < 4 OR length(v_domain) > 253
     OR v_domain !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,62}[a-z0-9]$' THEN
    RAISE EXCEPTION 'invalid domain' USING ERRCODE = '22023';
  END IF;
  IF p_source IS NULL OR p_source NOT IN (
    'landing', 'governance_scan', 'pricing', 'agency', 'voice_agent', 'siteos_builder'
  ) THEN
    RAISE EXCEPTION 'invalid source' USING ERRCODE = '22023';
  END IF;
  IF p_stage IS NULL OR p_stage NOT IN ('captured', 'scan_started') THEN
    RAISE EXCEPTION 'invalid stage' USING ERRCODE = '22023';
  END IF;

  v_key := v_email || '|' || v_domain;

  -- Einwilligung nur beim ERSTEN Erfassen (Trigger aus 20261008133000 lässt
  -- eine nachträgliche Erteilung per UPDATE nicht zu — gewollt: der Nachweis
  -- gehört zur ersten Erhebung). Spätere Einwilligungen laufen über das
  -- Double-Opt-in von newsletter-subscribe.
  RETURN QUERY
  INSERT INTO public.sales_leads AS l (
    email, company, company_domain, domains, source, path, user_agent, ip_hash,
    use_case, lead_key, funnel_stage, last_activity_at, metadata,
    marketing_consent, marketing_consent_text_version
  ) VALUES (
    v_email,
    nullif(left(btrim(coalesce(p_company, '')), 200), ''),
    v_domain,
    ARRAY[v_domain],
    p_source,
    left(p_path, 500),
    left(p_user_agent, 500),
    left(p_ip_hash, 128),
    'compliance',
    v_key,
    p_stage,
    pg_catalog.now(),
    coalesce(p_metadata, '{}'::jsonb),
    coalesce(p_marketing_consent, false),
    CASE WHEN coalesce(p_marketing_consent, false) THEN p_consent_version ELSE NULL END
  )
  ON CONFLICT (lead_key) DO UPDATE SET
    last_activity_at = pg_catalog.now(),
    submission_count = l.submission_count + 1,
    company          = coalesce(l.company, EXCLUDED.company),
    ip_hash          = EXCLUDED.ip_hash,
    funnel_stage     = public.funnel_stage_merge(l.funnel_stage, EXCLUDED.funnel_stage)
    -- source/created_at/Einwilligung bleiben die der ersten Erfassung.
  RETURNING l.id, (l.xmax = 0);
END;
$$;

REVOKE ALL ON FUNCTION public.capture_funnel_lead(text, text, text, text, text, text, text, text, boolean, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.capture_funnel_lead(text, text, text, text, text, text, text, text, boolean, text, jsonb)
  TO service_role;

COMMENT ON FUNCTION public.capture_funnel_lead(text, text, text, text, text, text, text, text, boolean, text, jsonb) IS
  'Funnel-Lead erfassen oder auffrischen (dedupliziert über lower(email)|domain). Nur service_role (gdpr-audit).';

-- ── 4. mark_funnel_lead_scan — Scan-Ergebnis nachtragen ────────────────────

CREATE OR REPLACE FUNCTION public.mark_funnel_lead_scan(
  p_lead_id  uuid,
  p_status   text,
  p_audit_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_next  text;
  v_stage text;
BEGIN
  v_next := CASE p_status
    WHEN 'started'   THEN 'scan_started'
    WHEN 'completed' THEN 'scan_completed'
    WHEN 'failed'    THEN 'scan_failed'
  END;
  IF v_next IS NULL THEN
    RAISE EXCEPTION 'invalid scan status' USING ERRCODE = '22023';
  END IF;
  IF p_status = 'completed' AND p_audit_id IS NULL THEN
    RAISE EXCEPTION 'audit_id required for completed scans' USING ERRCODE = '22023';
  END IF;

  UPDATE public.sales_leads l
     SET funnel_stage     = public.funnel_stage_merge(l.funnel_stage, v_next),
         audit_id         = CASE WHEN p_status = 'completed' THEN p_audit_id ELSE l.audit_id END,
         last_activity_at = pg_catalog.now()
   WHERE l.id = p_lead_id
     AND l.lead_key IS NOT NULL
  RETURNING l.funnel_stage INTO v_stage;

  RETURN v_stage;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_funnel_lead_scan(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_funnel_lead_scan(uuid, text, uuid) TO service_role;

-- ── 5. Registrierung: Audit-Übernahme → Lead-Zuordnung ─────────────────────

CREATE OR REPLACE FUNCTION public.sales_leads_sync_audit_claim()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Nur der Übergang anonym → übernommen, nur mit verknüpftem Lead.
  IF NEW.sales_lead_id IS NULL OR NEW.claimed_at IS NULL OR OLD.claimed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.sales_leads l
     SET tenant_id        = coalesce(l.tenant_id, NEW.tenant_id),
         user_id          = coalesce(l.user_id, NEW.user_id),
         audit_id         = coalesce(l.audit_id, NEW.id),
         funnel_stage     = CASE WHEN l.lead_key IS NULL THEN l.funnel_stage
                                 ELSE public.funnel_stage_merge(l.funnel_stage, 'registered') END,
         last_activity_at = pg_catalog.now()
   WHERE l.id = NEW.sales_lead_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Die Übernahme des Audits ist das Ziel; die Lead-Zuordnung ist Beiwerk.
  RAISE WARNING 'sales_leads_sync_audit_claim failed: %', SQLSTATE;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sales_leads_sync_audit_claim() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_gdpr_audits_sync_lead_claim ON public.gdpr_audits;
CREATE TRIGGER trg_gdpr_audits_sync_lead_claim
  AFTER UPDATE OF claimed_at ON public.gdpr_audits
  FOR EACH ROW
  EXECUTE FUNCTION public.sales_leads_sync_audit_claim();

-- ── 6. Abo-Ereignisse: Pilot / Kunde ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.subscriptions_funnel_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_status text := CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM v_old_status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'trialing' THEN
    INSERT INTO public.marketing_events (tenant_id, event_name, plan_key, currency, metadata)
    VALUES (NEW.tenant_id, 'pilot_started', NEW.plan_key, 'EUR',
            jsonb_build_object('origin', 'subscriptions_trigger'));
  ELSIF NEW.status = 'active' AND NEW.stripe_subscription_id IS NOT NULL THEN
    INSERT INTO public.marketing_events (tenant_id, event_name, plan_key, currency, metadata)
    VALUES (NEW.tenant_id, 'subscription_activated', NEW.plan_key, 'EUR',
            jsonb_build_object('origin', 'subscriptions_trigger',
                               'from_trial', coalesce(v_old_status = 'trialing', false)));
    UPDATE public.sales_leads l
       SET converted_at     = coalesce(l.converted_at, pg_catalog.now()),
           last_activity_at = pg_catalog.now()
     WHERE l.tenant_id = NEW.tenant_id
       AND l.converted_at IS NULL;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Abrechnung geht vor Messung: niemals einen Abo-Schreibvorgang blockieren.
  RAISE WARNING 'subscriptions_funnel_events failed: %', SQLSTATE;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.subscriptions_funnel_events() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_subscriptions_funnel_events ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_funnel_events
  AFTER INSERT OR UPDATE OF status ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.subscriptions_funnel_events();

-- ── 7. Lead-Verwaltung (nur Plattform-Operatoren) ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_funnel_leads(
  p_stage text DEFAULT NULL,
  p_limit integer DEFAULT 200
)
RETURNS TABLE (
  id               uuid,
  domain           text,
  email            text,
  company          text,
  source           text,
  created_at       timestamptz,
  last_activity_at timestamptz,
  funnel_stage     text,
  scan_status      text,
  audit_id         uuid,
  registered       boolean,
  pilot_status     text,
  conversion_stage text,
  marketing_consent boolean,
  followup_confirmed boolean,
  submission_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Plattform-Rolle aus der einzigen schreibbaren Quelle (ADR 0011).
  IF NOT public.is_platform_operator() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_stage IS NOT NULL AND p_stage NOT IN ('new', 'scan_started', 'scan_completed', 'pilot_started', 'customer') THEN
    RAISE EXCEPTION 'invalid stage filter' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT l.*,
           sub.status                 AS sub_status,
           sub.stripe_subscription_id AS sub_stripe_id
      FROM public.sales_leads l
      LEFT JOIN LATERAL (
        SELECT s.status, s.stripe_subscription_id
          FROM public.subscriptions s
         WHERE l.tenant_id IS NOT NULL AND s.tenant_id = l.tenant_id
         ORDER BY s.updated_at DESC
         LIMIT 1
      ) sub ON true
     WHERE l.lead_key IS NOT NULL
  ), staged AS (
    SELECT b.*,
           CASE
             WHEN b.converted_at IS NOT NULL
               OR (b.sub_status = 'active' AND b.sub_stripe_id IS NOT NULL) THEN 'customer'
             WHEN b.sub_status = 'trialing' THEN 'pilot_started'
             WHEN b.funnel_stage IN ('scan_completed', 'registered') THEN 'scan_completed'
             WHEN b.funnel_stage IN ('scan_started', 'scan_failed') THEN 'scan_started'
             ELSE 'new'
           END AS conv
      FROM base b
  )
  SELECT s.id, s.company_domain, s.email, s.company, s.source, s.created_at,
         coalesce(s.last_activity_at, s.created_at),
         s.funnel_stage,
         CASE s.funnel_stage
           WHEN 'scan_started'   THEN 'running'
           WHEN 'scan_failed'    THEN 'failed'
           WHEN 'scan_completed' THEN 'completed'
           WHEN 'registered'     THEN CASE WHEN s.audit_id IS NULL THEN 'none' ELSE 'completed' END
           ELSE 'none'
         END,
         s.audit_id,
         s.tenant_id IS NOT NULL,
         CASE
           WHEN s.sub_status = 'trialing' THEN 'pilot'
           WHEN s.sub_status = 'active' AND s.sub_stripe_id IS NOT NULL THEN 'paid'
           WHEN s.sub_status = 'active' THEN 'free'
           WHEN s.sub_status IS NULL THEN 'none'
           ELSE s.sub_status
         END,
         s.conv,
         s.marketing_consent AND s.marketing_consent_revoked_at IS NULL,
         s.followup_doi_confirmed_at IS NOT NULL AND s.marketing_consent_revoked_at IS NULL,
         s.submission_count
    FROM staged s
   WHERE p_stage IS NULL OR s.conv = p_stage
   ORDER BY coalesce(s.last_activity_at, s.created_at) DESC
   LIMIT greatest(1, least(coalesce(p_limit, 200), 1000));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_funnel_leads(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_funnel_leads(text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_funnel_kpis(p_days integer DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_since   timestamptz := pg_catalog.now() - make_interval(days => greatest(1, least(coalesce(p_days, 90), 3650)));
  v_total   bigint;
  v_started bigint;
  v_done    bigint;
  v_pilot   bigint;
  v_cust    bigint;
  v_by_src  jsonb;
BEGIN
  -- Plattform-Rolle aus der einzigen schreibbaren Quelle (ADR 0011).
  IF NOT public.is_platform_operator() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  WITH leads AS (
    SELECT l.*,
           (SELECT s.status FROM public.subscriptions s
             WHERE l.tenant_id IS NOT NULL AND s.tenant_id = l.tenant_id
             ORDER BY s.updated_at DESC LIMIT 1) AS sub_status,
           (SELECT s.stripe_subscription_id FROM public.subscriptions s
             WHERE l.tenant_id IS NOT NULL AND s.tenant_id = l.tenant_id
             ORDER BY s.updated_at DESC LIMIT 1) AS sub_stripe_id,
           EXISTS (SELECT 1 FROM public.subscriptions s
                    WHERE l.tenant_id IS NOT NULL AND s.tenant_id = l.tenant_id
                      AND (s.trial_end IS NOT NULL OR s.trial_ends_at IS NOT NULL OR s.status = 'trialing')) AS had_trial
      FROM public.sales_leads l
     WHERE l.lead_key IS NOT NULL AND l.created_at >= v_since
  )
  SELECT count(*),
         count(*) FILTER (WHERE funnel_stage IN ('scan_started', 'scan_failed', 'scan_completed', 'registered')),
         count(*) FILTER (WHERE funnel_stage = 'scan_completed' OR (funnel_stage = 'registered' AND audit_id IS NOT NULL)),
         count(*) FILTER (WHERE had_trial OR sub_status = 'trialing'),
         count(*) FILTER (WHERE converted_at IS NOT NULL OR (sub_status = 'active' AND sub_stripe_id IS NOT NULL))
    INTO v_total, v_started, v_done, v_pilot, v_cust
    FROM leads;

  SELECT coalesce(jsonb_object_agg(src, n), '{}'::jsonb) INTO v_by_src
    FROM (
      SELECT coalesce(l.source, 'unknown') AS src, count(*) AS n
        FROM public.sales_leads l
       WHERE l.lead_key IS NOT NULL AND l.created_at >= v_since
       GROUP BY 1
    ) x;

  -- Quoten sind NULL, wenn der Nenner 0 ist — keine erfundenen Zahlen.
  RETURN jsonb_build_object(
    'window_days', greatest(1, least(coalesce(p_days, 90), 3650)),
    'leads_total', v_total,
    'leads_by_source', v_by_src,
    'scans_started', v_started,
    'scans_completed', v_done,
    'scan_completion_rate', CASE WHEN v_started > 0 THEN round(v_done::numeric / v_started, 4) END,
    'pilots', v_pilot,
    'customers', v_cust,
    'lead_to_pilot_rate', CASE WHEN v_total > 0 THEN round(v_pilot::numeric / v_total, 4) END,
    'pilot_to_customer_rate', CASE WHEN v_pilot > 0 THEN round(v_cust::numeric / v_pilot, 4) END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_funnel_kpis(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_funnel_kpis(integer) TO authenticated;

-- ── 8. Double-Opt-in für Follow-up-E-Mails ─────────────────────────────────
--
-- Die Checkbox im Scan ist die Einwilligung; wirksam für Werbung wird sie
-- erst mit der Bestätigung per Link (DOI). Der Token hängt am Lead, nicht am
-- Audit: Wer mehrfach scannt, bekommt nicht mehrere Bestätigungs-Mails.

CREATE OR REPLACE FUNCTION public.request_followup_doi(p_lead_id uuid)
RETURNS TABLE (token uuid, email text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- Höchstens eine Bestätigungs-Mail pro 24 h; bestätigte Leads nie erneut.
  RETURN QUERY
  UPDATE public.sales_leads l
     SET followup_doi_token   = coalesce(l.followup_doi_token, gen_random_uuid()),
         followup_doi_sent_at = pg_catalog.now()
   WHERE l.id = p_lead_id
     AND l.lead_key IS NOT NULL
     AND l.followup_doi_confirmed_at IS NULL
     AND l.marketing_consent_revoked_at IS NULL
     AND (l.followup_doi_sent_at IS NULL OR l.followup_doi_sent_at < pg_catalog.now() - interval '24 hours')
  RETURNING l.followup_doi_token, l.email;
END;
$$;

REVOKE ALL ON FUNCTION public.request_followup_doi(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_followup_doi(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.confirm_followup_doi(p_token uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_confirmed timestamptz;
  v_revoked   timestamptz;
  v_id        uuid;
BEGIN
  IF p_token IS NULL THEN RETURN 'not_found'; END IF;
  SELECT l.id, l.followup_doi_confirmed_at, l.marketing_consent_revoked_at
    INTO v_id, v_confirmed, v_revoked
    FROM public.sales_leads l
   WHERE l.followup_doi_token = p_token
   FOR UPDATE;
  IF v_id IS NULL THEN RETURN 'not_found'; END IF;
  IF v_revoked IS NOT NULL THEN RETURN 'revoked'; END IF;
  IF v_confirmed IS NOT NULL THEN RETURN 'already_confirmed'; END IF;
  -- Bestätigungs-Links verfallen nach 30 Tagen.
  IF EXISTS (SELECT 1 FROM public.sales_leads l
              WHERE l.id = v_id AND l.followup_doi_sent_at < pg_catalog.now() - interval '30 days') THEN
    RETURN 'expired';
  END IF;
  UPDATE public.sales_leads
     SET followup_doi_confirmed_at = pg_catalog.now(),
         last_activity_at = pg_catalog.now()
   WHERE id = v_id;
  RETURN 'confirmed';
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_followup_doi(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_followup_doi(uuid) TO service_role;

-- ── 9. Follow-up-Mails nur mit Einwilligung UND Double-Opt-in ──────────────
--
-- Befund (Repo-Schema 20260507120000): `trg_audit_create_drip` legt für JEDES
-- Audit mit E-Mail eine dreiteilige Mail-Serie an (Tag 3/14/30, Mail 3 bewirbt
-- „Audit-Pro“), und `audit_email_drip_due` prüft keine Einwilligung. Seit der
-- Scan direkt nach Schritt 1 startet, entstünden solche Serien auch für
-- Besucher, die den Stepper danach verlassen. Ein Scan ist kein Opt-in.
--
-- Das Gate sitzt an der Stelle, die den Versand freigibt: Fällig ist eine
-- Serie nur, wenn das Audit eine wirksame Einwilligung trägt (Regel aus
-- 20261008133000) UND der verknüpfte Lead den Double-Opt-in bestätigt hat.
-- Die Drip-Zeilen bleiben unangetastet; bestätigt jemand später, laufen die
-- fälligen Mails ab dann.
--
-- Abgesichert wie 20261008133000: Im Live-Projekt können Drip-Objekte oder
-- Consent-Spalten fehlen (Ledger-Abweichung). Dann wird nichts ersetzt und
-- die Migration läuft trotzdem durch (kein Abbruch von `db push`).
DO $drip$
BEGIN
  IF to_regclass('public.audit_email_drip') IS NOT NULL
     AND to_regprocedure('public.audit_email_drip_due(integer)') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'gdpr_audits'
                    AND column_name = 'marketing_consent_revoked_at') THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.audit_email_drip_due(p_limit int DEFAULT 50)
      RETURNS TABLE (id uuid, audit_id uuid, email text, current_step int, unsubscribe_token uuid)
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public, pg_catalog
      AS $body$
        SELECT d.id, d.audit_id, d.email, d.current_step, d.unsubscribe_token
          FROM public.audit_email_drip d
          JOIN public.gdpr_audits a ON a.id = d.audit_id
          JOIN public.sales_leads l ON l.id = a.sales_lead_id
         WHERE d.unsubscribed = false
           AND d.next_send_at IS NOT NULL
           AND d.next_send_at <= now()
           AND d.current_step < 3
           AND a.marketing_consent = true
           AND a.marketing_consent_revoked_at IS NULL
           AND l.followup_doi_confirmed_at IS NOT NULL
           AND l.marketing_consent_revoked_at IS NULL
         ORDER BY d.next_send_at ASC
         LIMIT p_limit;
      $body$
    $fn$;
    REVOKE ALL ON FUNCTION public.audit_email_drip_due(int) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.audit_email_drip_due(int) TO service_role;
  ELSE
    RAISE NOTICE 'audit_email_drip objects or consent columns missing — drip consent gate skipped';
  END IF;
END
$drip$;

-- ── 10. Art. 17: Lead-Daten einer Person löschen ───────────────────────────
--
-- Wird von gdpr-delete (Konto-Löschung) und von der Lead-Verwaltung
-- (Löschanfrage ohne Konto) aufgerufen. Löscht Leads und Anmeldungen der
-- Adresse, anonymisiert Scans (das Ergebnis zur Domain bleibt, die Person
-- nicht) und beendet laufende Mail-Serien. Rechnungsdaten liegen nicht hier.

-- Nachweis jeder Löschung (Art. 5 Abs. 2, Art. 17): wann, auf welchem Weg,
-- wie viel, und bei Operator-Löschungen wer gehandelt hat.
--
-- BEWUSST KEIN BEZUG ZUR PERSON. Weder Adresse noch Hash noch Konto-ID: Ein
-- Hash vorhersagbarer Adressen ist per Vergleich wiedererkennbar (Prüfung
-- vom 19.10.2026), und ein HMAC bräuchte einen Schlüssel, den die rein in
-- SQL laufende Operator-Löschung in der Datenbank halten müsste. Stattdessen
-- ist die Zeilen-ID eine zufällige Vorgangsnummer: Sie geht als Beleg an die
-- betroffene Person (Antwort von gdpr-delete bzw. Anzeige in /app/leads) und
-- lässt sich nicht aus der Adresse zurückrechnen.
--
-- Aufbewahrung: 3 Jahre (purge_stale_funnel_leads), danach gelöscht.
-- RLS an, keine Policy: Schreiben nur über erase_lead_data, Lesen nur
-- service_role.
CREATE TABLE IF NOT EXISTS public.lead_erasure_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin           text NOT NULL CHECK (origin IN ('account_deletion', 'operator_request')),
  operator_user_id uuid,
  counts           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_erasure_log_operator_chk CHECK (
    (origin = 'operator_request' AND operator_user_id IS NOT NULL)
    OR (origin = 'account_deletion' AND operator_user_id IS NULL)
  )
);
ALTER TABLE public.lead_erasure_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lead_erasure_log FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.lead_erasure_log TO service_role;

COMMENT ON TABLE public.lead_erasure_log IS
  'Nachweis von Art.-17-Löschungen der Lead-/Scan-Daten ohne Personenbezug; id = Vorgangsnummer für die betroffene Person. Aufbewahrung 3 Jahre. Kein Client-Zugriff.';

DROP FUNCTION IF EXISTS public.erase_lead_data(text, uuid);

CREATE OR REPLACE FUNCTION public.erase_lead_data(
  p_email   text,
  p_user_id uuid DEFAULT NULL,
  p_origin  text DEFAULT 'account_deletion',
  p_actor   uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_leads  integer := 0;
  v_audits integer := 0;
  v_drips  integer := 0;
  v_news   integer := 0;
  v_wait   integer := 0;
  v_counts jsonb;
  v_receipt uuid;
BEGIN
  IF v_email = '' AND p_user_id IS NULL THEN
    RAISE EXCEPTION 'email or user required' USING ERRCODE = '22023';
  END IF;
  IF p_origin IS NULL OR p_origin NOT IN ('account_deletion', 'operator_request') THEN
    RAISE EXCEPTION 'invalid origin' USING ERRCODE = '22023';
  END IF;
  IF p_origin = 'operator_request' AND p_actor IS NULL THEN
    RAISE EXCEPTION 'operator required' USING ERRCODE = '22023';
  END IF;

  IF to_regclass('public.audit_email_drip') IS NOT NULL AND v_email <> '' THEN
    EXECUTE 'DELETE FROM public.audit_email_drip WHERE lower(email) = $1' USING v_email;
    GET DIAGNOSTICS v_drips = ROW_COUNT;
  END IF;

  UPDATE public.gdpr_audits a
     SET email = '', company = NULL, ip_hash = '', user_agent = NULL  -- ip_hash ist NOT NULL
   WHERE (v_email <> '' AND lower(a.email) = v_email)
      OR (p_user_id IS NOT NULL AND a.user_id = p_user_id AND a.email <> '');
  GET DIAGNOSTICS v_audits = ROW_COUNT;

  DELETE FROM public.sales_leads l
   WHERE (v_email <> '' AND lower(l.email) = v_email)
      OR (p_user_id IS NOT NULL AND l.user_id = p_user_id);
  GET DIAGNOSTICS v_leads = ROW_COUNT;

  IF to_regclass('public.newsletter_subscribers') IS NOT NULL AND v_email <> '' THEN
    EXECUTE 'DELETE FROM public.newsletter_subscribers WHERE lower(email) = $1' USING v_email;
    GET DIAGNOSTICS v_news = ROW_COUNT;
  END IF;
  IF to_regclass('public.waitlist_signups') IS NOT NULL AND v_email <> '' THEN
    EXECUTE 'DELETE FROM public.waitlist_signups WHERE lower(email) = $1' USING v_email;
    GET DIAGNOSTICS v_wait = ROW_COUNT;
  END IF;

  v_counts := jsonb_build_object(
    'sales_leads_deleted', v_leads,
    'gdpr_audits_anonymized', v_audits,
    'drip_rows_deleted', v_drips,
    'newsletter_rows_deleted', v_news,
    'waitlist_rows_deleted', v_wait
  );

  -- Im selben Statement wie die Löschung: ohne Nachweis keine Löschung.
  -- Kein Personenbezug im Nachweis (siehe Tabellenkommentar).
  INSERT INTO public.lead_erasure_log (origin, operator_user_id, counts)
  VALUES (p_origin, CASE WHEN p_origin = 'operator_request' THEN p_actor END, v_counts)
  RETURNING id INTO v_receipt;

  RETURN v_counts || jsonb_build_object('receipt_id', v_receipt);
END;
$$;

REVOKE ALL ON FUNCTION public.erase_lead_data(text, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.erase_lead_data(text, uuid, text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_erase_lead_data(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_platform_operator() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_email IS NULL OR position('@' IN p_email) < 2 THEN
    RAISE EXCEPTION 'email required' USING ERRCODE = '22023';
  END IF;
  -- Konten löscht nur der Nutzer selbst (gdpr-delete) — hier nur Lead-Daten.
  v_result := public.erase_lead_data(p_email, NULL, 'operator_request', auth.uid());
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_erase_lead_data(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_erase_lead_data(text) TO authenticated;

-- ── 11. Löschkonzept (Funktion; Einplanung in 20261015130000) ──────────────

CREATE OR REPLACE FUNCTION public.purge_stale_funnel_leads(p_inactive_for interval DEFAULT interval '12 months')
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF p_inactive_for IS NULL OR p_inactive_for < interval '30 days' THEN
    RAISE EXCEPTION 'retention below 30 days refused' USING ERRCODE = '22023';
  END IF;
  -- Gelöscht werden Funnel-Leads ohne Konto, ohne Kauf und ohne bestätigte,
  -- nicht widerrufene Einwilligung. gdpr_audits.sales_lead_id wird per FK auf
  -- NULL gesetzt (ON DELETE SET NULL).
  DELETE FROM public.sales_leads l
   WHERE l.lead_key IS NOT NULL
     AND l.tenant_id IS NULL
     AND l.converted_at IS NULL
     AND NOT (l.followup_doi_confirmed_at IS NOT NULL AND l.marketing_consent_revoked_at IS NULL)
     AND coalesce(l.last_activity_at, l.created_at) < pg_catalog.now() - p_inactive_for;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- Lösch-Nachweise werden nach 3 Jahren selbst gelöscht (Regelverjährung
  -- § 195 BGB als Obergrenze für die Nachweispflicht; Frist ist Teil der
  -- Freigabe zur Löschfrist).
  DELETE FROM public.lead_erasure_log g
   WHERE g.created_at < pg_catalog.now() - interval '3 years';

  -- Anonyme Scans ohne Lead und ohne Konto verlieren nach derselben Frist
  -- ihren Personenbezug; das Ergebnis zur Domain bleibt.
  UPDATE public.gdpr_audits a
     SET email = '', company = NULL, ip_hash = '', user_agent = NULL  -- ip_hash ist NOT NULL
   WHERE a.claimed_at IS NULL
     AND a.sales_lead_id IS NULL
     AND a.email <> ''
     AND a.created_at < pg_catalog.now() - p_inactive_for;

  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_stale_funnel_leads(interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_stale_funnel_leads(interval) TO service_role;

COMMENT ON FUNCTION public.purge_stale_funnel_leads(interval) IS
  'Löschkonzept für Funnel-Leads ohne Konto/Kauf/bestätigte Einwilligung; anonymisiert alte anonyme Scans. Eingeplant in 20261015130000.';

COMMIT;
