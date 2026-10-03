-- NIS2 Incident Notifications (preview slice)
-- Tracks Meldewege/Fristen: Early Warning (+24h), Notification (+72h), Final Report (+1 month).
-- Deadlines via BEFORE INSERT/UPDATE trigger (interval '1 month' is not IMMUTABLE → no GENERATED).
-- No BSI portal send. Do not apply live until owner Go after green CI.

CREATE TABLE IF NOT EXISTS public.nis2_incident_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  detected_at TIMESTAMPTZ NOT NULL,
  -- Placeholders; trg_nis2_incident_notifications_set_deadlines overwrites on INSERT/UPDATE.
  early_warning_due TIMESTAMPTZ NOT NULL DEFAULT now(),
  notification_due TIMESTAMPTZ NOT NULL DEFAULT now(),
  final_report_due TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel TEXT NOT NULL CHECK (channel IN ('bsi_portal', 'mip', 'customer')),
  customer_notified_at TIMESTAMPTZ NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nis2_incident_notifications_tenant_id
  ON public.nis2_incident_notifications (tenant_id);

CREATE INDEX IF NOT EXISTS idx_nis2_incident_notifications_detected_at
  ON public.nis2_incident_notifications (detected_at);

CREATE INDEX IF NOT EXISTS idx_nis2_incident_notifications_early_warning_due
  ON public.nis2_incident_notifications (early_warning_due);

ALTER TABLE public.nis2_incident_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nis2_incident_notifications_tenant_select" ON public.nis2_incident_notifications;
CREATE POLICY "nis2_incident_notifications_tenant_select"
  ON public.nis2_incident_notifications FOR SELECT
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "nis2_incident_notifications_tenant_insert" ON public.nis2_incident_notifications;
CREATE POLICY "nis2_incident_notifications_tenant_insert"
  ON public.nis2_incident_notifications FOR INSERT
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "nis2_incident_notifications_tenant_update" ON public.nis2_incident_notifications;
CREATE POLICY "nis2_incident_notifications_tenant_update"
  ON public.nis2_incident_notifications FOR UPDATE
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "nis2_incident_notifications_tenant_delete" ON public.nis2_incident_notifications;
CREATE POLICY "nis2_incident_notifications_tenant_delete"
  ON public.nis2_incident_notifications FOR DELETE
  USING (public.is_tenant_member(tenant_id));

CREATE OR REPLACE FUNCTION public.nis2_incident_notifications_set_deadlines()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.detected_at IS NULL THEN
    RAISE EXCEPTION 'nis2_incident_notifications.detected_at must not be null';
  END IF;
  NEW.early_warning_due := NEW.detected_at + INTERVAL '24 hours';
  NEW.notification_due := NEW.detected_at + INTERVAL '72 hours';
  NEW.final_report_due := NEW.detected_at + INTERVAL '1 month';
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nis2_incident_notifications_set_deadlines
  ON public.nis2_incident_notifications;
CREATE TRIGGER trg_nis2_incident_notifications_set_deadlines
  BEFORE INSERT OR UPDATE OF detected_at ON public.nis2_incident_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.nis2_incident_notifications_set_deadlines();

CREATE OR REPLACE FUNCTION public.nis2_incident_notifications_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nis2_incident_notifications_updated_at
  ON public.nis2_incident_notifications;
CREATE TRIGGER trg_nis2_incident_notifications_updated_at
  BEFORE UPDATE ON public.nis2_incident_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.nis2_incident_notifications_set_updated_at();

COMMENT ON TABLE public.nis2_incident_notifications IS
  'NIS2 Melde-/Benachrichtigungsfristen (preview). Kein automatischer BSI-Versand.';
