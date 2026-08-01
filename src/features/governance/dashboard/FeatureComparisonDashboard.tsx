import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, Search, X } from 'lucide-react';
import { useEntitlements } from '../../../core/billing/useEntitlements';

interface ComparisonTile {
  id: string;
  title: string;
  description: string;
  feature: string;
  tier: 'free_tier' | 'starter' | 'growth' | 'agency' | 'scale' | 'enterprise';
  color: 'cyan' | 'emerald' | 'violet' | 'amber' | 'indigo';
  path?: string;
}

const FEATURE_TIERS: { [tier: string]: ComparisonTile[] } = {
  free_tier: [
    {
      id: 'governance-cockpit',
      title: 'Governance Cockpit',
      description: 'Risiko-Übersicht, Audit-Readiness & KPIs',
      feature: 'governance.cockpit',
      tier: 'free_tier',
      color: 'cyan',
      path: '/app',
    },
    {
      id: 'website-scanner',
      title: 'Website-Scanner',
      description: 'DSGVO-Compliance auf deiner Website',
      feature: 'website.scan_monthly_limit',
      tier: 'free_tier',
      color: 'emerald',
      path: '/app/governance/website-scan',
    },
    {
      id: 'ai-systems',
      title: 'KI-Systeme',
      description: 'Verzeichnis & EU AI Act-Klassifizierung',
      feature: 'governance.ai_register',
      tier: 'free_tier',
      color: 'violet',
      path: '/app/governance/ai-register',
    },
    {
      id: 'evidence-vault',
      title: 'Evidence Vault',
      description: 'Hash-verifizierte Compliance-Nachweise',
      feature: 'evidence.basic_vault',
      tier: 'free_tier',
      color: 'indigo',
      path: '/app/evidence',
    },
    {
      id: 'tenants',
      title: 'Mandanten',
      description: 'Workspace-Verwaltung & Invitations',
      feature: 'workspace.management',
      tier: 'free_tier',
      color: 'violet',
      path: '/app/settings/workspace',
    },
  ],
  starter: [
    {
      id: 'risk-findings',
      title: 'Risiken & Findings',
      description: 'Compliance-Risiken & Remediation-Tasks',
      feature: 'governance.risk_findings',
      tier: 'starter',
      color: 'amber',
      path: '/app/governance/findings',
    },
    {
      id: 'reports',
      title: 'Dokumente & Reports',
      description: 'PDF-Exports, DSGVO-Verzeichnis & Audits',
      feature: 'reports.export',
      tier: 'starter',
      color: 'cyan',
      path: '/app/compliance',
    },
    {
      id: 'integrations',
      title: 'Integrationen',
      description: 'Connectors für APIs & Datenquellen',
      feature: 'integrations.connectors',
      tier: 'starter',
      color: 'amber',
      path: '/app/integrations',
    },
  ],
  growth: [
    {
      id: 'tasks',
      title: 'Aufgaben',
      description: 'Compliance-Tasks & Remediation-Tracking',
      feature: 'governance.tasks',
      tier: 'growth',
      color: 'emerald',
      path: '/app/governance/tasks',
    },
    {
      id: 'ai-assistant',
      title: 'KI-Assistent',
      description: 'Claude-Compliance-Advisor & Automation',
      feature: 'ai.assistant',
      tier: 'growth',
      color: 'indigo',
      path: '/app/ai-assistant',
    },
  ],
};

const TIER_LABELS: { [tier: string]: string } = {
  free_tier: 'Free Tier',
  starter: 'Starter',
  growth: 'Growth',
  agency: 'Agency',
  scale: 'Scale',
  enterprise: 'Enterprise',
};

const COLOR_CLASSES: Record<string, {
  border: string;
  bg: string;
  hoverBg: string;
  icon: string;
  badge: string;
  badgeText: string;
}> = {
  cyan: {
    border: 'border-ai-cyan-500/50',
    bg: 'bg-ai-cyan-500/5',
    hoverBg: 'hover:bg-ai-cyan-500/10',
    icon: 'text-ai-cyan-400',
    badge: 'bg-ai-cyan-500/20 text-ai-cyan-300',
    badgeText: 'text-ai-cyan-300',
  },
  emerald: {
    border: 'border-emerald-500/50',
    bg: 'bg-emerald-500/5',
    hoverBg: 'hover:bg-emerald-500/10',
    icon: 'text-emerald-400',
    badge: 'bg-emerald-500/20 text-emerald-300',
    badgeText: 'text-emerald-300',
  },
  violet: {
    border: 'border-violet-500/50',
    bg: 'bg-violet-500/5',
    hoverBg: 'hover:bg-violet-500/10',
    icon: 'text-violet-400',
    badge: 'bg-violet-500/20 text-violet-300',
    badgeText: 'text-violet-300',
  },
  amber: {
    border: 'border-amber-500/50',
    bg: 'bg-amber-500/5',
    hoverBg: 'hover:bg-amber-500/10',
    icon: 'text-amber-400',
    badge: 'bg-amber-500/20 text-amber-300',
    badgeText: 'text-amber-300',
  },
  indigo: {
    border: 'border-indigo-500/50',
    bg: 'bg-indigo-500/5',
    hoverBg: 'hover:bg-indigo-500/10',
    icon: 'text-indigo-400',
    badge: 'bg-indigo-500/20 text-indigo-300',
    badgeText: 'text-indigo-300',
  },
};

