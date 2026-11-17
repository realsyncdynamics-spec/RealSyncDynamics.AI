-- RSD-013 / RSD-004: pg_cron-Jobs staffeln, die um 03:00 UTC kollidierten.
--
-- Live-Befund (SELECT 13.11.2026, ebljyceifhnlzhjfyxup, nur lesend):
--   dsr-erasure-sweep        jobid 15  '0 3 * * *'     aktiv
--   memory-decay-hourly      jobid 19  '0 * * * *'     aktiv
--   scan-scheduler-dispatch  jobid 18  '*/15 * * * *'  aktiv
-- Deadlock 12.11.2026 03:00 UTC zwischen genau diesen drei Jobs.
--
-- Neue Plaene (nur schedule; Kommando, Rolle und Secrets bleiben unangetastet):
--   dsr-erasure-sweep        1 3 * * *          (03:01 UTC, taeglich)
--   memory-decay-hourly      2 * * * *          (jede Stunde :02)
--   scan-scheduler-dispatch  4,19,34,49 * * * * (versetzte */15)
--
-- Idempotent: Aenderung nur wenn der aktuelle Plan vom Ziel abweicht.
-- Fehlt das cron-Schema (CI-Stub), wird still uebersprungen.
-- Bevorzugt cron.alter_job; Fallback unschedule+schedule mit vorher
-- gesichertem Kommando, falls alter_job in der pg_cron-Version fehlt.

DO $stagger$
DECLARE
  rec record;
  new_schedule text;
  saved_command text;
BEGIN
  IF to_regnamespace('cron') IS NULL OR to_regclass('cron.job') IS NULL THEN
    RAISE NOTICE 'RSD-013: cron.job nicht vorhanden — Staffelung uebersprungen';
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
    new_schedule := CASE rec.jobname
      WHEN 'dsr-erasure-sweep'       THEN '1 3 * * *'
      WHEN 'memory-decay-hourly'     THEN '2 * * * *'
      WHEN 'scan-scheduler-dispatch' THEN '4,19,34,49 * * * *'
    END;

    IF new_schedule IS NULL THEN
      CONTINUE;
    END IF;

    IF rec.schedule IS NOT DISTINCT FROM new_schedule THEN
      RAISE NOTICE 'RSD-013: % hat bereits Plan %', rec.jobname, new_schedule;
      CONTINUE;
    END IF;

    saved_command := rec.command;

    BEGIN
      PERFORM cron.alter_job(rec.jobid, new_schedule);
      RAISE NOTICE 'RSD-013: % (jobid %) per alter_job von % auf % gesetzt',
        rec.jobname, rec.jobid, rec.schedule, new_schedule;
    EXCEPTION WHEN undefined_function THEN
      PERFORM cron.unschedule(rec.jobid);
      PERFORM cron.schedule(rec.jobname, new_schedule, saved_command);
      RAISE NOTICE 'RSD-013: % per unschedule+schedule auf % gesetzt (Kommando unveraendert)',
        rec.jobname, new_schedule;
    END;
  END LOOP;
END
$stagger$;
