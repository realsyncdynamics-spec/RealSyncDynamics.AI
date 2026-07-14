import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useEntitlements } from './useEntitlements';
import { Lock, Zap, ArrowRight } from 'lucide-react';

interface FeatureGateProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * FeatureGate wraps components that require specific entitlements.
 * If user lacks access, shows a paywall modal instead of the component.
 */
export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const { hasFeature, canAccess } = useEntitlements();
  const navigate = useNavigate();

  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  const access = canAccess(feature);
  if (fallback && !access.allowed) {
    return <>{fallback}</>;
  }

  return (
    <FeaturePaywall
      feature={feature}
      upgradeUrl={access.upgradeUrl}
    />
  );
}

interface FeaturePaywallProps {
  feature: string;
  upgradeUrl?: string;
}

function FeaturePaywall({ feature, upgradeUrl }: FeaturePaywallProps) {
  const navigate = useNavigate();

  const featureNames: Record<string, { title: string; description: string }> = {
    'reports.export': {
      title: 'Compliance-Reports exportieren',
      description: 'Exportiere detaillierte Reports für Audits und interne Reviews.',
    },
    'ai_classification.limited': {
      title: 'EU AI Act Klassifizierung',
      description: 'Klassifiziere Systeme nach EU AI Act Compliance-Anforderungen.',
    },
    'bots.count': {
      title: 'Governance-Bots',
      description: 'Automatisiere Compliance-Prozesse mit intelligenten Bots.',
    },
    'evidence.advanced_vault': {
      title: 'Advanced Evidence Vault',
      description: 'Erweiterte Evidence-Management mit Versionierung und Audit-Trail.',
    },
  };

  const info = featureNames[feature] || {
    title: 'Premium-Feature',
    description: 'Dieses Feature ist in deinem Plan nicht enthalten.',
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-obsidian-950 p-4">
      <div className="w-full max-w-md">
        <div className="bg-obsidian-900 border border-titanium-800 rounded-none p-8 text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-none bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <Lock className="w-8 h-8 text-amber-500" />
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-titanium-50 mb-2">
              {info.title}
            </h2>
            <p className="text-titanium-400">
              {info.description}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {upgradeUrl && (
              <button
                onClick={() => navigate(upgradeUrl)}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-none bg-ai-cyan-500 hover:bg-ai-cyan-600 text-obsidian-950 font-semibold transition-colors"
              >
                <Zap className="w-4 h-4" />
                Plan upgraden
              </button>
            )}
            <button
              onClick={() => navigate('/pricing')}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-none border border-titanium-700 text-titanium-300 hover:text-titanium-50 hover:border-titanium-600 transition-colors text-sm"
            >
              Alle Pläne anschauen
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-titanium-600">
            Kontaktiere uns für Enterprise-Lösungen: hello@realsyncdynamics.ai
          </p>
        </div>
      </div>
    </div>
  );
}