export function FeatureComparisonDashboard() {
  const navigate = useNavigate();
  const { hasFeature, canAccess, tier } = useEntitlements();
  const [searchQuery, setSearchQuery] = useState('');

  const comparisons = useMemo(() => {
    let allComparisons = Object.entries(FEATURE_TIERS).map(([tierKey, tiles]) => ({
      tier: tierKey,
      label: TIER_LABELS[tierKey],
      tiles: tiles.map((tile) => ({
        ...tile,
        accessible: hasFeature(tile.feature),
        access: canAccess(tile.feature),
        isUserTier: tier === tierKey,
      })),
    }));

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      allComparisons = allComparisons.map((comp) => ({
        ...comp,
        tiles: comp.tiles.filter(
          (tile) =>
            tile.title.toLowerCase().includes(query) ||
            tile.description.toLowerCase().includes(query)
        ),
      })).filter((comp) => comp.tiles.length > 0);
    }

    return allComparisons;
  }, [hasFeature, canAccess, tier, searchQuery]);

  return (
    <div className="dashboard-context min-h-screen bg-obsidian-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-titanium-50 mb-3">
            Feature-Übersicht
          </h1>
          <p className="text-titanium-400 max-w-2xl mb-6">
            Entdecke alle verfügbaren Governance-Module und ihre Verfügbarkeit nach Plan.
            Dein aktueller Plan: <span className="font-semibold capitalize text-titanium-300">{tier}</span>
          </p>

          {/* Search Bar */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-titanium-400" />
            <input
              type="text"
              placeholder="Features durchsuchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-none bg-obsidian-900 border border-titanium-800 text-titanium-50 placeholder-titanium-500 focus:outline-none focus:border-ai-cyan-400 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-titanium-400 hover:text-titanium-200 transition-colors"
                aria-label="Suche löschen"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Feature Tiers Grid */}
        {comparisons.length === 0 ? (
          <div className="py-12 text-center">
            <Search className="h-12 w-12 text-titanium-600 mx-auto mb-4" />
            <p className="text-titanium-400">
              Keine Features gefunden, die "{searchQuery}" enthalten.
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-4 text-ai-cyan-400 hover:text-ai-cyan-300 font-semibold text-sm"
            >
              Suche löschen
            </button>
          </div>
        ) : (
          <div className="space-y-12">
            {comparisons.map(({ tier: tierKey, label, tiles }) => (
            <div key={tierKey}>
              <div className="mb-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-titanium-50">{label}</h2>
                  {comparisons.find((c) => c.tier === tierKey)?.tiles.some((t) => t.isUserTier) && (
                    <span className="text-xs font-mono px-3 py-1 rounded-none bg-emerald-500/20 text-emerald-300">
                      Dein aktueller Plan
                    </span>
                  )}
                </div>
                <p className="text-sm text-titanium-400 mt-2">
                  {tiles.length} Feature{tiles.length !== 1 ? 's' : ''} verfügbar
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tiles.map((tile) => {
                  const colors = COLOR_CLASSES[tile.color];
                  return (
                    <button
                      key={tile.id}
                      onClick={() => {
                        if (tile.accessible && tile.path) {
                          navigate(tile.path);
                        } else if (!tile.accessible && tile.access.upgradeUrl) {
                          navigate(tile.access.upgradeUrl);
                        }
                      }}
                      disabled={!tile.accessible}
                      className={`
                        text-left p-4 rounded-none border transition-all flex flex-col h-full
                        ${tile.accessible
                          ? `${colors.bg} ${colors.border} ${colors.hoverBg} cursor-pointer`
                          : 'bg-obsidian-950 border-titanium-900 opacity-50 cursor-not-allowed'
                        }
                      `}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-sm font-semibold text-titanium-50 flex-1">
                          {tile.title}
                        </h3>
                        {!tile.accessible && <Lock className="w-4 h-4 text-amber-600 shrink-0 ml-2" />}
                      </div>

                      <p className="text-xs text-titanium-400 mb-4 flex-1">
                        {tile.description}
                      </p>

                      <div className="flex items-center justify-between pt-3 border-t border-titanium-800/50">
                        <span className={`text-xs font-mono px-2 py-1 rounded-none ${colors.badge}`}>
                          {tile.accessible ? 'Verfügbar' : `Ab ${tile.tier}`}
                        </span>
                        <ArrowRight className={`w-3.5 h-3.5 ${tile.accessible ? colors.badgeText : 'text-titanium-600'}`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
            </div>
        )}

        {/* Upgrade CTA */}
        {tier === 'free_tier' && (
          <div className="mt-12 bg-obsidian-900/50 border border-ai-cyan-500/30 rounded-none p-6 text-center">
            <h3 className="text-lg font-bold text-titanium-50 mb-2">
              Mehr Features freischalten?
            </h3>
            <p className="text-titanium-400 mb-4 max-w-2xl mx-auto">
              Upgrade auf einen Premium-Plan für erweiterte Compliance-Tools, Automatisierungen,
              und dedizierte Support.
            </p>
            <button
              onClick={() => navigate('/pricing')}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-none bg-ai-cyan-500 hover:bg-ai-cyan-600 text-obsidian-950 font-semibold transition-colors"
            >
              Pläne anschauen
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
