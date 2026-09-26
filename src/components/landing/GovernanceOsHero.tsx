/**
 * Startseiten-Hero — Governance OS Handoff v2 (Cyan, kein Gold).
 *
 * Werte aus HANDOFF.md §1 (hifi): Europa-Nachtkarte rechts mit Perspektive,
 * Tiefenebene, Overlays; Nav mit DE/EN; H1 Newsreader 80px; Loop
 * DISCOVER → ASSESS → GOVERN → PROVE; zwei CTAs.
 *
 * Positionierung 2026-09-26: Einstieg über das Kontrollproblem (Hook statt
 * Normen-Badge). Der Erst-CTA führt in den Governance-Check auf derselben
 * Seite (`#governance-check`), der Zweit-CTA ins Governance-Modell. Vertrag:
 * test/landing/homepage-hero.test.tsx.
 *
 * Die Karte ist das Handoff-Asset `public/europe-map-v2.png` (1052×1152) mit
 * WebP-Ableitung; beide Ebenen nutzen dieselbe Datei (ein Download).
 */
import { type ReactNode, useEffect, useId, useState } from 'react';
import { preload } from 'react-dom';
import { Link } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';
import '../../styles/governance-os-handoff.css';
import { BrandWordmark } from '../handoff/BrandWordmark';
import { LangToggle } from '../handoff/LangToggle';
import { useLang } from '../../i18n/useLang';

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

/**
 * Anker auf `/` (`/#pricing`) als echtes `<a>`: react-router scrollt bei
 * `<Link to="/#…">` auf derselben Seite nicht zum Ziel, der Browser schon.
 */
function NavItem({ to, className, onClick, children }: {
  to: string;
  className: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  if (to.startsWith('/#')) {
    return <a href={to} className={className} onClick={onClick}>{children}</a>;
  }
  return <Link to={to} className={className} onClick={onClick}>{children}</Link>;
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

  const landingNav = lang === 'de'
    ? [
        { label: 'Plattform', to: '/#governance-model', prominent: true },
        { label: 'Agenten', to: '/#agent-governance', prominent: false },
        { label: 'Governance', to: '/governance-runtime', prominent: false },
        { label: 'Evidence', to: '/#evidence', prominent: false },
        { label: 'Preise', to: '/#pricing', prominent: true },
        { label: 'Login', to: '/login', prominent: false },
      ]
    : [
        { label: 'Platform', to: '/#governance-model', prominent: true },
        { label: 'Agents', to: '/#agent-governance', prominent: false },
        { label: 'Governance', to: '/governance-runtime', prominent: false },
        { label: 'Evidence', to: '/#evidence', prominent: false },
        { label: 'Pricing', to: '/#pricing', prominent: true },
        { label: 'Login', to: '/login', prominent: false },
      ];

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
          {landingNav.map((item) => (
            <NavItem
              key={item.to}
              to={item.to}
              className={`rs-nav__link${item.prominent ? ' rs-nav__link--key' : ''}`}
            >
              {item.label}
            </NavItem>
          ))}
        </nav>
        <div className="rs-nav__tools">
          <LangToggle />
          <a href="#governance-check" className="rs-btn rs-btn--primary rs-btn--h40">
            {t('cta')}
          </a>
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
            {landingNav.map((item) => (
              <NavItem
                key={item.to}
                to={item.to}
                className={`rs-menu__item${item.prominent ? ' rs-menu__item--key' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </NavItem>
            ))}
          </nav>
          <div className="mt-4 flex items-center gap-3">
            <LangToggle />
          </div>
          <a
            href="#governance-check"
            className="rs-btn rs-btn--primary rs-btn--h52 mt-4 w-full"
            onClick={() => setMenuOpen(false)}
          >
            {t('cta')}
            <ArrowRight size={18} aria-hidden="true" />
          </a>
        </div>
      )}

      <div className="rs-hero__body">
        <div className="rs-hero__content">
          <p className="rs-hero__hook">
            <span>{t('heroHookA')}</span>{' '}
            <span>{t('heroHookB')}</span>{' '}
            <strong>{t('heroHookC')}</strong>
          </p>

          <h1 id="hero-heading" className="rs-hero__h1">
            <span className="rs-hero__h1-line">{t('heroA')}</span>
            <span className="rs-hero__h1-line">
              <span className="rs-hero__h1-nowrap">{t('heroB')}</span>{' '}
              <span className="rs-hero__h1-accent">{t('heroC')}</span>
            </span>
          </h1>

          <p className="rs-hero__subline">
            {t('sub1')} {t('sub2')}
          </p>

          <ol className="rs-loop" aria-label="DISCOVER → ASSESS → GOVERN → PROVE">
            {(['loopDiscover', 'loopAssess', 'loopGovern', 'loopProve'] as const).map((key, i) => (
              <li key={key}>
                {i > 0 && <ArrowRight size={14} aria-hidden="true" />}
                <span>{t(key)}</span>
              </li>
            ))}
          </ol>

          <div className="rs-hero__ctas" role="group" aria-label={t('heroActions')}>
            <a
              id="check-cta"
              data-hero-cta="check"
              data-testid="hero-primary-cta"
              href="#governance-check"
              className="rs-btn rs-btn--primary rs-btn--h52"
            >
              {t('cta')}
              <ArrowRight size={18} aria-hidden="true" />
            </a>
            <a
              data-hero-cta="explore"
              data-testid="hero-secondary-cta"
              href="#governance-model"
              className="rs-btn rs-btn--glass rs-btn--h52"
            >
              {t('ctaExplore')}
            </a>
          </div>

          <p className="rs-hero__trust">{t('trustLine')}</p>
        </div>
      </div>
    </section>
  );
}
