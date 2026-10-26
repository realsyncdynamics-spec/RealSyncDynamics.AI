import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, Globe, FileCheck2, Cpu, AlertTriangle, Activity,
  Building2, BarChart3, Users, Settings, Lock,
  Bell, CreditCard, Wrench, Bot, GitMerge, FileText,
  ClipboardCheck, ClipboardList, LayoutDashboard, ShieldAlert, ShieldCheck,
  MessagesSquare, Zap, Server, Layers, CalendarClock, Archive, Library,
  Share2, Sparkles, Scale, Shield, BadgeCheck, FileSearch, GitBranch,
  ListChecks, MessageSquare, Store, Terminal, Mic, ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import { TAB_MODULES } from './governanceModules';
import type { GovernanceModule } from './governanceBrowserTypes';
import type { NavLock } from './navAccess';
import { navLockTitle, useNavLock } from './useNavLock';
import { useActivePlan } from '../../hooks/useModuleAccess';
import { useTenant } from '../../core/access/TenantProvider';
import { useLang } from '../../i18n/useLang';
import { OS_ACCENT_TEXT } from './osChrome';
import { APP_SIDEBAR_WIDTH } from './app-theme';
import { SHELL_NAV, SHELL_NAV_ROUTES, activeShellNav, type ShellNavId } from './shellNav';
import { useShellCounts, type ShellCounts } from './useShellCounts';
import { groupShellNav, type ShellNavGroupId } from './shellNavGroups';
import { tenantDisplayName } from '../../features/governance/dashboard/dashboardSignals';
import '../../styles/governance-os-app.css';

/**
 * Seitenleiste der App — Handoff v2 §5.
 *
 * Hauptbereiche des Entwurfs (Übersicht, KI-Systeme, Klassifizierung,
 * Enforcement, Evidence, Voice, Berichte, Abrechnung) und alle übrigen Module
 * aus `TAB_MODULES` — dieselbe Registry wie die mobile Tab-Leiste — stehen in
 * einklappbaren Unterkategorien (shellNavGroups.ts): Start, Erfassen,
 * Bewerten, Durchsetzen, Belegen, Agenten, Verwaltung. Zugeklappte Gruppen
 * bleiben im DOM (`hidden`), kein Modul entfällt.
 *
 * Schlösser: aus `tenant_entitlements` (`useNavLock` → navAccess.ts), nicht
 * mehr aus `plan.modules`. Schloss ⇔ Routensperre (RouteEntitlementGate)
 * würde blockieren. Gesperrte Punkte zeigen kein Badge.
 * So bleibt jedes Modul erreichbar, ohne dass eine zweite, handgepflegte
 * Modulliste entsteht.
 *
 * Badges nur aus echten Zählern (`useShellCounts`); unbekannt ⇒ kein Badge.
 * Plan-Box: echter Plan aus `useActivePlan`, „Plan wechseln" → /app/billing.
 *
 * Farben: Tokens aus governance-os-app.css (`--color-rs-*`), Akzent-Fragment
 * aus osChrome.ts — keine Hex-Werte in dieser Datei.
 */

const ICON_MAP: Record<string, LucideIcon> = {
  Home, Globe, FileCheck2, Cpu, Bot, AlertTriangle, Activity,
  Building2, BarChart3, Users, Settings, Bell, CreditCard, Wrench,
  GitMerge, FileText, ClipboardCheck, ClipboardList, LayoutDashboard,
  ShieldAlert, ShieldCheck, MessagesSquare, Zap, Server, Layers,
  CalendarClock, Archive, Library, Share2, Sparkles, Scale, BadgeCheck,
  FileSearch, GitBranch, ListChecks, MessageSquare, Store, Terminal, Mic,
};

const NAV_ICONS: Record<ShellNavId, LucideIcon> = {
  overview: Home,
  systems: Cpu,
  classify: Scale,
  enforce: Shield,
  evidence: FileCheck2,
  voice: Mic,
  reports: BarChart3,
  billing: CreditCard,
};

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  growth: 'Professional',
  agency: 'Agency',
  enterprise: 'Enterprise',
};

function badgeFor(id: ShellNavId, counts: ShellCounts): number | null {
  switch (id) {
    case 'systems': return counts.systems;
    case 'classify': return counts.unclassified && counts.unclassified > 0 ? counts.unclassified : null;
    case 'enforce': return counts.policies;
    case 'evidence': return counts.evidence;
    default: return null;
  }
}

