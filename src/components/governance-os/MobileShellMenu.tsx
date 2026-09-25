import { Link, useLocation } from 'react-router-dom';
import { useLang } from '../../i18n/useLang';
import { SHELL_NAV, activeShellNav } from './shellNav';

/**
 * Burger-Menü mobil — die sieben Hauptbereiche aus Handoff v2 §5, damit
 * Klassifizierung und Abrechnung (nicht in der Tab-Bar) erreichbar bleiben.
 * Darunter folgen im Menü die bestehenden GovernanceTabs mit allen Modulen.
 */
export function MobileShellMenu() {
  const { pathname } = useLocation();
  const { t } = useLang();
  const active = activeShellNav(pathname);
  return (
    <div className="rs-ui grid grid-cols-2 gap-1 border-b border-titanium-800 bg-obsidian-900 p-2">
      {SHELL_NAV.map((item) => (
        <Link
          key={item.id}
          to={item.route}
          aria-current={active === item.id ? 'page' : undefined}
          className="rs-side__item"
        >
          <span className="rs-side__text">{t(item.labelKey)}</span>
        </Link>
      ))}
    </div>
  );
}
