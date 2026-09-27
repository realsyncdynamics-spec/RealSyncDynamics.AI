import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import '../../styles/governance-os-handoff.css';
import { BrandWordmark } from './BrandWordmark';
import { LangToggle } from './LangToggle';
import { HANDOFF_NAV } from './handoff-nav';
import type { HandoffKey } from '../../i18n/handoff';
import { useLang } from '../../i18n/useLang';

/**
 * Kopfzeile öffentlicher Handoff-Seiten (Preise, Audit): Wortmarke,
 * Nav-Chips (ab 1200px), DE/EN, optionale Zusatzwerkzeuge.
 */
export function HandoffTopBar({ active, children }: { active?: HandoffKey; children?: ReactNode }) {
  const { t } = useLang();
  return (
    <header className="rs-topbar">
      <BrandWordmark />
      <nav className="rs-topbar__chips" aria-label={t('mainNav')}>
        {HANDOFF_NAV.map((item) => {
          const isActive = item.key === active;
          return (
            <Link
              key={item.key}
              to={item.to}
              className={`rs-chip${item.prominent ? ' rs-chip--key' : ''}${isActive ? ' rs-chip--active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              {t(item.key)}
            </Link>
          );
        })}
      </nav>
      <div className="rs-topbar__tools">
        {children}
        <LangToggle />
      </div>
    </header>
  );
}
