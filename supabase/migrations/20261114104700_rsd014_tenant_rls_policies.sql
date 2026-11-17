-- RSD-014 / RSD-004 (ENTWURF): RLS fuer Tabellen mit tenant_id ohne Policy.
--
-- Live-Befund (SELECT 13.11.2026, ebljyceifhnlzhjfyxup, nur lesend):
-- 14 public-Tabellen mit tenant_id, RLS an, 0 Policies (plus runtime_events_*
-- Partitionen; Parent public.runtime_events hat bereits 3 Policies — Partitionen
-- werden hier bewusst nicht angefasst, siehe PR-Text).
--
-- WICHTIG: Tabellen ohne Policy sind derzeit Deny-by-default fuer
-- anon/authenticated. Eine SELECT-Policy fuer authenticated OEFFNET Lesen
-- fuer Mandantenmitglieder. service_role umgeht RLS weiterhin (kein FORCE RLS).
--
-- Nicht geaendert: Stripe-/Auth-Funktionen, Edge Functions (RSD-016 nicht
-- freigegeben), bestehende Policies anderer Tabellen — ausser der restriktiven
-- memberships-UPDATE-Policy (USING true -> is_tenant_member(tenant_id)).
--
-- _operation_metrics.tenant_id ist text, nicht uuid — daher keine
-- is_tenant_member-Policy, nur service_role.
-- seo_marketing_audit_log bleibt service_role-only (Audit-Log).

-- ai_evidence_retention: tenant-isoliertes SELECT, service_role ALL
DROP POLICY IF EXISTS rsd014_ai_evidence_retention_tenant_select ON public.ai_evidence_retention;
CREATE POLICY rsd014_ai_evidence_retention_tenant_select
  ON public.ai_evidence_retention
  FOR SELECT
  TO authenticated
  USING (is_tenant_member(tenant_id));

DROP POLICY IF EXISTS rsd014_ai_evidence_retention_service_all ON public.ai_evidence_retention;
CREATE POLICY rsd014_ai_evidence_retention_service_all
  ON public.ai_evidence_retention
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
-- ai_runtime_events: tenant-isoliertes SELECT, service_role ALL
DROP POLICY IF EXISTS rsd014_ai_runtime_events_tenant_select ON public.ai_runtime_events;
CREATE POLICY rsd014_ai_runtime_events_tenant_select
  ON public.ai_runtime_events
  FOR SELECT
  TO authenticated
  USING (is_tenant_member(tenant_id));

DROP POLICY IF EXISTS rsd014_ai_runtime_events_service_all ON public.ai_runtime_events;
CREATE POLICY rsd014_ai_runtime_events_service_all
  ON public.ai_runtime_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
-- bot_usage_plan_alerts: tenant-isoliertes SELECT, service_role ALL
DROP POLICY IF EXISTS rsd014_bot_usage_plan_alerts_tenant_select ON public.bot_usage_plan_alerts;
CREATE POLICY rsd014_bot_usage_plan_alerts_tenant_select
  ON public.bot_usage_plan_alerts
  FOR SELECT
  TO authenticated
  USING (is_tenant_member(tenant_id));

DROP POLICY IF EXISTS rsd014_bot_usage_plan_alerts_service_all ON public.bot_usage_plan_alerts;
CREATE POLICY rsd014_bot_usage_plan_alerts_service_all
  ON public.bot_usage_plan_alerts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
-- bot_usage_plan_applications: tenant-isoliertes SELECT, service_role ALL
DROP POLICY IF EXISTS rsd014_bot_usage_plan_applications_tenant_select ON public.bot_usage_plan_applications;
CREATE POLICY rsd014_bot_usage_plan_applications_tenant_select
  ON public.bot_usage_plan_applications
  FOR SELECT
  TO authenticated
  USING (is_tenant_member(tenant_id));

DROP POLICY IF EXISTS rsd014_bot_usage_plan_applications_service_all ON public.bot_usage_plan_applications;
CREATE POLICY rsd014_bot_usage_plan_applications_service_all
  ON public.bot_usage_plan_applications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
-- browser_executions: tenant-isoliertes SELECT, service_role ALL
DROP POLICY IF EXISTS rsd014_browser_executions_tenant_select ON public.browser_executions;
CREATE POLICY rsd014_browser_executions_tenant_select
  ON public.browser_executions
  FOR SELECT
  TO authenticated
  USING (is_tenant_member(tenant_id));

DROP POLICY IF EXISTS rsd014_browser_executions_service_all ON public.browser_executions;
CREATE POLICY rsd014_browser_executions_service_all
  ON public.browser_executions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
-- compliance_escalation_chain: tenant-isoliertes SELECT, service_role ALL
DROP POLICY IF EXISTS rsd014_compliance_escalation_chain_tenant_select ON public.compliance_escalation_chain;
CREATE POLICY rsd014_compliance_escalation_chain_tenant_select
  ON public.compliance_escalation_chain
  FOR SELECT
  TO authenticated
  USING (is_tenant_member(tenant_id));

DROP POLICY IF EXISTS rsd014_compliance_escalation_chain_service_all ON public.compliance_escalation_chain;
CREATE POLICY rsd014_compliance_escalation_chain_service_all
  ON public.compliance_escalation_chain
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
-- enterprise_agent_policies: tenant-isoliertes SELECT, service_role ALL
DROP POLICY IF EXISTS rsd014_enterprise_agent_policies_tenant_select ON public.enterprise_agent_policies;
CREATE POLICY rsd014_enterprise_agent_policies_tenant_select
  ON public.enterprise_agent_policies
  FOR SELECT
  TO authenticated
  USING (is_tenant_member(tenant_id));

