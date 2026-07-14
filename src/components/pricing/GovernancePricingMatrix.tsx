import { Check, X } from 'lucide-react';
import { PLAN_CONFIG } from '../../core/billing/plan-config';
import { FeatureKey } from '../../core/billing/types';

const GOVERNANCE_FEATURES: { category: string; features: Array<{ key: FeatureKey; label: string }> }[] = [
  {
    category: 'Website Compliance',
    features: [
      { key: 'website.scan', label: 'Website DSGVO-Scan' },
      { key: 'website.resan', label: 'Kontinuierliche Rescans' },
      { key: 'cookie.tracking', label: 'Cookie & Tracker-Erkennung' },
    ],
  },
  {
    category: 'DSGVO Governance',
    features: [
      { key: 'dsgvo.basic', label: 'DSGVO-Basisprüfung' },
      { key: 'dsgvo.monitoring', label: 'DSGVO-Monitoring' },
      { key: 'evidence.vault', label: 'Evidence Vault' },
      { key: 'compliance.export', label: 'Audit-Exports' },
    ],
  },
  {
    category: 'AI Act Governance',
    features: [
      { key: 'aiact.classification', label: 'AI-Act-Klassifikation' },
      { key: 'aiact.deeprisk', label: 'High-Risk-AI-Prüfung' },
      { key: 'dpia.assessment', label: 'DPIA-Vorprüfung' },
    ],
  },
  {
    category: 'Operations & Automation',
    features: [
      { key: 'policy.engine', label: 'Policy Engine' },
      { key: 'automation.basic', label: 'Automatisierungen' },
      { key: 'vendor.screening', label: 'Vendor-Screening' },
      { key: 'agents.industry', label: 'Branchen-Agenten' },
    ],
  },
  {
    category: 'Team & Integration',
    features: [
      { key: 'team.members', label: 'Team-Zugang' },
      { key: 'api.access', label: 'API & Webhooks' },
      { key: 'sso.enabled', label: 'SSO/SAML' },
      { key: 'public-sector.mode', label: 'Public-Sector-Mode' },
    ],
  },
];

export function GovernancePricingMatrix() {
  const plans = ['starter_governance', 'professional_governance', 'governance_os', 'enterprise_regulated'] as const;

  return (
    <div className="w-full overflow-x-auto bg-obsidian-900 px-4 py-12">
      <div className="min-w-max">
        {/* Header */}
        <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: '250px repeat(4, 200px)' }}>
          <div className="col-span-1" />
          {plans.map((plan) => {
            const config = PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG];
            const metadata = config.metadata;
            return (
              <div key={plan} className="text-center">
                <h3 className="font-bold text-titanium-50 text-sm mb-1">{metadata?.displayName}</h3>
                <p className="text-xs text-silver-300 mb-3">{metadata?.target}</p>
                <div className="font-display font-bold text-lg text-titanium-50">
                  {metadata?.monthlyPrice ? `€${metadata.monthlyPrice}` : 'Individuell'}
                </div>
                {metadata?.monthlyPrice && <p className="text-xs text-silver-400">/Monat</p>}
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div className="border-b border-silver-700 mb-6" />

        {/* Features Grid */}
        {GOVERNANCE_FEATURES.map((category) => (
          <div key={category.category} className="mb-8">
            <h4 className="text-xs font-bold uppercase tracking-wider text-silver-400 mb-3 col-span-5">
              {category.category}
            </h4>
            <div className="space-y-2">
              {category.features.map((feature) => (
                <div key={feature.key} className="grid gap-4" style={{ gridTemplateColumns: '250px repeat(4, 200px)' }}>
                  <div className="text-sm text-silver-300">{feature.label}</div>
                  {plans.map((plan) => {
                    const config = PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG];
                    const hasFeature = config.features[feature.key];
                    return (
                      <div key={`${plan}-${feature.key}`} className="flex justify-center">
                        {hasFeature ? (
                          <Check className="h-4 w-4 text-security-500" />
                        ) : (
                          <X className="h-4 w-4 text-silver-600" />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
