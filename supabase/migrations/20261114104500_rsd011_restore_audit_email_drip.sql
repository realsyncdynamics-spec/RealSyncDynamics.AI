-- RSD-011 / RSD-004: Audit-Email-Drip-Objekte additiv wiederherstellen.
--
-- Live-Befund (SELECT 13.11.2026, ebljyceifhnlzhjfyxup, nur lesend):
--   to_regclass('public.audit_email_drip') IS NULL
--   to_regprocedure('public.audit_email_drip_due(integer)') IS NULL
--   to_regprocedure('public.audit_email_drip_advance(uuid,text)') IS NULL
--   to_regprocedure('public.audit_email_drip_create_for_audit()') IS NULL
--   kein Trigger trg_audit_create_drip
--   Trotzdem stehen 20260507120000_audit_email_drip und
--   20261015120000_funnel_lead_capture in schema_migrations.
--   Consent-/DOI-Spalten an gdpr_audits / sales_leads sind vorhanden.
--
-- 20261015120000 hat die Funktion nur ersetzt, wenn sie schon existierte
-- (sonst NOTICE und Skip). Deshalb fehlt das Consent-Gate ebenfalls.
--
-- Diese Migration legt fehlende Objekte additiv an und setzt die
-- Funktionskoerper auf den zuletzt intendierten Stand (Original
-- 20260507120000 plus Consent-/DOI-Gate aus 20261015120000).
-- Bestehende gleichnamige Objekte werden nicht umbenannt oder gedroppt.
-- Der bestehende pg_cron-Job audit-email-drip-daily wird nicht veraendert.
-- Keine Secrets, kein HTTP-Aufruf ueber die net-Extension.

-- 1. Tabelle
-- collision-check: allow-existing-table audit_email_drip — RSD-011 stellt die laut Produktionsbefund fehlende Tabelle trotz registrierter Ursprungsmigration idempotent wieder her.
CREATE TABLE IF NOT EXISTS public.audit_email_drip (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id           uuid REFERENCES public.gdpr_audits(id) ON DELETE CASCADE,
  email              text NOT NULL,
  current_step       int NOT NULL DEFAULT 0,
  next_send_at       timestamptz,
  unsubscribed       boolean NOT NULL DEFAULT false,
  unsubscribe_token  uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  last_sent_step     int,
  last_sent_at       timestamptz,
  last_error         text
);

CREATE INDEX IF NOT EXISTS idx_audit_drip_due
  ON public.audit_email_drip (next_send_at)
  WHERE unsubscribed = false AND next_send_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_drip_email
  ON public.audit_email_drip (email);

CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_drip_unsubscribe
  ON public.audit_email_drip (unsubscribe_token);

ALTER TABLE public.audit_email_drip ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "drip_service_all" ON public.audit_email_drip;
CREATE POLICY "drip_service_all"
  ON public.audit_email_drip FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.audit_email_drip IS
  'Audit-Email-Drip-Flow: 3-Step-Sequence (Tag 3 / 14 / 30) nach gdpr_audit-Erstellung. RSD-011 stellt das Objekt additiv wieder her.';

-- 2. Triggerfunktion (Original 20260507120000)
CREATE OR REPLACE FUNCTION public.audit_email_drip_create_for_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.email IS NULL OR NEW.email = '' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.audit_email_drip
     WHERE email = NEW.email AND audit_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.audit_email_drip (audit_id, email, current_step, next_send_at)
  VALUES (NEW.id, NEW.email, 0, now() + interval '3 days');

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_email_drip_create_for_audit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_create_drip ON public.gdpr_audits;
CREATE TRIGGER trg_audit_create_drip
  AFTER INSERT ON public.gdpr_audits
  FOR EACH ROW EXECUTE FUNCTION public.audit_email_drip_create_for_audit();

-- 3. Faellige Zeilen (Signatur 20260507120000, Semantik inkl. Gate 20261015120000)
CREATE OR REPLACE FUNCTION public.audit_email_drip_due(p_limit int DEFAULT 50)
RETURNS TABLE (
  id uuid, audit_id uuid, email text, current_step int, unsubscribe_token uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.audit_email_drip_due(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_email_drip_due(int) TO service_role;

-- 4. Step als gesendet markieren (Original 20260507120000)
CREATE OR REPLACE FUNCTION public.audit_email_drip_advance(
  p_id uuid,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_current int;
  v_next_offset interval;
BEGIN
  SELECT current_step INTO v_current
    FROM public.audit_email_drip WHERE id = p_id;

  IF v_current IS NULL THEN RETURN; END IF;

  IF p_error IS NOT NULL THEN
    UPDATE public.audit_email_drip
       SET last_error = p_error, updated_at = now()
     WHERE id = p_id;
    RETURN;
  END IF;

  v_next_offset := CASE v_current
    WHEN 0 THEN interval '11 days'
    WHEN 1 THEN interval '16 days'
    ELSE NULL
  END;

  UPDATE public.audit_email_drip
     SET current_step = v_current + 1,
         last_sent_step = v_current + 1,
         last_sent_at = now(),
         updated_at = now(),
         last_error = NULL,
         next_send_at = CASE
           WHEN v_current + 1 < 3 THEN now() + v_next_offset
           ELSE NULL
         END
   WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_email_drip_advance(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_email_drip_advance(uuid, text) TO service_role;
