-- Gate 0 — RLS-Härtung (additiv, keine Daten- oder Schemaänderung an Tabellen).
--
-- Befunde gegen das voll migrierte Schema (pg_policies, 2026-09-27) verifiziert:
--
-- 1. „Service role“-Policies ohne TO-Klausel gelten für PUBLIC (anon,
--    authenticated). service_role hat BYPASSRLS und braucht sie gar nicht —
--    die Policies öffnen die Tabellen also ausschließlich für Clients.
-- 2. Direkte Member-Schreibrechte auf ai_systems, ai_act_assessments,
--    ai_policies (jede Rolle inkl. viewer_auditor, ohne Prüfpfad).
-- 3. ai_evidence_events: jedes Mitglied konnte beliebige Evidence-Typen
--    schreiben (auch Policy-/Approval-/Decision-Evidence). Einziger legitimer
--    Client-Schreiber ist der Industrial-OT-Wizard
--    (src/features/governance/IndustrialOtWizardView.tsx) mit
--    event_type='ai_act_classification' ohne ai_system_id/policy_id — genau
--    dieser Fall bleibt erlaubt, für schreibende Rollen.
-- 4. memberships „owner-write“ (FOR ALL, owner ODER admin): ein Admin konnte
--    sich selbst oder andere zu 'owner' machen und Owner-Zeilen ändern/löschen.
--
-- Alle legitimen Schreibpfade dieser Tabellen laufen über Edge Functions mit
-- service_role (geprüft: governance-resources, governance-decide,
-- governance-approvals, telemetry-ai-event, ai-act-auto-classify, api-audit,
-- email-notify-send, website-*-agent, cloudflare-deployer, tenant-members …)
-- oder über SECURITY-DEFINER-Funktionen (handle_new_auth_user) und sind von
-- RLS nicht betroffen.
--
-- Bewusst NICHT geändert: webhook_deliveries „service_insert“ — gilt zwar für
-- PUBLIC, prüft aber auth.role() = 'service_role' aus dem signierten JWT und
-- ist damit wirksam beschränkt.

-- ─── Helfer ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_tenant_owner(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.tenant_id = p_tenant_id
      AND m.user_id   = auth.uid()
      AND m.role      = 'owner'
  );
$$;

COMMENT ON FUNCTION public.is_tenant_owner(uuid) IS
  'Gate 0: true, wenn der aufrufende Nutzer Owner des Mandanten ist.';

CREATE OR REPLACE FUNCTION public.is_tenant_writer(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.tenant_id = p_tenant_id
      AND m.user_id   = auth.uid()
      AND m.role      IN ('owner', 'admin', 'dpo', 'editor')
  );
$$;

COMMENT ON FUNCTION public.is_tenant_writer(uuid) IS
  'Gate 0: true für schreibende Mandantenrollen (owner, admin, dpo, editor) — nicht viewer_auditor.';

-- ─── 1. „Service role“-Policies auf service_role einschränken ────────────────

-- agent_configuration: FOR ALL USING (true) für PUBLIC.
DROP POLICY IF EXISTS "Service role can manage agent config" ON public.agent_configuration;
DROP POLICY IF EXISTS agent_configuration_service_role ON public.agent_configuration;
CREATE POLICY agent_configuration_service_role
  ON public.agent_configuration FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- agent_token_usage: SELECT USING (true) für PUBLIC legte die Token-Nutzung
-- aller Mandanten offen; INSERT WITH CHECK (true) für PUBLIC.
DROP POLICY IF EXISTS "Service role can view token usage" ON public.agent_token_usage;
DROP POLICY IF EXISTS "Service role can insert token usage" ON public.agent_token_usage;
DROP POLICY IF EXISTS agent_token_usage_service_role ON public.agent_token_usage;
CREATE POLICY agent_token_usage_service_role
  ON public.agent_token_usage FOR ALL TO service_role
  USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS agent_token_usage_tenant_select ON public.agent_token_usage;
CREATE POLICY agent_token_usage_tenant_select
  ON public.agent_token_usage FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

-- governance_audit_log: Prüfpfad war für jeden Client beschreibbar.
DROP POLICY IF EXISTS "Service role can insert audit entries" ON public.governance_audit_log;
DROP POLICY IF EXISTS governance_audit_log_service_insert ON public.governance_audit_log;
CREATE POLICY governance_audit_log_service_insert
  ON public.governance_audit_log FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "api_calls service_role_insert" ON public.api_calls;
DROP POLICY IF EXISTS api_calls_service_insert ON public.api_calls;
CREATE POLICY api_calls_service_insert
  ON public.api_calls FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "email_notifications service_role_insert" ON public.email_notifications;
