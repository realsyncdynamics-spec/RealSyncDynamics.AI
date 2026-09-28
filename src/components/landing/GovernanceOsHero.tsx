/**
 * Startseiten-Hero — Governance OS Handoff v2 (Cyan, kein Gold).
 *
 * Werte aus HANDOFF.md §1 (hifi): Europa-Nachtkarte rechts mit Perspektive,
 * Tiefenebene, Overlays; Nav mit DE/EN; H1 Newsreader 80px; Loop
 * DISCOVER → ASSESS → GOVERN → EXECUTE → VERIFY → PROVE; zwei CTAs.
 *
 * Governance-OS-Positionierung: Kategorie-Eyebrow statt Normen-Badge, H1
 * „Die Kontrollschicht für KI im Unternehmen." (Entscheidung E-F3, Copy in
 * `src/i18n/handoff.ts`), Loop über alle sechs Stufen. Erst-CTA → Scan
 * (`PUBLIC_CTA.to` = `/audit`), Zweit-CTA → Enterprise-Anfrage
 * (`/contact-sales`, Label aus der CTA-SSoT), Architektur als Textlink. Die Systemzeile nennt nur
 * Belegtes (Supabase eu-central-1, Hash-Kette, PDP). Vertrag:
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
import { PUBLIC_CTA } from '../../config/public-nav';
import { HERO_FREE_SCAN_CTA_LABEL } from '../governance-frontend/hero-content';

export const HERO_MAP_WEBP = '/europe-map-v2.webp';
export const HERO_MAP_PNG = '/europe-map-v2.png';

/** Bestehender Enterprise-Einstieg — Ziel unverändert. */
const HERO_ENTERPRISE_LINK = '/contact-sales?tier=enterprise&source=home-hero';

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
        { label: 'Plattform', to: '/#system', prominent: true },
        { label: 'Pipeline', to: '/#pipeline', prominent: false },
        { label: 'Architektur', to: '/#architecture', prominent: false },
        { label: 'Governance', to: '/governance-runtime', prominent: false },
        { label: 'Preise', to: '/#pricing', prominent: true },
        { label: 'Login', to: '/login', prominent: false },
      ]
    : [
        { label: 'Platform', to: '/#system', prominent: true },
        { label: 'Pipeline', to: '/#pipeline', prominent: false },
        { label: 'Architecture', to: '/#architecture', prominent: false },
        { label: 'Governance', to: '/governance-runtime', prominent: false },
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
          <a href="#pipeline" className="rs-btn rs-btn--primary rs-btn--h40">
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
            href="#pipeline"
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
          <p className="rs-hero__eyebrow">{t('heroEyebrow')}</p>

          {/* Systemzeile: nur belegte Fakten (Supabase-Region, Hash-Kette,
              Policy Decision Point) — technische Bezeichner, daher unübersetzt. */}
          <dl className="rs-hero__status" data-testid="hero-status">
            {([
              ['SYSTEM', 'GOVERNANCE OS'],
              ['REGION', 'EU-CENTRAL-1 · FRANKFURT'],
              ['EVIDENCE', 'SHA-256 HASH-CHAIN'],
              ['POLICY', 'DECISION POINT'],
            ] as const).map(([key, value], i) => (
              <div key={key} className="rs-hero__status-cell">
                <dt className="rs-hero__status-key">{key}</dt>
                <dd className="rs-hero__status-val">
                  {i === 0 && <span className="rs-hero__status-dot" aria-hidden="true" />}
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          {/* Das Leerzeichen zwischen den Zeilen rendert nicht (beide Spans sind
              `display: block`), hält aber `textContent` als lesbaren Satz —
              darauf greifen FE-001 und der Hero-Vertrag zu. */}
          <h1 id="hero-heading" className="rs-hero__h1">
            <span className="rs-hero__h1-line">{t('heroA')}</span>{' '}
            <span className="rs-hero__h1-line">
              <span className="rs-hero__h1-nowrap">{t('heroB')}</span>{' '}
              <span className="rs-hero__h1-accent">{t('heroC')}</span>
            </span>
          </h1>

          <p className="rs-hero__subline">
            {t('sub1')} {t('sub2')}
          </p>

          <ol className="rs-loop" aria-label="DISCOVER → ASSESS → GOVERN → EXECUTE → VERIFY → PROVE">
            {(['loopDiscover', 'loopAssess', 'loopGovern', 'loopExecute', 'loopVerify', 'loopProve'] as const).map((key, i) => (
              <li key={key}>
                {i > 0 && <ArrowRight size={14} aria-hidden="true" />}
                <span>{t(key)}</span>
              </li>
            ))}
          </ol>

          <div className="rs-hero__ctas" role="group" aria-label={t('heroActions')}>
            <Link
              id="scan-cta"
              data-hero-cta="audit"
              data-testid="hero-primary-cta"
              to={PUBLIC_CTA.to}
              className="rs-btn rs-btn--primary rs-btn--h52"
            >
              {HERO_FREE_SCAN_CTA_LABEL[lang] ?? HERO_FREE_SCAN_CTA_LABEL.de}
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link
              data-hero-cta="enterprise"
              data-testid="hero-secondary-cta"
              to={HERO_ENTERPRISE_LINK}
              className="rs-btn rs-btn--glass rs-btn--h52"
            >
              {/* CTA-SSoT: einzige kontaktbasierte CTA (runtimeVocab.CTA.enterprise). */}
              {t('ctaEnterprise')}
            </Link>
          </div>

          {/* Der Architektur-Einstieg bleibt erreichbar, jetzt als Textlink —
              die Buttonplätze tragen Scan und Enterprise. */}
          <a
            href="#architecture"
            className="rs-hero__enterprise"
            data-testid="hero-architecture-link"
          >
            {t('ctaExplore')}
            <ArrowRight size={14} aria-hidden="true" />
          </a>

          <p className="rs-hero__trust">{t('trustLine')}</p>
        </div>
      </div>
    </section>
  );
}
