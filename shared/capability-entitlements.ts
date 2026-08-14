/**
 * Modular entitlement model for Pricing V2.
 *
 * This layer is additive: legacy plan keys remain valid and continue to
 * resolve through the existing pricing SSoT. It deliberately does not
 * contain Stripe Price IDs or monetary values.
 *
 * Commercial model:
 *   capability = what the customer can do
 *   capacity   = how much they can operate
 *
 * A customer can therefore have complex governance on one website without
 * being forced into a higher organization-sized plan.
 */

export type CapabilityFamily = 'govern' | 'automate' | 'engage';

export type GovernanceCapability =
  | 'core_governance'
  | 'legal'
  | 'health'
  | 'finance'
  | 'ai_governance'
  | 'nis2'
  | 'dora'
  | 'iso_27001'
  | 'tisax';

export type AutomationCapability =
  | 'automation'
  | 'workflows'
  | 'drift_detection'
  | 'remediation'
  | 'bulk_operations';

export type EngagementCapability =
  | 'ai_bots'
  | 'voice'
  | 'whatsapp'
  | 'website_chat'
  | 'api'
  | 'webhooks'
  | 'human_handoff';

export type Capability = GovernanceCapability | AutomationCapability | EngagementCapability;

export type CapacityKey =
  | 'websites'
  | 'users'
  | 'workspaces'
  | 'automation_runs'
  | 'ai_actions'
  | 'evidence_retention_days';

export interface CapabilityGrant {
  capability: Capability;
  enabled: boolean;
  /** Optional reason shown by the customer-facing entitlement UI. */
  source?: string;
}

export interface CapacityGrant {
  capacity: CapacityKey;
  /** `-1` means unlimited. */
  limit: number;
  /** Optional reason shown by the customer-facing entitlement UI. */
  source?: string;
}

export interface ModularEntitlements {
  capabilities: CapabilityGrant[];
  capacity: CapacityGrant[];
}

/**
 * Core is intentionally useful on its own. Specialized governance and
 * automation are additive capabilities rather than higher plan ranks.
 */
export const CORE_CAPABILITIES: readonly Capability[] = [
  'core_governance',
];

/**
 * Capacity is independent from capability. This is the critical rule that
 * prevents a complex single-site customer from paying an organization-size
 * price merely because they need deeper governance.
 */
export const DEFAULT_CORE_CAPACITY: Readonly<Record<CapacityKey, number>> = {
  websites: 1,
  users: 3,
  workspaces: 1,
  automation_runs: 100,
  ai_actions: 100,
  evidence_retention_days: 90,
};

export function hasCapability(
  entitlements: ModularEntitlements,
  capability: Capability,
): boolean {
  return entitlements.capabilities.some(
    (grant) => grant.capability === capability && grant.enabled,
  );
}

export function getCapacity(
  entitlements: ModularEntitlements,
  capacity: CapacityKey,
): number {
  return entitlements.capacity.find((grant) => grant.capacity === capacity)?.limit ?? 0;
}

export function canUseCapacity(
  entitlements: ModularEntitlements,
  capacity: CapacityKey,
  requested: number,
): boolean {
  const limit = getCapacity(entitlements, capacity);
  return limit === -1 || requested <= limit;
}

/**
 * Merge grants without creating duplicate keys. Later grants win. This is
 * suitable for composing subscription, capability-pack and capacity grants
 * after the server has verified their entitlement sources.
 */
export function mergeEntitlements(
  ...sources: ModularEntitlements[]
): ModularEntitlements {
  const capabilities = new Map<Capability, CapabilityGrant>();
  const capacity = new Map<CapacityKey, CapacityGrant>();

  for (const source of sources) {
    for (const grant of source.capabilities) {
      capabilities.set(grant.capability, grant);
    }
    for (const grant of source.capacity) {
      capacity.set(grant.capacity, grant);
    }
  }

  return {
    capabilities: [...capabilities.values()],
    capacity: [...capacity.values()],
  };
}
