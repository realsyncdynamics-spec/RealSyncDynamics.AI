import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEntitlements } from '../../../core/billing/useEntitlements';
import { useTenant } from '../../../core/access/TenantProvider';
import { Zap } from 'lucide-react';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase';
import { usePerformanceMonitor, measureAsync } from '../../../lib/performance';
import { GovernanceDashboardTiles } from './GovernanceDashboardTiles';

export function FreeTierDashboard() {
  usePerformanceMonitor('FreeTierDashboard', { threshold: 300 });

  const navigate = useNavigate();
  const { tier, hasFeature, canAccess } = useEntitlements();
  const { activeTenantId, tenants } = useTenant();
  const [tenantDetails, setTenantDetails] = useState<{ orgName?: string; tenantType?: string } | null>(null);

  const tenant = useMemo(() => {
    return tenants.find((t) => t.tenantId === activeTenantId);
  }, [tenants, activeTenantId]);

  const GOVERNANCE_FEATURES = [
    'governance.cockpit',
    'website.scan_monthly_limit',
    'governance.ai_register',
    'governance.risk_findings',
    'evidence.basic_vault',
    'reports.export',
    'governance.tasks',
    'workspace.management',
    'integrations.connectors',
    'ai.assistant',
  ];

  const accessibleFeaturesCount = useMemo(() => {
    return GOVERNANCE_FEATURES.filter((feature) => hasFeature(feature)).length;
  }, [hasFeature]);

  // Fetch tenant org_name and tenant_type from database
  useEffect(() => {
    if (!activeTenantId || !isSupabaseConfigured()) return;
    let cancelled = false;

    void (async () => {
      try {
        const sb = getSupabase();
        const result = await measureAsync('fetch-tenant-details',
          async () => {
            const { data: tenantData } = await sb
              .from('tenants')
              .select('org_name, tenant_type')
              .eq('id', activeTenantId)
              .single();
            return tenantData;
          },
          { category: 'database', tags: { table: 'tenants' } }
        );
        if (!cancelled && result) {
          setTenantDetails({
            orgName: result.org_name || undefined,
            tenantType: result.tenant_type || undefined,
          });
        }
      } catch {
        // Silently fail
      }
    })();

    return () => { cancelled = true; };
  }, [activeTenantId]);


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
    <div className="dashboard-context min-h-screen bg-obsidian-950 p-6">
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
                {accessibleFeaturesCount}/{GOVERNANCE_FEATURES.length}
              </p>
            </div>
          </div>
        </div>

        {/* Governance Modules */}
        <div className="mb-12">
          <h2 className="text-xl font-bold text-titanium-50 mb-6">Governance-Module</h2>
          <GovernanceDashboardTiles layout="grid" />
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
