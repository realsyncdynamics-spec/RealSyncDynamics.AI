import { Link } from 'react-router-dom';
import {
  PRICING_TAX_NOTE,
  checkoutHrefForPlan,
  monthlyPriceText,
  planById,
  type Plan,
  type PlanId,
} from '@/shared/pricing';
import { getImplementation } from '../../../product/implementation-status';
import { PUBLIC_STATUS_LABEL } from '../../../product/implementation-status-public';
import { SEOHead } from '../../SEOHead';
import { PRODUCT_LANDINGS, productLandingPath } from './content';
import type { LandingCard, LandingSection, PlanCell, ProductLandingContent } from './types';
import '../../../styles/product-landing.css';

/** Pakete der Tabelle, in der Reihenfolge der Abo-Leiter. Preise kommen aus `shared/pricing.ts`. */
const TABLE_PLAN_IDS: readonly PlanId[] = ['free', 'starter', 'growth', 'agency', 'enterprise'];

/** Status-Label ausschließlich aus der Registry; ohne Eintrag kein Label. */
function statusLabel(statusId: string | undefined): string | null {
  if (!statusId) return null;
  const item = getImplementation(statusId);
  return item ? PUBLIC_STATUS_LABEL.de[item.status] : null;
}

function StatusBadge({ statusId }: { statusId?: string }) {
  const label = statusLabel(statusId);
  return label ? <span className="pl-badge">{label}</span> : null;
}

function Cell({ value }: { value: PlanCell }) {
  if (value === true) return <span className="pl-yes" aria-label="enthalten">✓</span>;
  if (value === false) return <span className="pl-no" aria-label="nicht enthalten">–</span>;
  return <>{value}</>;
}

function Card({ card, step }: { card: LandingCard; step?: number }) {
  return (
    <>
      {step !== undefined && <span className="pl-step" aria-hidden="true">{step}</span>}
      <StatusBadge statusId={card.statusId} />
      <h3>{card.title}</h3>
      <p>{card.text}</p>
      {card.to && card.toLabel && (
        <Link className="pl-cardlink" to={card.to}>
          {card.toLabel} →
        </Link>
      )}
    </>
  );
}

