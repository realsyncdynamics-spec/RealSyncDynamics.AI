import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { StudioGlassCube, StudioStarfield } from '../components/landing/studio/StudioStarfield';
import {
  BETA_OFFER, COMPANY_LINE, LEGAL_LINKS, PRODUCTS, RECEPTIONIST, STATUS_TEXT, TAX_NOTE,
  faqs, planCards, pricingIntro, productNote, productStatus, registryStatus,
} from '../components/landing/v3/landingV3Data';
import { BETA, betaSignupHref } from '../config/beta';
import { CTA } from '../content/runtimeVocab';
import '../styles/landing-studio.css';

/**
 * Landing „Studio“ — Design-Vorschau unter `/design/landing-studio` (noIndex).
 *
 * Gestaltung aus Dominiks Studio-Entwurf (Sternenhimmel, Glas-Navigation,
 * Neon-Glaswürfel). Bewusst KEINE eigene Datenhaltung: Produkte, Status,
 * Preise, Beta, Steuerhinweis, Firma und alle Ziele (Audit, Builder,
 * Chat-Assistent, Warteliste, Checkout, Anmeldung) kommen aus
 * `landingV3Data.ts` — also aus denselben Quellen wie die Startseite `/`.
 *
 * Aus dem Entwurf nicht übernommen, weil nicht belegt oder nicht freigegeben:
 *   - fest eingetragene Voice-Paketpreise aus dem Entwurf → Preise nur aus shared/pricing.ts
 *   - „Fail-closed / blockiert“ als Ist-Zustand → Policy-Prüfung läuft im Beobachtungsmodus
 *   - „DSGVO & EU AI Act inklusive“ als Pauschalversprechen
 *   - Kontaktformular ohne Backend → ersetzt durch den Website-Check (/audit)
 *
 * Abweichung von der Design-DNA (Hard-Edge, 90°): Dieser Entwurf nutzt runde
 * Glasflächen. Deshalb nur Vorschau-Route, nicht `/` (Owner-Entscheidung offen).
 */

const SOURCE = 'landing-studio';

const GOV_STEPS = [
  { n: '01', title: 'Anfrage', body: 'KI oder Mitarbeiter will etwas tun: Daten lesen, E-Mail senden, Rechnung freigeben.' },
  { n: '02', title: 'Prüfung', body: 'Mandant, Berechtigung, Einwilligung und Risiko — in dieser Reihenfolge.' },
  { n: '03', title: 'Entscheidung', body: 'Freigeben, an einen Menschen übergeben oder anhalten.' },
  { n: '04', title: 'Nachweis', body: 'Jede Entscheidung bleibt im Governance OS nachvollziehbar.' },
] as const;

function Pill({ label }: { label: string }) {
  return <span className="lst-status">{label}</span>;
}

