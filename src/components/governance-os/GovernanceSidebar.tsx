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
import { OS_ACCENT_BG, OS_ACCENT_TEXT, OS_CREAM_TEXT, OS_FOCUS_RING } from './osChrome';
import {
  APP_DURATION_MS,
  APP_EASING,
  APP_NAV_ITEM_HEIGHT,
  APP_RADIUS_MD,
  APP_SIDEBAR_WIDTH,
} from './app-theme';

/**
 * Seitenleiste der App — die Modulnavigation aus dem Handoff-Entwurf.
 *
 * Sie ersetzt ab `lg` die waagerechte Tab-Leiste. Auf schmalen Geraeten
 * bleibt es beim Burger-Menue und der Tab-Bar unten: Eine 248px-Spalte
 * neben einem 390px-Fenster laesst fuer den Inhalt nichts uebrig.
 *
 * ## Aus dem Entwurf kommt das Raster, nicht die Farbe
 *
 * Breite, Zeilenhoehe, Radius und Bewegungskurve folgen dem Entwurf
 * (`app-theme.ts`). Die Farben kommen aus `osChrome.ts` — dieselbe Quelle,
 * aus der TopBar, Tabs, Statusleiste und Command Center lesen. Der Entwurf
 * ist in Cyan gehalten; `osChrome` und `index.css` schreiben fuer `/app`
 * ausdruecklich Gold fest. Eine cyanfarbene Seitenleiste neben goldenem
 * Chrome haette diese Regel nicht geaendert, nur gebrochen.
 *
 * ## Die Liste wird nicht gepflegt, sie wird gelesen
 *
 * Der Entwurf zeigt sieben feste Eintraege. Diese Komponente nimmt
 * stattdessen `TAB_MODULES` — dieselbe Registry, aus der die Tab-Leiste
 * liest. Eine zweite, handgepflegte Liste waere genau die Stelle, an der
 * beim naechsten Modul die Navigation auseinanderlaeuft, und sie haette
 * weder Status-Badge noch Plan-Gate. Wer ein Modul auf `roadmap`
 * zurueckstuft, nimmt es damit auch hier automatisch aus der Leiste.
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

/** Bewegung nach Entwurf — eine Kurve, keine Federn, kein Hover-Zoom. */
const MOTION = {
  transitionTimingFunction: APP_EASING,
  transitionDuration: `${APP_DURATION_MS}ms`,
} as const;

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

  const tone = active
    ? 'bg-obsidian-800 text-titanium-50'
    : locked
      ? 'text-titanium-600 hover:bg-obsidian-800'
      : 'text-titanium-400 hover:text-titanium-100 hover:bg-obsidian-800';

  return (
    <Link
      to={module.route}
      aria-current={active ? 'page' : undefined}
      title={locked && minPlan ? `${module.label} — ab ${minPlan}` : module.description}
      className={`group flex items-center gap-2.5 px-2.5 text-[13px] transition-colors focus-visible:outline-none ${OS_FOCUS_RING} ${tone}`}
      style={{ ...MOTION, height: APP_NAV_ITEM_HEIGHT, borderRadius: APP_RADIUS_MD }}
    >
      <Icon
        className={`h-[18px] w-[18px] shrink-0 ${
          active ? OS_ACCENT_TEXT : 'text-titanium-600 group-hover:text-titanium-300'
        }`}
      />
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
      className="hidden shrink-0 flex-col overflow-y-auto border-r border-titanium-800 bg-obsidian-900 px-3 py-4 lg:flex"
      style={{ width: APP_SIDEBAR_WIDTH }}
    >
      <div className="flex items-center gap-2.5 px-1 pb-4">
        <span className={`grid h-7 w-7 shrink-0 place-items-center ${OS_ACCENT_BG}`}>
          <ShieldCheck className="h-4 w-4" style={{ color: OS_CREAM_TEXT }} aria-hidden="true" />
        </span>
        <span className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-titanium-500">
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
        className="mt-auto border border-titanium-800 bg-obsidian-950 p-3"
        style={{ borderRadius: APP_RADIUS_MD }}
      >
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-titanium-600">Plan</p>
        <p className="mt-1 text-[13px] text-titanium-100">{PLAN_LABELS[plan] ?? 'Free'}</p>
        <Link
          to="/app/billing"
          className={`mt-2 inline-block text-[12px] underline-offset-2 hover:underline ${OS_ACCENT_TEXT}`}
        >
          Plan wechseln
        </Link>
      </div>
    </nav>
  );
}
