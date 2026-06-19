import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import {
  Home, Globe, FileCheck2, Cpu, AlertTriangle, Activity,
  Building2, BarChart3, Users, Settings, Lock, X,
  Bell, CreditCard, Wrench, Bot, GitMerge, FileText,
  ClipboardCheck, ClipboardList, LayoutDashboard, Briefcase,
  type LucideIcon,
} from 'lucide-react';
import { GOVERNANCE_MODULES, canAccessModule, minimumPlanForModule } from './governanceModules';
import { ModuleStatusBadge } from './ModuleStatusBadge';
import { MODULE_GROUP_ORDER } from './governanceBrowserTypes';
import { useActivePlan } from '../../hooks/useModuleAccess';

const ICON_MAP: Record<string, LucideIcon> = {
  Home, Globe, FileCheck2, Cpu, Bot, AlertTriangle, Activity,
  Building2, BarChart3, Users, Settings, Bell, CreditCard, Wrench,
  GitMerge, FileText, ClipboardCheck, ClipboardList, LayoutDashboard, Briefcase,
};

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter', growth: 'Professional', agency: 'Agency', enterprise: 'Enterprise',
};

interface GovernanceMobileNavProps {
  open: boolean;
  onClose: () => void;
}

// Mobiles Navigations-Drawer: volle gruppierte Modul-Liste (Pendant zur
// Desktop-GovernanceSidebar), geöffnet über das Menü-Icon der TopBar.
// Nur < lg sichtbar; ab lg übernimmt die feste linke Sidebar.
export function GovernanceMobileNav({ open, onClose }: GovernanceMobileNavProps) {
  const { pathname } = useLocation();
  const { plan } = useActivePlan();

  // Scroll des Hintergrunds sperren, solange das Drawer offen ist.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const isActive = (route: string) =>
    route === '/app' ? pathname === '/app' : pathname.startsWith(route);

  return (
    <div className="lg:hidden fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <nav className="relative w-72 max-w-[85%] h-full bg-obsidian-900 border-r border-titanium-900 flex flex-col">
        <div className="flex items-center justify-between h-14 px-4 border-b border-titanium-900 shrink-0">
          <span className="font-mono text-[10px] uppercase tracking-widest text-titanium-500">
            Navigation
          </span>
          <button
            onClick={onClose}
            aria-label="Menü schließen"
            className="p-1.5 text-titanium-400 hover:text-titanium-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {MODULE_GROUP_ORDER.map((group) => {
            const modules = GOVERNANCE_MODULES.filter((m) => m.group === group);
            if (modules.length === 0) return null;
            return (
              <div key={group}>
                <div className="px-4 pt-3 pb-1 font-mono text-[9px] uppercase tracking-widest text-titanium-600">
                  {group}
                </div>
                {modules.map((mod) => {
                  const Icon: LucideIcon = ICON_MAP[mod.icon] ?? Home;
                  const allowed = canAccessModule(mod, plan);
                  if (!allowed) {
                    const planLabel = PLAN_LABELS[minimumPlanForModule(mod)] ?? minimumPlanForModule(mod);
                    return (
                      <Link
                        key={mod.id}
                        to="/pricing"
                        onClick={onClose}
                        title={`${mod.label} — ab ${planLabel} verfügbar`}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-titanium-700 hover:bg-obsidian-800 transition-colors"
                      >
                        <Icon className="h-4 w-4 shrink-0 text-titanium-800" />
                        <span className="flex-1 opacity-60">{mod.label}</span>
                        <Lock className="h-3 w-3 text-titanium-700" />
                      </Link>
                    );
                  }
                  const active = isActive(mod.route);
                  return (
                    <Link
                      key={mod.id}
                      to={mod.route}
                      onClick={onClose}
                      className={`flex items-center gap-3 px-4 py-2.5 text-sm border-l-2 transition-colors ${
                        active
                          ? 'border-cyan-400 bg-obsidian-800 text-titanium-50'
                          : 'border-transparent text-titanium-300 hover:bg-obsidian-800 hover:text-titanium-100'
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-cyan-400' : 'text-titanium-600'}`} />
                      <span className="flex-1">{mod.label}</span>
                      {mod.status !== 'live' && <ModuleStatusBadge status={mod.status} />}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
