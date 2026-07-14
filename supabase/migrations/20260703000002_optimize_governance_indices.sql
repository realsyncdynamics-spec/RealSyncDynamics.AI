-- Performance optimization: add strategic indices for governance queries
-- Targets: governance-agent (2-5s → <2s), database queries (p95 <200ms)

-- Asset reference lookups (used in auto-mapping, policy pack operations)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_governance_assets_tenant_ref
  ON governance_assets(tenant_id, asset_ref) WHERE status != 'archived';

-- Control lookups by tenant and type (policy pack operations)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_governance_controls_tenant_type
  ON governance_controls(tenant_id, control_type) WHERE is_active = TRUE;

-- Custody chain queries (provenance verification)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_governance_audit_log_asset
  ON governance_admin_audit_log(asset_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_governance_audit_log_tenant_time
  ON governance_admin_audit_log(tenant_id, created_at DESC);

-- Policy pack queries (auto-activation, recommendations)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_governance_policy_packs_tenant
  ON governance_policy_packs(tenant_id, priority DESC) WHERE is_active = TRUE;

-- Current mapping lookups (fast control status queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_governance_current_mappings_asset_control
  ON governance_current_mappings(asset_id, control_id) WHERE status != 'not_applicable';

-- Recommendation confidence filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_governance_auto_map_confidence
  ON governance_auto_mappings(asset_id, confidence DESC) WHERE confidence > 75;

-- Tenant industry detection (for auto-mapping signal)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tenants_industry
  ON tenants(id, industry) WHERE industry IS NOT NULL;

-- Signing keys lookups (provenance verification)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_signing_keys_active
  ON signing_keys(tenant_id, is_active) WHERE is_active = TRUE;

-- Composite index for fast asset + control + tenant queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_governance_assets_controls_composite
  ON governance_assets(tenant_id, asset_ref, id) WHERE status != 'archived';

-- Analyse tables to update planner statistics
ANALYZE governance_assets;
ANALYZE governance_controls;
ANALYZE governance_admin_audit_log;
ANALYZE governance_policy_packs;
ANALYZE governance_current_mappings;
ANALYZE governance_auto_mappings;
ANALYZE tenants;
ANALYZE signing_keys;

-- Comment on indices
COMMENT ON INDEX idx_governance_assets_tenant_ref IS 'Supports fast asset lookups by tenant during auto-mapping';
COMMENT ON INDEX idx_governance_controls_tenant_type IS 'Supports control filtering by type during policy pack operations';
COMMENT ON INDEX idx_governance_audit_log_asset IS 'Supports provenance chain queries for custody verification';
COMMENT ON INDEX idx_governance_audit_log_tenant_time IS 'Supports audit log filtering by tenant and time range';
COMMENT ON INDEX idx_governance_policy_packs_tenant IS 'Supports policy pack recommendation queries';
COMMENT ON INDEX idx_governance_current_mappings_asset_control IS 'Supports fast control status lookups';
COMMENT ON INDEX idx_governance_auto_map_confidence IS 'Supports high-confidence mapping filtering';
COMMENT ON INDEX idx_tenants_industry IS 'Supports industry-based auto-mapping recommendations';
COMMENT ON INDEX idx_signing_keys_active IS 'Supports fast active key lookups for signature verification';
