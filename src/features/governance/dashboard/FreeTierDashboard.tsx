import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEntitlements } from '../../../core/billing/useEntitlements';
import { useTenant } from '../../../core/access/TenantProvider';
import { ScanActionGuard } from '../../../core/billing/ScanActionGuard';
import { ArrowRight, Zap, Lock } from 'lucide-react';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase';

interface DashboardCard {
  id: string;
  title: string;
  description: string;
  feature: string;
  cta: string;
  path?: string;
  action?: () => void;
  tier: 'free_tier' | 'starter' | 'growth' | 'agency' | 'scale' | 'enterprise';
}

const DASHBOARD_CARDS: DashboardCard[] = [
  {
    id: 'scan-count',
    title: 'Website-Scans verfügbar',
    description: 'Monatliche Compliance-Scans durchführen',
    feature: 'website.scan_monthly_limit',
    cta: 'Scan starten',
    path: '/app/governance/website-scan',
    tier: 'free_tier',
  },
  {
    id: 'dsgvo-dir',
    title: 'DSGVO-Verzeichnis',
    description: 'Erfasse deine Datenverarbeitung',
    feature: 'governance.dsgvo_directory',
    cta: 'Öffnen',
    path: '/app/governance/dsgvo-directory',
    tier: 'free_tier',
  },
  {
    id: 'ai-register',
    title: 'KI-System-Verzeichnis',
    description: 'Registriere deine KI-Systeme',
    feature: 'governance.ai_register',
    cta: 'Öffnen',
    path: '/app/governance/ai-register',
    tier: 'free_tier',
  },
  {
    id: 'evidence',
    title: 'Evidence Vault',
    description: 'Speichere Compliance-Nachweise',
    feature: 'evidence.basic_vault',
    cta: 'Öffnen',
    path: '/app/evidence',
    tier: 'free_tier',
  },
  {
    id: 'reports',
    title: 'Compliance-Reports',
    description: 'Exportiere Reports für Audits',
    feature: 'reports.export',
    cta: 'Öffnen',
    path: '/app/compliance',
    tier: 'starter',
  },
  {
    id: 'ai-classification',
    title: 'AI-Act Klassifizierung',
    description: 'Klassifiziere Systeme nach EU AI Act',
    feature: 'ai_classification.limited',
    cta: 'Öffnen',
    path: '/app/governance/ai-act-assessment',
    tier: 'growth',
  },
];

