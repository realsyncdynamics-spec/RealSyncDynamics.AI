import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { checkoutHrefForPlan, formatPriceEur, planById } from '@/shared/pricing';
import { useLang } from '../../../i18n/useLang';
import { BETA, betaSignupHref } from '../../../config/beta';
import { LV2_STACK } from '../v2/landing-v2-content';
import { V5_COPY } from './landing-v5-content';

const SOURCE = 'landing-v5-hero';

/**
 * Landing v5 — Hero.
 *
 * Design, Buttons und Flows aus Landing v2 (Gold-Primär „Free Audit“,
 * Tarif-Kacheln, Enterprise), Texte aus der Live-Landing v4
 * (i18n-Schlüssel `v4Hero*` — eine Textquelle, keine Kopie).
 * Hintergrund: echte three.js-Szene (`heroEuropeNetwork3D.ts`, lazy);
 * Vordergrund: Zeiger-gesteuerte 3D-Neigung der Inhaltsebenen.
 *
 * Beta (src/config/beta.ts): Tarif-Kacheln führen nicht in den Checkout,
 * sondern in die kostenlose Beta-Registrierung.
 */
export function HeroV5() {
  const { t, lang } = useLang();
  const c = V5_COPY[lang];
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [webgl, setWebgl] = useState<'pending' | 'on' | 'off'>('pending');
  const [url, setUrl] = useState('');

  // 3D-Szene nach dem ersten Paint (eigener Chunk). Prerender/Automation: statisch.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || navigator.webdriver) {
      setWebgl('off');
      return;
    }
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) {
      setWebgl('off');
      return;
    }
    let unmount: (() => void) | undefined;
    let cancelled = false;
    import('./heroEuropeNetwork3D')
      .then(({ mountHeroEurope }) => {
        if (cancelled) return;
        unmount = mountHeroEurope({ canvas, visibilityTarget: sectionRef.current });
        setWebgl('on');
      })
      .catch(() => setWebgl('off'));
    return () => {
      cancelled = true;
      unmount?.();
    };
  }, []);

  // 3D-Neigung der Inhaltsebenen (nur Hover-Geräte, nicht bei Reduced Motion).
  useEffect(() => {
    const stage = stageRef.current;
    const section = sectionRef.current;
    if (!stage || !section) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !matchMedia('(hover: hover)').matches) return;
    let raf = 0;
    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };
    const tick = () => {
      cur.x += (target.x - cur.x) * 0.08;
      cur.y += (target.y - cur.y) * 0.08;
      stage.style.setProperty('--rx', `${(-cur.y * 4).toFixed(2)}deg`);
      stage.style.setProperty('--ry', `${(cur.x * 6).toFixed(2)}deg`);
      stage.style.setProperty('--px', cur.x.toFixed(3));
      stage.style.setProperty('--py', cur.y.toFixed(3));
      raf = Math.abs(target.x - cur.x) + Math.abs(target.y - cur.y) > 0.001 ? requestAnimationFrame(tick) : 0;
    };
    const onMove = (e: PointerEvent) => {
      const r = section.getBoundingClientRect();
      target.x = (e.clientX - r.left) / r.width - 0.5;
      target.y = (e.clientY - r.top) / r.height - 0.5;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onLeave = () => {
      target.x = 0;
      target.y = 0;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    section.addEventListener('pointermove', onMove);
    section.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      section.removeEventListener('pointermove', onMove);
      section.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  const onScan = (e: FormEvent) => {
    e.preventDefault();
    const u = url.trim();
    navigate(`/audit?source=${SOURCE}` + (u ? '&url=' + encodeURIComponent(u) : ''));
  };

  const tiers = (['starter', 'growth', 'agency'] as const).map((id) => planById(id));
  const loop = [t('v4HeroLoop1'), t('v4HeroLoop2'), t('v4HeroLoop3'), t('v4HeroLoop4')];

  return (
    <section ref={sectionRef} id="top" className="lv2-hero v5-hero" aria-labelledby="v5-hero-title" data-webgl={webgl}>
      <div className="v5-hero__scene" aria-hidden="true">
        <img className="v5-hero__fallback" src="/europe-map-v2.webp" alt="" loading="eager" decoding="async" fetchPriority="high" />
        <canvas ref={canvasRef} className="v5-hero__canvas" />
        <div className="v5-hero__vignette" />
      </div>

      <div ref={stageRef} className="lv2__wrap lv2-hero__inner v5-stage">
        {BETA.active && (
          <Link to={betaSignupHref(BETA.testPlan, `${SOURCE}-badge`)} className="v5-beta-pill v5-layer" style={{ ['--z' as string]: '60px' }}>
            <b>{BETA.badge}</b> {BETA.headline} <span aria-hidden="true">→</span>
          </Link>
        )}

        <h1 id="v5-hero-title" className="lv2-hero__h1 v5-layer" style={{ ['--z' as string]: '40px' }} data-testid="v4-hero-heading">
          <span className="is-silver">
            {t('v4HeroTitleA')}
            <br />
            {t('v4HeroTitleB')}{' '}
          </span>
          <span className="is-gold">{t('v4HeroTitleEm')}</span>
        </h1>

        <ol className="lv2-pipeline v5-layer" style={{ ['--z' as string]: '30px' }} aria-label="Ablauf">
          {loop.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        <p className="v5-lede v5-layer" style={{ ['--z' as string]: '24px' }} data-testid="v4-hero-lede">
          {c.lede}
        </p>

        <ul className="lv2-stack v5-layer" style={{ ['--z' as string]: '14px' }} aria-label="Infrastruktur">
          {LV2_STACK.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <div className="lv2-hero__cta v5-cta v5-layer" style={{ ['--z' as string]: '70px' }} role="group" aria-label="Hero-Aktionen">
          <Link to={`/audit?source=${SOURCE}`} className="lv2-btn lv2-btn--gold v5-btn3d" data-hero-cta="audit" data-testid="hero-primary-cta">
            {t('v4HeroPrimaryCta')}
          </Link>
          {tiers.map((plan) => {
            const href = BETA.active ? betaSignupHref(plan.id, SOURCE) : checkoutHrefForPlan(plan, { source: SOURCE });
            return (
              <Link
                key={plan.id}
                to={href}
                className={`lv2-btn lv2-btn--glass v5-btn3d v5-tier${plan.highlight ? ' lv2-btn--featured' : ''}`}
                data-hero-cta={`plan-${plan.id}`}
              >
                {plan.name}
                {BETA.active ? (
                  <strong>
                    <s>{formatPriceEur(plan.price.monthlyEur)}</s> 0 €
                  </strong>
                ) : (
                  <strong>{formatPriceEur(plan.price.monthlyEur)}</strong>
                )}
              </Link>
            );
          })}
          <Link
            to={`/contact-sales?tier=enterprise&source=${SOURCE}`}
            className="lv2-btn lv2-btn--glass lv2-btn--enterprise v5-btn3d"
            data-hero-cta="enterprise"
            data-testid="hero-secondary-cta"
          >
            {c.enterprise}
          </Link>
        </div>

        <form className="v5-scan v5-layer" style={{ ['--z' as string]: '50px' }} onSubmit={onScan}>
          <input
            type="url"
            inputMode="url"
            placeholder={c.scanPlaceholder}
            aria-label={c.scanLabel}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button type="submit" className="lv2-btn lv2-btn--gold">
            {c.scanButton}
          </button>
        </form>

        <p className="lv2-hero__note v5-layer" style={{ ['--z' as string]: '10px' }}>
          {BETA.active
            ? `${c.note} · Beta bis ${BETA.endsLabel}`
            : c.note}
        </p>
        <Link to="/governance-runtime" className="v5-secondary v5-layer" style={{ ['--z' as string]: '10px' }}>
          {t('v4HeroSecondaryCta')} →
        </Link>
      </div>
    </section>
  );
}
