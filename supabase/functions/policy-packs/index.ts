// policy-packs — Aktivierung/Deaktivierung von Policy Packs pro Tenant.
//
// POST /functions/v1/policy-packs
// Auth: Authorization: Bearer <user JWT>
// Body: { op: 'activate' | 'deactivate', tenant_id, pack_id }
//
// Gate: policy.packs (seit AP2 ab Starter). Katalog + Abdeckung liest das
// Frontend RLS-sicher direkt (policy_pack_catalog/_controls sind global
// lesbar, framework_controls + asset_control_mappings ebenfalls).
//
// AP9 Welle 4 (2026-09-02): Packs mit eigenem Rahmenwerk-Key werden beim
// Aktivieren zusätzlich gegen diesen Key geprüft — vorher konnte, wer
// `policy.packs` hatte, jeden Pack aktivieren, auch einen, den sein Plan
// nicht enthält (entitlement-reality-map.md). Deaktivieren bleibt frei.
//
// Bei `activate` werden zusätzlich idempotent die passenden Standard-
// `governance_policies` für das aktivierte Pack angelegt sowie
// `computeAutoMappings` (`auto_map`) und fehlende Pack-Control-Mappings
// für die vorhandenen `governance_assets` des Mandanten ausgeführt.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { gateFeature, EntitlementError } from '../_shared/entitlements.ts';
import { audit } from '../_shared/auditLog.ts';
import {
  planPackPolicySeeding,
  planPackControlMappings,
  type PolicyRuleTemplateRow,
  type ExistingGovernancePolicyRow,
  type TenantAssetForAutoMap,
  type FrameworkControlRow,
  type PackControlRow,
  type ExistingAssetControlMappingRow,
} from './packActivation.ts';

/**
 * Rahmenwerke, die ihren eigenen Entitlement-Key haben. Alle anderen
 * (GDPR, EU_AI_ACT, TISAX, DORA) sind mit `policy.packs` abgedeckt.
 * Quelle: `frameworks` im `policy_pack_catalog`; Keys aus `shared/pricing.ts`.
 */
const FRAMEWORK_ENTITLEMENTS: Readonly<Record<string, string>> = {
  NIS2: 'policy.nis2',
  ISO_27001: 'policy.iso27001',
};

interface SyncPackSideEffectsResult {
  policiesCreated: number;
  policiesUpgraded: number;
  mappingsApplied: number;
}

