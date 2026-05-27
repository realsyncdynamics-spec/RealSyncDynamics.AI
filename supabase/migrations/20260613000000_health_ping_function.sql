-- Health-Probe-Funktion fuer den /functions/v1/health Endpoint.
--
-- Bewusst trivial: keine Table-Reads, keine RLS-Touchpoints, kein Side-Effect.
-- Dient ausschliesslich als billiger "DB ist erreichbar"-Roundtrip aus der
-- Edge Function. STABLE statt VOLATILE → kein WAL-Write, niedrigste Last.
--
-- Sicherheit:
--   - SECURITY INVOKER (Default) — laeuft mit den Rechten des Callers.
--   - Keine personenbezogenen oder konfigurationsabhaengigen Daten.
--   - Execute-Recht fuer anon, authenticated, service_role — der Endpoint
--     ist oeffentlich (verify_jwt=false in supabase/config.toml).

create or replace function public.health_ping()
returns text
language sql
stable
as $$
  select 'ok'::text;
$$;

grant execute on function public.health_ping() to anon, authenticated, service_role;
