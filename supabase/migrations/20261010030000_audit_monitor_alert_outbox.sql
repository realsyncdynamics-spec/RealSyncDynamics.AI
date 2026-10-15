-- ─────────────────────────────────────────────────────────────────────────────
-- audit_monitor_alerts: Outbox für Drift-Alerts von audit-monitor-cron
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Vorher rückte audit-monitor-cron die Drift-Baseline (monitored_domains.last_*)
-- vor, bevor die Drift-Mail rausging. Scheiterte Resend, verglich der nächste
-- Lauf gegen den neuen Stand — dieselbe Drift löste nie wieder eine Mail aus.
--
-- Jetzt wird der Alert hier eingereiht, BEVOR die Baseline vorrückt. Was nicht
-- zugestellt ist, bleibt `pending` und wird in späteren Läufen erneut versucht
-- (höchstens MAX_ALERT_ATTEMPTS = 5, dann `failed`).
--
-- UNIQUE (monitored_domain_id, fingerprint): Der Fingerabdruck hängt an der
-- alten Baseline + Tracker-Delta (ohne Risk-Score). Scheitert nach dem Einreihen das Fortschreiben der
-- Baseline, erkennt der nächste Lauf dieselbe Drift — und reiht keinen zweiten
-- Alert ein.
--
-- Nur service_role: `recipient` ist eine E-Mail-Adresse, Tenants lesen ihre
-- Drift-Historie weiter aus audit_monitor_results.

CREATE TABLE IF NOT EXISTS public.audit_monitor_alerts (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monitored_domain_id  uuid NOT NULL REFERENCES public.monitored_domains(id) ON DELETE CASCADE,
  tenant_id            uuid NOT NULL,
  domain               text NOT NULL,
  recipient            text NOT NULL,
  fingerprint          text NOT NULL,
  payload              jsonb NOT NULL,
  status               text NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'sent', 'failed')),
  attempts             integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error           text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  sent_at              timestamptz,
  CONSTRAINT audit_monitor_alerts_domain_fingerprint_key UNIQUE (monitored_domain_id, fingerprint)
);

ALTER TABLE public.audit_monitor_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_monitor_alerts" ON public.audit_monitor_alerts;
CREATE POLICY "service_role_full_access_monitor_alerts"
  ON public.audit_monitor_alerts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_monitor_alerts_pending
  ON public.audit_monitor_alerts (created_at)
  WHERE status = 'pending';
