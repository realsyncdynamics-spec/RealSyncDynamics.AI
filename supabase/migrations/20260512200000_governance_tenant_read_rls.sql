-- ============================================================
-- Tenant-scoped read access for governance_* tables
-- ============================================================
-- Authenticated users may SELECT rows whose tenant_id is in their
-- memberships set. Writes stay service-role-only (Edge Functions
-- mediate ingestion / key management / future asset+policy CRUD).
--
-- framework_controls already has an authenticated-read-all policy
-- from the foundation migration; not duplicated here.

CREATE POLICY "governance_assets_tenant_read"
ON public.governance_assets
FOR SELECT TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()
  )
);

CREATE POLICY "governance_policies_tenant_read"
ON public.governance_policies
FOR SELECT TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()
  )
);

CREATE POLICY "governance_events_tenant_read"
ON public.governance_events
FOR SELECT TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()
  )
);

CREATE POLICY "governance_evidence_tenant_read"
ON public.governance_evidence
FOR SELECT TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()
  )
);

CREATE POLICY "asset_control_mappings_tenant_read"
ON public.asset_control_mappings
FOR SELECT TO authenticated
USING (
  asset_id IN (
    SELECT id FROM public.governance_assets
    WHERE tenant_id IN (
      SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()
    )
  )
);
