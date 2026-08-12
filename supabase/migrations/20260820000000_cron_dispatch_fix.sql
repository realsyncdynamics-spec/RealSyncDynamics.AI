-- Cron-Dispatch reparieren: sechs Jobs feuerten seit ihrer Registrierung ins Leere
--
-- BEFUND (verifiziert gegen die Live-DB am 2026-08-12)
-- Die GUCs `app.supabase_url` und `app.service_role_key` sind in Produktion nie
-- gesetzt worden — weder per `ALTER DATABASE` noch fuer die Rolle `postgres`,
-- unter der pg_cron laeuft. Jeder Job, der sie liest, scheitert stuendlich:
--
--   current_setting('app.supabase_url')        -> ERROR: unrecognized configuration parameter
--   current_setting('app.supabase_url', true)  -> NULL -> url NOT NULL verletzt
--
-- Betroffen waren alle sechs GUC-Jobs; die sieben Jobs, die stattdessen den
-- Vault nutzen, liefen durchgehend sauber. Der wichtigste Ausfall ist
-- `dsr-erasure-sweep`: die Abarbeitung von DSGVO-Loeschantraegen (Art. 17)
-- wurde nie ausgeloest. Das ist ein Compliance-Ausfall, kein Komfortproblem.
--
-- ANSATZ
-- Statt die Projekt-URL in sechs Kommandos zu wiederholen (so macht es heute
-- `business-metrics-cron-15min`, der einzige funktionierende HTTP-Job), gibt es
-- eine zentrale Dispatch-Funktion. Sie loest Basis-URL und Token auf, meldet
-- fehlende Konfiguration mit klarem Text statt mit einer NOT-NULL-Verletzung
-- und ist damit die einzige Stelle, die kuenftig angefasst werden muss.
--
-- WAS DIESE MIGRATION NICHT LEISTET — zwei Vault-Secrets fehlen weiterhin
-- und koennen nur vom Betreiber angelegt werden (der Service-Role-Key gehoert
-- nicht in eine Migration und nicht in die Git-History):
--
--   service_role_key      -> governance-monitoring-daily/-hourly,
--                            scan-scheduler-dispatch, memory-decay-hourly
--   agent_os_runner_token -> agent-os-runner-hourly/-daily
--
-- Anlegen ueber:
--   SELECT vault.create_secret('<wert>', 'service_role_key');
--
-- Bis dahin scheitern diese Jobs weiter — aber mit einer Meldung, die sagt
-- welches Secret fehlt, statt mit einer NOT-NULL-Verletzung auf einer
-- pg_net-internen Tabelle. `dsr-erasure-sweep` laeuft ab sofort, sein Token
-- (`governance_erasure_sweeper_token`) liegt bereits im Vault.

BEGIN;

-- ============================================================
-- §1 Basis-URL der Edge Functions
-- ============================================================
-- Aufloesungsreihenfolge, absichtlich in dieser Reihenfolge:
--   1. Vault-Secret `supabase_url` — erlaubt Branch-/Staging-Projekte, ohne
--      diese Migration zu aendern
--   2. GUC `app.supabase_url` — respektiert eine spaeter nachgezogene
--      `ALTER DATABASE`-Konfiguration, ohne dass hier etwas zu tun waere
--   3. Literal des Produktionsprojekts — der Fallback, der den heutigen
--      Ausfall behebt. Die Projekt-URL ist kein Geheimnis (sie steht als
--      VITE_SUPABASE_URL im ausgelieferten Frontend).

CREATE OR REPLACE FUNCTION public.app_functions_base_url()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    NULLIF(public.get_app_secret('supabase_url'), ''),
    NULLIF(current_setting('app.supabase_url', true), ''),
    'https://ebljyceifhnlzhjfyxup.supabase.co'
  ) || '/functions/v1/';
$$;

REVOKE ALL    ON FUNCTION public.app_functions_base_url() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.app_functions_base_url() TO service_role;

COMMENT ON FUNCTION public.app_functions_base_url() IS
  'Basis-URL der Edge Functions fuer pg_cron-Dispatch. Vault > GUC > Produktions-Literal.';

