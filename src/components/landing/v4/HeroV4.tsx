import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { LV4_H1_GOLD, LV4_H1_LINES, LV4_PIPELINE, LV4_SUBLINE } from './landing-v4-content';

const SOURCE = 'landing-v4-hero';

/**
 * Hero v4 — Serif-H1 mit goldenem „for Europe“, Betriebsschleife
 * Discover → Classify → Enforce → Prove und die Erde (vorhandene
 * Europa-Nachtaufnahme `/europe-globe.*`) rechts im Bild.
 */
export function HeroV4() {
  return (
    <section id="top" className="lv4-hero" aria-labelledby="lv4-hero-title">
      <div className="lv4-hero__space" aria-hidden="true">
        <picture>
          <source srcSet="/europe-globe.webp" type="image/webp" />
          <img
            src="/europe-globe.jpg"
            alt=""
            width={1920}
            height={1080}
            decoding="async"
            fetchPriority="high"
          />
        </picture>
      </div>

      <div className="lv2__wrap lv4-hero__inner">
        <h1 id="lv4-hero-title" className="lv4-hero__h1">
          {LV4_H1_LINES.map((line) => (
            <span key={line} className="lv4-hero__line">
              {line}{' '}
            </span>
          ))}
          <span className="lv4-hero__line is-gold">{LV4_H1_GOLD}</span>
        </h1>

        <ol className="lv4-pipeline" aria-label="Betriebsschleife">
          {LV4_PIPELINE.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        <p className="lv4-hero__sub">
          {LV4_SUBLINE.map((line) => (
            <span key={line}>{line} </span>
          ))}
        </p>

        <div className="lv4-hero__cta" role="group" aria-label="Hero-Aktionen">
          <Link
            to={`/audit?source=${SOURCE}`}
            className="lv4-btn lv4-btn--lg"
            data-hero-cta="audit"
            data-testid="hero-primary-cta"
          >
            Free Audit starten <ArrowRight size="0.9em" aria-hidden="true" />
          </Link>
          <Link
            to="/demo-tour/dashboard"
            className="lv4-btn lv4-btn--lg lv4-btn--ghost"
            data-hero-cta="dashboard"
            data-testid="hero-secondary-cta"
          >
            Live Dashboard ansehen
          </Link>
        </div>
      </div>
    </section>
  );
}
