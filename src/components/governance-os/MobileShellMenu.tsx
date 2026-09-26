import { Link, useLocation } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useLang } from '../../i18n/useLang';
import { SHELL_NAV, activeShellNav } from './shellNav';
import { navLockTitle, useNavLock } from './useNavLock';

/**
 * Burger-Menü mobil — die sieben Hauptbereiche aus Handoff v2 §5, damit
 * Klassifizierung und Abrechnung (nicht in der Tab-Bar) erreichbar bleiben.
 * Darunter folgen im Menü die bestehenden GovernanceTabs mit allen Modulen.
 * Schlösser wie in der Seitenleiste aus tenant_entitlements (navAccess.ts).
 */
export function MobileShellMenu() {
  const { pathname } = useLocation();
  const { t } = useLang();
  const active = activeShellNav(pathname);
  const lockFor = useNavLock();
  return (
    <div className="rs-ui grid grid-cols-2 gap-1 border-b border-titanium-800 bg-obsidian-900 p-2">
      {SHELL_NAV.map((item) => {
        const lock = lockFor({ route: item.route, keys: item.entitlementKeys });
        const label = t(item.labelKey);
        return (
          <Link
            key={item.id}
            to={item.route}
            aria-current={active === item.id ? 'page' : undefined}
            className={`rs-side__item${lock.locked ? ' rs-side__item--locked' : ''}`}
            title={lock.locked ? navLockTitle(label, lock) : undefined}
          >
            <span className="rs-side__text">{label}</span>
            {lock.locked && <Lock className="h-3 w-3 shrink-0" aria-label={navLockTitle(label, lock)} />}
          </Link>
        );
      })}
    </div>
  );
}
