-- agent-os-runner-hourly abschalten.
--
-- BEFUND
-- Der Job (registriert 2026-05-29, '0 * * * *') ruft agent-os-runner mit
-- cadence='hourly'. Die hourly-Cadence laeuft nur Deadline-Sentinel und
-- Monitoring-SLO — beide deterministisch, null LLM-Tokens. Der einzige
-- LLM-Aufruf (Hermes-Brief) haengt an cadence='daily' und bleibt.
--
-- Trotzdem iteriert der hourly-Lauf ueber alle Tenants in public.tenants
-- und schreibt agent_observations + agent_events, auch wenn sich nichts
-- geaendert hat. 24x/Tag, ohne Mehrwert. Die daily-Cadence (06:00 UTC)
-- deckt denselben Sweep einmal ab.
--
-- Diese Migration entfernt nur den Schedule. Die Edge Function und der
-- daily-Job bleiben. Ein spaeterer Bedarf (z.B. sub-taegliche SLO-Checks
-- bei wachsenden Tenant-Zahlen) kann den Job wieder anlegen.

DO $$
BEGIN
  PERFORM cron.unschedule('agent-os-runner-hourly')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agent-os-runner-hourly');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'cron.unschedule agent-os-runner-hourly uebersprungen (pg_cron nicht aktiv oder Job nicht vorhanden).';
END $$;
