-- RSD-015 rollback. DANGEROUS IF USED ON NON-EMPTY TABLES.
-- Intended only after a verified RSD-015-only deployment to a previously
-- empty/missing-schema environment. No automatic rollback in production.
-- A nonempty table blocks the entire transaction: preserve all evidence.
BEGIN;
DO $guard$
BEGIN
  IF to_regclass('public.sub_processor_notifications') IS NULL
    OR to_regclass('public.sub_processor_changes') IS NULL
    OR to_regclass('public.sub_processor_subscriptions') IS NULL THEN
    RAISE EXCEPTION 'RSD-015 rollback: unexpected schema; manual review required';
  END IF;
  IF EXISTS (SELECT 1 FROM public.sub_processor_subscriptions)
    OR EXISTS (SELECT 1 FROM public.sub_processor_changes)
    OR EXISTS (SELECT 1 FROM public.sub_processor_notifications) THEN
    RAISE EXCEPTION 'RSD-015 rollback refused: preserving nonempty tables';
  END IF;
END
$guard$;

DROP TRIGGER IF EXISTS trg_sp_notif_no_update ON public.sub_processor_notifications;
DROP FUNCTION IF EXISTS public.sp_notif_block_modification();
DROP FUNCTION IF EXISTS public.sub_processor_changes_pending();
DROP FUNCTION IF EXISTS public.sub_processor_change_mark_notified(uuid);
DROP TABLE IF EXISTS public.sub_processor_notifications;
DROP TABLE IF EXISTS public.sub_processor_changes;
DROP TABLE IF EXISTS public.sub_processor_subscriptions;
COMMIT;
