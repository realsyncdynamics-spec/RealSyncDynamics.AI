import { Link, useLocation } from 'react-router-dom';
import {
  Home, Globe, FileCheck2, Cpu, AlertTriangle, Activity,
  Building2, BarChart3, Users, Settings, Lock,
  Bell, CreditCard, Wrench, Bot, GitMerge, FileText,
  ClipboardCheck, ClipboardList, LayoutDashboard, ShieldAlert, ShieldCheck,
  MessagesSquare, Zap, Server, Layers, CalendarClock, Archive, Library,
  Share2, Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { TAB_MODULES, canAccessModule, minimumPlanForModule } from './governanceModules';
import { ModuleStatusBadge } from './ModuleStatusBadge';
import type { GovernanceModule } from './governanceBrowserTypes';
import { useActivePlan } from '../../hooks/useModuleAccess';
import {
  APP_BG,
  APP_CYAN,
  APP_FAINT,
  APP_LINE,
  APP_MONO,
  APP_MUTED,
  APP_PRIMARY,
  APP_RADIUS_MD,
  APP_SIDEBAR_WIDTH,
  APP_SURFACE,
  APP_SURFACE_ACTIVE,
  APP_TEXT,
} from './app-theme';

/**
 * Seitenleiste der App — die Modulnavigation aus dem Handoff-Entwurf.
 *
 * Sie ersetzt ab `lg` die waagerechte Tab-Leiste. Auf schmalen Geraeten
 * bleibt es beim Burger-Menue und der Tab-Bar unten: Eine 248px-Spalte
 * neben einem 390px-Fenster laesst fuer den Inhalt nichts uebrig.
 *
 * ## Die Liste wird nicht gepflegt, sie wird gelesen
 *
 * Der Entwurf zeigt sieben feste Eintraege. Diese Komponente nimmt
 * stattdessen `TAB_MODULES` — dieselbe Registry, aus der die Tab-Leiste
 * liest. Das ist keine Abweichung um ihrer selbst willen: Eine zweite,
 * handgepflegte Liste waere genau die Stelle, an der beim naechsten Modul
 * die Navigation auseinanderlaeuft, und sie haette weder Status-Badge noch
 * Plan-Gate. Wer ein Modul auf `roadmap` zurueckstuft, nimmt es damit auch
 * hier automatisch aus der Leiste.
 *
 * Gesperrte Module bleiben sichtbar, tragen aber ein Schloss und den
 * Mindest-Plan — verschwiegene Module lassen sich nicht buchen.
 */

const ICON_MAP: Record<string, LucideIcon> = {
  Home, Globe, FileCheck2, Cpu, Bot, AlertTriangle, Activity,
  Building2, BarChart3, Users, Settings, Bell, CreditCard, Wrench,
  GitMerge, FileText, ClipboardCheck, ClipboardList, LayoutDashboard,
  ShieldAlert, ShieldCheck, MessagesSquare, Zap, Server, Layers,
  CalendarClock, Archive, Library, Share2, Sparkles,
};

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  growth: 'Professional',
  agency: 'Agency',
  enterprise: 'Enterprise',
};

/** `/app/dashboard` traegt mehrere historische Adressen. */
function isActiveRoute(route: string, pathname: string): boolean {
  if (route === '/app/dashboard') {
    return ['/app', '/app/dashboard', '/app/home', '/app/overview'].includes(pathname);
  }
  return pathname === route || pathname.startsWith(`${route}/`);
}

function SidebarItem({
  module,
  active,
  locked,
}: {
  module: GovernanceModule;
  active: boolean;
  locked: boolean;
}) {
  const Icon: LucideIcon = ICON_MAP[module.icon] ?? Home;
  const minPlan = locked ? PLAN_LABELS[minimumPlanForModule(module)] ?? 'Enterprise' : null;

  return (
    <Link
      to={module.route}
      aria-current={active ? 'page' : undefined}
      title={locked && minPlan ? `${module.label} — ab ${minPlan}` : module.description}
      className="group flex h-[38px] items-center gap-2.5 px-2.5 text-[13px] transition-colors"
      style={{
        borderRadius: APP_RADIUS_MD,
        backgroundColor: active ? APP_SURFACE_ACTIVE : 'transparent',
        color: active ? APP_TEXT : locked ? APP_FAINT : APP_MUTED,
      }}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" style={{ color: active ? APP_CYAN : undefined }} />
      <span className="min-w-0 flex-1 truncate">{module.label}</span>
      {locked ? (
        <Lock className="h-3 w-3 shrink-0" aria-label={minPlan ? `ab ${minPlan}` : 'gesperrt'} />
      ) : (
        <ModuleStatusBadge status={module.status} />
      )}
    </Link>
  );
}

export function GovernanceSidebar() {
  const { pathname } = useLocation();
  const { plan } = useActivePlan();

  return (
    <nav
      aria-label="Modulnavigation"
      className="hidden shrink-0 flex-col overflow-y-auto border-r px-3 py-4 lg:flex"
      style={{
        width: APP_SIDEBAR_WIDTH,
        backgroundColor: APP_SURFACE,
        borderColor: APP_LINE,
      }}
    >
      <div className="flex items-center gap-2.5 px-1 pb-4">
        <span
          className="grid h-7 w-7 shrink-0 place-items-center"
          style={{
            borderRadius: APP_RADIUS_MD,
            background: `linear-gradient(135deg, ${APP_PRIMARY}, ${APP_CYAN})`,
          }}
        >
          <ShieldCheck className="h-4 w-4" style={{ color: '#FFFFFF' }} aria-hidden="true" />
        </span>
        <span
          className="truncate text-[10px] uppercase tracking-[0.14em]"
          style={{ fontFamily: APP_MONO, color: APP_MUTED }}
        >
          Governance OS
        </span>
      </div>

      <div className="flex flex-col gap-0.5">
        {TAB_MODULES.map((module) => (
          <SidebarItem
            key={module.id}
            module={module}
            active={isActiveRoute(module.route, pathname)}
            locked={!canAccessModule(module, plan)}
          />
        ))}
      </div>

      <div
        className="mt-auto border p-3"
        style={{ borderRadius: APP_RADIUS_MD, borderColor: APP_LINE, backgroundColor: APP_BG }}
      >
        <p
          className="text-[9px] uppercase tracking-[0.16em]"
          style={{ fontFamily: APP_MONO, color: APP_FAINT }}
        >
          Plan
        </p>
        <p className="mt-1 text-[13px]" style={{ color: APP_TEXT }}>
          {PLAN_LABELS[plan] ?? 'Free'}
        </p>
        <Link
          to="/app/billing"
          className="mt-2 inline-block text-[12px] underline-offset-2 hover:underline"
          style={{ color: APP_CYAN }}
        >
          Plan wechseln
        </Link>
      </div>
    </nav>
  );
}
