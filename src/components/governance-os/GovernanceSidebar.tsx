import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Lock, PanelLeftClose, PanelLeft, Home, type LucideIcon } from 'lucide-react';
import { GOVERNANCE_MODULES, canAccessModule, minimumPlanForModule } from './governanceModules';
import { ModuleStatusBadge } from './ModuleStatusBadge';
import { MODULE_GROUP_ORDER, type GovernanceModule } from './governanceBrowserTypes';
import { NAV_ICON_MAP, PLAN_LABELS, isModuleActive } from './navConfig';
import { useActivePlan } from '../../hooks/useModuleAccess';

const COLLAPSE_KEY = 'rsd_nav_collapsed';

function NavItem({
  module,
  active,
  collapsed,
}: {
  module: GovernanceModule;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon: LucideIcon = NAV_ICON_MAP[module.icon] ?? Home;
  return (
    <Link
      to={module.route}
      title={collapsed ? module.label : undefined}
      className={`group flex items-center gap-2.5 px-3 py-2 text-sm font-medium border-l-2 transition-colors ${
        active
          ? 'border-cyan-400 bg-obsidian-800 text-titanium-50'
          : 'border-transparent text-titanium-400 hover:text-titanium-100 hover:bg-obsidian-800'
      }`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-cyan-400' : 'text-titanium-600 group-hover:text-titanium-300'}`} />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{module.label}</span>
          {module.status !== 'live' && <ModuleStatusBadge status={module.status} />}
        </>
      )}
    </Link>
  );
}

function LockedNavItem({ module, collapsed }: { module: GovernanceModule; collapsed: boolean }) {
  const Icon: LucideIcon = NAV_ICON_MAP[module.icon] ?? Home;
  const minPlan = minimumPlanForModule(module);
  const planLabel = PLAN_LABELS[minPlan] ?? minPlan;
  return (
    <Link
      to="/pricing"
      title={`${module.label} — ab ${planLabel} verfügbar`}
      className="group flex items-center gap-2.5 px-3 py-2 text-sm font-medium border-l-2 border-transparent text-titanium-700 hover:text-titanium-500 hover:bg-obsidian-800 transition-colors"
    >
      <Icon className="h-4 w-4 shrink-0 text-titanium-800" />
      {!collapsed && (
        <>
          <span className="flex-1 truncate opacity-60">{module.label}</span>
          <Lock className="h-3 w-3 text-titanium-700 shrink-0" />
        </>
      )}
    </Link>
  );
}

// Linke Navigations-Sidebar des Governance-OS (Browser-OS-Layout).
// Desktop-only (lg+); mobil übernimmt MobileBottomNavigation. Plan-gating
// und Modul-Quelle identisch zur früheren Tab-Leiste (GOVERNANCE_MODULES).
export function GovernanceSidebar() {
  const { pathname } = useLocation();
  const { plan } = useActivePlan();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? 'true' : 'false');
    } catch {
      /* localStorage nicht verfügbar */
    }
  }, [collapsed]);

  const isActive = (route: string) => isModuleActive(route, pathname);

  return (
    <nav
      className={`hidden lg:flex flex-col shrink-0 bg-obsidian-900 border-r border-titanium-900 transition-[width] duration-150 ${
        collapsed ? 'w-14' : 'w-56'
      }`}
    >
      {/* Kopf: Label + Einklapp-Toggle */}
      <div className="flex items-center h-9 px-3 border-b border-titanium-900 shrink-0">
        {!collapsed && (
          <span className="flex-1 font-mono text-[9px] uppercase tracking-widest text-titanium-600">
            Navigation
          </span>
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? 'Navigation ausklappen' : 'Navigation einklappen'}
          title={collapsed ? 'Ausklappen' : 'Einklappen'}
          className={`p-1 text-titanium-500 hover:text-titanium-200 transition-colors ${collapsed ? 'mx-auto' : ''}`}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* Modul-Liste — nach Gruppen (Übersicht / Governance / Arbeit / Organisation) */}
      <div className="flex-1 overflow-y-auto py-1 scrollbar-none">
        {MODULE_GROUP_ORDER.map((group, idx) => {
          const modules = GOVERNANCE_MODULES.filter((m) => m.group === group);
          if (modules.length === 0) return null;
          return (
            <div key={group}>
              {collapsed ? (
                idx > 0 && <div className="my-1 mx-3 border-t border-titanium-900/60" />
              ) : (
                <div className="px-3 pt-3 pb-1 font-mono text-[9px] uppercase tracking-widest text-titanium-600">
                  {group}
                </div>
              )}
              {modules.map((mod) =>
                canAccessModule(mod, plan) ? (
                  <NavItem
                    key={mod.id}
                    module={mod}
                    active={isActive(mod.route)}
                    collapsed={collapsed}
                  />
                ) : (
                  <LockedNavItem key={mod.id} module={mod} collapsed={collapsed} />
                ),
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
