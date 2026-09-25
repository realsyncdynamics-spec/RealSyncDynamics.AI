/**
 * Startseiten-Hero — Europe screenshot reference, 2026-09-25.
 * The background is an image; all copy, navigation and actions remain HTML.
 *
 * Vertrag mit test/landing/canonical-scan-entry.test.tsx und
 * test/landing/homepage-hero.test.tsx: genau ein `[data-hero-cta="audit"]`,
 * `<a id="audit-cta" href="/audit">`, Zweit-CTA mit HERO_DASHBOARD_CTA_LABEL.
 *
 * The existing app, audit funnel and handoff styles keep their own contracts.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { preload } from 'react-dom';
import { Link } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';
import '../../styles/governance-os-handoff.css';
import './governance-reference-hero.css';
import { BrandWordmark } from '../handoff/BrandWordmark';
import { LangToggle } from '../handoff/LangToggle';
import { useLang } from '../../i18n/useLang';
import { EUROPE_REFERENCE_HERO, HERO_DASHBOARD_CTA_LABEL } from '../governance-frontend/hero-content';

export const HERO_MAP_WEBP = '/europe-reference-hero.webp';
export const HERO_MAP_JPG = '/europe-reference-hero.jpg';

function MapPicture() {
  return (
    <picture>
      <source srcSet={HERO_MAP_WEBP} type="image/webp" />
      <img
        src={HERO_MAP_JPG}
        alt=""
        width={1529}
        height={1029}
        decoding="async"
        loading="eager"
        fetchPriority="high"
      />
    </picture>
  );
}

function ReferenceNav({ lang, onNavigate }: { lang: 'de' | 'en'; onNavigate?: () => void }) {
  return EUROPE_REFERENCE_HERO.navigation.map((item) =>
    item.to.startsWith('#') ? (
      <a key={item.to} href={item.to} className="rs-nav__link" onClick={onNavigate}>
        {item.label[lang]}
      </a>
    ) : (
      <Link key={item.to} to={item.to} className="rs-nav__link" onClick={onNavigate}>
        {item.label[lang]}
      </Link>
    ),
  );
}

export function GovernanceOsHero({ modeSwitch }: { modeSwitch?: ReactNode } = {}) {
  const { t, lang } = useLang();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  // LCP: das Hero-Bild so früh wie möglich anfordern. React 19 hebt den
  // Preload in den <head>; im Prerender-HTML steht er damit vor dem Bundle.
  preload(HERO_MAP_WEBP, { as: 'image', type: 'image/webp', fetchPriority: 'high' });

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
      if (event.key !== 'Tab') return;
      const elements = menuRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
      if (!elements?.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
      menuTriggerRef.current?.focus({ preventScroll: true });
    };
  }, [menuOpen]);

  const dashboardLabel = lang === 'de' ? HERO_DASHBOARD_CTA_LABEL : t('cta2');

  return (
    <section
      id="product"
      className="rs-ui rs-hero rs-hero--reference"
      aria-labelledby="hero-heading"
      data-hero-visual="europe-reference"
      lang={lang}
    >
      <div className="rs-hero__map" aria-hidden="true" data-testid="hero-map">
        <MapPicture />
      </div>

      <header className="rs-nav">
        <BrandWordmark />
        <nav className="rs-nav__links" aria-label={t('mainNav')}>
          <ReferenceNav lang={lang} />
          {modeSwitch}
        </nav>
        <div className="rs-nav__tools">
          {modeSwitch}
          <Link to="/audit" className="rs-btn rs-btn--primary rs-btn--h40">
            {t('cta')}
          </Link>
        </div>
        <button
          type="button"
          ref={menuTriggerRef}
          className="rs-nav__burger"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          aria-label={menuOpen ? t('menuClose') : t('menuOpen')}
          onClick={() => setMenuOpen(true)}
        >
          <Menu size={20} aria-hidden="true" />
        </button>
      </header>

      {menuOpen && (
        <div ref={menuRef} id={menuId} className="rs-menu rs-ui" role="dialog" aria-modal="true" aria-label={t('mainNav')}>
          <div className="rs-menu__head">
            <BrandWordmark />
            <button
              type="button"
              className="rs-nav__burger"
              style={{ marginLeft: 0 }}
              aria-label={t('menuClose')}
              onClick={() => setMenuOpen(false)}
              autoFocus
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <nav className="flex flex-col gap-2" aria-label={t('mainNav')}>
            <ReferenceNav lang={lang} onNavigate={() => setMenuOpen(false)} />
            {modeSwitch}
          </nav>
          <div className="mt-4 flex items-center gap-3">
            {modeSwitch}
            <LangToggle />
          </div>
          <Link
            to="/audit"
            className="rs-btn rs-btn--primary rs-btn--h52 mt-4 w-full"
            onClick={() => setMenuOpen(false)}
          >
            {t('cta')}
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      )}

      <div className="rs-hero__body">
        <div className="rs-hero__content">
          <h1 id="hero-heading" className="rs-hero__h1">
            <span className="rs-hero__h1-line">{t('heroA')}</span>
            <span className="rs-hero__h1-line">
              <span className="rs-hero__h1-nowrap">{t('heroB')}</span>{' '}
              <span className="rs-hero__h1-accent">{t('heroC')}</span>
            </span>
          </h1>

          <ol className="rs-loop" aria-label="DISCOVER → CLASSIFY → ENFORCE → PROVE">
            {(['loopDiscover', 'loopClassify', 'loopEnforce', 'loopProve'] as const).map((key, i) => (
              <li key={key}>
                {i > 0 && <ArrowRight size={20} aria-hidden="true" />}
                <span>{t(key)}</span>
              </li>
            ))}
          </ol>

          <p className="rs-hero__description" lang="en">
            {EUROPE_REFERENCE_HERO.description.map((line) => <span key={line}>{line}</span>)}
          </p>

          <div className="rs-hero__ctas" role="group" aria-label={t('heroActions')}>
            <Link
              id="audit-cta"
              data-hero-cta="audit"
              data-testid="hero-primary-cta"
              to="/audit"
              className="rs-btn rs-btn--primary rs-btn--h52"
            >
              {t('cta')}
              <ArrowRight size={26} aria-hidden="true" />
            </Link>
            <Link
              data-hero-cta="dashboard"
              data-testid="hero-secondary-cta"
              to="/app/dashboard"
              className="rs-btn rs-btn--glass rs-btn--h52"
            >
              {dashboardLabel}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
