import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MascotStage } from '../../components/landing/products/MascotStage';
import { STAGE_VARIANT_BY_PRODUCT } from '../../components/landing/products/stageScenes';
import { ProductFooter, ProductNav } from '../../components/landing/products/ProductChrome';
import {
  PRODUCT_CONTENT, type ProductLandingKey, type ProductLink,
} from '../../components/landing/products/productContent';
import { statusLabel } from '../../components/landing/products/productLandingShared';
import { TAX_NOTE, planCards, pricingIntro } from '../../components/landing/v3/landingV3Data';
import { checkoutHrefForPlan, formatPriceEur, planById } from '@/shared/pricing';
import '../../styles/product-landing.css';

/**
 * Produkt-Landingpage nach der Vorlage von `/ki-bots` (Entwurf, 19.11.2026) für
 * Landingpage-Builder, App Builder, Governance OS und Claude Code Optimizer.
 *
 * Aufbau: Hero mit SYNC (3D), Produktversprechen, interaktiver Beispielablauf,
 * Anwendungsbeispiele, Einstieg, Preise mit ehrlichen Grenzen, Handlungsaufforderung,
 * Fragen, Footer mit Pflichtseiten. Inhalte aus productContent.ts, Status aus der
 * Registry, Preise aus shared/pricing.ts (planCards). Alle Seiten sind noindex.
 */

function Pill({ children }: { children: string }) {
  return <span className="pl-pill">{children}</span>;
}

/** Sprungmarken (`#…`) als Anker, alles andere über den Router. */
function ProductAction({ link, className, testId, heroCta }: {
  link: ProductLink;
  className: string;
  testId?: string;
  heroCta?: string;
}) {
  if (link.to.startsWith('#')) {
    return <a className={className} href={link.to} data-testid={testId} data-hero-cta={heroCta}>{link.label}</a>;
  }
  return <Link className={className} to={link.to} data-testid={testId} data-hero-cta={heroCta}>{link.label}</Link>;
}

