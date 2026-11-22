-- Rollback RSD-013: Originalplaene der drei Jobs wiederherstellen.
-- Nur verwenden, wenn die Forward-Migration angewendet wurde.

DO $unstagger$
DECLARE
  rec record;
  old_schedule text;
  saved_command text;
BEGIN
  IF to_regnamespace('cron') IS NULL OR to_regclass('cron.job') IS NULL THEN
    RAISE NOTICE 'RSD-013 Rollback: cron.job nicht vorhanden — nichts zu tun';
    RETURN;
  END IF;

  FOR rec IN
    SELECT jobid, jobname, schedule, command
      FROM cron.job
     WHERE jobname IN (
       'dsr-erasure-sweep',
       'memory-decay-hourly',
       'scan-scheduler-dispatch'
     )
  LOOP
    old_schedule := CASE rec.jobname
      WHEN 'dsr-erasure-sweep'       THEN '0 3 * * *'
      WHEN 'memory-decay-hourly'     THEN '0 * * * *'
      WHEN 'scan-scheduler-dispatch' THEN '*/15 * * * *'
    END;

    IF old_schedule IS NULL OR rec.schedule IS NOT DISTINCT FROM old_schedule THEN
      CONTINUE;
    END IF;

    saved_command := rec.command;

    BEGIN
      PERFORM cron.alter_job(rec.jobid, old_schedule);
    EXCEPTION WHEN undefined_function THEN
      PERFORM cron.unschedule(rec.jobid);
      PERFORM cron.schedule(rec.jobname, old_schedule, saved_command);
    END;
  END LOOP;
END
$unstagger$;
