-- Enable RLS on 25 critical multi-tenant tables per CLAUDE.md architecture
-- Timestamp: 2026-07-23

-- ── Registry Tables ────────────────────────────────────────────
ALTER TABLE IF EXISTS public.ai_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- ── Policy Engine ────────────────────────────────────────────
ALTER TABLE IF EXISTS public.ai_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.policy_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.governance_controls ENABLE ROW LEVEL SECURITY;

-- ── Evidence Stream ────────────────────────────────────────────
ALTER TABLE IF EXISTS public.ai_evidence_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.evidence_retention ENABLE ROW LEVEL SECURITY;

-- ── Governance ────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.governance_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.governance_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.governance_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.runtime_events ENABLE ROW LEVEL SECURITY;

-- ── Integration ────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ai_tool_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.dpias ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.dsr_tracker ENABLE ROW LEVEL SECURITY;

-- ── Operations ────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.operations_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.enterprise_agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_email_sent ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vps_connections ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies: Tenant Isolation + Service Role ────────────────
-- Pattern: authenticated users see only their tenant_id rows.
-- service_role bypasses RLS (for Edge Functions, Cron, Backfills).

-- ─── governance_approvals ────────────────────────────────────────
DROP POLICY IF EXISTS governance_approvals_select ON public.governance_approvals;
CREATE POLICY governance_approvals_select
  ON public.governance_approvals FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS governance_approvals_insert ON public.governance_approvals;
CREATE POLICY governance_approvals_insert
  ON public.governance_approvals FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS governance_approvals_update ON public.governance_approvals;
CREATE POLICY governance_approvals_update
  ON public.governance_approvals FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS governance_approvals_delete ON public.governance_approvals;
CREATE POLICY governance_approvals_delete
  ON public.governance_approvals FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS governance_approvals_service_role ON public.governance_approvals;
CREATE POLICY governance_approvals_service_role
  ON public.governance_approvals FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ─── governance_webhooks ─────────────────────────────────────────
DROP POLICY IF EXISTS governance_webhooks_select ON public.governance_webhooks;
CREATE POLICY governance_webhooks_select
  ON public.governance_webhooks FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS governance_webhooks_insert ON public.governance_webhooks;
CREATE POLICY governance_webhooks_insert
  ON public.governance_webhooks FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS governance_webhooks_update ON public.governance_webhooks;
CREATE POLICY governance_webhooks_update
  ON public.governance_webhooks FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS governance_webhooks_delete ON public.governance_webhooks;
CREATE POLICY governance_webhooks_delete
  ON public.governance_webhooks FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS governance_webhooks_service_role ON public.governance_webhooks;
CREATE POLICY governance_webhooks_service_role
  ON public.governance_webhooks FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ─── runtime_events ──────────────────────────────────────────────
DROP POLICY IF EXISTS runtime_events_select ON public.runtime_events;
CREATE POLICY runtime_events_select
  ON public.runtime_events FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS runtime_events_insert ON public.runtime_events;
CREATE POLICY runtime_events_insert
  ON public.runtime_events FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS runtime_events_service_role ON public.runtime_events;
CREATE POLICY runtime_events_service_role
  ON public.runtime_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ─── workflow_runs ───────────────────────────────────────────────
DROP POLICY IF EXISTS workflow_runs_select ON public.workflow_runs;
CREATE POLICY workflow_runs_select
  ON public.workflow_runs FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS workflow_runs_insert ON public.workflow_runs;
CREATE POLICY workflow_runs_insert
  ON public.workflow_runs FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS workflow_runs_update ON public.workflow_runs;
CREATE POLICY workflow_runs_update
  ON public.workflow_runs FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS workflow_runs_delete ON public.workflow_runs;
CREATE POLICY workflow_runs_delete
  ON public.workflow_runs FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS workflow_runs_service_role ON public.workflow_runs;
