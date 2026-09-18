import type { GovernanceContext } from './types';

/** Preview-only identity. Production uses TenantProvider + Supabase session. */
export const DEMO_CTX: GovernanceContext = {
  tenantId: '00000000-0000-0000-0000-000000000001',
  sessionId: 'preview-session',
  actorId: 'preview-actor',
  tenantVerified: true,
  authenticated: true,
  entitlementBuilder: true,
};

export const DEMO_CTX_LOCKED: GovernanceContext = {
  ...DEMO_CTX,
  authenticated: false,
  tenantVerified: false,
  entitlementBuilder: false,
};
