// Governance Analytics Aggregator — Daily KPI snapshot computation
//
// This function runs via cron (daily at 00:15 UTC) to compute and store
// pre-aggregated KPI metrics for fast dashboard loads.
//
// Invoked by: Supabase Cron (via pg_cron)
// Authorization: service_role (automatic)

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse } from '../_shared/gateway.ts';

interface KpiSnapshot {
  tenant_id: string;
  captured_date: string;
  asset_count: number;
  policy_count: number;
  event_count: number;
  incident_count: number;
  critical_incident_count: number;
  high_incident_count: number;
  medium_incident_count: number;
  policy_blocks_count: number;
  policy_warns_count: number;
  policy_approvals_required_count: number;
  dpia_draft_count: number;
  dpia_approved_count: number;
  dsr_overdue_count: number;
  assets_with_evidence_percent: number;
  assets_with_mappings_percent: number;
  policies_enabled_percent: number;
  metadata: Record<string, unknown>;
}

async function computeAssetMetrics(
  client: ReturnType<typeof createClient>,
  tenantId: string
): Promise<{
  count: number;
  riskDistribution: { critical: number; high: number; medium: number };
  typeCounts: Record<string, number>;
}> {
  try {
    const { data, error } = await client.rpc('get_asset_metrics', { p_tenant_id: tenantId });
    if (error) throw error;
    return data || { count: 0, riskDistribution: {}, typeCounts: {} };
  } catch (err) {
    console.error('Error computing asset metrics:', err);
    return { count: 0, riskDistribution: { critical: 0, high: 0, medium: 0 }, typeCounts: {} };
  }
}

async function computePolicyMetrics(
  client: ReturnType<typeof createClient>,
  tenantId: string
): Promise<{ count: number; enabled_percent: number; blocks_count: number; warns_count: number }> {
  try {
    const { data, error } = await client.rpc('get_policy_metrics', { p_tenant_id: tenantId });
    if (error) throw error;
    return data || { count: 0, enabled_percent: 0, blocks_count: 0, warns_count: 0 };
  } catch (err) {
    console.error('Error computing policy metrics:', err);
    return { count: 0, enabled_percent: 0, blocks_count: 0, warns_count: 0 };
  }
}

async function computeIncidentMetrics(
  client: ReturnType<typeof createClient>,
  tenantId: string
): Promise<{
  count: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  approvals_required: number;
}> {
  try {
    const { data, error } = await client.rpc('get_incident_metrics', { p_tenant_id: tenantId });
    if (error) throw error;
    return (
      data || {
        count: 0,
        critical_count: 0,
        high_count: 0,
        medium_count: 0,
        approvals_required: 0,
      }
    );
  } catch (err) {
    console.error('Error computing incident metrics:', err);
    return {
      count: 0,
      critical_count: 0,
      high_count: 0,
      medium_count: 0,
      approvals_required: 0,
    };
  }
}

async function computeComplianceMetrics(
  client: ReturnType<typeof createClient>,
  tenantId: string
): Promise<{
  dpia_draft: number;
  dpia_approved: number;
  dsr_overdue: number;
  mappings_percent: number;
}> {
  try {
    const { data, error } = await client.rpc('get_compliance_metrics', { p_tenant_id: tenantId });
    if (error) throw error;
    return data || { dpia_draft: 0, dpia_approved: 0, dsr_overdue: 0, mappings_percent: 0 };
  } catch (err) {
    console.error('Error computing compliance metrics:', err);
    return { dpia_draft: 0, dpia_approved: 0, dsr_overdue: 0, mappings_percent: 0 };
  }
}

async function computeSnapshotForTenant(
  client: ReturnType<typeof createClient>,
  tenantId: string
): Promise<KpiSnapshot | null> {
  const today = new Date().toISOString().split('T')[0];

  try {
    const [assets, policies, incidents, compliance] = await Promise.all([
      computeAssetMetrics(client, tenantId),
      computePolicyMetrics(client, tenantId),
      computeIncidentMetrics(client, tenantId),
      computeComplianceMetrics(client, tenantId),
    ]);

    const snapshot: KpiSnapshot = {
      tenant_id: tenantId,
      captured_date: today,
      asset_count: assets.count,
      policy_count: policies.count,
      event_count: 0, // Will be computed from events table
      incident_count: incidents.count,
      critical_incident_count: incidents.critical_count,
      high_incident_count: incidents.high_count,
      medium_incident_count: incidents.medium_count,
      policy_blocks_count: policies.blocks_count,
      policy_warns_count: policies.warns_count,
      policy_approvals_required_count: incidents.approvals_required,
      dpia_draft_count: compliance.dpia_draft,
      dpia_approved_count: compliance.dpia_approved,
      dsr_overdue_count: compliance.dsr_overdue,
      assets_with_evidence_percent: Math.min(100, Math.round(assets.count > 0 ? (assets.typeCounts['documented'] ?? 0) / assets.count * 100 : 0)),
      assets_with_mappings_percent: compliance.mappings_percent,
      policies_enabled_percent: policies.enabled_percent,
      metadata: {
        computedAt: new Date().toISOString(),
        version: '1.0',
      },
    };

    return snapshot;
  } catch (err) {
    console.error(`Error computing snapshot for tenant ${tenantId}:`, err);
    return null;
  }
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: 'Missing environment variables' }, 500);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const startTime = Date.now();
  let processed = 0;
  let failed = 0;
  const errors: string[] = [];

  try {
    // Fetch all active tenants
    const { data: tenants, error: tenantsErr } = await admin
      .from('workspaces')
      .select('id')
      .eq('status', 'active')
      .limit(1000); // Safety limit

    if (tenantsErr) {
      throw new Error(`Failed to fetch tenants: ${tenantsErr.message}`);
    }

    if (!tenants || tenants.length === 0) {
      return jsonResponse({
        success: true,
        processed: 0,
        failed: 0,
        duration_ms: Date.now() - startTime,
        message: 'No active tenants found',
      });
    }

    // Compute and upsert snapshot for each tenant
    for (const tenant of tenants) {
      try {
        const snapshot = await computeSnapshotForTenant(admin, tenant.id);

        if (snapshot) {
          const { error: upsertErr } = await admin
            .from('governance_kpi_snapshots')
            .upsert(snapshot, { onConflict: 'tenant_id,captured_date' });

          if (upsertErr) {
            throw upsertErr;
          }
          processed++;
        } else {
          failed++;
          errors.push(`Failed to compute snapshot for ${tenant.id}`);
        }
      } catch (err) {
        failed++;
        errors.push(`Tenant ${tenant.id}: ${err instanceof Error ? err.message : String(err)}`);
        // Continue to next tenant
      }
    }

    const duration = Date.now() - startTime;
    return jsonResponse({
      success: true,
      processed,
      failed,
      duration_ms: duration,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined, // Return first 5 errors
    });
  } catch (err) {
    console.error('Aggregator failed:', err);
    return jsonResponse({
      success: false,
      error: err instanceof Error ? err.message : String(err),
      processed,
      failed,
      duration_ms: Date.now() - startTime,
    }, 500);
  }
});
