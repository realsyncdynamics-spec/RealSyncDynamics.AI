import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  CAPABILITY_STATUS_LABEL,
  PRODUCTS,
  type CapabilityStatus,
} from '../../product/productSuite';
import '../../styles/product-portal.css';

/**
 * Gemeinsamer Rahmen für Startseite und Produktseiten: eine Navigation für
 * alle drei Produkte, ein Login, ein Footer mit Rechtstexten.
 */

const NAV: readonly { label: string; to: string }[] = [
  ...PRODUCTS.map((p) => ({ label: p.name.replace('RealSync ', ''), to: p.pageRoute })),
  { label: 'Preise', to: '/pricing' },
  { label: 'Lösungen', to: '/branchen' },
  { label: 'Dokumentation', to: '/docs' },
];

const FOOTER: readonly { label: string; to: string }[] = [
  { label: 'Impressum', to: '/impressum' },
  { label: 'Datenschutz', to: '/datenschutz' },
  { label: 'AGB', to: '/agb' },
  { label: 'Widerruf', to: '/widerruf' },
  { label: 'AVV', to: '/legal/avv' },
  { label: 'Unterauftragsverarbeiter', to: '/legal/sub-processors' },
  { label: 'Grenzen des Produkts', to: '/grenzen' },
  { label: 'Roadmap', to: '/roadmap' },
  { label: 'Kontakt', to: '/kontakt' },
];

export function StatusChip({ status }: { status: CapabilityStatus }) {
  return (
    <span className={`rsp-chip rsp-chip-${status}`} data-status={status}>
      {CAPABILITY_STATUS_LABEL[status]}
    </span>
  );
}

export function PortalChrome({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div className="rsp">
      <a className="rsp-skip" href="#main">Zum Inhalt springen</a>
      <header className="rsp-header">
        <div className="rsp-wrap rsp-header-row">
          <Link to="/" className="rsp-brand" aria-label="RealSync Dynamics AI – Startseite">
            <span className="rsp-brand-mark" aria-hidden="true" />
            <span>
              RealSync Dynamics AI <small>BUILD · AUTOMATE · GOVERN</small>
            </span>
          </Link>
          <nav className="rsp-nav" aria-label="Hauptnavigation">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} aria-current={pathname === n.to ? 'page' : undefined}>
                {n.label}
              </Link>
            ))}
            <Link to="/login" className="rsp-nav-login">Anmelden</Link>
          </nav>
          <details className="rsp-menu">
            <summary aria-label="Menü öffnen">MENÜ</summary>
            <nav className="rsp-menu-panel" aria-label="Mobile Navigation">
              {NAV.map((n) => (
                <Link key={n.to} to={n.to}>{n.label}</Link>
              ))}
              <Link to="/login">Anmelden</Link>
            </nav>
          </details>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="rsp-footer">
        <div className="rsp-wrap">
          <p>
            RealSync Dynamics AI · Datenhaltung in der EU (Supabase Frankfurt). Scans und Prüfungen sind
            technische Hilfsmittel und keine Rechtsberatung oder Zertifizierung.
          </p>
          <nav aria-label="Rechtliches">
            {FOOTER.map((f) => (
              <Link key={f.to} to={f.to}>{f.label}</Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
