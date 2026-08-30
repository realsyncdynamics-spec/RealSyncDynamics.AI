-- Lockdown der Audit-Job-Worker-Funktionen fuer Client-Rollen.
--
-- Befund des Function-ACL-Drift-Guards (2026-08-23, gegen RealSyncDynamicsLive
-- gemessen): `audit_jobs_claim_next` und `audit_jobs_complete` waren fuer
-- `anon`/`authenticated` aufrufbar, obwohl ihre Ursprungs-Migration sie per
-- `revoke all ... from public; grant ... to service_role` auf den
-- Scan-Worker beschraenken wollte.
--
-- Ursache ist ein Postgres-Footgun: `REVOKE ... FROM PUBLIC` entfernt nur den
-- PUBLIC-Pseudo-Rollen-Eintrag, NICHT die expliziten `anon`/`authenticated`-
-- Grants, die Supabase-Default-Privileges jeder neuen Funktion mitgeben.
-- Die Rollen muessen einzeln entzogen werden. (Gleicher Fehler ist auf
-- frischem Postgres/CI reproduzierbar — diese Migration korrigiert beides.)
--
-- Warum genau diese zwei und nicht mehr: 20260822000000 hat beide Funktionen
-- per CREATE OR REPLACE neu angelegt — NACH dem Bulk-Revoke vom ACL-Vorfall.
-- Dabei kamen die Default-Grants frisch zurueck, und das REVOKE FROM PUBLIC
-- derselben Migration liess sie stehen. Merksatz fuer kuenftige Migrationen:
-- Worker-Funktionen immer mit `from public, anon, authenticated` sperren.
--
-- Sicherheitsrelevanz: Beide Funktionen sind SECURITY DEFINER und gehoeren
-- exklusiv dem Scan-Worker (services/playwright-scanner, service_role).
-- Client-aufrufbar koennte ein beliebiger Nutzer Audit-Jobs claimen oder
-- fremde Jobs als abgeschlossen markieren — das faelscht den Prueffpfad.
--
-- Idempotent: REVOKE ist wiederholbar; service_role behaelt seinen Grant.

revoke execute on function public.audit_jobs_claim_next(text)
    from public, anon, authenticated;

revoke execute on function public.audit_jobs_complete(uuid, text, uuid, jsonb, text)
    from public, anon, authenticated;
