-- Super-admin cross-tenant read for the audit/event-telemetry dashboard at
-- /dashboard/audit. Webhook events were previously deny-all (idempotency
-- store), now super_admins can inspect them for replay/debug. Governance
-- streams add a super_admin overlay alongside the existing tenant policy.

-- ─── governance_admin_log ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "governance_admin_log_super_admin_read" ON public.governance_admin_log;
CREATE POLICY "governance_admin_log_super_admin_read"
  ON public.governance_admin_log
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = auth.uid() AND p.is_super_admin = true
  ));

-- ─── governance_events ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "governance_events_super_admin_read" ON public.governance_events;
CREATE POLICY "governance_events_super_admin_read"
  ON public.governance_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = auth.uid() AND p.is_super_admin = true
  ));

-- ─── webhook_events ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "webhook_events_super_admin_read" ON public.webhook_events;
CREATE POLICY "webhook_events_super_admin_read"
  ON public.webhook_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = auth.uid() AND p.is_super_admin = true
  ));

-- ─── Indexes for the dashboard's "newest 200 ordered by created_at" queries ──
CREATE INDEX IF NOT EXISTS governance_admin_log_created_at_idx
  ON public.governance_admin_log (created_at DESC);

CREATE INDEX IF NOT EXISTS governance_events_created_at_idx
  ON public.governance_events (created_at DESC);

CREATE INDEX IF NOT EXISTS governance_events_risk_level_idx
  ON public.governance_events (risk_level);

CREATE INDEX IF NOT EXISTS webhook_events_processed_at_idx
  ON public.webhook_events (processed_at DESC);

CREATE INDEX IF NOT EXISTS webhook_events_type_idx
  ON public.webhook_events (type);