async function syncActivatedPackResources(
  admin: SupabaseClient,
  tenantId: string,
  packIds: readonly string[],
): Promise<SyncPackSideEffectsResult> {
  const cleanPackIds = Array.from(new Set(packIds.map((p) => p.trim()).filter(Boolean)));
  if (cleanPackIds.length === 0) {
    return { policiesCreated: 0, policiesUpgraded: 0, mappingsApplied: 0 };
  }

  // 1. Standard-Policies für das aktivierte Pack idempotent anlegen
  const [{ data: dbTemplates }, { data: existingPolicies }] = await Promise.all([
    admin
      .from('policy_rule_templates')
      .select('template_id, pack_id, version, name, description, policy_type, severity, condition, action, enabled_by_default')
      .in('pack_id', cleanPackIds),
    admin
      .from('governance_policies')
      .select('id, source_template_id, source_pack_id, name, condition')
      .eq('tenant_id', tenantId),
  ]);

  const policyPlan = planPackPolicySeeding(
    tenantId,
    cleanPackIds,
    (dbTemplates ?? []) as PolicyRuleTemplateRow[],
    (existingPolicies ?? []) as ExistingGovernancePolicyRow[],
  );

  let policiesCreated = 0;
  if (policyPlan.toInsert.length > 0) {
    const { data: insertedPolicies, error: insPolErr } = await admin
      .from('governance_policies')
      .insert(policyPlan.toInsert)
      .select('id');
    if (!insPolErr && insertedPolicies) {
      policiesCreated = insertedPolicies.length;
    }
  }

  let policiesUpgraded = 0;
  for (const up of policyPlan.toUpgradeCondition) {
    const { error: upErr } = await admin
      .from('governance_policies')
      .update({ condition: up.condition })
      .eq('id', up.id);
    if (!upErr) policiesUpgraded += 1;
  }

  // 2. Vorhandene Assets des Mandanten laden (oder Initial-Scope-Asset anlegen, falls keins existiert)
  let { data: assets } = await admin
    .from('governance_assets')
    .select('id, asset_type, ai_act_class, data_types, status')
    .eq('tenant_id', tenantId)
    .neq('status', 'archived')
    .order('created_at', { ascending: true });

  if (!assets || assets.length === 0) {
    const { data: createdAsset } = await admin
      .from('governance_assets')
      .insert({
        tenant_id: tenantId,
        asset_type: 'ai_system',
        name: 'Workspace-Governance-Scope',
        description: 'Automatisch angelegter Standard-Scope für Policy-Pack-Controls.',
        ai_act_class: 'minimal',
        data_types: ['personal_data'],
        status: 'active',
        metadata: { source: 'policy_pack_activation' },
      })
      .select('id, asset_type, ai_act_class, data_types, status')
      .maybeSingle();
    if (createdAsset) {
      assets = [createdAsset];
    }
  }

  const tenantAssets = (assets ?? []) as TenantAssetForAutoMap[];
  if (tenantAssets.length === 0) {
    return { policiesCreated, policiesUpgraded, mappingsApplied: 0 };
  }

  const assetIds = tenantAssets.map((a) => a.id);
  const [
    { data: packControls },
    { data: frameworkControls },
    { data: existingMappings },
  ] = await Promise.all([
    admin
      .from('policy_pack_controls')
      .select('pack_id, framework, control_code, required')
      .in('pack_id', cleanPackIds),
    admin
      .from('framework_controls')
      .select('id, framework, control_code'),
    admin
      .from('asset_control_mappings')
      .select('asset_id, control_id, status, source')
      .in('asset_id', assetIds),
  ]);

  const plannedMappings = planPackControlMappings(
    tenantAssets,
    (packControls ?? []) as PackControlRow[],
    (frameworkControls ?? []) as FrameworkControlRow[],
    (existingMappings ?? []) as ExistingAssetControlMappingRow[],
  );

  let mappingsApplied = 0;
  if (plannedMappings.length > 0) {
    const { error: mapErr } = await admin
      .from('asset_control_mappings')
      .upsert(plannedMappings, { onConflict: 'asset_id,control_id' });
    if (!mapErr) {
      mappingsApplied = plannedMappings.length;
    }
  }

  return { policiesCreated, policiesUpgraded, mappingsApplied };
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED', 'POST only');

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const op = String(body.op ?? '');
  const tenantId = String(body.tenant_id ?? '');
  const packId = String(body.pack_id ?? '');
  if (!['activate', 'deactivate'].includes(op)) return jsonError(400, 'BAD_REQUEST', 'op must be activate|deactivate');
  if (!tenantId || !packId) return jsonError(400, 'BAD_REQUEST', 'tenant_id and pack_id required');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  const userId = userResp.user.id;
  const userEmail = userResp.user.email ?? null;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: member } = await admin.from('memberships').select('user_id').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  if (!member) return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');

  try {
    await gateFeature(admin, tenantId, 'policy.packs');
  } catch (e) {
    if (e instanceof EntitlementError) return jsonError(402, 'PAYMENT_REQUIRED', 'Policy Packs sind im aktuellen Plan nicht enthalten (policy.packs) — ab Starter.');
    return jsonError(500, 'INTERNAL', 'entitlement check failed');
  }

  try {
    // Pack muss existieren.
    const { data: pack } = await admin.from('policy_pack_catalog').select('id, frameworks').eq('id', packId).maybeSingle();
    if (!pack) return jsonError(404, 'NOT_FOUND', 'unbekanntes Policy Pack');

    let synced: SyncPackSideEffectsResult = { policiesCreated: 0, policiesUpgraded: 0, mappingsApplied: 0 };

    if (op === 'activate') {
      const frameworks = Array.isArray((pack as { frameworks?: unknown }).frameworks)
        ? ((pack as { frameworks: unknown[] }).frameworks).map((f) => String(f).toUpperCase())
        : [];
      for (const framework of frameworks) {
        const key = FRAMEWORK_ENTITLEMENTS[framework];
        if (!key) continue;
        try {
          await gateFeature(admin, tenantId, key);
        } catch (e) {
          if (e instanceof EntitlementError) {
            return jsonError(402, 'PAYMENT_REQUIRED', `Das Rahmenwerk ${framework} ist im aktuellen Plan nicht enthalten (${key}).`);
          }
          throw e;
        }
      }

      const { error } = await admin.from('policy_pack_activations')
        .upsert({ tenant_id: tenantId, pack_id: packId, created_by: userId }, { onConflict: 'tenant_id,pack_id' });
      if (error) return jsonError(500, 'INTERNAL', 'could not activate pack');

      synced = await syncActivatedPackResources(admin, tenantId, [packId]);
    } else {
      await admin.from('policy_pack_activations').delete().eq('tenant_id', tenantId).eq('pack_id', packId);
    }

    await audit(admin, {
      tenant_id: tenantId, actor_user_id: userId, actor_email: userEmail,
      action: `policy_pack.${op}`, target_type: 'policy_pack', target_id: packId,
      payload: op === 'activate'
        ? { policies_created: synced.policiesCreated, mappings_applied: synced.mappingsApplied }
        : {},
    });

    return jsonResponse({
      ok: true,
      pack_id: packId,
      activated: op === 'activate',
      ...(op === 'activate'
        ? { policies_created: synced.policiesCreated, mappings_applied: synced.mappingsApplied }
        : {}),
    });
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', scope: 'policy_packs_failed', op, error: (e as Error)?.message ?? String(e) }));
    return jsonError(500, 'INTERNAL', 'policy-packs operation failed');
  }
});
