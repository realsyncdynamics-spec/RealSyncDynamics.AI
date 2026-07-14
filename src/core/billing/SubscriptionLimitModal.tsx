import React from 'react';
import { Lock, Zap, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SubscriptionLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: string;
  featureName: string;
  currentTier?: string;
  upgradeUrl?: string;
}

const FEATURE_INFO: Record<string, { tier: string; description: string; benefits: string[] }> = {
  'reports.export': {
    tier: 'Starter',
    description: 'Exportiere detaillierte Compliance-Reports für Audits und interne Reviews.',
    benefits: [
      'PDF & CSV Export',
      'Compliance-Ready Format',
      'Audit Trail Included',
      'Multiple Format Support',
    ],
  },
  'bots.count': {
    tier: 'Agency',
    description: 'Automatisiere Compliance-Prozesse mit intelligenten Bots.',
    benefits: [
      'Unlimited Bot Creation',
      'Advanced Scheduling',
      'Webhook Integration',
      'Bot Analytics',
    ],
  },
  'ai_classification.limited': {
    tier: 'Growth',
    description: 'Klassifiziere Systeme nach EU AI Act Compliance-Anforderungen.',
    benefits: [
      'Automated Classification',
      'Risk Assessment',
      'Compliance Mapping',
      'Regulatory Updates',
    ],
  },
  'evidence.advanced_vault': {
    tier: 'Scale',
    description: 'Erweiterte Evidence-Management mit Versionierung und Audit-Trail.',
    benefits: [
      'Unlimited Storage',
      'Version Control',
      'Advanced Search',
      'Compliance Reporting',
    ],
  },
};

export function SubscriptionLimitModal({
  isOpen,
  onClose,
  feature,
  featureName,
  currentTier,
  upgradeUrl,
}: SubscriptionLimitModalProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const info = FEATURE_INFO[feature] || {
    tier: 'Premium',
    description: `Upgrade to unlock ${featureName}.`,
    benefits: ['Premium Features', 'Enhanced Capabilities', 'Priority Support'],
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-obsidian-900 border border-titanium-800 rounded-none max-w-md w-full p-6 space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-none bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Lock className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-titanium-50 mb-1">
              {featureName}
            </h2>
            <p className="text-sm text-titanium-400">
              {info.tier}-Plan erforderlich
            </p>
          </div>
        </div>

        <p className="text-sm text-titanium-300 bg-obsidian-950 p-4 border border-titanium-800 rounded-none">
          {info.description}
        </p>

        <div className="space-y-2">
          <p className="text-xs text-titanium-500 font-mono mb-3">FEATURES</p>
          {info.benefits.map((benefit) => (
            <div key={benefit} className="flex items-start gap-2">
              <div className="w-4 h-4 rounded-none bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
                <div className="w-2 h-2 bg-emerald-400 rounded-full" />
              </div>
              <span className="text-sm text-titanium-300">{benefit}</span>
            </div>
          ))}
        </div>

        <div className="bg-ai-cyan-500/10 border border-ai-cyan-500/30 p-4 rounded-none space-y-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-ai-cyan-400" />
            <p className="text-sm font-semibold text-ai-cyan-300">
              Upgrade auf {info.tier}
            </p>
          </div>
          <p className="text-xs text-ai-cyan-200">
            Erhalte Zugriff auf dieses und weitere Premium-Features
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-none border border-titanium-700 text-titanium-300 hover:text-titanium-50 hover:border-titanium-600 transition-colors font-medium"
          >
            Schließen
          </button>
          <button
            onClick={() => {
              if (upgradeUrl) {
                navigate(upgradeUrl);
              } else {
                navigate('/pricing');
              }
              onClose();
            }}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-none bg-ai-cyan-500 hover:bg-ai-cyan-600 text-obsidian-950 font-semibold transition-colors"
          >
            <Zap className="w-4 h-4" />
            Upgraden
          </button>
        </div>

        <p className="text-xs text-titanium-600 text-center">
          Oder kontaktiere uns für Enterprise-Lösungen
        </p>
      </div>
    </div>
  );
}
