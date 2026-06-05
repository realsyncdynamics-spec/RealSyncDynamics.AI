import { Link, useLocation } from 'react-router-dom';
import {
  Home, Globe, FileCheck2, Cpu, AlertTriangle, Activity,
  Building2, BarChart3, Users, Settings, MoreHorizontal, Lock,
  type LucideIcon,
} from 'lucide-react';
import { TAB_MODULES, DOCK_MODULES, canAccessModule, minimumPlanForModule } from './governanceModules';
import { ModuleStatusBadge } from './ModuleStatusBadge';
import type { GovernanceModule } from './governanceBrowserTypes';
import { useActivePlan } from '../../hooks/useModuleAccess';
import { useState } from 'react';

const ICON_MAP: Record<string, LucideIcon> = {
  Home, Globe, FileCheck2, Cpu, Bot: Cpu, AlertTriangle, Activity,
  Building2, BarChart3, Users, Settings,
};

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter', growth: 'Professional', agency: 'Agency', enterprise: 'Enterprise',
};

function TabItem({ module, active, allowed }: { module: GovernanceModule; active: boolean; allowed: boolean }) {
  const Icon: LucideIcon = ICON_MAP[module.icon] ?? Home;
  const minPlan = allowed ? null : minimumPlanForModule(module);
  const planLabel = minPlan ? (PLAN_LABELS[minPlan] ?? minPlan) : null;

  if (!allowed) {
    return (
      <Link
        to="/pricing"
        title={`Ab ${planLabel} verfügbar`}
        className="group flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 border-transparent text-titanium-700 hover:text-titanium-500 hover:bg-obsidian-800 transition-colors opacity-60"
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-titanium-800" />
        <span>{module.label}</span>
        <Lock className="h-2.5 w-2.5 text-titanium-700" />
        {planLabel && (
          <span className="font-mono text-[8px] uppercase tracking-widest text-titanium-700 border border-titanium-800 px-1 py-0.5 hidden sm:inline">
            {planLabel}
          </span>
        )}
      </Link>
    );
  }

  return (
    <Link
      to={module.route}
      className={`group flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
        active
          ? 'border-cyan-400 text-titanium-50 bg-obsidian-800'
          : 'border-transparent text-titanium-400 hover:text-titanium-100 hover:bg-obsidian-800'
      }`}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-cyan-400' : 'text-titanium-600 group-hover:text-titanium-300'}`} />
      <span>{module.label}</span>
      <ModuleStatusBadge status={module.status} />
    </Link>
  );
}

export function GovernanceTabs() {
  const { pathname } = useLocation();
  const { plan } = useActivePlan();
  const [dockOpen, setDockOpen] = useState(false);

  const isActive = (route: string) =>
    route === '/app' ? pathname === '/app' : pathname.startsWith(route);

  return (
    <div className="relative shrink-0 bg-obsidian-900 border-b border-titanium-900">
      <div className="flex overflow-x-auto scrollbar-none">
        {TAB_MODULES.map((mod) => (
          <TabItem
            key={mod.id}
            module={mod}
            active={isActive(mod.route)}
            allowed={canAccessModule(mod, plan)}
          />
        ))}

        {/* Roadmap-Module im More-Menü */}
        {DOCK_MODULES.length > 0 && (
          <div className="relative ml-auto shrink-0">
            <button
              onClick={() => setDockOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-titanium-500 hover:text-titanium-200 hover:bg-obsidian-800 transition-colors border-b-2 border-transparent"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Mehr</span>
            </button>
            {dockOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setDockOpen(false)} />
                <div className="absolute right-0 top-full z-20 bg-obsidian-900 border border-titanium-800 shadow-xl min-w-[220px]">
                  <div className="px-3 py-2 border-b border-titanium-900">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-titanium-600">Roadmap Module</span>
                  </div>
                  {DOCK_MODULES.map((mod) => {
                    const Icon: LucideIcon = ICON_MAP[mod.icon] ?? Home;
                    const allowed = canAccessModule(mod, plan);
                    return (
                      <Link
                        key={mod.id}
                        to={allowed ? mod.route : '/pricing'}
                        onClick={() => setDockOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2.5 text-xs text-titanium-400 hover:bg-obsidian-800 hover:text-titanium-100 transition-colors"
                      >
                        <Icon className="h-3.5 w-3.5 text-titanium-600" />
                        <span className="flex-1">{mod.label}</span>
                        <ModuleStatusBadge status={mod.status} />
                        {!allowed && <Lock className="h-2.5 w-2.5 text-titanium-700" />}
                      </Link>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
