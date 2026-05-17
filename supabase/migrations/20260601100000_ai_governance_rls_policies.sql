-- AI Governance Core — RLS-Policies (Folgemigration zu 20260510_ai_governance_core.sql)
--
-- Die drei Kerntabellen (ai_systems, ai_policies, ai_evidence_events) hatten
-- bisher RLS aktiviert, aber keine Policies. Damit lieferten alle SELECTs für
-- nicht-service_role-Sessions 0 Zeilen, und das Dashboard fiel immer auf
-- Demo-Daten zurück. Diese Migration vergibt:
--
--   1. SELECT für eingeloggte Member ihres Tenants (`tenant_id IN memberships`)
--   2. SELECT auf globale Demo-Policies (`ai_policies.tenant_id IS NULL`) für
--      alle authentifizierten User — das stellt sicher, dass die in der
--      Vorgängermigration eingespielten Beispiel-Policies pro Mandant
--      sichtbar sind, ohne sie zu duplizieren.
--   3. INSERT/UPDATE/DELETE auf eigene Tenant-Rows (member-scoped).
--   4. service_role bleibt explizit zugelassen für Backfills, Cron, Edge
--      Functions — gleiches Muster wie 20260430180000 oder 20260515300000.
--
-- Alles idempotent (DROP POLICY IF EXISTS + CREATE POLICY).

-- ─── ai_systems ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS ai_systems_select ON public.ai_systems;
CREATE POLICY ai_systems_select
  ON public.ai_systems
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS ai_systems_insert ON public.ai_systems;
CREATE POLICY ai_systems_insert
  ON public.ai_systems
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS ai_systems_update ON public.ai_systems;
CREATE POLICY ai_systems_update
  ON public.ai_systems
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS ai_systems_delete ON public.ai_systems;
CREATE POLICY ai_systems_delete
  ON public.ai_systems
  FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS ai_systems_service_role ON public.ai_systems;
CREATE POLICY ai_systems_service_role
  ON public.ai_systems
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── ai_policies (tenant-scoped + global demo policies sichtbar) ─────────────

DROP POLICY IF EXISTS ai_policies_select ON public.ai_policies;
CREATE POLICY ai_policies_select
  ON public.ai_policies
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IS NULL
    OR tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS ai_policies_insert ON public.ai_policies;
CREATE POLICY ai_policies_insert
  ON public.ai_policies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS ai_policies_update ON public.ai_policies;
CREATE POLICY ai_policies_update
  ON public.ai_policies
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS ai_policies_delete ON public.ai_policies;
CREATE POLICY ai_policies_delete
  ON public.ai_policies
  FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS ai_policies_service_role ON public.ai_policies;
CREATE POLICY ai_policies_service_role
  ON public.ai_policies
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── ai_evidence_events (append-only für Tenant; service_role schreibt) ──────

DROP POLICY IF EXISTS ai_evidence_events_select ON public.ai_evidence_events;
CREATE POLICY ai_evidence_events_select
  ON public.ai_evidence_events
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid())
  );

-- Kein UPDATE/DELETE-Pfad für authenticated — Evidence ist append-only.
-- Tenant-Member dürfen optional Evidence-Rows eintragen (z. B. via manuelle
-- Anmerkungen im UI); die Hash-Chain wird vom Trigger gesetzt.
DROP POLICY IF EXISTS ai_evidence_events_insert ON public.ai_evidence_events;
CREATE POLICY ai_evidence_events_insert
  ON public.ai_evidence_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS ai_evidence_events_service_role ON public.ai_evidence_events;
CREATE POLICY ai_evidence_events_service_role
  ON public.ai_evidence_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