DROP POLICY IF EXISTS email_notifications_service_insert ON public.email_notifications;
CREATE POLICY email_notifications_service_insert
  ON public.email_notifications FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can create notifications" ON public.dashboard_notifications;
DROP POLICY IF EXISTS dashboard_notifications_service_insert ON public.dashboard_notifications;
CREATE POLICY dashboard_notifications_service_insert
  ON public.dashboard_notifications FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert logs" ON public.deployment_logs;
DROP POLICY IF EXISTS deployment_logs_service_insert ON public.deployment_logs;
CREATE POLICY deployment_logs_service_insert
  ON public.deployment_logs FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert/update reports" ON public.website_compliance_reports;
DROP POLICY IF EXISTS "Service role can update reports" ON public.website_compliance_reports;
DROP POLICY IF EXISTS website_compliance_reports_service_write ON public.website_compliance_reports;
CREATE POLICY website_compliance_reports_service_write
  ON public.website_compliance_reports FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ─── 2. Direkte Member-Schreibrechte entfernen ───────────────────────────────
-- Lese-Policies bleiben unverändert. Schreiben nur noch serverseitig
-- (service_role, eigene Policies *_service_role / service_only_write bleiben).

DROP POLICY IF EXISTS ai_systems_insert ON public.ai_systems;
DROP POLICY IF EXISTS ai_systems_update ON public.ai_systems;
DROP POLICY IF EXISTS ai_systems_delete ON public.ai_systems;
DROP POLICY IF EXISTS "ai_systems tenant_update" ON public.ai_systems;

DROP POLICY IF EXISTS "ai_act_assessments tenant_update" ON public.ai_act_assessments;

DROP POLICY IF EXISTS ai_policies_insert ON public.ai_policies;
DROP POLICY IF EXISTS ai_policies_update ON public.ai_policies;
DROP POLICY IF EXISTS ai_policies_delete ON public.ai_policies;

-- ─── 3. ai_evidence_events: Client-Insert auf den OT-Wizard-Fall begrenzen ───

DROP POLICY IF EXISTS ai_evidence_events_insert ON public.ai_evidence_events;
CREATE POLICY ai_evidence_events_insert
  ON public.ai_evidence_events FOR INSERT TO authenticated
  WITH CHECK (
    public.is_tenant_writer(tenant_id)
    AND event_type = 'ai_act_classification'
    AND ai_system_id IS NULL
    AND policy_id IS NULL
  );

-- ─── 4. memberships: keine Owner-Erzeugung durch Admins ──────────────────────
-- Owner dürfen alles. Admins dürfen Nicht-Owner-Zeilen verwalten, aber weder
-- eine Owner-Zeile anfassen noch die Rolle 'owner' vergeben (auch nicht an
-- sich selbst). Übrige Rollen: kein Schreibrecht.

DROP POLICY IF EXISTS "memberships owner-write" ON public.memberships;

DROP POLICY IF EXISTS memberships_insert ON public.memberships;
CREATE POLICY memberships_insert
  ON public.memberships FOR INSERT TO authenticated
  WITH CHECK (
    public.is_tenant_owner(tenant_id)
    OR (public.is_tenant_owner_or_admin(tenant_id) AND role <> 'owner')
  );

DROP POLICY IF EXISTS memberships_update ON public.memberships;
CREATE POLICY memberships_update
  ON public.memberships FOR UPDATE TO authenticated
  USING (
    public.is_tenant_owner(tenant_id)
    OR (public.is_tenant_owner_or_admin(tenant_id) AND role <> 'owner')
  )
  WITH CHECK (
    public.is_tenant_owner(tenant_id)
    OR (public.is_tenant_owner_or_admin(tenant_id) AND role <> 'owner')
  );

DROP POLICY IF EXISTS memberships_delete ON public.memberships;
CREATE POLICY memberships_delete
  ON public.memberships FOR DELETE TO authenticated
  USING (
    public.is_tenant_owner(tenant_id)
    OR (public.is_tenant_owner_or_admin(tenant_id) AND role <> 'owner')
  );

-- ─── 5. Views über gehärtete Tabellen: RLS nicht mehr umgehen ────────────────
-- Beide Views laufen ohne security_invoker mit den Rechten ihres Owners und
-- umgehen damit die RLS der Basistabelle. Verifiziert: anon las über
-- agent_token_usage_analytics bzw. api_monthly_usage Zeilen fremder Mandanten,
-- obwohl der direkte Tabellenzugriff 0 Zeilen liefert. Mit security_invoker
-- gilt die Policy der Basistabelle: Mitglieder sehen ihren Mandanten
-- (ApiUsageStats liest api_monthly_usage weiter), anon und Fremde nichts.
ALTER VIEW public.agent_token_usage_analytics SET (security_invoker = on);
ALTER VIEW public.api_monthly_usage SET (security_invoker = on);
