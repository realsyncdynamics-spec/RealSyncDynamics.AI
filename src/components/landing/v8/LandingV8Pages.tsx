import { Link } from 'react-router-dom';
import {
  PRODUCT_AREAS,
  SOLUTIONS,
  primaryShowcase,
  productBySlug,
  productPath,
} from '../../../marketing/products/registry';
import { V8_PRICE_SUFFIX, V8_VOICE_PLACEHOLDER, v8PlanCards, v8PriceLine } from '../../../marketing/products/pricing';
import type { ProductArea } from '../../../marketing/products/types';
import { ShowcaseSlot } from './ShowcaseSlot';
import { StatusBadge } from './StatusBadge';
import { ProductsCta, RegistrationCta } from './V8Ctas';

const CARD_TITLE: Record<string, string> = {
  governance: 'Governance & Compliance',
  'agent-studio': 'Agent Studio (inkl. Voice)',
  'creative-studio': 'Creative Studio',
  'website-builder': 'Website & Business Builder',
  operations: 'Operations',
};

const SHOWCASE = [
  {
    slug: 'governance',
    title: 'Governance-Plattform',
    body: 'Runtime, Policies und Evidence. Die Beispielansicht ist kein Mandantenbild.',
  },
  {
    slug: 'agent-studio',
    title: 'Voice-Agent',
    body: 'Telefonie ist nicht angebunden. Die Startseite beschreibt den geplanten Kanal.',
  },
  {
    slug: 'website-builder',
    title: 'Landingpage- / Website-Builder',
    body: 'Bestehender Builder für Websites. Publish bleibt eine Vorschau.',
  },
  {
    slug: 'creative-studio',
    title: 'Sprachdemo',
    body: 'Browser-Demo aus freigegebenen Unternehmensinfos. Kein Studio für Bild oder Video.',
  },
] as const;

function AreaCard({ area }: { area: ProductArea }) {
  const shown = area.features.find((feature) => feature.demo) ?? area.features[0];
  return (
    <article className="v8-card">
      <div className="v8-letter">
        {area.letter} · {area.role}
      </div>
      <h3>
        <Link to={productPath(area)}>{CARD_TITLE[area.slug] ?? area.name}</Link>
      </h3>
      <p>{area.summary}</p>
      {shown ? (
        <p>
          <StatusBadge feature={shown} />
        </p>
      ) : null}
    </article>
  );
}

function Placeholder({ caption }: { caption: string }) {
  return (
    <div className="v8-placeholder-canvas" data-testid="v8-media-slot">
      <div>
        <div className="v8-kicker">Platzhalter</div>
        <p>{caption}</p>
        <p className="v8-micro">Kein gerendertes Mock-Bild</p>
      </div>
    </div>
  );
}