export function LandingStudio() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [site, setSite] = useState('');
  const [siteError, setSiteError] = useState('');

  const plans = planCards();
  const starter = plans.find((p) => p.id === 'starter');
  const tryStatus = registryStatus(RECEPTIONIST.tryRegistryId);
  const govProduct = PRODUCTS.find((p) => p.key === 'governance');

  const submitCheck = (e: FormEvent) => {
    e.preventDefault();
    const value = site.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    if (!/^[^\s/@]+\.[^\s/@]+$/.test(value)) {
      setSiteError('Bitte eine Website-Adresse wie ihr-betrieb.de eingeben.');
      return;
    }
    setSiteError('');
    navigate(`/audit?domain=${encodeURIComponent(value)}&source=${SOURCE}`);
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="lst" id="top">
      <div className="lst-sky" aria-hidden="true" />
      <StudioStarfield />
      <a href="#start" className="lst-skip">Zum Inhalt springen</a>

      <div className="lst-wrap">
        <header className={menuOpen ? 'lst-nav lst-nav--open' : 'lst-nav'}>
          <div className="lst-nav-inner">
            <Link to="/" className="lst-brand" aria-label="RealSync Dynamics & AI – Startseite">
              <span className="lst-mark" aria-hidden="true"><span /><span /></span>
              REALSYNC AI
            </Link>
            <nav className="lst-links" aria-label="Hauptnavigation">
              <a href="#produkte" onClick={closeMenu}>Produkte</a>
              <a href="#receptionist" onClick={closeMenu}>Receptionist</a>
              <a href="#govern" onClick={closeMenu}>Governance</a>
              <a href="#preise" onClick={closeMenu}>Preise</a>
              <Link to="/welcome" className="lst-links-login" onClick={closeMenu}>Anmelden</Link>
            </nav>
            <Link to="/welcome" className="lst-btn lst-btn--primary lst-nav-cta" data-testid="studio-login">
              Login / Register
            </Link>
            <button
              type="button"
              className="lst-burger"
              aria-label="Menü"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              ☰
            </button>
          </div>
        </header>

        <main>
          {/* HERO */}
          <section className="lst-hero">
            <div>
              {BETA_OFFER ? (
                <Link className="lst-pill" to={betaSignupHref(BETA.testPlan, `${SOURCE}-hero`)}>
                  ✦ {BETA.badge} · kostenlos bis {BETA.endsLabel}
                </Link>
              ) : (
                <span className="lst-pill">✦ Governance OS · Made in Thüringen</span>
              )}
              <h1 data-testid="studio-hero-heading">
                Neue Dimensionen für Ihren Betrieb: <span className="lst-grad">KI-Mitarbeiter mit Governance</span>
              </h1>
              <p className="lst-lead">
                Für Betriebe mit Kundenkontakt, zuerst im Handwerk. Website bauen, Anfragen beantworten,
                Freigaben behalten — mit eingebauter Governance statt IT-Abteilung.
              </p>
              <div className="lst-cta">
                <a href="#start" className="lst-btn lst-btn--primary">{CTA.startFreeAudit}</a>
                <a href="#receptionist" className="lst-btn lst-btn--ghost">AI Receptionist ansehen →</a>
              </div>
              <ul className="lst-facts">
                <li><b>Website-Scan</b> kostenlos</li>
                {starter ? <li><b>Starter</b> {starter.price}{starter.unit}</li> : null}
                <li><b>Ein Ansprechpartner</b> · Thüringen</li>
              </ul>
            </div>
            <StudioGlassCube />
          </section>

          {/* PRODUKTE (App Builder, Bots/Voice, Optimizer, Governance OS) */}
          <section id="produkte" className="lst-products" aria-label="Produkte">
            {PRODUCTS.map((p) => {
              const st = productStatus(p);
              const note = productNote(p);
              return (
                <Link key={p.key} to={p.href} className="lst-card lst-product" data-testid={`studio-product-${p.key}`}>
                  <span className="lst-eyebrow">{p.section}</span>
                  <h3>{p.name} {st ? <Pill label={st.label} /> : null}</h3>
                  <p>{p.body}</p>
                  <p className="lst-flow">{p.flow}</p>
                  {note ? <p className="lst-note">{note}</p> : null}
                </Link>
              );
            })}
          </section>

          {/* AI RECEPTIONIST / VOICE */}
          <section id="receptionist" className="lst-card lst-panel" data-testid="studio-receptionist">
            <p className="lst-eyebrow">{RECEPTIONIST.name} · Voice Agent</p>
            <h2>{RECEPTIONIST.heading}</h2>
            <p className="lst-sub">
              {RECEPTIONIST.body} {RECEPTIONIST.audience}. <Pill label={STATUS_TEXT[RECEPTIONIST.status]} />
            </p>
            <ol className="lst-steps">
              {RECEPTIONIST.steps.map((s, i) => (
                <li key={s} className="lst-card lst-step">
                  <span className="lst-num">{String(i + 1).padStart(2, '0')}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            <div className="lst-cta">
              <Link className="lst-btn lst-btn--primary" to={RECEPTIONIST.waitlistHref} data-testid="studio-receptionist-waitlist">
                {RECEPTIONIST.waitlistCta}
              </Link>
              <Link className="lst-btn lst-btn--ghost" to={RECEPTIONIST.tryHref} data-testid="studio-receptionist-try">
                {RECEPTIONIST.tryCta}
              </Link>
              {tryStatus ? <Pill label={`Chat-Assistent: ${STATUS_TEXT[tryStatus]}`} /> : null}
            </div>
          </section>

          {/* GOVERNANCE OS */}
          <section id="govern" className="lst-card lst-panel">
            <p className="lst-eyebrow">
              Governance OS {govProduct && productStatus(govProduct) ? `· ${productStatus(govProduct)!.label}` : ''}
            </p>
            <h2>KI einsetzen — mit Kontrolle</h2>
            <p className="lst-sub">
              Das Governance OS sitzt zwischen Ihrer KI und Ihren Daten. Die automatische Policy-Prüfung
              arbeitet derzeit im Beobachtungsmodus; Freigaben bleiben nachvollziehbar.
            </p>
            <div className="lst-govsteps">
              {GOV_STEPS.map((s) => (
                <div key={s.n} className="lst-card lst-govstep">
                  <p className="lst-num">{s.n} — {s.title.toUpperCase()}</p>
                  <h4>{s.title}</h4>
                  <p>{s.body}</p>
                </div>
              ))}
            </div>
            <div className="lst-proof" aria-label="Beispielablauf mit Beispieldaten">
              <div className="lst-dim"># Beispielablauf · Beispieldaten</div>
              <div><span className="lst-k">→ anfrage</span>      kundendaten.export</div>
              <div><span className="lst-ok">✓ mandant</span>       Musterbetrieb</div>
              <div><span className="lst-ok">✓ berechtigung</span>  rolle: vertrieb</div>
              <div><span className="lst-no">✕ einwilligung</span>  fehlt</div>
              <div><span className="lst-k">→ entscheidung</span>  an Mensch übergeben</div>
            </div>
            {govProduct ? (
              <div className="lst-cta">
                <Link className="lst-btn lst-btn--ghost" to={govProduct.href}>Governance OS ansehen →</Link>
              </div>
            ) : null}
          </section>

          {/* PREISE (SSoT) */}
          <section id="preise" className="lst-card lst-panel">
            <p className="lst-eyebrow">Preise</p>
            <h2>Klein anfangen, sauber wachsen</h2>
            <p className="lst-sub">{pricingIntro()}</p>
            <div className="lst-prices">
              {plans.map((p) => (
                <div
                  key={p.id}
                  className={p.featured ? 'lst-card lst-price lst-price--hot' : 'lst-card lst-price'}
                  data-testid={`studio-plan-${p.id}`}
                >
                  <span className="lst-pname">{p.name}{p.badge ? <> · <em>{p.badge}</em></> : null}</span>
                  <span className="lst-amt">
                    <span>{p.price}</span> <small>{p.unit}</small>
                  </span>
                  {p.listPrice ? <span className="lst-dim">statt {p.listPrice}</span> : null}
                  <span className="lst-dim">{p.note}</span>
                  <ul>{p.features.map((f) => <li key={f}>✓ {f}</li>)}</ul>
                  <Link className={p.featured ? 'lst-btn lst-btn--primary' : 'lst-btn lst-btn--ghost'} to={p.href}>
                    {p.cta}
                  </Link>
                </div>
              ))}
            </div>
            <p className="lst-dim lst-tax" data-testid="studio-tax-note">
              {TAX_NOTE} Verbindlich sind Preise und Leistungen auf <Link to="/pricing">der Preisseite</Link>.
            </p>
          </section>

          {/* FAQ */}
          <section id="fragen" className="lst-card lst-panel">
            <p className="lst-eyebrow">Fragen</p>
            <h2>Kurz beantwortet</h2>
            <div className="lst-faq">
              {faqs().map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          {/* WEBSITE-CHECK → /audit */}
          <section id="start" className="lst-card lst-panel">
            <p className="lst-eyebrow">Kostenloser Check</p>
            <h2>Erzählen Sie uns von Ihrem Betrieb</h2>
            <p className="lst-sub">
              Geben Sie Ihre Website-Adresse ein. Im nächsten Schritt nennen Sie Ihre E-Mail-Adresse für das
              Ergebnis. Details in der <Link to="/datenschutz">Datenschutzerklärung</Link>.
            </p>
            <form className="lst-form" onSubmit={submitCheck} noValidate>
              <label htmlFor="lst-site" className="lst-sr">Website-Adresse</label>
              <input
                id="lst-site"
                value={site}
                onChange={(e) => setSite(e.target.value)}
                placeholder="ihr-betrieb.de"
                inputMode="url"
                autoComplete="url"
                aria-invalid={siteError ? true : undefined}
                aria-describedby={siteError ? 'lst-site-error' : undefined}
                data-testid="studio-check-input"
              />
              <button className="lst-btn lst-btn--primary" type="submit">{CTA.startFreeAudit}</button>
              {siteError ? <p id="lst-site-error" className="lst-error" role="alert">{siteError}</p> : null}
            </form>
          </section>
        </main>

        <footer className="lst-footer">
          <span>{COMPANY_LINE} · {TAX_NOTE}</span>
          <nav aria-label="Rechtliches">
            {LEGAL_LINKS.map((l) => <Link key={l.to} to={l.to}>{l.label}</Link>)}
            <a href="#top">Nach oben ↑</a>
          </nav>
        </footer>
      </div>
    </div>
  );
}
