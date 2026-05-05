-- Workflow-Runs Sweeper.
--
-- Wenn ein n8n-Workflow keinen Callback macht (Bug, Crash, Network-Loss),
-- bleibt der workflow_runs-Eintrag forever in status='pending' oder 'running'.
-- Das verfälscht Quotas, Run-History und alle abgeleiteten Metriken.
--
-- Diese Funktion findet alle Runs die seit > 24h in nicht-terminalem Zustand
-- hängen und setzt sie auf status='timeout'. Idempotent.
--
-- Aufruf:
--   - manuell:    SELECT public.sweep_stale_workflow_runs();
--   - per cron:   siehe Hinweis am Ende dieser Datei
--   - per Edge Function (z. B. workflow-cleanup): RPC-Call

CREATE OR REPLACE FUNCTION public.sweep_stale_workflow_runs(
    p_max_age_hours INTEGER DEFAULT 24
)
RETURNS TABLE (swept_count INTEGER, oldest_swept TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
    v_oldest TIMESTAMPTZ;
BEGIN
    WITH stale AS (
        UPDATE public.workflow_runs
           SET status = 'timeout',
               error_code = 'SWEEPER_TIMEOUT',
               error_message = format(
                   'Run hing > %s Stunden im nicht-terminalen Zustand und wurde vom Sweeper geschlossen.',
                   p_max_age_hours
               ),
               finished_at = COALESCE(finished_at, now()),
               duration_ms = COALESCE(duration_ms, EXTRACT(EPOCH FROM (now() - started_at)) * 1000)::INTEGER
         WHERE status IN ('pending', 'running')
           AND started_at < now() - (p_max_age_hours || ' hours')::INTERVAL
        RETURNING id, started_at
    )
    SELECT COUNT(*)::INTEGER, MIN(started_at)
      INTO v_count, v_oldest
      FROM stale;

    swept_count  := COALESCE(v_count, 0);
    oldest_swept := v_oldest;
    RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.sweep_stale_workflow_runs(INTEGER) IS
    'Setzt workflow_runs-Einträge die > p_max_age_hours alt und in pending/running sind auf status=timeout. Default-Threshold 24 Stunden. Idempotent. Aufruf per manuell, pg_cron oder Edge Function.';

-- ─── Optionaler Hinweis: pg_cron-Schedule ────────────────────────────────
-- Supabase hat pg_cron als Extension verfügbar (Dashboard → Database →
-- Extensions → pg_cron aktivieren). Nach Aktivierung kann man die Funktion
-- per cron alle 5 Minuten laufen lassen:
--
--   SELECT cron.schedule(
--       'workflow-runs-sweeper',
--       '*/5 * * * *',
--       $$SELECT public.sweep_stale_workflow_runs();$$
--   );
--
-- Job-Status:
--   SELECT * FROM cron.job;
--
-- Job entfernen:
--   SELECT cron.unschedule('workflow-runs-sweeper');
