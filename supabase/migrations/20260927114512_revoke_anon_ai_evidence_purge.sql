-- ai_evidence_purge_expired: EXECUTE fuer anon/authenticated entziehen.
--
-- Befund (gemessen 2026-09-27 gegen Produktion, Supabase-Security-Advisor
-- "anon_security_definer_function_executable" + has_function_privilege):
-- Die Funktion ist SECURITY DEFINER, prueft keinen Aufrufer und war fuer
-- anon und authenticated ausfuehrbar — also per
--   POST /rest/v1/rpc/ai_evidence_purge_expired
--   {"p_tenant_id": "<uuid>", "p_dry_run": false}
-- ohne Anmeldung fuer jeden Mandanten ausloesbar.
--
-- Absicht war das nie: 20260901090000_evidence_append_only_anchors.sql
-- schreibt "REVOKE ALL ... FROM PUBLIC; GRANT EXECUTE ... TO service_role".
-- In Supabase reicht REVOKE FROM PUBLIC aber nicht: die Default Privileges
-- des Schemas `public` vergeben EXECUTE an anon und authenticated DIREKT,
-- nicht ueber PUBLIC. Gleiches Muster wie
-- 20260825000000_siteos_anonymous_builds_retention.sql.
--
-- Rein additiv: keine Daten, keine Signatur, kein Koerper wird geaendert.
-- Kein Client-Aufrufer im Repo (nur service_role / DB-Tests).

REVOKE ALL ON FUNCTION public.ai_evidence_purge_expired(UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ai_evidence_purge_expired(UUID, BOOLEAN) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_evidence_purge_expired(UUID, BOOLEAN) TO service_role;