export default function ProductLanding({ product }: { product: ProductLandingKey }) {
  const c = PRODUCT_CONTENT[product];
  const [shown, setShown] = useState(0);
  const [waveSignal, setWaveSignal] = useState(0);

  const steps = c.flow.steps;
  const done = shown >= steps.length;
  const activeStep = shown - 1;
  const plans = c.key === 'governance-os' ? [] : planCards(c.source);
  const governanceLaunch = c.key === 'governance-os' ? planById('governance_launch') : null;
  const status = c.status
    .map((s) => ({ label: s.label, value: statusLabel(s.registryId) }))
    .filter((s): s is { label: string; value: string } => s.value !== null);

  const nextStep = () => {
    if (shown === 0) setWaveSignal((n) => n + 1);
    setShown((n) => Math.min(n + 1, steps.length));
  };

  return (
    <div className="pl" data-product={c.key}>
      <a href="#ablauf" className="pl-skip">Zum Inhalt springen</a>

      <header className="pl-hero" id="top">
        <ProductNav current={c.key} />

        <div className="pl-hero-grid">
          <div className="pl-hero-copy">
            <span className="pl-eyebrow">{c.name} · {c.audience}</span>
            <h1 className="pl-h1" data-testid="product-heading">
              <span>{c.h1[0]}</span>
              <span className="pl-h1-2">{c.h1[1]}</span>
            </h1>
            <p className="pl-lead">{c.lead}</p>
            <div className="pl-actions">
              <ProductAction
                link={c.primary}
                className="pl-btn pl-btn--solid pl-btn--lg"
                testId="product-primary"
                heroCta={c.key}
              />
              <ProductAction link={c.secondary} className="pl-btn pl-btn--lg" testId="product-secondary" />
            </div>
            {status.length > 0 ? (
              <p className="pl-meta" data-testid="product-status">
                {status.map((s) => (
                  <span key={s.label}>{s.label} <Pill>{s.value}</Pill></span>
                ))}
              </p>
            ) : null}
          </div>
          <MascotStage
            tag={c.stageTag}
            caption={c.stageCaption}
            waveSignal={waveSignal}
            variant={STAGE_VARIANT_BY_PRODUCT[c.key]}
          />
        </div>
      </header>

      <main>
        <section className="pl-section" aria-labelledby="pl-promise-h">
          <span className="pl-eyebrow">Was Sie bekommen</span>
          <h2 id="pl-promise-h" className="pl-h2">{c.promiseTitle}</h2>
          <ol className="pl-promises">
            {c.promises.map((p, i) => (
              <li key={p.title}>
                <span className="pl-meta">{String(i + 1).padStart(2, '0')}</span>
                <strong>{p.title}</strong>
                <span>{p.body}</span>
              </li>
            ))}
          </ol>
        </section>

        <section id="ablauf" className="pl-section pl-split" aria-labelledby="pl-demo-h">
          <div className="pl-col">
            <span className="pl-eyebrow">{c.flow.eyebrow}</span>
            <h2 id="pl-demo-h" className="pl-h2">{c.flow.title}</h2>
            <p className="pl-text">{c.flow.text}</p>
            <ol className="pl-phases" data-testid="product-phases">
              {steps.map((s, i) => (
                <li key={s.title} data-active={i === activeStep} data-done={i < activeStep || (done && i === activeStep)}>
                  <span className="pl-meta">{String(i + 1).padStart(2, '0')}</span>
                  <span>{s.title}</span>
                </li>
              ))}
            </ol>
            <p className="pl-fine">{c.flow.fine}</p>
          </div>

          <div className="pl-chat" data-testid="product-demo" data-hero-cta={`${c.key}-demo`}>
            <div className="pl-chat-head">
              <span className="pl-meta">{c.flow.panelLabel}</span>
              <span className="pl-meta">{shown} / {steps.length}</span>
            </div>
            <ol className="pl-chat-log" aria-live="polite">
              {shown === 0 ? (
                <li className="pl-chat-empty">Noch kein Schritt. Starten Sie den Ablauf.</li>
              ) : (
                steps.slice(0, shown).flatMap((s, i) => [
                  <li key={`${s.title}-a`} className="pl-msg" data-speaker="empfang">
                    <span className="pl-meta">Schritt {i + 1} · {s.title}</span>
                    <span>{s.action}</span>
                  </li>,
                  <li key={`${s.title}-r`} className="pl-msg" data-speaker="system">
                    <span className="pl-meta">Ergebnis</span>
                    <span>{s.result}</span>
                  </li>,
                ])
              )}
            </ol>
            <div className="pl-actions">
              <button type="button" className="pl-btn pl-btn--solid" onClick={nextStep} disabled={done}>
                {shown === 0 ? 'Ablauf starten' : 'Nächster Schritt'}
              </button>
              <button type="button" className="pl-btn" onClick={() => setShown(0)} disabled={shown === 0}>
                Von vorn
              </button>
            </div>
          </div>
        </section>

        <section className="pl-section" aria-labelledby="pl-cases-h">
          <span className="pl-eyebrow">Anwendungsbeispiele</span>
          <h2 id="pl-cases-h" className="pl-h2">{c.casesTitle}</h2>
          <div className="pl-cards">
            {c.cases.map((x) => (
              <article key={x.trade} className="pl-card">
                <span className="pl-meta">{x.trade}</span>
                <p>{x.situation}</p>
                <p className="pl-card-result">{x.result}</p>
              </article>
            ))}
          </div>
          <p className="pl-fine">Beispiele zur Veranschaulichung, keine Kundenreferenzen.</p>
        </section>

        <section className="pl-section pl-split" aria-labelledby="pl-start-h">
          <div className="pl-col">
            <span className="pl-eyebrow">Einstieg</span>
            <h2 id="pl-start-h" className="pl-h2">In drei Schritten loslegen.</h2>
          </div>
          <ol className="pl-phases">
            {c.startSteps.map((s, i) => (
              <li key={s.title}>
                <span className="pl-meta">{String(i + 1).padStart(2, '0')}</span>
                <span><strong>{s.title}</strong> {s.body}</span>
              </li>
            ))}
          </ol>
        </section>

        <section id="preise" className="pl-section" aria-labelledby="pl-preise-h">
          <span className="pl-eyebrow">Preise und Verfügbarkeit</span>
          <h2 id="pl-preise-h" className="pl-h2">{c.pricingTitle}</h2>
          {c.key === 'governance-os' ? (
            <p className="pl-text">Einmalige Implementierung für einen Anwendungsfall. Preis und Berechtigungen kommen aus dem kanonischen Angebotsmodell.</p>
          ) : (
            <p className="pl-text">{pricingIntro()}</p>
          )}
          <div className="pl-plans">
            {governanceLaunch ? (
              <article className="pl-plan" data-featured="true" data-testid="product-plan-governance-launch">
                <Pill>Einmalig</Pill>
                <h3 className="pl-h3">{governanceLaunch.name}</h3>
                <p className="pl-price">
                  <strong>{governanceLaunch.price.oneTimeEur !== null ? formatPriceEur(governanceLaunch.price.oneTimeEur) : 'Preis auf Anfrage'}</strong>
                  <span> einmalig</span>
                </p>
                <p className="pl-plan-note">{governanceLaunch.outcomeHeadline}</p>
                <p className="pl-plan-channels">{governanceLaunch.technicalSubheadline}</p>
                <Link to={checkoutHrefForPlan(governanceLaunch, { source: c.source })} className="pl-btn pl-btn--solid">
                  {governanceLaunch.ctaLabel}
                </Link>
              </article>
            ) : null}
            {plans.map((p) => (
              <article key={p.id} className="pl-plan" data-featured={p.featured} data-testid={`product-plan-${p.id}`}>
                {p.badge ? <Pill>{p.badge}</Pill> : null}
                <h3 className="pl-h3">{p.name}</h3>
                <p className="pl-price">
                  <strong>{p.price}</strong>
                  {p.listPrice ? <s aria-label={`statt ${p.listPrice}`}>{p.listPrice}</s> : null}
                  <span>{p.unit}</span>
                </p>
                <p className="pl-plan-note">{p.note}</p>
                {p.desc ? <p className="pl-plan-channels">{p.desc}</p> : null}
                <Link to={p.href} className={p.featured ? 'pl-btn pl-btn--solid' : 'pl-btn'}>{p.cta}</Link>
              </article>
            ))}
          </div>
          <p className="pl-fine" data-testid="product-limits">{c.limits}</p>
          <p className="pl-fine" data-testid="product-tax-note">
            {TAX_NOTE} Verbindlich sind Preise und Leistungen auf <Link to="/pricing">der Preisseite</Link>.
          </p>
        </section>

        <section className="pl-section pl-cta" aria-labelledby="pl-cta-h">
          <h2 id="pl-cta-h" className="pl-h2 pl-h2--xl">{c.cta.title}</h2>
          <p className="pl-text">{c.cta.text}</p>
          <div className="pl-actions">
            <ProductAction link={c.cta.primary} className="pl-btn pl-btn--solid pl-btn--lg" testId="product-cta-primary" />
            <ProductAction link={c.cta.secondary} className="pl-btn pl-btn--lg" testId="product-cta-secondary" />
          </div>
        </section>

        <section className="pl-section pl-split" aria-labelledby="pl-fragen-h">
          <div className="pl-col">
            <span className="pl-eyebrow">Häufige Fragen</span>
            <h2 id="pl-fragen-h" className="pl-h2">Kurz beantwortet.</h2>
          </div>
          <div className="pl-faq">
            {c.faqs.map((f) => (
              <details key={f.q}>
                <summary>{f.q}<span aria-hidden="true">+</span></summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <ProductFooter />
    </div>
  );
}
