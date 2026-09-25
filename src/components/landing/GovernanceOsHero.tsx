/**
 * Startseiten-Hero — Governance OS Handoff v2 (Cyan, kein Gold).
 *
 * Werte aus HANDOFF.md §1 (hifi): Europa-Nachtkarte rechts mit Perspektive,
 * Tiefenebene, Overlays; Nav mit DE/EN; Badge; H1 Newsreader 80px; Loop
 * DISCOVER → CLASSIFY → ENFORCE → PROVE; zwei CTAs.
 *
 * Vertrag mit test/landing/canonical-scan-entry.test.tsx und
 * test/landing/homepage-hero.test.tsx: genau ein `[data-hero-cta="audit"]`,
 * `<a id="audit-cta" href="/audit">`, Zweit-CTA mit HERO_DASHBOARD_CTA_LABEL.
 *
 * Die Karte ist das Handoff-Asset `public/europe-map-v2.png` (1052×1152) mit
 * WebP-Ableitung; beide Ebenen nutzen dieselbe Datei (ein Download).
 */
import { useEffect, useId, useState } from 'react';
import { preload } from 'react-dom';
import { Link } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';
import '../../styles/governance-os-handoff.css';
import { BrandWordmark } from '../handoff/BrandWordmark';
import { LangToggle } from '../handoff/LangToggle';
import { HANDOFF_NAV } from '../handoff/handoff-nav';
import { useLang } from '../../i18n/useLang';
import { HERO_DASHBOARD_CTA_LABEL } from '../governance-frontend/hero-content';

export const HERO_MAP_WEBP = '/europe-map-v2.webp';
export const HERO_MAP_PNG = '/europe-map-v2.png';

function MapPicture({ priority }: { priority: boolean }) {
  return (
    <picture>
      <source srcSet={HERO_MAP_WEBP} type="image/webp" />
      <img
        src={HERO_MAP_PNG}
        alt=""
        width={1052}
        height={1152}
        decoding="async"
        loading={priority ? 'eager' : 'lazy'}
        {...(priority ? { fetchPriority: 'high' as const } : {})}
      />
    </picture>
  );
}

export function GovernanceOsHero() {
  const { t, lang } = useLang();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();

  // LCP: das Hero-Bild so früh wie möglich anfordern. React 19 hebt den
  // Preload in den <head>; im Prerender-HTML steht er damit vor dem Bundle.
  preload(HERO_MAP_WEBP, { as: 'image', type: 'image/webp', fetchPriority: 'high' });

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const dashboardLabel = lang === 'de' ? HERO_DASHBOARD_CTA_LABEL : t('cta2');

  return (
    <section
      id="product"
      className="rs-ui rs-hero"
      aria-labelledby="hero-heading"
      data-hero-visual="europe-map-v2"
      lang={lang}
    >
      <div className="rs-hero__map" aria-hidden="true" data-testid="hero-map">
        <div className="rs-hero__map-layer rs-hero__map-depth">
          <MapPicture priority={false} />
        </div>
        <div className="rs-hero__map-layer rs-hero__map-main">
          <MapPicture priority />
        </div>
      </div>
      <div className="rs-hero__overlay rs-hero__glow" aria-hidden="true" />
      <div className="rs-hero__overlay rs-hero__fade-x" aria-hidden="true" />
      <div className="rs-hero__overlay rs-hero__vignette" aria-hidden="true" />
      <div className="rs-hero__overlay rs-hero__dots" aria-hidden="true" />

      <header className="rs-nav">
        <BrandWordmark />
        <nav className="rs-nav__links" aria-label={t('mainNav')}>
          {HANDOFF_NAV.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              className={`rs-nav__link${item.prominent ? ' rs-nav__link--key' : ''}`}
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>
        <div className="rs-nav__tools">
          <LangToggle />
          <Link to="/audit" className="rs-btn rs-btn--primary rs-btn--h40">
            {t('cta')}
          </Link>
        </div>
        <button
          type="button"
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
        <div id={menuId} className="rs-menu rs-ui" role="dialog" aria-modal="true" aria-label={t('mainNav')}>
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
            {HANDOFF_NAV.map((item) => (
              <Link
                key={item.key}
                to={item.to}
                className={`rs-menu__item${item.prominent ? ' rs-menu__item--key' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex items-center gap-3">
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
          <span className="rs-badge">
            <span className="rs-badge__dot" aria-hidden="true" />
            {t('heroBadge')}
          </span>

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
                {i > 0 && <ArrowRight size={14} aria-hidden="true" />}
                <span>{t(key)}</span>
              </li>
            ))}
          </ol>

          <div className="rs-hero__ctas" role="group" aria-label={t('heroActions')}>
            <Link
              id="audit-cta"
              data-hero-cta="audit"
              data-testid="hero-primary-cta"
              to="/audit"
              className="rs-btn rs-btn--primary rs-btn--h52"
            >
              {t('cta')}
              <ArrowRight size={18} aria-hidden="true" />
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

          <p className="rs-hero__trust">{t('trustLine')}</p>
        </div>
      </div>
    </section>
  );
}
