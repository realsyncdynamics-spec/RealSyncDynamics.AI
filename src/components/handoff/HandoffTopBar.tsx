import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import '../../styles/governance-os-handoff.css';
import { BrandWordmark } from './BrandWordmark';
import { LangToggle } from './LangToggle';
import { useLang } from '../../i18n/useLang';

export type PublicTopBarActive = 'product' | 'governance' | 'evidence' | 'pricing' | 'login';

/**
 * Einheitliche öffentliche Navigation für Landing, Audit, Pricing,
 * Governance Runtime und öffentliche Dashboard-Preview.
 */
export function HandoffTopBar({
  active,
  children,
}: {
  active?: PublicTopBarActive;
  children?: ReactNode;
}) {
  const { t, lang } = useLang();
  const nav = lang === 'de'
    ? [
        { id: 'product' as const, label: 'Produkt', to: '/#product' },
        { id: 'governance' as const, label: 'Governance', to: '/governance-runtime' },
        { id: 'evidence' as const, label: 'Evidence', to: '/#audit-trail' },
        { id: 'pricing' as const, label: 'Preise', to: '/#pricing' },
        { id: 'login' as const, label: 'Login', to: '/login' },
      ]
    : [
        { id: 'product' as const, label: 'Product', to: '/#product' },
        { id: 'governance' as const, label: 'Governance', to: '/governance-runtime' },
        { id: 'evidence' as const, label: 'Evidence', to: '/#audit-trail' },
        { id: 'pricing' as const, label: 'Pricing', to: '/#pricing' },
        { id: 'login' as const, label: 'Login', to: '/login' },
      ];

  return (
    <header className="rs-topbar">
      <BrandWordmark />
      <nav className="rs-topbar__chips" aria-label={t('mainNav')}>
        {nav.map((item) => {
          const isActive = item.id === active;
          return (
            <Link
              key={item.id}
              to={item.to}
              className={`rs-chip${isActive ? ' rs-chip--key' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="rs-topbar__tools">
        {children}
        <LangToggle />
        <Link to="/audit" className="rs-btn rs-btn--primary rs-btn--h40">
          {t('cta')}
        </Link>
      </div>
    </header>
  );
}
