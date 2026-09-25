import { Link, useLocation } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useLang } from '../../i18n/useLang';
import { SHELL_NAV, activeShellNav } from './shellNav';
import { useRouteLockCheck } from '../../core/access/useRouteLock';

/**
 * Burger-Menü mobil — die sieben Hauptbereiche aus Handoff v2 §5, damit
 * Klassifizierung und Abrechnung (nicht in der Tab-Bar) erreichbar bleiben.
 * Darunter folgen im Menü die bestehenden GovernanceTabs mit allen Modulen.
 */
export function MobileShellMenu() {
  const { pathname } = useLocation();
  const { t } = useLang();
  const isLocked = useRouteLockCheck();
  const active = activeShellNav(pathname);
  return (
    <div className="rs-ui grid grid-cols-2 gap-1 border-b border-titanium-800 bg-obsidian-900 p-2">
      {SHELL_NAV.map((item) => {
        const locked = isLocked(item.route);
        return (
          <Link
            key={item.id}
            to={item.route}
            aria-current={active === item.id ? 'page' : undefined}
            className={`rs-side__item${locked ? ' rs-side__item--locked' : ''}`}
            data-locked={locked ? 'true' : undefined}
          >
            <span className="rs-side__text">{t(item.labelKey)}</span>
            {locked && <Lock className="h-3 w-3 shrink-0" aria-label="gesperrt" />}
          </Link>
        );
      })}
    </div>
  );
}
