-- RSD-015: restore missing sub-processor notification schema without replaying
-- historical migration 20260507140000 (recorded in production but objects absent).
-- Draft only. DO NOT apply independently of the corrected mail Edge Function.
-- No pg_cron, pg_net, Vault, HTTP, secret, or existing-customer mutations.
--
-- Production precondition (read-only checked 2026-11-17):
--   all 3 public.sub_processor_* tables and both public RPCs are absent.
-- Old migration included an unauthenticated write policy, but did not prove
-- address ownership / double opt-in. This migration intentionally restores
-- only service_role access until a separate verified enrollment exists.
BEGIN;

-- collision-check: allow-existing-table sub_processor_subscriptions — Ursprungsmigration 20260507140000 ist in Produktion registriert, aber die Tabelle fehlt nachweislich (SELECT 17.11.2026). Idempotente Wiederherstellung statt Replay der alten Cron- und Rechte-Aenderungen.
CREATE TABLE IF NOT EXISTS public.sub_processor_subscriptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL,
  tenant_id       uuid,
  company         text,
  verified_at     timestamptz,
  unsubscribed_at timestamptz,
  unsub_token     uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sp_sub_email_active
  ON public.sub_processor_subscriptions (lower(email))
  WHERE unsubscribed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sp_sub_verified
  ON public.sub_processor_subscriptions (verified_at)
  WHERE unsubscribed_at IS NULL;

-- collision-check: allow-existing-table sub_processor_changes — Ursprungsmigration 20260507140000 ist in Produktion registriert, aber die Tabelle fehlt nachweislich (SELECT 17.11.2026). Idempotente Wiederherstellung statt Replay der alten Cron- und Rechte-Aenderungen.
CREATE TABLE IF NOT EXISTS public.sub_processor_changes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_type       text NOT NULL
    CHECK (change_type IN ('added','removed','replaced','region_changed','purpose_changed')),
  processor_name    text NOT NULL,
  processor_purpose text,
  processor_region  text,
  processor_dpa_url text,
  description       text NOT NULL,
  effective_from    timestamptz NOT NULL,
  notify_at         timestamptz NOT NULL,
  notified_at       timestamptz,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sp_changes_notify
  ON public.sub_processor_changes (notify_at) WHERE notified_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sp_changes_effective
  ON public.sub_processor_changes (effective_from DESC);

-- collision-check: allow-existing-table sub_processor_notifications — Ursprungsmigration 20260507140000 ist in Produktion registriert, aber die Tabelle fehlt nachweislich (SELECT 17.11.2026). Idempotente Wiederherstellung statt Replay der alten Cron- und Rechte-Aenderungen.
CREATE TABLE IF NOT EXISTS public.sub_processor_notifications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_id         uuid NOT NULL REFERENCES public.sub_processor_changes(id)
                    ON DELETE RESTRICT,
  subscription_id   uuid NOT NULL REFERENCES public.sub_processor_subscriptions(id)
                    ON DELETE RESTRICT,
  email             text NOT NULL,
  sent_at           timestamptz NOT NULL DEFAULT now(),
  resend_message_id text,
  error_message     text,
  UNIQUE (change_id, subscription_id)
);
CREATE INDEX IF NOT EXISTS idx_sp_notif_change
  ON public.sub_processor_notifications(change_id);
CREATE INDEX IF NOT EXISTS idx_sp_notif_sent
  ON public.sub_processor_notifications(sent_at DESC);

-- Fail-closed for NEW writes, but do not validate or delete legacy rows if
-- a different environment already has the original table with error receipts.
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sub_processor_notifications'::regclass
      AND conname = 'sp_notif_sent_receipt_only'
  ) THEN
    ALTER TABLE public.sub_processor_notifications
      ADD CONSTRAINT sp_notif_sent_receipt_only
      CHECK (resend_message_id IS NOT NULL
             AND btrim(resend_message_id) <> ''
             AND error_message IS NULL) NOT VALID;
  END IF;
END
$constraint$;

-- Preserve the evidence trail. The trigger runs with caller privileges.
CREATE OR REPLACE FUNCTION public.sp_notif_block_modification()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $fn$
BEGIN
  RAISE EXCEPTION 'sub_processor_notifications is append-only'
    USING ERRCODE = '42501';
