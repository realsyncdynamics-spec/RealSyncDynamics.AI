import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { RegistrationCta } from './V8Ctas';
import '../../../styles/landing-v8/landing-v8.css';

const LINKS = [
  { to: '/v8', label: 'Start', end: true },
  { to: '/v8/produkte', label: 'Produkte', end: false },
  { to: '/v8/loesungen', label: 'Lösungen', end: false },
  { to: '/v8/preise', label: 'Preise', end: false },
  { to: '/v8/demo', label: 'Demo', end: false },
] as const;

export function LandingV8Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="landing-v8" data-theme="light-cream">
      <header className="v8-wrap v8-header">
        <Link to="/v8" className="v8-brand" onClick={close}>
          <img src="/brand/logo-square-400.svg" alt="" width={34} height={34} />
          <div>
            RSD & AI
            <small>RealSync Dynamics & AI</small>
          </div>
        </Link>
        <nav className={open ? 'v8-nav v8-nav-open' : 'v8-nav'} aria-label="Landing v8">
          {LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} onClick={close}>
              {link.label}
            </NavLink>
          ))}
          <RegistrationCta className="v8-btn v8-btn-primary" onClick={close} />
        </nav>
        <button
          type="button"
          className="v8-btn v8-btn-secondary v8-menu-btn"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          Menü
        </button>
      </header>
      <main>{children}</main>
      <footer className="v8-footer">
        <div className="v8-wrap v8-foot">
          <div>© 2026 RSD & AI · RealSync Dynamics & AI</div>
          <nav aria-label="Rechtliches">
            <Link to="/impressum">Impressum</Link>
            <Link to="/datenschutz">Datenschutz</Link>
            <Link to="/agb">AGB</Link>
            <Link to="/v8/preise">Preise</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
