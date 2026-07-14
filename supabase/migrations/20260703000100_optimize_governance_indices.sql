-- Performance optimization: add strategic indices for governance queries.
-- Targets: governance-agent (2-5s → <2s), database queries (p95 <200ms).
--
-- WICHTIG: Indizes referenzieren ausschließlich real existierende Tabellen und
-- Spalten des aktuellen Governance-Schemas (siehe 20260512000000_governance_events.sql).
-- Frühere Fassung indizierte spekulative, nie angelegte Tabellen
-- (governance_controls, governance_admin_audit_log, governance_policy_packs,
-- governance_current_mappings, governance_auto_mappings) und eine nicht
-- vorhandene Spalte governance_assets.asset_ref — dadurch schlug die
-- Migrations-Validierung fehl.
--
-- Kein CONCURRENTLY: Die Migrations-Runner (Supabase CLI) kapseln Migrationen in
-- eine Transaktion, in der CONCURRENTLY nicht erlaubt ist. Auf frischen/kleinen
-- Tabellen ist der Sperr-Vorteil ohnehin vernachlässigbar.

-- Asset-Lookups nach Tenant + Status (Auto-Mapping, Dashboard-Listen)
CREATE INDEX IF NOT EXISTS idx_governance_assets_tenant_status
  ON public.governance_assets(tenant_id, status) WHERE status != 'archived';

-- Asset-Filter nach Typ (Auto-Mapping-Signal, Registry-Ansichten)
CREATE INDEX IF NOT EXISTS idx_governance_assets_tenant_type
  ON public.governance_assets(tenant_id, asset_type) WHERE status != 'archived';

-- Event-Historie je Asset (Custody-/Prüfpfad-Abfragen)
CREATE INDEX IF NOT EXISTS idx_governance_events_asset_time
  ON public.governance_events(asset_id, created_at DESC);

-- Event-Historie je Tenant über Zeitfenster (Audit-Log-Abfragen)
CREATE INDEX IF NOT EXISTS idx_governance_events_tenant_time
  ON public.governance_events(tenant_id, created_at DESC);

-- Tenant-Industrie-Erkennung (Signal für industriespezifisches Auto-Mapping)
CREATE INDEX IF NOT EXISTS idx_tenants_industry
  ON public.tenants(industry) WHERE industry IS NOT NULL;

-- Planner-Statistiken aktualisieren (nur real existierende Tabellen)
ANALYZE public.governance_assets;
ANALYZE public.governance_events;
ANALYZE public.tenants;

-- Kommentare zur Dokumentation
COMMENT ON INDEX idx_governance_assets_tenant_status IS 'Schnelle Asset-Lookups nach Tenant + Status beim Auto-Mapping';
COMMENT ON INDEX idx_governance_assets_tenant_type IS 'Asset-Filter nach Typ (Auto-Mapping-Signal, Registry)';
COMMENT ON INDEX idx_governance_events_asset_time IS 'Custody-/Prüfpfad-Abfragen je Asset';
COMMENT ON INDEX idx_governance_events_tenant_time IS 'Audit-Log-Abfragen je Tenant über Zeitfenster';
COMMENT ON INDEX idx_tenants_industry IS 'Industriebasierte Auto-Mapping-Empfehlungen';
