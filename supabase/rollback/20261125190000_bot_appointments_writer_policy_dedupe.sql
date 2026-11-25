-- Rückbau von 20261125190000_bot_appointments_writer_policy_dedupe.sql
--
-- NICHT im Migrationsordner: nur manuell und nach Freigabe ausführen.
-- Stellt den Stand vor der Migration her:
--   - "bot_appointments tenant-update" wieder mit is_tenant_member
--     (jedes Mitglied, auch viewer_auditor, darf ändern)
--   - UPDATE wieder auf allen Spalten für anon und authenticated
--   - Unique-Index entfernt (doppelte offene Anfragen wieder möglich)
-- appointment-book bleibt danach funktionsfähig; der 23505-Zweig greift
-- dann nur nicht mehr, die Duplikatprüfung im Code bleibt.

BEGIN;

DROP INDEX IF EXISTS public.bot_appointments_open_conversation_uniq;

DROP POLICY IF EXISTS "bot_appointments tenant-update" ON public.bot_appointments;
CREATE POLICY "bot_appointments tenant-update"
  ON public.bot_appointments FOR UPDATE
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

REVOKE UPDATE (status) ON public.bot_appointments FROM authenticated;
GRANT UPDATE ON public.bot_appointments TO anon, authenticated;

COMMIT;
