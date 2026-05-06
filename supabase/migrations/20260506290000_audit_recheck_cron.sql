-- pg_cron: Audit-Recheck-Daily 07:00 UTC scannt audit_recheck_subscriptions wo
-- next_run_at <= now() und re-runt das Audit, alarmiert bei Score-Drop > 5.

DO $$ BEGIN
  PERFORM cron.unschedule('audit-recheck-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  PERFORM cron.schedule(
    'audit-recheck-daily',
    '0 7 * * *',
    $cmd$
    SELECT net.http_get(
      url := 'https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/audit-recheck-weekly',
      timeout_milliseconds := 60000
    );
    $cmd$
  );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
