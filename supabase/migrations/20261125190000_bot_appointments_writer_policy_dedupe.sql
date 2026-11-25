-- bot_appointments: Schreibrecht nur für schreibende Rollen, atomarer
-- Schutz vor doppelten Terminanfragen derselben Konversation.
--
-- 1. Policy "bot_appointments tenant-update"
--    Bisher: is_tenant_member(tenant_id) — jedes Mitglied, auch die
--    Nur-Lese-Rolle viewer_auditor, durfte Termine ändern.
--    Neu: is_tenant_writer(tenant_id) (owner, admin, dpo, editor), gleiche
--    Funktion wie in den übrigen Schreib-Policies. Lesen bleibt unverändert.
--    Der Posteingang (src/features/bots/api.ts setAppointmentStatus) bleibt
--    für schreibende Rollen nutzbar. Inserts laufen weiter nur über die
--    Service-Role (appointment-book, agent-runtime); dafür gibt es keine
--    Policy, daran ändert sich nichts.
--
-- 2. Partieller Unique-Index bot_appointments_open_conversation_uniq
--    Eine offene Anfrage (status = 'requested') je Mandant, Bot,
--    Konversation, Name und Wunschtermin. Gilt nur mit conversation_id;
--    Anfragen ohne Konversation (z. B. agent-runtime) sind nicht betroffen.
--    Folgetermine (anderer Wunschtermin) und erneute Anfragen nach
--    Bestätigung oder Absage bleiben möglich.
--    appointment-book fängt den Konflikt (23505) ab und gibt den
--    bestehenden Termin zurück.
--
-- Nicht destruktiv: keine Daten werden gelöscht oder geändert. Bestehen
-- bereits Duplikate, bricht der Index-Aufbau ab statt Daten zu entfernen
-- (Produktion 25.11.2026: 0 Zeilen in bot_appointments).

DO $appt_policy$
BEGIN
  IF to_regclass('public.bot_appointments') IS NULL THEN
    RETURN;
  END IF;
  IF to_regprocedure('public.is_tenant_writer(uuid)') IS NULL THEN
    RAISE EXCEPTION 'public.is_tenant_writer(uuid) fehlt — Policy wird nicht ohne Rollenprüfung ersetzt';
  END IF;

  DROP POLICY IF EXISTS "bot_appointments tenant-update" ON public.bot_appointments;
  CREATE POLICY "bot_appointments tenant-update"
    ON public.bot_appointments FOR UPDATE
    USING (public.is_tenant_writer(tenant_id))
    WITH CHECK (public.is_tenant_writer(tenant_id));
END
$appt_policy$;

CREATE UNIQUE INDEX IF NOT EXISTS bot_appointments_open_conversation_uniq
  ON public.bot_appointments (
    tenant_id,
    bot_id,
    conversation_id,
    customer_name,
    (COALESCE(requested_at, '1970-01-01 00:00:00+00'::timestamptz))
  )
  WHERE status = 'requested' AND conversation_id IS NOT NULL;

COMMENT ON INDEX public.bot_appointments_open_conversation_uniq IS
  'Eine offene Terminanfrage je Konversation, Name und Wunschtermin (appointment-book, atomarer Duplikatschutz).';
