import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { LV4_BRAND, LV4_NAV, LV4_STATUS } from './landing-v4-content';

const AUDIT = '/audit?source=landing-v4';

/**
 * Statusleiste + Header der Landing v4. Nur Dunkel (Design v4 hat keinen
 * Farbschalter). Login führt auf die bestehende `/welcome`-Route, der CTA in
 * den kanonischen Scan-Einstieg `/audit`.
 */
export function LandingV4Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const close = () => setMenuOpen(false);

  return (
    <>
      <div className="lv4-status">
        <div className="lv2__wrap lv4-status__row">
          <span className="lv4-status__dot" aria-hidden="true" />
          {LV4_STATUS.join(' · ')}
        </div>
      </div>
      <header className="lv4-header">
        <div className="lv2__wrap lv4-header__row">
          <Link to="/" className="lv4-logo" aria-label={`${LV4_BRAND} – Startseite`}>
            RealSync Dynamics.AI
          </Link>
          <nav className="lv4-nav" aria-label="Hauptnavigation">
            {LV4_NAV.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
            <Link to="/welcome">Login</Link>
            <Link to={AUDIT} className="lv4-btn" data-lv4-cta="audit">
              Free Audit starten
            </Link>
          </nav>
          <button
            type="button"
            className="lv4-burger"
            aria-label="Menü öffnen"
            aria-expanded={menuOpen}
            aria-controls="lv4-mobile-menu"
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={22} aria-hidden="true" />
          </button>
        </div>
      </header>

      {menuOpen && (
        <div id="lv4-mobile-menu" className="lv4-menu" role="dialog" aria-modal="true" aria-label="Menü">
          <div className="lv4-menu__top">
            <span className="lv4-logo">RealSync Dynamics.AI</span>
            <button type="button" className="lv4-burger" aria-label="Menü schließen" onClick={close}>
              <X size={22} aria-hidden="true" />
            </button>
          </div>
          <nav aria-label="Mobile Navigation">
            {LV4_NAV.map((item) => (
              <a key={item.href} href={item.href} onClick={close}>
                {item.label}
              </a>
            ))}
            <Link to="/welcome" onClick={close}>
              Login
            </Link>
          </nav>
          <Link to={AUDIT} className="lv4-btn" onClick={close}>
            Free Audit starten
          </Link>
        </div>
      )}
    </>
  );
}
