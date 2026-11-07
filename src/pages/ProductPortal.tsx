import { Link } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { PortalChrome, StatusChip } from '../components/portal/PortalChrome';
import { PLATFORM_FLOW, PRODUCTS } from '../product/productSuite';
import { TRY_FREE } from '../config/beta';

/**
 * Startseite als Produktportal: drei Produkte, eine Plattform.
 *
 * BUILD (Build Studio) · AUTOMATE (Agent Studio) · GOVERN (Governance OS).
 * Inhalte und Status kommen aus `src/product/productSuite.ts`, das seinerseits
 * aus `implementation-status.ts` liest. Je Karte erscheinen höchstens vier
 * Fähigkeiten mit Status, damit Besucher in Sekunden sehen, was es gibt und
 * was heute schon funktioniert.
 *
 * Die bisherige Startseite (Landing v6) bleibt unverändert unter
 * /design/landing-v6 erreichbar.
 */
export function ProductPortal() {
  return (
    <PortalChrome>
      <SEOHead />
      <section className="rsp-hero" aria-labelledby="rsp-hero-title">
        <div className="rsp-wrap">
          <p className="rsp-hero-kicker">REALSYNC DYNAMICS AI</p>
          <h1 id="rsp-hero-title">
            <span className="rsp-v-build">BUILD.</span>{' '}
            <span className="rsp-v-automate">AUTOMATE.</span>{' '}
            <span className="rsp-v-govern">GOVERN.</span>
          </h1>
          <p className="rsp-lead">
            Erstellen Sie professionelle Websites und Anwendungen, automatisieren Sie Ihre
            Kundenkommunikation mit KI-Agenten und behalten Sie die Kontrolle über Ihre KI-Systeme –
            auf einer integrierten europäischen Plattform.
          </p>
          <div className="rsp-actions">
            <a className="rsp-btn rsp-btn-primary" href="#produkte">Produkte ansehen</a>
            <Link className="rsp-btn rsp-btn-ghost" to="/pricing">Preise</Link>
          </div>
          <p className="rsp-note">{TRY_FREE.note}</p>
        </div>
      </section>

      <section id="produkte" className="rsp-section" aria-labelledby="rsp-products-title">
        <div className="rsp-wrap">
          <p className="rsp-eyebrow">Drei Produkte · eine Plattform</p>
          <h2 id="rsp-products-title">Wählen Sie, womit Sie anfangen.</h2>
          <p>
            Jedes Produkt ist für sich nutzbar. Zusammen teilen sie ein Konto, einen Mandanten und eine
            Governance-Schicht. Der Status neben jeder Funktion zeigt, was heute live ist und was noch
            Vorschau ist.
          </p>
          <div className="rsp-products">
            {PRODUCTS.map((p) => (
              <article key={p.id} className="rsp-card" data-product={p.id} aria-labelledby={`rsp-card-${p.id}`}>
                <span className="rsp-card-verb">{p.verb}</span>
                <h3 id={`rsp-card-${p.id}`}>{p.name}</h3>
                <p>{p.description}</p>
                <ul aria-label={`Funktionen von ${p.name}`}>
                  {p.capabilities.slice(0, 4).map((c) => (
                    <li key={c.id}>
                      <span>{c.label}</span>
                      <StatusChip status={c.status} />
                    </li>
                  ))}
                </ul>
                <div className="rsp-actions">
                  <Link className="rsp-btn rsp-btn-primary" to={p.primaryCta.to}>{p.primaryCta.label}</Link>
                  <Link className="rsp-btn rsp-btn-ghost" to={p.secondaryCta.to}>
                    {p.secondaryCta.label}
                  </Link>
                </div>
                {p.id === 'build' && (
                  <Link className="rsp-note" to={p.pageRoute}>Build Studio entdecken →</Link>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="rsp-section" aria-labelledby="rsp-flow-title">
        <div className="rsp-wrap">
          <p className="rsp-eyebrow">Zusammenspiel</p>
          <h2 id="rsp-flow-title">Von der Website zum KI-Mitarbeiter – mit Nachweis.</h2>
          <p>
            Beispiel Handwerksbetrieb: Website im Build Studio erstellen, einen Assistenten für Anfragen und
            Terminwünsche hinzufügen, Datenschutz prüfen, freigeben und die Nachweise im selben Dashboard
            nachvollziehen. Jeder Schritt zeigt seinen heutigen Stand.
          </p>
          <ol className="rsp-flow">
            {PLATFORM_FLOW.map((s) => (
              <li key={s.id}>
                <span className="rsp-flow-step">{s.step}</span>
                <strong>{s.label}</strong>
                <StatusChip status={s.status} />
                <span className="rsp-flow-note">{s.note}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="rsp-section" aria-labelledby="rsp-start-title">
        <div className="rsp-wrap">
          <p className="rsp-eyebrow">Ein Konto für alles</p>
          <h2 id="rsp-start-title">Einmal anmelden, alle drei Produkte nutzen.</h2>
          <p>
            Ein Benutzerkonto und eine Mandantenidentität gelten für Build Studio, Agent Studio und
            Governance OS. Berechtigungen, Freigaben und Nachweise prüft der Server – nicht der Browser.
          </p>
          <div className="rsp-actions" style={{ marginTop: 20 }}>
            <Link className="rsp-btn rsp-btn-primary" to="/login">Anmelden</Link>
            <Link className="rsp-btn rsp-btn-ghost" to="/grenzen">Grenzen des Produkts</Link>
          </div>
        </div>
      </section>
    </PortalChrome>
  );
}