function isActiveRoute(route: string, pathname: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function MoreItem({ module, active, lock }: { module: GovernanceModule; active: boolean; lock: NavLock }) {
  const Icon: LucideIcon = ICON_MAP[module.icon] ?? Home;
  const locked = lock.locked;
  return (
    <Link
      to={module.route}
      aria-current={active ? 'page' : undefined}
      title={locked ? navLockTitle(module.label, lock) : module.description}
      className={`rs-side__item rs-side__item--small${locked ? ' rs-side__item--locked' : ''}`}
      data-testid={`side-more-${module.id}`}
      data-locked={locked ? 'true' : 'false'}
    >
      <Icon className="rs-side__icon" aria-hidden="true" />
      <span className="rs-side__text">{module.label}</span>
      {locked && <Lock className="h-3 w-3 shrink-0" aria-label={navLockTitle(module.label, lock)} />}
    </Link>
  );
}

export function GovernanceSidebar() {
  const { pathname } = useLocation();
  const { plan, loading: planLoading } = useActivePlan();
  const lockFor = useNavLock();
  const { tenants, activeTenantId } = useTenant();
  const { t, lang } = useLang();
  const counts = useShellCounts();
  const active = activeShellNav(pathname);
  const rawTenantName = tenants.find((x) => x.tenantId === activeTenantId)?.name ?? null;
  const tenantName = rawTenantName === null ? null : tenantDisplayName(rawTenantName, lang);
  const moreModules = TAB_MODULES.filter((m) => !SHELL_NAV_ROUTES.has(m.route));
  const groups = groupShellNav(SHELL_NAV, moreModules);
  // Offen: „Start" und die Gruppe der aktuellen Seite. Wechselt die Seite in
  // eine zugeklappte Gruppe, klappt diese auf; andere bleiben, wie der Nutzer
  // sie gesetzt hat.
  const activeGroup = groups.find(
    ({ shell, modules }) =>
      shell.some((item) => item.id === active) ||
      modules.some((m) => isActiveRoute(m.route, pathname)),
  )?.group.id;
  const [openGroups, setOpenGroups] = useState<ReadonlySet<ShellNavGroupId>>(
    () => new Set<ShellNavGroupId>(activeGroup ? ['start', activeGroup] : ['start']),
  );
  useEffect(() => {
    if (!activeGroup) return;
    setOpenGroups((prev) => (prev.has(activeGroup) ? prev : new Set(prev).add(activeGroup)));
  }, [activeGroup]);
  const toggleGroup = (id: ShellNavGroupId) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <nav aria-label={t('shellNavLabel')} className="rs-side" style={{ width: APP_SIDEBAR_WIDTH }}>
      <Link to="/app/dashboard" className="rs-side__brand" style={{ textDecoration: 'none' }}>
        <span className="rs-logo-mark">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="rs-side__brand-text">
          <span className="rs-side__product">Governance OS</span>
          <span className="rs-side__tenant">{tenantName ?? t('shellNoTenant')}</span>
        </span>
      </Link>

      {groups.map(({ group, shell, modules }) => {
        const isOpen = openGroups.has(group.id);
        const listId = `side-group-${group.id}`;
        return (
          <div key={group.id} className="rs-side__section" data-testid={`side-group-${group.id}`}>
            <button
              type="button"
              className="rs-side__head"
              aria-expanded={isOpen}
              aria-controls={listId}
              onClick={() => toggleGroup(group.id)}
            >
              <span className="rs-side__head-text">{t(group.labelKey)}</span>
              <span className="rs-side__head-count">{shell.length + modules.length}</span>
              <ChevronDown className="rs-side__chev" aria-hidden="true" />
            </button>
            <div id={listId} className="rs-side__group" hidden={!isOpen}>
              {shell.map((item) => {
                const Icon = NAV_ICONS[item.id];
                const lock = lockFor({ route: item.route, keys: item.entitlementKeys });
                const locked = lock.locked;
                const label = t(item.labelKey);
                const badge = badgeFor(item.id, counts);
                const to = item.id === 'classify' && counts.firstSystemId
                  ? `/app/ai-systems/${counts.firstSystemId}`
                  : item.route;
                return (
                  <Link
                    key={item.id}
                    to={to}
                    aria-current={active === item.id ? 'page' : undefined}
                    className={`rs-side__item${locked ? ' rs-side__item--locked' : ''}`}
                    data-testid={`side-nav-${item.id}`}
                    data-locked={locked ? 'true' : 'false'}
                    title={locked ? navLockTitle(label, lock) : undefined}
                  >
                    <Icon className="rs-side__icon" aria-hidden="true" />
                    <span className="rs-side__text">{label}</span>
                    {locked ? (
                      <Lock className="h-3 w-3 shrink-0" aria-label={navLockTitle(label, lock)} data-testid={`side-lock-${item.id}`} />
                    ) : badge !== null ? (
                      <span className="rs-side__badge" data-testid={`side-badge-${item.id}`}>{badge}</span>
                    ) : null}
                  </Link>
                );
              })}
              {modules.map((module) => (
                <MoreItem
                  key={module.id}
                  module={module}
                  active={isActiveRoute(module.route, pathname)}
                  lock={lockFor({ route: module.route, module })}
                />
              ))}
            </div>
          </div>
        );
      })}

      <div className="rs-plan">
        <p className="rs-plan__label">{t('shellPlan')}</p>
        <p className="rs-plan__name">{planLoading ? '—' : PLAN_LABELS[plan] ?? plan}</p>
        <Link to="/app/billing" className={`rs-plan__link ${OS_ACCENT_TEXT}`}>
          {t('upgrade')}
        </Link>
      </div>
    </nav>
  );
}
