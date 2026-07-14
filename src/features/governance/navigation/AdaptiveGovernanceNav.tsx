import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEntitlements } from '../../../core/billing/useEntitlements';
import { useTenant } from '../../../core/access/TenantProvider';
import { Lock, ChevronRight } from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  path: string;
  feature: string;
  group: string;
  requiredTier?: 'free_tier' | 'starter' | 'growth' | 'agency' | 'scale' | 'enterprise';
  icon?: React.ReactNode;
}

const GOVERNANCE_NAV_ITEMS: NavItem[] = [
  // Free Tier & Starter Features
  { id: 'dashboard', label: 'Dashboard', path: '/app/dashboard', feature: 'dashboard.access', group: 'core', icon: '📊' },
  { id: 'dsgvo-dir', label: 'DSGVO-Verzeichnis', path: '/app/governance/dsgvo-directory', feature: 'governance.dsgvo_directory', group: 'governance', icon: '📋' },
  { id: 'ai-register', label: 'AI-System-Verzeichnis', path: '/app/governance/ai-register', feature: 'governance.ai_register', group: 'governance', icon: '🤖' },
  { id: 'evidence-basic', label: 'Evidence Vault', path: '/app/evidence', feature: 'evidence.basic_vault', group: 'governance', icon: '🔐' },

  // Starter+ Features
  { id: 'website-scan', label: 'Website-Scan', path: '/app/governance/website-scan', feature: 'website.scan', group: 'compliance', icon: '🌐' },
  { id: 'reports', label: 'Reports', path: '/app/compliance', feature: 'reports.export', group: 'compliance', requiredTier: 'starter', icon: '📄' },

  // Growth+ Features
  { id: 'ai-classification', label: 'AI-Classification', path: '/app/governance/ai-act-assessment', feature: 'ai_classification.limited', group: 'ai-governance', requiredTier: 'growth', icon: '⚙️' },

  // Agency+ Features
  { id: 'bots', label: 'Governance Bots', path: '/app/bots', feature: 'bots.count', group: 'automation', requiredTier: 'agency', icon: '🤳' },
];

interface AccessibleItem extends NavItem {
  accessible: boolean;
  upgradeUrl?: string;
}

export function AdaptiveGovernanceNav() {
  const navigate = useNavigate();
  const { tier, hasFeature, canAccess } = useEntitlements();
  const { activeTenantId } = useTenant();

  const items = useMemo<AccessibleItem[]>(() => {
    return GOVERNANCE_NAV_ITEMS.map((item) => {
      const access = canAccess(item.feature);
      return {
        ...item,
        accessible: access.allowed,
        upgradeUrl: access.upgradeUrl,
      };
    });
  }, [hasFeature, canAccess]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, AccessibleItem[]> = {};
    items.forEach((item) => {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
    });
    return groups;
  }, [items]);

  const handleNavClick = (item: AccessibleItem) => {
    if (item.accessible) {
      navigate(item.path);
    } else if (item.upgradeUrl) {
      navigate(item.upgradeUrl);
    }
  };

  return (
    <nav className="space-y-6">
      {Object.entries(groupedItems).map(([groupId, groupItems]) => (
        <div key={groupId} className="space-y-2">
          <h3 className="text-xs font-mono uppercase tracking-wider text-titanium-500 px-3">
            {groupId === 'core' && 'Allgemein'}
            {groupId === 'governance' && 'Governance'}
            {groupId === 'compliance' && 'Compliance'}
            {groupId === 'ai-governance' && 'KI-Governance'}
            {groupId === 'automation' && 'Automatisierung'}
          </h3>
          {groupItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item)}
              disabled={!item.accessible}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-none text-sm transition-colors
                ${item.accessible
                  ? 'text-titanium-300 hover:bg-obsidian-800 hover:text-titanium-50 cursor-pointer'
                  : 'text-titanium-600 bg-obsidian-900/30 cursor-not-allowed'
                }
              `}
            >
              <span className="text-base">{item.icon}</span>
              <span className="flex-1 text-left">{item.label}</span>
              {!item.accessible && (
                <Lock className="w-3.5 h-3.5 text-amber-600" />
              )}
              {item.accessible && (
                <ChevronRight className="w-3.5 h-3.5 text-titanium-500" />
              )}
            </button>
          ))}
        </div>
      ))}

      {/* Tier Badge */}
      <div className="mt-8 px-3 py-3 bg-obsidian-900/50 border border-titanium-800 rounded-none">
        <p className="text-xs font-mono text-titanium-500 mb-1">Aktueller Plan</p>
        <p className="text-sm font-semibold text-titanium-300 capitalize">{tier}</p>
      </div>
    </nav>
  );
}