function Section({ section }: { section: LandingSection }) {
  return (
    <section id={section.id} className="pl-section" aria-labelledby={`pl-${section.id}`}>
      <div className="pl-head">
        <span className="pl-eyebrow">{section.eyebrow}</span>
        <h2 id={`pl-${section.id}`}>{section.title}</h2>
        {section.intro && <p>{section.intro}</p>}
      </div>
      {section.kind === 'list' && (
        <ul className="pl-list">
          {(section.list ?? []).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {section.kind === 'cards' && (
        <div className="pl-grid">
          {(section.cards ?? []).map((card) => (
            <article key={card.title} className="pl-card">
              <Card card={card} />
            </article>
          ))}
        </div>
      )}
      {section.kind === 'steps' && (
        <ol className="pl-grid pl-steps">
          {(section.cards ?? []).map((card, index) => (
            <li key={card.title} className="pl-card">
              <Card card={card} step={index + 1} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function PlanTable({ content, plans }: { content: ProductLandingContent; plans: Plan[] }) {
  return (
    <section id="pakete" className="pl-section" aria-labelledby="pl-pakete">
      <div className="pl-head">
        <span className="pl-eyebrow">Pakete</span>
        <h2 id="pl-pakete">{content.planIntro}</h2>
      </div>
      <div className="pl-tablewrap">
        <table className="pl-table">
          <thead>
            <tr>
              <th scope="col">Leistung</th>
              {plans.map((plan) => (
                <th key={plan.id} scope="col">
                  <span className="pl-planname">{plan.name}</span>
                  <span className="pl-planprice">
                    {plan.priceOnRequest ? 'Auf Anfrage' : monthlyPriceText(plan)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {content.planRows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {plans.map((plan) => (
                  <td key={plan.id}>
                    <Cell value={row.value(plan)} />
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row">Paket wählen</th>
              {plans.map((plan) => (
                <td key={plan.id}>
                  <Link
                    className="pl-btn pl-btn-ghost"
                    to={checkoutHrefForPlan(plan, { source: `produkt-${content.slug}` })}
                    aria-label={`${plan.ctaLabel}: ${plan.name}`}
                  >
                    {plan.ctaLabel}
                  </Link>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="pl-note">
        {PRICING_TAX_NOTE} Verbindlich sind Preise und Leistungen auf der{' '}
        <Link to="/pricing">Preisseite</Link>.
      </p>
    </section>
  );
}

/**
 * Gemeinsame Produkt-Landing unter `/produkte/:slug`.
 *
 * Inhalte: `./content/*`. Preise, Limits und Checkout-Ziele aus `shared/pricing.ts`,
 * Status-Labels aus `src/product/implementation-status.ts`. Keine Zahl im Markup.
 */
export function ProductLanding({ content }: { content: ProductLandingContent }) {
  const plans = TABLE_PLAN_IDS.map((id) => planById(id));

  return (
    <div className="pl">
      <SEOHead
        title={content.seoTitle}
        description={content.seoDescription}
        canonical={productLandingPath(content.slug)}
        noIndex
      />
      <a className="pl-skip" href="#inhalt">
        Zum Inhalt springen
      </a>
      <header className="pl-top">
        <Link className="pl-logo" to="/">
          RealSync Dynamics AI
        </Link>
        <nav aria-label="Produkte" className="pl-nav">
          {PRODUCT_LANDINGS.map((product) => (
            <Link
              key={product.slug}
              to={productLandingPath(product.slug)}
              aria-current={product.slug === content.slug ? 'page' : undefined}
            >
              {product.seoTitle.split(' – ')[0]}
            </Link>
          ))}
          <Link to="/pricing">Preise</Link>
          <Link to="/welcome">Anmelden</Link>
        </nav>
      </header>

      <main id="inhalt">
        <section className="pl-hero" aria-labelledby="pl-h1">
          <div className="pl-herotext">
            <span className="pl-eyebrow">
              {content.eyebrow} <StatusBadge statusId={content.statusId} />
            </span>
            <h1 id="pl-h1">
              {content.headline} <span>{content.headlineSub}</span>
            </h1>
            <p className="pl-lead">{content.lead}</p>
            <div className="pl-actions">
              <Link className="pl-btn pl-btn-primary" to={content.primaryCta.to}>
                {content.primaryCta.label}
              </Link>
              <Link className="pl-btn pl-btn-ghost" to={content.secondaryCta.to}>
                {content.secondaryCta.label}
              </Link>
            </div>
            <p className="pl-hint">{content.hint}</p>
          </div>
          <figure className="pl-example">
            <div className="pl-examplehead">{content.example.title}</div>
            <ul>
              {content.example.rows.map((row) => (
                <li key={row}>{row}</li>
              ))}
            </ul>
            <figcaption>{content.example.caption}</figcaption>
          </figure>
        </section>

        {content.sections.map((section) => (
          <Section key={section.id} section={section} />
        ))}

        <PlanTable content={content} plans={plans} />

        <section id="fragen" className="pl-section" aria-labelledby="pl-fragen">
          <div className="pl-head">
            <span className="pl-eyebrow">Häufige Fragen</span>
            <h2 id="pl-fragen">Kurz beantwortet.</h2>
          </div>
          <div className="pl-faq">
            {content.faq.map((entry) => (
              <details key={entry.question}>
                <summary>{entry.question}</summary>
                <p>{entry.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="pl-section pl-closing" aria-labelledby="pl-abschluss">
          <h2 id="pl-abschluss">{content.closing.title}</h2>
          <p>{content.closing.text}</p>
          <div className="pl-actions">
            <Link className="pl-btn pl-btn-primary" to={content.primaryCta.to}>
              {content.primaryCta.label}
            </Link>
          </div>
        </section>
      </main>

      <footer className="pl-footer">
        <Link className="pl-logo" to="/">
          RealSync Dynamics AI
        </Link>
        <nav aria-label="Rechtliches">
          <Link to="/impressum">Impressum</Link>
          <Link to="/datenschutz">Datenschutz</Link>
          <Link to="/agb">AGB</Link>
          <Link to="/avv">AVV</Link>
          <Link to="/kontakt">Kontakt</Link>
        </nav>
      </footer>
    </div>
  );
}
