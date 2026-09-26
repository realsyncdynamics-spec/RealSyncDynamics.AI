import { Link, useLocation } from 'react-router-dom';
import { Home, Cpu, Shield, FileCheck2, BarChart3, Lock } from 'lucide-react';
import { useLang } from '../../i18n/useLang';
import type { HandoffKey } from '../../i18n/handoff';
import { SHELL_NAV, activeShellNav, type ShellNavId } from './shellNav';
import { navLockTitle, useNavLock } from './useNavLock';
import '../../styles/governance-os-app.css';

/**
 * Tab-Bar mobil — Handoff v2 §5: Übersicht, KI-Systeme, Enforcement,
 * Evidence, Berichte. Aktiv Cyan, sonst gedämpft; Icon 20px, Label 9px.
 * Alle übrigen Bereiche (Klassifizierung, Abrechnung, Module) liegen im
 * Burger-Menü der Kopfzeile. Schlösser wie in der Seitenleiste aus
 * tenant_entitlements (navAccess.ts, Keys aus SHELL_NAV).
 */
const BOTTOM_TABS: ReadonlyArray<{ id: ShellNavId; icon: typeof Home; labelKey: HandoffKey; route: string }> = [
  { id: 'overview', icon: Home, labelKey: 'navOverview', route: '/app/dashboard' },
  { id: 'systems', icon: Cpu, labelKey: 'navSystems', route: '/app/ai-systems' },
  { id: 'enforce', icon: Shield, labelKey: 'navEnforce', route: '/app/policy-packs' },
  { id: 'evidence', icon: FileCheck2, labelKey: 'navEvidence', route: '/app/evidence' },
  { id: 'reports', icon: BarChart3, labelKey: 'navReports', route: '/app/reports' },
] as const;

export function MobileBottomNavigation() {
  const { pathname } = useLocation();
  const { t } = useLang();
  const active = activeShellNav(pathname);
  // Klassifizierung ist die Detailseite der KI-Systeme — der Tab bleibt aktiv.
  const activeTab = active === 'classify' ? 'systems' : active;
  const lockFor = useNavLock();

  return (
    <nav className="rs-tabbar rs-ui" aria-label={t('shellTabsLabel')}>
      {BOTTOM_TABS.map(({ id, icon: Icon, labelKey, route }) => {
        const lock = lockFor({ route, keys: SHELL_NAV.find((item) => item.id === id)?.entitlementKeys });
        const label = t(labelKey);
        return (
          <Link
            key={id}
            to={route}
            className="rs-tabbar__tab"
            aria-current={activeTab === id ? 'page' : undefined}
            title={lock.locked ? navLockTitle(label, lock) : undefined}
            data-locked={lock.locked ? 'true' : 'false'}
          >
            {lock.locked ? (
              <Lock className="h-5 w-5 shrink-0" aria-label={navLockTitle(label, lock)} />
            ) : (
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            )}
            <span className="rs-tabbar__label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
