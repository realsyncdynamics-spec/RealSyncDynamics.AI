import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, Globe, FileCheck2, Cpu, AlertTriangle, Activity,
  Building2, BarChart3, Users, Settings, Lock,
  Bell, CreditCard, Wrench, Bot, GitMerge, FileText,
  ClipboardCheck, ClipboardList, LayoutDashboard, ShieldAlert, ShieldCheck,
  MessagesSquare, Zap, Server, Layers, CalendarClock, Archive, Library,
  Share2, Sparkles, Scale, Shield, BadgeCheck, FileSearch, GitBranch,
  ListChecks, MessageSquare, Store, Terminal, Mic, Radar, ChevronDown,
  PanelLeftClose, PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react';
import { GOVERNANCE_MODULES } from './governanceModules';
import type { GovernanceModule } from './governanceBrowserTypes';
import type { NavLock } from './navAccess';
import { navLockTitle, useNavLock } from './useNavLock';
import { useActivePlan } from '../../hooks/useModuleAccess';
import { useTenant } from '../../core/access/TenantProvider';
import { useLang } from '../../i18n/useLang';
import { OS_ACCENT_TEXT } from './osChrome';
import { APP_SIDEBAR_RAIL_WIDTH, APP_SIDEBAR_WIDTH } from './app-theme';
import {
  SHELL_NAV, SHELL_NAV_GROUPS, activeShellNav,
  type ShellNavEntry, type ShellNavGroupId, type ShellNavId,
} from './shellNav';
import { useShellCounts, type ShellCounts } from './useShellCounts';
import { tenantDisplayName } from '../../features/governance/dashboard/dashboardSignals';
import '../../styles/governance-os-app.css';

/**
 * Seitenleiste der App — Design System „RealSync Dashboard“, Komponente SideNav.
 *
 * Alle Module in sieben Unterkategorien (`SHELL_NAV_GROUPS`: Start, Erfassen,
 * Bewerten, Durchsetzen, Belegen, Agenten, Verwaltung). Die Gruppe der
 * aktuellen Seite ist offen, die übrigen sind zu; jede Gruppe zeigt ihre
 * Anzahl. Zugeklappte Gruppen bleiben im DOM (`hidden`), damit Schlösser und
 * Ziele prüfbar bleiben. Eingeklappt: 64px-Icon-Rail mit einem Icon je Gruppe.
 *
 * Schlösser: aus `tenant_entitlements` (`useNavLock` → navAccess.ts), nicht
 * mehr aus `plan.modules`. Schloss ⇔ Routensperre (RouteEntitlementGate)
 * würde blockieren. Gesperrte Punkte bleiben sichtbar und zeigen kein Badge.
 * Module mit Status „roadmap“ tragen „Geplant“.
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

const GROUP_ICONS: Record<ShellNavGroupId, LucideIcon> = {
  start: Home,
  capture: Radar,
  assess: Scale,
  enforce: ShieldCheck,
  prove: FileCheck2,
  agents: Bot,
  admin: Settings,
};

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  growth: 'Professional',
  agency: 'Agency',
  enterprise: 'Enterprise',
};

const MODULE_BY_ID: ReadonlyMap<string, GovernanceModule> = new Map(GOVERNANCE_MODULES.map((m) => [m.id, m] as const));
const SHELL_BY_ID = new Map(SHELL_NAV.map((i) => [i.id, i] as const));

const COLLAPSED_KEY = 'rs.sidebar.collapsed';

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean): void {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, value ? '1' : '0');
  } catch {
    // Ohne Speicher bleibt der Zustand nur für diese Ansicht erhalten.
  }
}

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

function isEntryActive(entry: ShellNavEntry, pathname: string, active: ShellNavId | null): boolean {
  if (entry.kind === 'shell') return active === entry.id;
  const module = MODULE_BY_ID.get(entry.id);
  return module ? isActiveRoute(module.route, pathname) : false;
}

/** Gruppe der aktuellen Seite (oder null außerhalb der Modulliste). */
export function activeNavGroup(pathname: string): ShellNavGroupId | null {
  const active = activeShellNav(pathname);
  const group = SHELL_NAV_GROUPS.find((g) => g.entries.some((e) => isEntryActive(e, pathname, active)));
  return group?.id ?? null;
}

interface ItemProps {
  testId: string;
  to: string;
  label: string;
  Icon: LucideIcon;
  active: boolean;
  lock: NavLock;
  lockTestId?: string;
  badge?: number | null;
  badgeTestId?: string;
  planned?: boolean;
  plannedLabel: string;
  title?: string;
}