export function FreeTierDashboard() {
  const navigate = useNavigate();
  const { tier, hasFeature, canAccess } = useEntitlements();
  const { activeTenantId, tenants } = useTenant();
  const [tenantDetails, setTenantDetails] = useState<{ orgName?: string; tenantType?: string } | null>(null);

  const tenant = useMemo(() => {
    return tenants.find((t) => t.tenantId === activeTenantId);
  }, [tenants, activeTenantId]);

  // Fetch tenant org_name and tenant_type from database
  useEffect(() => {
    if (!activeTenantId || !isSupabaseConfigured()) return;
    let cancelled = false;

    void (async () => {
      try {
        const sb = getSupabase();
        const { data } = await sb
          .from('tenants')
          .select('org_name, tenant_type')
          .eq('id', activeTenantId)
          .single();
        if (!cancelled && data) {
          setTenantDetails({
            orgName: data.org_name || undefined,
            tenantType: data.tenant_type || undefined,
          });
        }
      } catch {
        // Silently fail
      }
    })();

    return () => { cancelled = true; };
  }, [activeTenantId]);

  const accessibleCards = useMemo(() => {
    return DASHBOARD_CARDS.map((card) => ({
      ...card,
      accessible: hasFeature(card.feature),
      access: canAccess(card.feature),
    }));
  }, [hasFeature, canAccess]);

  const welcomeMessage = useMemo(() => {
    if (tenantDetails?.orgName) {
      return `Willkommen, ${tenantDetails.orgName}!`;
    }
    switch (tenantDetails?.tenantType) {
      case 'freelancer':
        return 'Willkommen, Freelancer!';
      case 'sme':
        return 'Willkommen bei deinem KMU!';
      case 'agency':
        return 'Willkommen bei deiner Agentur!';
      case 'enterprise':
        return 'Willkommen im Enterprise-Bereich!';
      default:
        return 'Willkommen!';
    }
  }, [tenantDetails]);

  return (
    <div className="min-h-screen bg-obsidian-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-titanium-50 mb-2">
                {welcomeMessage}
              </h1>
              <p className="text-titanium-400">
                Plan: <span className="font-semibold capitalize text-titanium-300">{tier}</span>
              </p>
            </div>
            <button
              onClick={() => navigate('/pricing')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-none bg-ai-cyan-500/10 border border-ai-cyan-500 text-ai-cyan-300 hover:bg-ai-cyan-500/20 transition-colors text-sm font-medium"
            >
              <Zap className="w-4 h-4" />
              Plan upgraden
            </button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-obsidian-900 border border-titanium-800 rounded-none">
              <p className="text-xs text-titanium-500 font-mono mb-1">PLAN</p>
              <p className="text-lg font-semibold text-titanium-300 capitalize">{tier}</p>
            </div>
            <div className="p-4 bg-obsidian-900 border border-titanium-800 rounded-none">
              <p className="text-xs text-titanium-500 font-mono mb-1">ORG-TYP</p>
              <p className="text-lg font-semibold text-titanium-300 capitalize">
                {tenantDetails?.tenantType || 'Keine Angabe'}
              </p>
            </div>
            <div className="p-4 bg-obsidian-900 border border-titanium-800 rounded-none">
              <p className="text-xs text-titanium-500 font-mono mb-1">ONBOARDED</p>
              <p className="text-lg font-semibold text-emerald-400">✓</p>
            </div>
            <div className="p-4 bg-obsidian-900 border border-titanium-800 rounded-none">
              <p className="text-xs text-titanium-500 font-mono mb-1">FEATURES</p>
              <p className="text-lg font-semibold text-titanium-300">
                {accessibleCards.filter((c) => c.accessible).length}/{accessibleCards.length}
              </p>
            </div>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="mb-12">
          <h2 className="text-xl font-bold text-titanium-50 mb-6">Verfügbare Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accessibleCards.map((card) => {
              // Wrap scan card with limit guard
              if (card.id === 'scan-count' && card.accessible) {
                return (
                  <ScanActionGuard key={card.id}>
                    {(canScan, onScan) => (
                      <button
                        onClick={onScan}
                        disabled={!canScan}
                        className={`
                          text-left p-5 rounded-none border transition-all
                          ${canScan
                            ? 'bg-obsidian-900 border-titanium-700 hover:border-ai-cyan-400 hover:bg-obsidian-800 cursor-pointer'
                            : 'bg-obsidian-950 border-titanium-900 opacity-60 cursor-not-allowed'
                          }
                        `}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="text-sm font-semibold text-titanium-50 flex-1">
                            {card.title}
                          </h3>
                        </div>

                        <p className="text-xs text-titanium-400 mb-4">
                          {card.description}
                        </p>

                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-mono px-2 py-1 rounded-none ${
                            canScan
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-amber-500/10 text-amber-400'
                          }`}>
                            {canScan ? 'Verfügbar' : 'Limit erreicht'}
                          </span>
                          <ArrowRight className="w-4 h-4 text-titanium-500" />
                        </div>
                      </button>
                    )}
                  </ScanActionGuard>
                );
              }

              // Regular card rendering for other features
              return (
                <button
                  key={card.id}
                  onClick={() => {
                    if (card.accessible && card.path) {
                      navigate(card.path);
                    } else if (!card.accessible && card.access.upgradeUrl) {
                      navigate(card.access.upgradeUrl);
                    }
                  }}
                  disabled={!card.accessible}
                  className={`
                    text-left p-5 rounded-none border transition-all
                    ${card.accessible
                      ? 'bg-obsidian-900 border-titanium-700 hover:border-ai-cyan-400 hover:bg-obsidian-800 cursor-pointer'
                      : 'bg-obsidian-950 border-titanium-900 opacity-60 cursor-not-allowed'
                    }
                  `}
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-sm font-semibold text-titanium-50 flex-1">
                      {card.title}
                    </h3>
                    {!card.accessible && (
                      <Lock className="w-4 h-4 text-amber-600 shrink-0 ml-2" />
                    )}
                  </div>

                  <p className="text-xs text-titanium-400 mb-4">
                    {card.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-mono px-2 py-1 rounded-none ${
                      card.accessible
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {card.accessible ? 'Verfügbar' : `Ab ${card.tier}`}
                    </span>
                    <ArrowRight className="w-4 h-4 text-titanium-500" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Upgrade CTA for Free Tier */}
        {tier === 'free_tier' && (
          <div className="bg-obsidian-900/50 border border-ai-cyan-500/30 rounded-none p-6 text-center">
            <h3 className="text-lg font-bold text-titanium-50 mb-2">
              Mehr Features freischalten?
            </h3>
            <p className="text-titanium-400 mb-4 max-w-2xl mx-auto">
              Upgrade auf einen Premium-Plan für erweiterte Compliance-Tools, KI-Klassifizierung,
              Governance-Bots und mehr.
            </p>
            <button
              onClick={() => navigate('/pricing')}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-none bg-ai-cyan-500 hover:bg-ai-cyan-600 text-obsidian-950 font-semibold transition-colors"
            >
              <Zap className="w-4 h-4" />
              Jetzt upgraden
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
