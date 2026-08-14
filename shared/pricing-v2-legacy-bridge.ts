/**
 * Pricing V2 compatibility bridge.
 *
 * This is intentionally separate from shared/pricing.ts. It lets the new
 * capability/capacity model coexist with the existing Stripe/plan catalog
 * while we migrate customer entitlements safely.
 *
 * Rules:
 * - legacy plan keys remain authoritative for existing billing;
 * - this file translates only capabilities/capacity;
 * - no Stripe IDs or prices live here;
 * - one-time governance_launch is handled separately by its existing grant;
 * - new customers can eventually be created directly from modular grants.
 */

import type { PlanKey } from './pricing';
import {
  type Capability,
  type CapacityKey,
  type ModularEntitlements,
  DEFAULT_CORE_CAPACITY,
} from './capability-entitlements';

const CORE: Capability[] = ['core_governance'];

const LEGACY_CAPABILITIES: Record<string, Capability[]> = {
  free_audit: [],
  starter: CORE,
  starter_yearly: CORE,
  growth: [
    ...CORE,
    'legal',
    'automation',
    'workflows',
  ],
  growth_yearly: [
    ...CORE,
    'legal',
    'automation',
    'workflows',
  ],
  agency: [
    ...CORE,
    'legal',
    'automation',
    'workflows',
    'remediation',
    'bulk_operations',
    'ai_bots',
    'website_chat',
    'api',
    'webhooks',
    'human_handoff',
  ],
  agency_yearly: [
    ...CORE,
    'legal',
    'automation',
    'workflows',
    'remediation',
    'bulk_operations',
    'ai_bots',
    'website_chat',
    'api',
    'webhooks',
    'human_handoff',
  ],
  enterprise: [
    ...CORE,
    'legal',
    'health',
    'finance',
    'ai_governance',
    'nis2',
    'dora',
    'iso_27001',
    'tisax',
    'automation',
    'workflows',
    'drift_detection',
    'remediation',
    'bulk_operations',
    'ai_bots',
    'voice',
    'whatsapp',
    'website_chat',
    'api',
    'webhooks',
    'human_handoff',
  ],
  enterprise_yearly: [
    ...CORE,
    'legal',
    'health',
    'finance',
    'ai_governance',
    'nis2',
    'dora',
    'iso_27001',
    'tisax',
    'automation',
    'workflows',
    'drift_detection',
    'remediation',
    'bulk_operations',
    'ai_bots',
    'voice',
    'whatsapp',
    'website_chat',
    'api',
    'webhooks',
    'human_handoff',
  ],
  partner: [
    ...CORE,
    'automation',
    'workflows',
    'bulk_operations',
    'ai_bots',
    'website_chat',
    'api',
    'webhooks',
    'human_handoff',
  ],
  partner_yearly: [
    ...CORE,
    'automation',
    'workflows',
    'bulk_operations',
    'ai_bots',
    'website_chat',
    'api',
    'webhooks',
    'human_handoff',
  ],
};

const LEGACY_WEBSITE_CAPACITY: Record<string, number> = {
  free_audit: 1,
  starter: 1,
  starter_yearly: 1,
  growth: 5,
  growth_yearly: 5,
  agency: 25,
  agency_yearly: 25,
  enterprise: 100,
  enterprise_yearly: 100,
  partner: -1,
  partner_yearly: -1,
};

export function modularEntitlementsForLegacyPlan(planKey: PlanKey): ModularEntitlements {
  const capabilities = LEGACY_CAPABILITIES[planKey] ?? [];
  const websites = LEGACY_WEBSITE_CAPACITY[planKey] ?? 0;

  const capacity: Record<CapacityKey, number> = {
    ...DEFAULT_CORE_CAPACITY,
    websites,
  };

  return {
    capabilities: capabilities.map((capability) => ({
      capability,
      enabled: true,
      source: `legacy-plan:${planKey}`,
    })),
    capacity: Object.entries(capacity).map(([key, limit]) => ({
      capacity: key as CapacityKey,
      limit,
      source: `legacy-plan:${planKey}`,
    })),
  };
}

/**
 * Guard used during migration: a legacy customer must never receive less
 * website capacity merely because the entitlement representation changed.
 */
export function preservesLegacyWebsiteCapacity(
  planKey: PlanKey,
  requestedCapacity: number,
): boolean {
  return requestedCapacity <= (LEGACY_WEBSITE_CAPACITY[planKey] ?? 0);
}
