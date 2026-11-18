-- Rollback RSD-014. Nur nach angewendeter Forward-Migration verwenden.
-- Stellt die restriktive memberships-Policy auf USING true zurueck
-- (Stand Live 13.11.2026) und entfernt die in der Forward-Migration
-- angelegten Policies.

DROP POLICY IF EXISTS rsd014_ai_evidence_retention_tenant_select ON public.ai_evidence_retention;
DROP POLICY IF EXISTS rsd014_ai_evidence_retention_service_all ON public.ai_evidence_retention;
DROP POLICY IF EXISTS rsd014_ai_runtime_events_tenant_select ON public.ai_runtime_events;
DROP POLICY IF EXISTS rsd014_ai_runtime_events_service_all ON public.ai_runtime_events;
DROP POLICY IF EXISTS rsd014_bot_usage_plan_alerts_tenant_select ON public.bot_usage_plan_alerts;
DROP POLICY IF EXISTS rsd014_bot_usage_plan_alerts_service_all ON public.bot_usage_plan_alerts;
DROP POLICY IF EXISTS rsd014_bot_usage_plan_applications_tenant_select ON public.bot_usage_plan_applications;
DROP POLICY IF EXISTS rsd014_bot_usage_plan_applications_service_all ON public.bot_usage_plan_applications;
DROP POLICY IF EXISTS rsd014_browser_executions_tenant_select ON public.browser_executions;
DROP POLICY IF EXISTS rsd014_browser_executions_service_all ON public.browser_executions;
DROP POLICY IF EXISTS rsd014_compliance_escalation_chain_tenant_select ON public.compliance_escalation_chain;
DROP POLICY IF EXISTS rsd014_compliance_escalation_chain_service_all ON public.compliance_escalation_chain;
DROP POLICY IF EXISTS rsd014_enterprise_agent_policies_tenant_select ON public.enterprise_agent_policies;
DROP POLICY IF EXISTS rsd014_enterprise_agent_policies_service_all ON public.enterprise_agent_policies;
DROP POLICY IF EXISTS rsd014_enterprise_ai_audit_events_tenant_select ON public.enterprise_ai_audit_events;
DROP POLICY IF EXISTS rsd014_enterprise_ai_audit_events_service_all ON public.enterprise_ai_audit_events;
DROP POLICY IF EXISTS rsd014_enterprise_ai_system_registry_tenant_select ON public.enterprise_ai_system_registry;
DROP POLICY IF EXISTS rsd014_enterprise_ai_system_registry_service_all ON public.enterprise_ai_system_registry;
DROP POLICY IF EXISTS rsd014_enterprise_connectors_tenant_select ON public.enterprise_connectors;
DROP POLICY IF EXISTS rsd014_enterprise_connectors_service_all ON public.enterprise_connectors;
DROP POLICY IF EXISTS rsd014_enterprise_feedback_reports_tenant_select ON public.enterprise_feedback_reports;
DROP POLICY IF EXISTS rsd014_enterprise_feedback_reports_service_all ON public.enterprise_feedback_reports;
DROP POLICY IF EXISTS rsd014_enterprise_founders_access_tenant_select ON public.enterprise_founders_access;
DROP POLICY IF EXISTS rsd014_enterprise_founders_access_service_all ON public.enterprise_founders_access;
DROP POLICY IF EXISTS rsd014__operation_metrics_service_all ON public._operation_metrics;
DROP POLICY IF EXISTS rsd014_seo_marketing_audit_log_service_all ON public.seo_marketing_audit_log;

DROP POLICY IF EXISTS "memberships prevent-last-owner-downgrade" ON public.memberships;
CREATE POLICY "memberships prevent-last-owner-downgrade"
  ON public.memberships
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (can_set_membership_role(tenant_id, user_id, role));

REVOKE SELECT ON TABLE
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
  FROM authenticated;
