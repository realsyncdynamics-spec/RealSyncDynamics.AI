-- create_api_key: EXECUTE fuer authenticated (und anon) entziehen.
--
-- Befund (gemessen 2026-10-19 gegen Produktion, Production Audit):
-- Die Funktion ist SECURITY DEFINER und legt einen Schluessel fuer das
-- uebergebene p_tenant_id mit den uebergebenen p_scopes an. Sie prueft weder
-- Mitgliedschaft noch Rolle; auth.uid() landet nur in created_by. Auf
-- public.api_keys liegt kein Trigger, RLS greift unter SECURITY DEFINER nicht.
-- Jeder angemeldete Nutzer konnte also per
--   POST /rest/v1/rpc/create_api_key
--   {"p_tenant_id": "<fremder Mandant>", "p_name": "x", "p_scopes": [...]}
-- einen API-Schluessel fuer einen fremden Mandanten mit frei gewaehlten
-- Scopes erzeugen.
--
-- Ausnutzbar war das bisher nur deshalb nicht, weil verify_api_key die
-- Praefix-Extraktion falsch rechnet und keinen Schluessel anerkennt. Dieser
-- Entzug muss deshalb VOR jeder Reparatur von verify_api_key in Produktion
-- liegen.
--
-- Kein Client-Aufrufer: Im Repo ruft niemand rpc('create_api_key') auf. Die
-- Oberflaeche (GovernanceApiKeysView) schickt action 'create_api_key' an die
-- Edge Function governance-resources, die diese Aktion nicht kennt. Der
-- Entzug bricht also keinen bestehenden Pfad. Ein kuenftiger Erstellpfad
-- gehoert in eine Edge Function mit Owner/Admin-Pruefung (service_role).
--
-- Rein additiv: keine Daten, keine Signatur, kein Koerper wird geaendert.
-- Gleiches Muster wie 20260927114512_revoke_anon_ai_evidence_purge.sql:
-- REVOKE FROM PUBLIC allein reicht in Supabase nicht, weil die Default
-- Privileges des Schemas public anon und authenticated DIREKT berechtigen.
--
-- Begleitend: scripts/check-function-acl-drift.mjs fuehrt create_api_key
-- nicht mehr als Pflicht fuer authenticated, sondern als verboten fuer
-- Clients.

REVOKE ALL ON FUNCTION public.create_api_key(UUID, TEXT, TEXT[], INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_api_key(UUID, TEXT, TEXT[], INTEGER) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_api_key(UUID, TEXT, TEXT[], INTEGER) TO service_role;
