-- nur lesend
--
-- Schule DIGITAL – Live-Messung von RLS und Grants.
-- Status: KONZEPT / Hilfsabfrage. Diese Datei ändert nichts.
-- Stand der zugehörigen Analyse: 27.11.2026, main @ a53dce7c.
--
-- Zweck: In der Produktionsdatenbank (Supabase SQL-Editor, Transaktion
-- ohne Schreibrechte oder vergleichbarer Lesezugriff) prüfen, ob die im
-- Repo dokumentierte RLS-Schuld und die beiden Mandantenmodelle live so
-- vorliegen, wie das Schema im Repository es nahelegt.
--
-- Strikt nur SELECT. Kein INSERT, UPDATE, DELETE, DDL, GRANT, REVOKE,
-- kein ENABLE/DISABLE ROW LEVEL SECURITY, kein VACUUM, keine Funktion
-- mit Nebenwirkung.
--
-- Tabellen der ersten Abfrage:
--   * die acht Einträge aus test/runtime/db/security-regressions.db.test.ts:540-549
--   * organizations / organization_members (NOVA H1, Hinweis, NICHT VERIFIZIERT)
--   * tenants / tenant_memberships / memberships (Mandantenmodell; tenants
--     ist in supabase/migrations/ nicht per CREATE TABLE definiert)
--   * user_consents (Consent-Bestand)
-- Fehlende Relationen liefern einfach keine Zeile; das ist ein Befund,
-- kein Fehler der Abfrage.
--
-- Keine Kundendaten, keine Policy-Ausdrücke mit personenbezogenen Werten,
-- keine Secret-Werte. Ausgabe nur Relationenname, RLS-Flags und Grants.

select c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and c.relname in ('_circuit_breakers','_operation_metrics','_rate_limits',
    'memory_retention_policies','provenance_records','seo_marketing_audit_log',
    'social_publishing_metrics_hourly','subscription_addons',
    'organizations','organization_members','tenants','tenant_memberships',
    'memberships','user_consents')
order by 1;

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon','authenticated')
  and table_name in ('provenance_records','subscription_addons',
    'organizations','organization_members','tenants','tenant_memberships')
order by 1, 2, 3;