CREATE POLICY workflow_runs_service_role
  ON public.workflow_runs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ─── ai_tool_runs ────────────────────────────────────────────────
DROP POLICY IF EXISTS ai_tool_runs_select ON public.ai_tool_runs;
CREATE POLICY ai_tool_runs_select
  ON public.ai_tool_runs FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS ai_tool_runs_insert ON public.ai_tool_runs;
CREATE POLICY ai_tool_runs_insert
  ON public.ai_tool_runs FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS ai_tool_runs_service_role ON public.ai_tool_runs;
CREATE POLICY ai_tool_runs_service_role
  ON public.ai_tool_runs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ─── connectors ──────────────────────────────────────────────────
DROP POLICY IF EXISTS connectors_select ON public.connectors;
CREATE POLICY connectors_select
  ON public.connectors FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS connectors_insert ON public.connectors;
CREATE POLICY connectors_insert
  ON public.connectors FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS connectors_update ON public.connectors;
CREATE POLICY connectors_update
  ON public.connectors FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS connectors_delete ON public.connectors;
CREATE POLICY connectors_delete
  ON public.connectors FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS connectors_service_role ON public.connectors;
CREATE POLICY connectors_service_role
  ON public.connectors FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ─── vendors ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS vendors_select ON public.vendors;
CREATE POLICY vendors_select
  ON public.vendors FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS vendors_insert ON public.vendors;
CREATE POLICY vendors_insert
  ON public.vendors FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS vendors_update ON public.vendors;
CREATE POLICY vendors_update
  ON public.vendors FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS vendors_delete ON public.vendors;
CREATE POLICY vendors_delete
  ON public.vendors FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS vendors_service_role ON public.vendors;
CREATE POLICY vendors_service_role
  ON public.vendors FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ─── dpias ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS dpias_select ON public.dpias;
CREATE POLICY dpias_select
  ON public.dpias FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS dpias_insert ON public.dpias;
CREATE POLICY dpias_insert
  ON public.dpias FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS dpias_update ON public.dpias;
CREATE POLICY dpias_update
  ON public.dpias FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS dpias_delete ON public.dpias;
CREATE POLICY dpias_delete
  ON public.dpias FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS dpias_service_role ON public.dpias;
CREATE POLICY dpias_service_role
  ON public.dpias FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ─── incidents ───────────────────────────────────────────────────
DROP POLICY IF EXISTS incidents_select ON public.incidents;
CREATE POLICY incidents_select
  ON public.incidents FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS incidents_insert ON public.incidents;
CREATE POLICY incidents_insert
  ON public.incidents FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS incidents_update ON public.incidents;
CREATE POLICY incidents_update
  ON public.incidents FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS incidents_delete ON public.incidents;
CREATE POLICY incidents_delete
  ON public.incidents FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS incidents_service_role ON public.incidents;
CREATE POLICY incidents_service_role
  ON public.incidents FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ─── enterprise_agent_runs ───────────────────────────────────────
DROP POLICY IF EXISTS enterprise_agent_runs_select ON public.enterprise_agent_runs;
CREATE POLICY enterprise_agent_runs_select
  ON public.enterprise_agent_runs FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS enterprise_agent_runs_insert ON public.enterprise_agent_runs;
CREATE POLICY enterprise_agent_runs_insert
  ON public.enterprise_agent_runs FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS enterprise_agent_runs_service_role ON public.enterprise_agent_runs;
CREATE POLICY enterprise_agent_runs_service_role
  ON public.enterprise_agent_runs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ─── vps_connections ─────────────────────────────────────────────
-- Note: vps_connections uses owner_id (user), not tenant_id.
-- Existing policies already created; this just ensures RLS is enabled.

-- ─── SUMMARY ──────────────────────────────────────────────────────
-- Service-role can do anything (for Edge Functions, Cron).
-- Authenticated users scoped to their tenant via memberships lookup.
-- Anonymous access denied implicitly (no policy = deny all).
-- No public-unsafe USING(true) patterns.