END
$fn$;
REVOKE ALL ON FUNCTION public.sp_notif_block_modification()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sp_notif_block_modification() TO service_role;
DROP TRIGGER IF EXISTS trg_sp_notif_no_update
  ON public.sub_processor_notifications;
CREATE TRIGGER trg_sp_notif_no_update
  BEFORE UPDATE OR DELETE ON public.sub_processor_notifications
  FOR EACH ROW EXECUTE FUNCTION public.sp_notif_block_modification();

ALTER TABLE public.sub_processor_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_processor_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_processor_notifications ENABLE ROW LEVEL SECURITY;

-- Revoke the historical public anonymous INSERT policy if it exists in any
-- environment. Open, unauthenticated enrollment cannot prove address consent.
DROP POLICY IF EXISTS "sp_sub_anon_insert"
  ON public.sub_processor_subscriptions;
DROP POLICY IF EXISTS "sp_changes_authenticated_read"
  ON public.sub_processor_changes;

-- Only service_role can read/write the restored objects for now.
DROP POLICY IF EXISTS "sp_sub_service_all"
  ON public.sub_processor_subscriptions;
CREATE POLICY "sp_sub_service_all"
  ON public.sub_processor_subscriptions FOR ALL TO service_role
  USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sp_changes_service_write"
  ON public.sub_processor_changes;
CREATE POLICY "sp_changes_service_write"
  ON public.sub_processor_changes FOR ALL TO service_role
  USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sp_notif_service_all"
  ON public.sub_processor_notifications;
CREATE POLICY "sp_notif_service_all"
  ON public.sub_processor_notifications FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE
  public.sub_processor_subscriptions,
  public.sub_processor_changes,
  public.sub_processor_notifications
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.sub_processor_subscriptions,
  public.sub_processor_changes,
  public.sub_processor_notifications
  TO service_role;

-- SECURITY INVOKER and explicit service-only EXECUTE keep this out of anon
-- and authenticated PostgREST APIs, even though it lives in public.
CREATE OR REPLACE FUNCTION public.sub_processor_changes_pending()
RETURNS TABLE (
  id uuid, change_type text, processor_name text,
  description text, effective_from timestamptz, notify_at timestamptz
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $fn$
  SELECT c.id, c.change_type, c.processor_name, c.description,
         c.effective_from, c.notify_at
    FROM public.sub_processor_changes c
   WHERE c.notified_at IS NULL AND c.notify_at <= now()
   ORDER BY c.notify_at ASC
$fn$;
REVOKE ALL ON FUNCTION public.sub_processor_changes_pending()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sub_processor_changes_pending()
  TO service_role;

-- Even a stale Edge function must NOT mark changes notified unless every
-- currently verified, active recipient has a successful provider receipt.
-- A zero-recipient change remains pending: it requires owner review.
CREATE OR REPLACE FUNCTION public.sub_processor_change_mark_notified(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $fn$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.sub_processor_changes c
     SET notified_at = now()
   WHERE c.id = p_id
     AND c.notified_at IS NULL
     AND EXISTS (
       SELECT 1 FROM public.sub_processor_subscriptions s
        WHERE s.verified_at IS NOT NULL AND s.unsubscribed_at IS NULL
     )
     AND NOT EXISTS (
       SELECT 1
         FROM public.sub_processor_subscriptions s
        WHERE s.verified_at IS NOT NULL AND s.unsubscribed_at IS NULL
          AND NOT EXISTS (
            SELECT 1
              FROM public.sub_processor_notifications n
             WHERE n.change_id = c.id AND n.subscription_id = s.id
               AND n.resend_message_id IS NOT NULL
               AND n.error_message IS NULL
          )
     );
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'change not fully notified to verified recipients'
      USING ERRCODE = 'P0001';
  END IF;
END
$fn$;
REVOKE ALL ON FUNCTION public.sub_processor_change_mark_notified(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sub_processor_change_mark_notified(uuid)
  TO service_role;

COMMENT ON TABLE public.sub_processor_subscriptions IS
  'RSD-015: service-only until verified enrollment and contractual recipients exist';
COMMENT ON TABLE public.sub_processor_notifications IS
  'RSD-015: append-only successful Resend receipts; no false-delivery records';

COMMIT;