export function LandingV8Home() {
  return (
    <>
      <section className="v8-wrap v8-hero">
        <div>
          <div className="v8-kicker">AI Governance Runtime</div>
          <h1>KI-Agenten + Business-Automatisierung + überprüfbare AI Governance</h1>
          <p className="v8-lead">
            Die operative Kontrollschicht für KI-Systeme und digitale Prozesse. Erkennen Sie Risiken,
            setzen Sie verbindliche Policies durch und halten Sie jede relevante Entscheidung nachvollziehbar fest.
          </p>
          <div className="v8-actions">
            <RegistrationCta className="v8-btn v8-btn-primary" />
            <ProductsCta className="v8-btn v8-btn-secondary" />
          </div>
          <div className="v8-trust">
            <span>EU-fokussierte Infrastruktur</span>
            <span>Provider-neutraler Ansatz</span>
            <span>Nachvollziehbare Evidence</span>
          </div>
        </div>
        <div className="v8-panel" aria-label="UI-Konzept mit Beispieldaten">
          <div className="v8-panel-head">
            <span>Governance Control Room</span>
            <span className="v8-badge v8-badge-demo">UI-Konzept · Beispieldaten</span>
          </div>
          <div className="v8-metrics">
            <div className="v8-metric">
              <b>12</b>
              <small>Beispiel · KI-Systeme</small>
            </div>
            <div className="v8-metric">
              <b>184</b>
              <small>Beispiel · Policy-Events</small>
            </div>
            <div className="v8-metric">
              <b>03</b>
              <small>Beispiel · Freigaben offen</small>
            </div>
          </div>
          <p className="v8-micro">UI-Konzept · Beispieldaten. Keine Messung aus einem Mandanten.</p>
        </div>
      </section>

      <section className="v8-section v8-section-paper" id="bereiche">
        <div className="v8-wrap">
          <div className="v8-section-head">
            <div>
              <div className="v8-kicker">Fünf Produktbereiche</div>
              <h2>Eine Plattform, klar getrennte Arbeitsflächen.</h2>
            </div>
            <p className="v8-intro">
              Governance, Agenten, Creative, Builder und Operations. Jedes Frontend bleibt individuell, die Kontrolle zentral.
            </p>
          </div>
          <div className="v8-grid">
            {PRODUCT_AREAS.map((area) => (
              <AreaCard key={area.slug} area={area} />
            ))}
          </div>
        </div>
      </section>

      <section className="v8-section" id="showcase">
        <div className="v8-wrap">
          <div className="v8-section-head">
            <div>
              <div className="v8-kicker">Showcase</div>
              <h2>Was heute bereits existiert.</h2>
            </div>
            <p className="v8-intro">
              Keine erfundenen Screenshots. Die Flächen bleiben Platzhalter, bis eine echte Ansicht oder eine Live-Demo eingebunden ist.
            </p>
          </div>
          <div className="v8-grid">
            {SHOWCASE.map((item) => (
              <article className="v8-card" key={item.slug}>
                <Placeholder caption="Slot für echten Screenshot oder Live-Demo" />
                <h3>
                  <Link to={productPath(PRODUCT_AREAS.find((area) => area.slug === item.slug)!)}>{item.title}</Link>
                </h3>
                <p>{item.body}</p>
                <span className="v8-badge v8-badge-demo">Demo</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="v8-section">
        <div className="v8-wrap">
          <div className="v8-cta">
            <div>
              <div className="v8-kicker">Der nächste Schritt</div>
              <h2>Machen Sie KI in Ihrem Unternehmen kontrollierbar.</h2>
              <p>Weiter zur Registrierung auf der Anwendung. Diese Vorschau legt kein Konto an.</p>
            </div>
            <div className="v8-actions">
              <RegistrationCta className="v8-btn v8-btn-inverse" />
              <ProductsCta className="v8-btn v8-btn-secondary" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export function LandingV8Products() {
  return (
    <section className="v8-section">
      <div className="v8-wrap">
        <div className="v8-kicker">Produkte</div>
        <h2 className="v8-statement">Fünf Bereiche, eine Liste.</h2>
        <div className="v8-grid" style={{ marginTop: 'var(--space-500)' }}>
          {PRODUCT_AREAS.map((area) => (
            <AreaCard key={area.slug} area={area} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingV8Product({ slug }: { slug: string }) {
  const area = productBySlug(slug.split('/')[0]);
  if (!area) {
    return (
      <section className="v8-section">
        <div className="v8-wrap">
          <h2 className="v8-statement">Diesen Bereich gibt es nicht.</h2>
          <Link to="/v8/produkte">Zur Übersicht</Link>
        </div>
      </section>
    );
  }
  const showcase = primaryShowcase(area);
  const sample = showcase?.showcase.kind === 'live' && showcase.showcase.component === 'governance-runtime';
  return (
    <section className="v8-section">
      <div className="v8-wrap">
        <div className="v8-kicker">
          Produkt · Modul {area.letter}
        </div>
        <h2 className="v8-statement">{CARD_TITLE[area.slug] ?? area.name}</h2>
        <p className="v8-lead">{area.summary}</p>
        {showcase?.showcase.kind === 'live' ? (
          <>
            {sample ? <p className="v8-micro">UI-Konzept · Beispieldaten</p> : null}
            <ShowcaseSlot feature={showcase} embed />
          </>
        ) : (
          <Placeholder caption="Slot für echten Screenshot oder Live-Demo" />
        )}
        <div className="v8-feature-list">
          {area.features.map((feature) => (
            <div className="v8-feature-row" key={feature.id}>
              <div>
                <strong>{feature.name}</strong>
                <p>{feature.summary}</p>
                {feature.href ? (
                  <p>
                    <Link to={feature.href}>Vorhandene Seite öffnen</Link>
                  </p>
                ) : null}
              </div>
              <StatusBadge feature={feature} />
            </div>
          ))}
        </div>
        <div className="v8-actions">
          <RegistrationCta className="v8-btn v8-btn-primary" />
          <ProductsCta className="v8-btn v8-btn-secondary" />
        </div>
      </div>
    </section>
  );
}

export function LandingV8Solutions() {
  return (
    <section className="v8-section">
      <div className="v8-wrap">
        <div className="v8-kicker">Lösungen</div>
        <h2 className="v8-statement">Handwerk, Praxis, Kanzlei.</h2>
        <p className="v8-lead">Genau diese drei Branchen. Keine Kundenzahlen und keine Logos.</p>
        <div className="v8-grid" style={{ marginTop: 'var(--space-500)' }}>
          {SOLUTIONS.map((item) => (
            <article className="v8-card" key={item.id}>
              <div className="v8-letter">Branche</div>
              <h3>
                <Link to={item.href}>{item.name}</Link>
              </h3>
              <p>{item.summary}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingV8Pricing() {
  const plans = v8PlanCards();
  return (
    <section className="v8-section" data-testid="v8-pricing">
      <div className="v8-wrap">
        <div className="v8-kicker">Preise · RSD & AI</div>
        <h2 className="v8-statement">Vier Plattform-Stufen, Voice als Add-on.</h2>
        <p className="v8-lead">Beträge aus der gemeinsamen Preisliste. Voice hat keinen freigegebenen Plattformpreis.</p>
        <div className="v8-prices">
          {plans.map((plan) => (
            <article key={plan.id} className={plan.highlight ? 'v8-price v8-price-featured' : 'v8-price'}>
              {plan.highlight && plan.badge ? <span className="v8-badge v8-badge-ok">{plan.badge}</span> : <span />}
              <h3>{plan.name}</h3>
              <p>
                <strong>{plan.priceLabel}</strong>
                <span className="v8-price-period"> {V8_PRICE_SUFFIX}</span>
              </p>
              <p>{plan.blurb}</p>
              <Link className={plan.highlight ? 'v8-btn v8-btn-primary' : 'v8-btn v8-btn-secondary'} to={plan.href}>
                {plan.cta}
              </Link>
            </article>
          ))}
        </div>
        <aside className="v8-addon">
          <div>
            <div className="v8-panel-head">
              <strong>{V8_VOICE_PLACEHOLDER.title}</strong>
              <span className="v8-badge v8-badge-demo">Demo</span>
            </div>
            <p>{V8_VOICE_PLACEHOLDER.priceLabel}</p>
            <p>{V8_VOICE_PLACEHOLDER.note}</p>
          </div>
        </aside>
      </div>
    </section>
  );
}

export function LandingV8Demo() {
  return (
    <section className="v8-section">
      <div className="v8-wrap">
        <div className="v8-kicker">Demo</div>
        <h2 className="v8-statement">Vorhandene Demos, sonst ein leerer Slot.</h2>
        <p className="v8-lead">Jede Fläche ohne produktive Anbindung trägt das Kennzeichen Demo.</p>
        {PRODUCT_AREAS.map((area) => {
          const feature = primaryShowcase(area);
          const sample = feature?.showcase.kind === 'live' && feature.showcase.component === 'governance-runtime';
          return (
            <article key={area.slug} style={{ marginTop: 'var(--space-700)' }}>
              <h3>
                {area.letter} · {CARD_TITLE[area.slug] ?? area.name}
              </h3>
              {feature?.showcase.kind === 'live' ? (
                <>
                  {sample ? <p className="v8-micro">UI-Konzept · Beispieldaten</p> : null}
                  <ShowcaseSlot feature={feature} embed />
                </>
              ) : (
                <Placeholder caption="Slot für echten Screenshot oder Live-Demo" />
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function LandingV8Start() {
  return (
    <section className="v8-section">
      <div className="v8-wrap">
        <div className="v8-kicker">Registrierung</div>
        <h2 className="v8-statement">Weiter zur Registrierung der Anwendung.</h2>
        <p className="v8-lead">
          Diese Vorschau legt kein Konto an und sammelt keine Zugangsdaten. Das Ziel hängt an der konfigurierten App-Origin.
        </p>
        <div className="v8-actions">
          <RegistrationCta className="v8-btn v8-btn-primary" />
          <ProductsCta className="v8-btn v8-btn-secondary" />
          <Link className="v8-textlink" to="/login">
            Anmelden
          </Link>
        </div>
      </div>
    </section>
  );
}

export function LandingV8Missing() {
  return (
    <section className="v8-section">
      <div className="v8-wrap">
        <h2 className="v8-statement">Diese Vorschau-Seite gibt es nicht.</h2>
        <Link to="/v8">Zur Übersicht</Link>
      </div>
    </section>
  );
}
