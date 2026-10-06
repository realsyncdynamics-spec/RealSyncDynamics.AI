-- websites und security_signals: Schreiben nur mit schreibender Rolle,
-- und nur die Spalten, die die Oberfläche tatsächlich setzt.
--
-- Befund (Feature-Matrix Phase 1, Sicherheitsbefund 6):
--
--   websites — INSERT/UPDATE/DELETE für jedes Mitglied (is_tenant_member),
--   auch viewer_auditor. Schwerer: UPDATE ohne Spaltengrenze. Der
--   Insert-Trigger b2_websites_ensure_asset prüft, dass governance_asset_id
--   zum Mandanten gehört — ein späteres UPDATE nicht. Ein Mitglied konnte die
--   Website auf das Asset eines FREMDEN Mandanten umhängen; tenant-audit
--   verankert Scan-Läufe und Nachweise dann an diesem Asset. Ebenso frei:
--   plan_tier ('rebuild'/'managed'), status, deployment_host/-ip.
--
--   security_signals — UPDATE jeder Spalte für jedes Mitglied (Schwere,
--   Payload, Zeitstempel …), obwohl die Oberfläche nur den Status setzt.
--
-- Korrektur:
--   websites: Anlegen nur für owner/admin/dpo/editor (is_tenant_writer), nur
--     mit plan_tier='audit' und status='lead' (die einzige Form, die die
--     Oberfläche anlegt), Spalten tenant_id/domain/plan_tier/status. Kein
--     Client-UPDATE (die Oberfläche ändert Websites nicht; Server-Pfade laufen
--     mit service_role). Löschen nur schreibende Rollen.
--   security_signals: UPDATE nur schreibende Rollen und nur die Spalte status.
--
-- Nicht destruktiv: keine Daten geändert; service_role-Policies unverändert.

-- ─── websites ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS websites_tenant_insert ON public.websites;
CREATE POLICY websites_tenant_insert ON public.websites
  FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_writer(tenant_id) AND plan_tier = 'audit' AND status = 'lead');

DROP POLICY IF EXISTS websites_tenant_update ON public.websites;

DROP POLICY IF EXISTS websites_tenant_delete ON public.websites;
CREATE POLICY websites_tenant_delete ON public.websites
  FOR DELETE TO authenticated
  USING (public.is_tenant_writer(tenant_id));

REVOKE INSERT, UPDATE ON public.websites FROM anon, authenticated;
GRANT INSERT (tenant_id, domain, plan_tier, status) ON public.websites TO authenticated;

-- ─── security_signals ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "security_signals tenant-update" ON public.security_signals;
CREATE POLICY "security_signals tenant-update" ON public.security_signals
  FOR UPDATE TO authenticated
  USING (public.is_tenant_writer(tenant_id))
  WITH CHECK (public.is_tenant_writer(tenant_id));

REVOKE UPDATE ON public.security_signals FROM anon, authenticated;
GRANT UPDATE (status) ON public.security_signals TO authenticated;