-- ============================================================
-- §2 Zentraler Cron-Dispatch
-- ============================================================
-- Ein fehlendes Token ist ein Konfigurationsfehler und wird als solcher
-- gemeldet: `cron.job_run_details.return_message` nennt Job und Secret-Namen.
-- Die Alternative — leerer Bearer-Header und ein 401, das nur in
-- `net._http_response` sichtbar waere — haette denselben Ausfall erneut
-- unsichtbar gemacht. Genau das ist hier monatelang passiert.

CREATE OR REPLACE FUNCTION public.dispatch_cron_function(
  p_function    text,
  p_secret_name text,
  p_body        jsonb DEFAULT '{}'::jsonb
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token text;
BEGIN
  v_token := public.get_app_secret(p_secret_name);

  IF v_token IS NULL OR v_token = '' THEN
    RAISE EXCEPTION
      'Cron-Dispatch "%" abgebrochen: Vault-Secret "%" fehlt. Anlegen mit: SELECT vault.create_secret(''<wert>'', ''%'');',
      p_function, p_secret_name, p_secret_name;
  END IF;

  RETURN net.http_post(
    url     := public.app_functions_base_url() || p_function,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_token
    ),
    body    := p_body,
    timeout_milliseconds := 60000
  );
END;
$$;

REVOKE ALL    ON FUNCTION public.dispatch_cron_function(text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.dispatch_cron_function(text, text, jsonb) TO service_role;

COMMENT ON FUNCTION public.dispatch_cron_function(text, text, jsonb) IS
  'Ruft eine Edge Function aus pg_cron auf. Token aus dem Vault; fehlendes Secret bricht mit klarer Meldung ab.';

-- ============================================================
-- §3 Betroffene Jobs neu registrieren
-- ============================================================
-- `cron.schedule(jobname, ...)` ist Upsert per Name (siehe 20260624000003) —
-- Zeitplaene bleiben unveraendert, nur das Kommando wird ersetzt.

-- DSGVO Art. 17: Loeschantraege. Token liegt im Vault, laeuft ab sofort wieder.
SELECT cron.schedule(
  'dsr-erasure-sweep',
  '0 3 * * *',
  $cron$ SELECT public.dispatch_cron_function(
           'governance-erasure-sweeper',
           'governance_erasure_sweeper_token',
           jsonb_build_object('trigger', 'cron')) $cron$
);

SELECT cron.schedule(
  'agent-os-runner-hourly',
  '0 * * * *',
  $cron$ SELECT public.dispatch_cron_function(
           'agent-os-runner',
           'agent_os_runner_token',
           jsonb_build_object('cadence', 'hourly')) $cron$
);

SELECT cron.schedule(
  'agent-os-runner-daily',
  '0 6 * * *',
  $cron$ SELECT public.dispatch_cron_function(
           'agent-os-runner',
           'agent_os_runner_token',
           jsonb_build_object('cadence', 'daily')) $cron$
);

SELECT cron.schedule(
  'governance-monitoring-daily',
  '0 2 * * *',
  $cron$ SELECT public.dispatch_cron_function(
           'governance-monitoring-scheduler',
           'service_role_key') $cron$
);

SELECT cron.schedule(
  'governance-monitoring-hourly',
  '15 * * * *',
  $cron$ SELECT public.dispatch_cron_function(
           'governance-monitoring-scheduler',
           'service_role_key',
           jsonb_build_object('frequency_filter', 'hourly')) $cron$
);

SELECT cron.schedule(
  'scan-scheduler-dispatch',
  '*/15 * * * *',
  $cron$ SELECT public.dispatch_cron_function(
           'scheduler-dispatch',
           'service_role_key') $cron$
);

-- RFC-003 §3.1: ohne diesen Job verfaellt kein Memory (siehe CLAUDE.md §5).
SELECT cron.schedule(
  'memory-decay-hourly',
  '0 * * * *',
  $cron$ SELECT public.dispatch_cron_function(
           'memory-decay-worker',
           'service_role_key') $cron$
);

COMMIT;
