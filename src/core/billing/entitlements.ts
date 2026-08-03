import {
  SubscriptionSnapshot,
  TenantContext,
  CurrentUsage,
  EntitlementDecision,
  FeatureKey,
  UsageLimits,
} from './types';
import {
  hasModule,
  hasPermission,
  limitOf,
  resolvePlan,
  type ModuleId,
  type PermissionKey,
  type Plan,
} from '@/shared/pricing';

/**
 * Auflösung der Entitlements eines Tenants.
 *
 * ⚠️  Diese Datei bezog ihre Werte früher aus einer zweiten Plan-Tabelle
 *     (`core/billing/plan-config.ts` mit bronze/silver/gold und eigenen
 *     Preisen). Diese Tabelle ist entfallen — alle Werte kommen jetzt aus
 *     der Pricing-SSoT.
 *
 * `FeatureKey` bleibt bestehen: Das sind die Entitlement-Schlüssel, die
 * auch die Datenbank (`tenant_entitlements`) verwendet. Die Zuordnung
 * unten übersetzt sie auf Module und Berechtigungen der SSoT — sie enthält
 * keine Plan-Namen und kann daher nicht von den Preisen abweichen.
 */

type FeatureRule =
  | { kind: 'module'; module: ModuleId }
  | { kind: 'permission'; permission: PermissionKey }
  | { kind: 'limit'; limit: Parameters<typeof limitOf>[1]; min: number }
  | { kind: 'always' };

const FEATURE_RULES: Record<FeatureKey, FeatureRule> = {
  // Provenance / Herkunftsnachweis
  'asset.register':       { kind: 'always' },
  'asset.verify':         { kind: 'always' },
  'watermark.apply':      { kind: 'permission', permission: 'provenanceSigning' },
  'barcode.issue':        { kind: 'permission', permission: 'provenanceSigning' },
  'provenance.basic':     { kind: 'module', module: 'audit_center' },
  'provenance.advanced':  { kind: 'permission', permission: 'provenanceSigning' },
  'c2pa.export':          { kind: 'permission', permission: 'provenanceSigning' },
  // Governance Runtime
  'website.scan':         { kind: 'module', module: 'audit_center' },
  'website.resan':        { kind: 'module', module: 'monitoring' },
  'cookie.tracking':      { kind: 'module', module: 'dsgvo' },
  'dsgvo.basic':          { kind: 'module', module: 'dsgvo' },
  'dsgvo.monitoring':     { kind: 'module', module: 'monitoring' },
  'aiact.classification': { kind: 'module', module: 'eu_ai_act' },
  'aiact.deeprisk':       { kind: 'module', module: 'risk_register' },
  'evidence.vault':       { kind: 'permission', permission: 'evidenceVault' },
  'policy.engine':        { kind: 'module', module: 'policy_engine' },
  'dpia.assessment':      { kind: 'module', module: 'policy_engine' },
  'vendor.screening':     { kind: 'module', module: 'policy_engine' },
  'automation.basic':     { kind: 'module', module: 'automation_engine' },
  'agents.industry':      { kind: 'module', module: 'workflows' },
  // Übergreifend
  'team.members':         { kind: 'limit', limit: 'seats', min: 2 },
  'api.access':           { kind: 'permission', permission: 'api' },
  'bulk.jobs':            { kind: 'permission', permission: 'bulkOperations' },
  'compliance.export':    { kind: 'permission', permission: 'auditExport' },
  'org.governance':       { kind: 'permission', permission: 'multiTenant' },
  'sso.enabled':          { kind: 'permission', permission: 'sso' },
  'public-sector.mode':   { kind: 'permission', permission: 'multiTenant' },
};

function featureEnabled(plan: Plan, rule: FeatureRule): boolean {
  switch (rule.kind) {
    case 'always':
      return true;
    case 'module':
      return hasModule(plan, rule.module);
    case 'permission':
      return hasPermission(plan, rule.permission);
    case 'limit': {
      const value = limitOf(plan, rule.limit);
      return value === -1 || value >= rule.min;
    }
  }
}

/** `-1` (unbegrenzt) der SSoT entspricht `null` im Usage-Modell. */
function unlimitedAsNull(value: number): number | null {
  return value === -1 ? null : value;
}

function limitsForPlan(plan: Plan): UsageLimits {
  return {
    activeAssets: unlimitedAsNull(plan.limits.domains),
    monthlyRegistrations: unlimitedAsNull(plan.limits.domains),
    teamSeatsIncluded: unlimitedAsNull(plan.limits.seats),
    apiCallsMonthly: unlimitedAsNull(plan.limits.apiCallsPerMonth),
    bulkJobsMonthly: unlimitedAsNull(plan.limits.bulkJobsPerMonth),
    complianceExportsMonthly: unlimitedAsNull(plan.limits.auditReportsPerMonth),
  };
}

export function resolveEntitlements(
  subscription: SubscriptionSnapshot,
  tenant: TenantContext,
  usage: CurrentUsage,
): EntitlementDecision {
  // Altdaten mit `scale` werden transparent auf `partner` abgebildet;
  // unbekannte Keys fallen defensiv auf den Free-Plan zurück.
  const plan = resolvePlan(subscription.planKey) ?? resolvePlan('free')!;
  const limits = limitsForPlan(plan);

  const isActive =
    plan.price.monthlyEur === 0 ||
    subscription.status === 'active' ||
    subscription.status === 'trialing';

  const seatsAllowed =
    limits.teamSeatsIncluded === null
      ? null
      : limits.teamSeatsIncluded + (subscription.quantity ?? 0);

  const features = Object.fromEntries(
    (Object.keys(FEATURE_RULES) as FeatureKey[]).map((key) => {
      // Ohne aktive Subscription bleibt nur die Verifikation erhalten —
      // sie ist die einzige Funktion, die auch abgelaufene Kunden brauchen,
      // um bereits ausgestellte Nachweise prüfen zu lassen.
      if (!isActive && key !== 'asset.verify') return [key, false];
      // Public-Sector-Modus verlangt zusätzlich das Tenant-Flag.
      if (key === 'public-sector.mode' && !tenant.isPublicSector) return [key, false];
      return [key, featureEnabled(plan, FEATURE_RULES[key])];
    }),
  ) as Record<FeatureKey, boolean>;

  return {
    planKey: subscription.planKey,
    status: subscription.status,
    trialEnd: subscription.trialEnd,
    isActive,
    features,
    limits,
    seatsAllowed,
    overages: {
      seatsExceeded: seatsAllowed === null ? false : tenant.memberCount > seatsAllowed,
      assetsExceeded:
        limits.activeAssets === null ? false : usage.activeAssets > limits.activeAssets,
      apiExceeded:
        limits.apiCallsMonthly === null ? false : usage.apiCallsMonthly > limits.apiCallsMonthly,
      bulkJobsExceeded:
        limits.bulkJobsMonthly === null ? false : usage.bulkJobsMonthly > limits.bulkJobsMonthly,
    },
  };
}
