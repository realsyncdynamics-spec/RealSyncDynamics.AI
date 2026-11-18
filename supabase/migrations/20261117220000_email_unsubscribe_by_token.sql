-- Issue #2282: tokenbasierte, idempotente E-Mail-Abmeldung.
-- DRAFT — nicht ohne Owner-Freigabe anwenden. Abhängig von RSD-011 (audit_email_drip)
-- und RSD-015 (#2278, sub_processor_subscriptions). Fehlen die Tabellen (Produktion
-- am 17.11.2026), tut die Funktion nichts und meldet keinen Fehler.
--
-- Aufrufer: Cloudflare-Pages-Functions /api/sp-unsubscribe und /api/drip-unsubscribe
-- (POST, src/lib/emailUnsubscribe.ts) mit dem öffentlichen anon-Key.
--
-- Sicherheitsmodell:
--  * Autorität ist allein der 122-Bit-Zufallstoken (gen_random_uuid) aus der Mail.
--  * SECURITY DEFINER mit leerem search_path; anon erhält NUR EXECUTE auf diese
--    Funktion, keinerlei Tabellenrechte.
--  * Rückgabe void: gültige, unbekannte und bereits abgemeldete Tokens sind von
--    außen nicht unterscheidbar (keine Enumeration).
--  * Nur Abmelden, nie Anmelden: kein Pfad setzt unsubscribed zurück.
--  * Idempotent: Updates nur auf noch aktive Zeilen; der erste Zeitstempel bleibt.
--  * Versandsperre sofort: audit_email_drip_due() filtert unsubscribed = false,
--    sub-processor-notify filtert unsubscribed_at IS NULL.

CREATE OR REPLACE FUNCTION public.email_unsubscribe_by_token(p_list text, p_token uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_email text;
BEGIN
  IF p_token IS NULL THEN
    RETURN;
  END IF;

  IF p_list = 'sp' THEN
    IF to_regclass('public.sub_processor_subscriptions') IS NULL THEN
      RETURN;
    END IF;
    UPDATE public.sub_processor_subscriptions
       SET unsubscribed_at = now()
     WHERE unsub_token = p_token
       AND unsubscribed_at IS NULL;

  ELSIF p_list = 'drip' THEN
    IF to_regclass('public.audit_email_drip') IS NULL THEN
      RETURN;
    END IF;
    SELECT d.email INTO v_email
      FROM public.audit_email_drip d
     WHERE d.unsubscribe_token = p_token;
    IF v_email IS NULL THEN
      RETURN;
    END IF;
    -- Abmeldung gilt für die Adresse, nicht nur für eine einzelne Audit-Sequenz:
    -- Wer abbestellt, soll auch aus parallel laufenden Drips desselben Postfachs fallen.
    UPDATE public.audit_email_drip d
       SET unsubscribed = true,
           next_send_at = NULL,
           updated_at   = now()
     WHERE lower(d.email) = lower(v_email)
       AND d.unsubscribed = false;
  END IF;
  -- Unbekannte Liste: stillschweigend nichts tun (keine Information nach außen).
END
$fn$;

COMMENT ON FUNCTION public.email_unsubscribe_by_token(text, uuid) IS
  'Issue #2282: idempotente Abmeldung per Mail-Token (sp | drip). Rückgabe void, keine Enumeration.';

REVOKE ALL ON FUNCTION public.email_unsubscribe_by_token(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_unsubscribe_by_token(text, uuid) TO anon, authenticated, service_role;