function NavItem({ testId, to, label, Icon, active, lock, lockTestId, badge = null, badgeTestId, planned = false, plannedLabel, title }: ItemProps) {
  const locked = lock.locked;
  return (
    <li>
      <Link
        to={to}
        aria-current={active ? 'page' : undefined}
        className={`rs-side__item${locked ? ' rs-side__item--locked' : ''}`}
        data-testid={testId}
        data-locked={locked ? 'true' : 'false'}
        title={locked ? navLockTitle(label, lock) : title}
      >
        <Icon className="rs-side__icon" aria-hidden="true" />
        <span className="rs-side__text">{label}</span>
        {planned && <span className="rs-side__tag">{plannedLabel}</span>}
        {locked ? (
          <Lock className="h-3 w-3 shrink-0" aria-label={navLockTitle(label, lock)} data-testid={lockTestId} />
        ) : badge !== null ? (
          <span className="rs-side__badge" data-testid={badgeTestId}>{badge}</span>
        ) : null}
      </Link>
    </li>
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
  const activeGroup = activeNavGroup(pathname);
  const rawTenantName = tenants.find((x) => x.tenantId === activeTenantId)?.name ?? null;
  const tenantName = rawTenantName === null ? null : tenantDisplayName(rawTenantName, lang);

  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed);
  const [openGroups, setOpenGroups] = useState<ReadonlySet<ShellNavGroupId>>(
    () => new Set<ShellNavGroupId>([activeGroup ?? 'start']),
  );

  // Wechselt die Seite in eine andere Gruppe, geht diese auf.
  useEffect(() => {
    if (!activeGroup) return;
    setOpenGroups((prev) => (prev.has(activeGroup) ? prev : new Set(prev).add(activeGroup)));
  }, [activeGroup]);

  const toggleCollapsed = (next: boolean) => {
    setCollapsed(next);
    writeCollapsed(next);
  };

  const toggleGroup = (id: ShellNavGroupId) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const brand = (
    <Link to="/app/dashboard" className="rs-side__brand" style={{ textDecoration: 'none' }} aria-label={collapsed ? 'Governance OS' : undefined}>
      <span className="rs-logo-mark">
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
      </span>
      {!collapsed && (
        <span className="rs-side__brand-text">
          <span className="rs-side__product">Governance OS</span>
          <span className="rs-side__tenant">{tenantName ?? t('shellNoTenant')}</span>
        </span>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <nav
        aria-label={t('shellNavLabel')}
        className="rs-side rs-side--rail"
        style={{ width: APP_SIDEBAR_RAIL_WIDTH }}
        data-collapsed="true"
      >
        {brand}
        <ul className="rs-side__group">
          {SHELL_NAV_GROUPS.map((group) => {
            const Icon = GROUP_ICONS[group.id];
            const label = t(group.labelKey);
            return (
              <li key={group.id}>
                <button
                  type="button"
                  className="rs-side__rail-btn"
                  aria-label={label}
                  title={label}
                  aria-current={activeGroup === group.id ? 'true' : undefined}
                  data-testid={`side-rail-${group.id}`}
                  onClick={() => {
                    setOpenGroups((prev) => new Set(prev).add(group.id));
                    toggleCollapsed(false);
                  }}
                >
                  <Icon className="rs-side__icon" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          className="rs-side__rail-btn rs-side__collapse"
          aria-label={t('shellExpand')}
          title={t('shellExpand')}
          onClick={() => toggleCollapsed(false)}
        >
          <PanelLeftOpen className="rs-side__icon" aria-hidden="true" />
        </button>
      </nav>
    );
  }

  return (
    <nav aria-label={t('shellNavLabel')} className="rs-side" style={{ width: APP_SIDEBAR_WIDTH }} data-collapsed="false">
      {brand}

      {SHELL_NAV_GROUPS.map((group) => {
        const open = openGroups.has(group.id);
        const listId = `side-group-${group.id}`;
        const label = t(group.labelKey);
        return (
          <div key={group.id} className="rs-side__section" data-testid={`side-group-${group.id}`}>
            <button
              type="button"
              className="rs-side__group-head"
              aria-expanded={open}
              aria-controls={listId}
              onClick={() => toggleGroup(group.id)}
            >
              <span className="rs-side__group-label">{label}</span>
              <span className="rs-side__count">{group.entries.length}</span>
              <ChevronDown className={`rs-side__chev${open ? ' rs-side__chev--open' : ''}`} aria-hidden="true" />
            </button>
            <ul id={listId} className="rs-side__group" hidden={!open}>
              {group.entries.map((entry) => {
                if (entry.kind === 'shell') {
                  const item = SHELL_BY_ID.get(entry.id);
                  if (!item) return null;
                  const itemLabel = t(item.labelKey);
                  const to = item.id === 'classify' && counts.firstSystemId
                    ? `/app/ai-systems/${counts.firstSystemId}`
                    : item.route;
                  return (
                    <NavItem
                      key={`shell-${item.id}`}
                      testId={`side-nav-${item.id}`}
                      to={to}
                      label={itemLabel}
                      Icon={NAV_ICONS[item.id]}
                      active={active === item.id}
                      lock={lockFor({ route: item.route, keys: item.entitlementKeys })}
                      lockTestId={`side-lock-${item.id}`}
                      badge={badgeFor(item.id, counts)}
                      badgeTestId={`side-badge-${item.id}`}
                      plannedLabel={t('shellPlanned')}
                    />
                  );
                }
                const module = MODULE_BY_ID.get(entry.id);
                if (!module) return null;
                return (
                  <NavItem
                    key={`module-${module.id}`}
                    testId={`side-more-${module.id}`}
                    to={module.route}
                    label={module.label}
                    Icon={ICON_MAP[module.icon] ?? Home}
                    active={isActiveRoute(module.route, pathname)}
                    lock={lockFor({ route: module.route, module })}
                    planned={module.status === 'roadmap'}
                    plannedLabel={t('shellPlanned')}
                    title={module.description}
                  />
                );
              })}
            </ul>
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
      <button
        type="button"
        className="rs-side__item rs-side__collapse"
        onClick={() => toggleCollapsed(true)}
      >
        <PanelLeftClose className="rs-side__icon" aria-hidden="true" />
        <span className="rs-side__text">{t('shellCollapse')}</span>
      </button>
    </nav>
  );
}