DROP POLICY IF EXISTS rsd014_enterprise_agent_policies_service_all ON public.enterprise_agent_policies;
CREATE POLICY rsd014_enterprise_agent_policies_service_all
  ON public.enterprise_agent_policies
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
-- enterprise_ai_audit_events: tenant-isoliertes SELECT, service_role ALL
DROP POLICY IF EXISTS rsd014_enterprise_ai_audit_events_tenant_select ON public.enterprise_ai_audit_events;
CREATE POLICY rsd014_enterprise_ai_audit_events_tenant_select
  ON public.enterprise_ai_audit_events
  FOR SELECT
  TO authenticated
  USING (is_tenant_member(tenant_id));

DROP POLICY IF EXISTS rsd014_enterprise_ai_audit_events_service_all ON public.enterprise_ai_audit_events;
CREATE POLICY rsd014_enterprise_ai_audit_events_service_all
  ON public.enterprise_ai_audit_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
-- enterprise_ai_system_registry: tenant-isoliertes SELECT, service_role ALL
DROP POLICY IF EXISTS rsd014_enterprise_ai_system_registry_tenant_select ON public.enterprise_ai_system_registry;
CREATE POLICY rsd014_enterprise_ai_system_registry_tenant_select
  ON public.enterprise_ai_system_registry
  FOR SELECT
  TO authenticated
  USING (is_tenant_member(tenant_id));

DROP POLICY IF EXISTS rsd014_enterprise_ai_system_registry_service_all ON public.enterprise_ai_system_registry;
CREATE POLICY rsd014_enterprise_ai_system_registry_service_all
  ON public.enterprise_ai_system_registry
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
-- enterprise_connectors: tenant-isoliertes SELECT, service_role ALL
DROP POLICY IF EXISTS rsd014_enterprise_connectors_tenant_select ON public.enterprise_connectors;
CREATE POLICY rsd014_enterprise_connectors_tenant_select
  ON public.enterprise_connectors
  FOR SELECT
  TO authenticated
  USING (is_tenant_member(tenant_id));

DROP POLICY IF EXISTS rsd014_enterprise_connectors_service_all ON public.enterprise_connectors;
CREATE POLICY rsd014_enterprise_connectors_service_all
  ON public.enterprise_connectors
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
-- enterprise_feedback_reports: tenant-isoliertes SELECT, service_role ALL
DROP POLICY IF EXISTS rsd014_enterprise_feedback_reports_tenant_select ON public.enterprise_feedback_reports;
CREATE POLICY rsd014_enterprise_feedback_reports_tenant_select
  ON public.enterprise_feedback_reports
  FOR SELECT
  TO authenticated
  USING (is_tenant_member(tenant_id));

DROP POLICY IF EXISTS rsd014_enterprise_feedback_reports_service_all ON public.enterprise_feedback_reports;
CREATE POLICY rsd014_enterprise_feedback_reports_service_all
  ON public.enterprise_feedback_reports
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
-- enterprise_founders_access: tenant-isoliertes SELECT, service_role ALL
DROP POLICY IF EXISTS rsd014_enterprise_founders_access_tenant_select ON public.enterprise_founders_access;
CREATE POLICY rsd014_enterprise_founders_access_tenant_select
  ON public.enterprise_founders_access
  FOR SELECT
  TO authenticated
  USING (is_tenant_member(tenant_id));

DROP POLICY IF EXISTS rsd014_enterprise_founders_access_service_all ON public.enterprise_founders_access;
CREATE POLICY rsd014_enterprise_founders_access_service_all
  ON public.enterprise_founders_access
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
-- _operation_metrics: bewusst kein authenticated-Zugang
DROP POLICY IF EXISTS rsd014__operation_metrics_service_all ON public._operation_metrics;
CREATE POLICY rsd014__operation_metrics_service_all
  ON public._operation_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
-- seo_marketing_audit_log: bewusst kein authenticated-Zugang
DROP POLICY IF EXISTS rsd014_seo_marketing_audit_log_service_all ON public.seo_marketing_audit_log;
CREATE POLICY rsd014_seo_marketing_audit_log_service_all
  ON public.seo_marketing_audit_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- memberships: restriktive UPDATE-Policy enger binden.
-- Live: polpermissive=false, USING true, WITH CHECK can_set_membership_role(...).
-- USING true heisst: die Restriktion gilt fuer jede Zeile, die eine permissiven
-- Policy durchlaesst. Eine spaetere permissive USING-true-Policy wuerde dann
-- alle Zeilen sichtbar machen. USING is_tenant_member(tenant_id) begrenzt das
-- auf den eigenen Mandanten; WITH CHECK bleibt unveraendert.
DROP POLICY IF EXISTS "memberships prevent-last-owner-downgrade" ON public.memberships;
CREATE POLICY "memberships prevent-last-owner-downgrade"
  ON public.memberships
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (is_tenant_member(tenant_id))
  WITH CHECK (can_set_membership_role(tenant_id, user_id, role));

-- Policies allein oeffnen nicht: authenticated hat auf diesen Tabellen
-- typischerweise keine Table-Privilegien (lokal nachgeprueft). Ohne GRANT
-- SELECT bleibt jedes Mitglieds-SELECT bei "permission denied".
GRANT SELECT ON TABLE
  public.ai_evidence_retention,
  public.ai_runtime_events,
  public.bot_usage_plan_alerts,
  public.bot_usage_plan_applications,
  public.browser_executions,
  public.compliance_escalation_chain,
  public.enterprise_agent_policies,
  public.enterprise_ai_audit_events,
  public.enterprise_ai_system_registry,
  public.enterprise_connectors,
  public.enterprise_feedback_reports,
  public.enterprise_founders_access
  TO authenticated;
-- _operation_metrics und seo_marketing_audit_log bewusst ohne Grant an authenticated.
