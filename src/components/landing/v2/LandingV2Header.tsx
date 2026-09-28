import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { LV2_BRAND } from './landing-v2-content';

export type Lv2Theme = 'dark' | 'light';

const NAV = [
  { label: 'Produkt', href: '#produkt' },
  { label: 'Evidence', href: '#evidence' },
  { label: 'Preise', href: '#preise' },
] as const;

interface ThemePillProps {
  theme: Lv2Theme;
  onChange: (next: Lv2Theme) => void;
}

function ThemePill({ theme, onChange }: ThemePillProps) {
  return (
    <div className="lv2-theme" role="group" aria-label="Farbschema">
      <button
        type="button"
        aria-label="Dunkel"
        aria-pressed={theme === 'dark'}
        onClick={() => onChange('dark')}
      >
        <Moon size="1em" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Hell"
        aria-pressed={theme === 'light'}
        onClick={() => onChange('light')}
      >
        <Sun size="1em" aria-hidden="true" />
      </button>
    </div>
  );
}

interface LandingV2HeaderProps {
  theme: Lv2Theme;
  onThemeChange: (next: Lv2Theme) => void;
}

/**
 * Header (absolut über dem Hero), Vollbild-Menü < 1000px und Sticky-CTA-Bar
 * ab `scrollY > 85vh`. Login führt auf die bestehende `/login`-Route.
 */
export function LandingV2Header({ theme, onThemeChange }: LandingV2HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sticky, setSticky] = useState(false);

  useEffect(() => {
    const onScroll = () => setSticky(window.scrollY > window.innerHeight * 0.85);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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

  const cta = (
    <Link to="/audit?source=landing-v2" className="lv2-btn lv2-btn--gold lv2-btn--pill" data-lv2-cta="audit">
      Free Audit starten
    </Link>
  );

  return (
    <>
      <header className="lv2-header">
        <div className="lv2__wrap lv2-header__row">
          <Link to="/" className="lv2-logo" aria-label={`${LV2_BRAND} – Startseite`}>
            {LV2_BRAND}
          </Link>
          <nav className="lv2-nav" aria-label="Hauptnavigation">
            {NAV.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
            <Link to="/login">Login</Link>
            <ThemePill theme={theme} onChange={onThemeChange} />
            {cta}
          </nav>
          <button
            type="button"
            className="lv2-burger"
            aria-label="Menü öffnen"
            aria-expanded={menuOpen}
            aria-controls="lv2-mobile-menu"
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={22} aria-hidden="true" />
          </button>
        </div>
      </header>

      {menuOpen && (
        <div id="lv2-mobile-menu" className="lv2-menu" role="dialog" aria-modal="true" aria-label="Menü">
          <div className="lv2-menu__top">
            <span className="lv2-logo">{LV2_BRAND}</span>
            <button
              type="button"
              className="lv2-burger"
              aria-label="Menü schließen"
              onClick={() => setMenuOpen(false)}
            >
              <X size={22} aria-hidden="true" />
            </button>
          </div>
          <nav aria-label="Mobile Navigation">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
                {item.label}
              </a>
            ))}
            <Link to="/login" onClick={() => setMenuOpen(false)}>
              Login
            </Link>
          </nav>
          <div className="lv2-menu__cta">
            <ThemePill theme={theme} onChange={onThemeChange} />
            {cta}
          </div>
        </div>
      )}

      <div className="lv2-sticky" data-visible={sticky} aria-hidden={!sticky}>
        <div className="lv2__wrap lv2-sticky__row">
          <a href="#top" className="lv2-logo">
            {LV2_BRAND}
          </a>
          <nav className="lv2-nav" aria-label="Sticky-Navigation">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} tabIndex={sticky ? 0 : -1}>
                {item.label}
              </a>
            ))}
            <Link to="/login" tabIndex={sticky ? 0 : -1}>
              Login
            </Link>
          </nav>
          <Link
            to="/audit?source=landing-v2-sticky"
            className="lv2-btn lv2-btn--gold lv2-btn--pill"
            tabIndex={sticky ? 0 : -1}
          >
            Free Audit starten
          </Link>
        </div>
      </div>
    </>
  );
}
