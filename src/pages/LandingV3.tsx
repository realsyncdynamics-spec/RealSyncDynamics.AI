import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SyncHeroStage } from '../components/landing/v3/SyncHeroStage';
import { AskAiPill } from '../components/AskAiPill';
import {
  BETA_OFFER, COMPANY_LINE, LEGAL_LINKS, PRODUCTS, SOURCE, STATUS_TEXT, TAX_NOTE,
  faqs, planCards, pricingIntro, productNote, productStatus,
} from '../components/landing/v3/landingV3Data';
import { BETA, betaSignupHref } from '../config/beta';
import '../styles/landing-v3.css';

/**
 * Startseite v3 — öffentliche Startseite unter `/` (seit 17.11.2026).
 * Die frühere Vorschau-Route /design/startseite-v3 leitet auf `/`;
 * Landing v6 bleibt als Rückfall unter /design/landing-v6.
 *
 * Gestaltung und Texte aus dem Claude-Design-Export „RealSync Startseite v3“.
 * Nicht übernommen, weil nicht belegt oder nicht freigegeben:
 *   - Bot „Nora“ mit fest eingetragener Mandanten-/Bot-ID im Browser
 *   - WhatsApp-Link mit privater Nummer
 *   - Browser-Agent (nicht auf main, kein Registry-Eintrag)
 *   - Badges zur Backend-Anbindung (keine Registry-Quelle)
 *   - fest eingetragene Preise und Checkout-Links
 * Status, Preise, Beta, Steuerhinweis und Firma kommen aus den Quellen in
 * landingV3Data.ts.
 *
 * Hero-Bühne seit 19.11.2026: SYNC, das 3D-Maskottchen (SyncHeroStage, Weg 1).
 * Ein Klick im Produktkatalog lässt SYNC winken. `data-hero-cta` am Hauptbutton
 * blendet den schwebenden Assistent-Button aus, solange der Hero sichtbar ist.
 */

const AUTO_ADVANCE_MS = 6000;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

function StatusPill({ label }: { label: string }) {
  return <span className="lv3-pill">{label}</span>;
}

export function LandingV3() {
  const navigate = useNavigate();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [waveSignal, setWaveSignal] = useState(0);
  const [site, setSite] = useState('');
  const [siteError, setSiteError] = useState('');

  useEffect(() => {
    if (paused || prefersReducedMotion()) return;
    const id = window.setInterval(() => setActive((i) => (i + 1) % PRODUCTS.length), AUTO_ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [paused]);

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

  const plans = planCards();
  const current = PRODUCTS[active]!;

  return (
    <div className="lv3">
      <a href="#produkte" className="lv3-skip">Zum Inhalt springen</a>

      {BETA_OFFER ? (
        <p className="lv3-ribbon">
          <span>{BETA.headline} – bis {BETA.endsLabel}, keine Kreditkarte.</span>{' '}
          <Link to={betaSignupHref(BETA.testPlan, `${SOURCE}-ribbon`)}>Jetzt kostenlos testen</Link>
        </p>
      ) : null}

      <header className="lv3-hero" id="top">
        <nav className="lv3-nav" aria-label="Hauptnavigation">
          <Link to="/" className="lv3-brand">RealSync Dynamics &amp; AI</Link>
          <a href="#katalog">Produkte</a>
          <a href="#preise">Preise</a>
          <a href="#fragen">Fragen</a>
          <Link to="/contact-sales">Kontakt</Link>
          <Link to="/welcome">Anmelden</Link>
          <AskAiPill className="lv3-btn lv3-ask" />
          <a className="lv3-btn lv3-btn--solid" href="#start">Check starten</a>
        </nav>

        <div className="lv3-hero-grid">
          <div className="lv3-hero-copy">
            <h1 className="lv3-h1" data-testid="v3-hero-heading">
              <span>Ihre Ideen.</span>
              <span className="lv3-h1-2">In Bewegung.</span>
            </h1>
            <p className="lv3-lead">
              Websites, KI-Agenten und Automatisierungen, die Ihrem Betrieb Arbeit abnehmen und Kunden schneller zum Ziel bringen.
            </p>
            <div className="lv3-actions">
              <a className="lv3-btn lv3-btn--solid lv3-btn--lg" href="#start" data-hero-cta="landing-v3">Kostenlosen Check starten</a>
              <a className="lv3-btn lv3-btn--lg" href="#katalog">Produkte entdecken</a>
            </div>
          </div>
          <SyncHeroStage caption={current.stageCaption} statusLabel="SYNC · RealSync" waveSignal={waveSignal} />
        </div>

        <div
          id="katalog"
          className="lv3-catalog"
          role="group"
          aria-label="Produkte"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
        >
          {PRODUCTS.map((p, i) => {
            const st = productStatus(p);
            const note = productNote(p);
            return (
              <Link
                key={p.key}
                to={p.href}
                className="lv3-cat"
                onMouseEnter={() => setActive(i)}
                onFocus={() => { setActive(i); setPaused(true); setWaveSignal((n) => n + 1); }}
              >
                <span className="lv3-cat-bar" aria-hidden="true"><span data-on={i === active} /></span>
                <span className="lv3-meta">
                  {String(i + 1).padStart(2, '0')} · {p.section}
                  {st ? <StatusPill label={st.label} /> : null}
                </span>
                <span className="lv3-cat-name">{p.name}</span>
                <span className="lv3-cat-short">{p.short}{note ? ` · ${note}` : ''}</span>
              </Link>
            );
          })}
        </div>
      </header>

      <main>
        <section id="einstiege" className="lv3-section lv3-split" aria-labelledby="lv3-entry-h">
          <div>
            <span className="lv3-eyebrow">Zwei gleichwertige Einstiege</span>
            <h2 id="lv3-entry-h" className="lv3-h2">Sie bestimmen, womit wir beginnen.</h2>
            <p className="lv3-text">
              Kennen Sie Ihr Ziel, öffnen Sie direkt die passende Produktseite. Möchten Sie zuerst den Zustand Ihrer bestehenden Website verstehen, starten Sie mit dem kostenlosen Domain-Scan.
            </p>
          </div>
          <div className="lv3-cards">
            <a href="#produkte" className="lv3-card">
              <span className="lv3-meta">Direkter Produkteinstieg</span>
              <strong className="lv3-card-name">Das passende Produkt öffnen.</strong>
              <span>Alle vier Produktseiten sind direkt erreichbar. Ein vorheriger Scan ist nicht nötig.</span>
              <span className="lv3-card-cta">Vier Produkte ansehen <span aria-hidden="true">→</span></span>
            </a>
            <a href="#start" className="lv3-card">
              <span className="lv3-meta">Kostenloser Domain-Scan</span>
              <strong className="lv3-card-name">Mit der bestehenden Website starten.</strong>
              <span>Adresse eingeben, öffentliche Website prüfen lassen und konkrete Befunde ansehen.</span>
              <span className="lv3-card-cta">Domain prüfen <span aria-hidden="true">→</span></span>
            </a>
          </div>
        </section>

        <section id="produkte" className="lv3-section" aria-labelledby="lv3-module-h">
          <span className="lv3-eyebrow">Module</span>
          <h2 id="lv3-module-h" className="lv3-h2">Direkt ausprobieren.</h2>
          <p className="lv3-text">Jede Karte führt zur Seite des Produkts.</p>
          <div className="lv3-cards">
            {PRODUCTS.map((p, i) => {
              const st = productStatus(p);
              const note = productNote(p);
              return (
                <Link key={p.key} to={p.href} className="lv3-card" data-testid={`v3-product-${p.key}`}>
                  <span className="lv3-meta">
                    {String(i + 1).padStart(2, '0')} · {p.section}
                    {st ? <StatusPill label={st.label} /> : null}
                  </span>
                  <strong className="lv3-card-name">{p.name}</strong>
                  <span>{p.body}{note ? ` ${note}.` : ''}</span>
                  <span className="lv3-card-flow">{p.flow}</span>
                  <span className="lv3-card-cta">Produkt ansehen <span aria-hidden="true">→</span></span>
                </Link>
              );
            })}
          </div>
        </section>

        <section id="kundenweg" className="lv3-section lv3-split" aria-labelledby="lv3-kundenweg-h">
          <div>
            <span className="lv3-eyebrow">Vom Domain-Scan zur laufenden Übersicht</span>
            <h2 id="lv3-kundenweg-h" className="lv3-h2">Der Weg in sechs Schritten.</h2>
            <p className="lv3-text">
              Die Schritte vier bis sechs sind freiwillig. Der Telefonassistent lässt sich auch separat öffnen. Bei einer Website-Anpassung entsteht ein neuer Frontend-Entwurf; das bestehende Backend bleibt unverändert.
            </p>
          </div>
          <ol className="lv3-steps" data-testid="v3-customer-journey">
            {[
              'Domain eingeben',
              'Öffentliche Website prüfen',
              'Befunde, Fehlercodes und Vorschläge ansehen',
              'Optional einen Frontend-Entwurf anpassen',
              'Optional den Telefonassistenten ergänzen',
              'Governance OS für Zuständigkeiten, Freigaben und Nachweise nutzen',
            ].map((step, i) => (
              <li key={step}>
                <span className="lv3-meta">{String(i + 1).padStart(2, '0')}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <p className="lv3-fine">
            Nach Schritt 3 folgt die Frage: „Was sollen wir für Sie tun?“ Eine erneute Prüfung führt zurück zu Schritt 2. Automatische Dauerüberwachung ist in Vorbereitung.
          </p>
        </section>

        <section id="govern" className="lv3-section lv3-split" aria-labelledby="lv3-govern-h">
          <div>
            <span className="lv3-eyebrow">Im Hintergrund</span>
            <h2 id="lv3-govern-h" className="lv3-h2">Die Kontrollschicht läuft mit.</h2>
            <p className="lv3-text">
              Berechtigungen, Regeln und Nachweise begleiten die Abläufe. Wer sie selbst steuern möchte, öffnet das{' '}
              <Link to={`/governance-runtime?source=${SOURCE}`}>Governance OS</Link>.
            </p>
          </div>
          <ol className="lv3-steps">
            {['Scan', 'Report', 'Build', 'Automate', 'Govern'].map((s, i) => (
              <li key={s}><span className="lv3-meta">{String(i + 1).padStart(2, '0')}</span><span>{s}</span></li>
            ))}
          </ol>
        </section>

        <section id="preise" className="lv3-section" aria-labelledby="lv3-preise-h">
          <span className="lv3-eyebrow">Pakete</span>
          <h2 id="lv3-preise-h" className="lv3-h2">Klein anfangen. Mitwachsen.</h2>
          <p className="lv3-text">{pricingIntro()}</p>
          <div className="lv3-plans">
            {plans.map((p) => (
              <article key={p.id} className="lv3-plan" data-featured={p.featured} data-testid={`v3-plan-${p.id}`}>
                {p.badge ? <StatusPill label={p.badge} /> : null}
                <h3 className="lv3-h3">{p.name}</h3>
                <p className="lv3-price">
                  <strong>{p.price}</strong>
                  {p.listPrice ? <s aria-label={`statt ${p.listPrice}`}>{p.listPrice}</s> : null}
                  <span>{p.unit}</span>
                </p>
                <p className="lv3-plan-note">{p.note}</p>
                <p className="lv3-plan-desc">{p.desc}</p>
                <ul className="lv3-plan-list">{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
                <Link to={p.href} className={p.featured ? 'lv3-btn lv3-btn--solid' : 'lv3-btn'}>{p.cta}</Link>
              </article>
            ))}
          </div>
          <p className="lv3-fine" data-testid="v3-tax-note">
            {TAX_NOTE} Verbindlich sind Preise und Leistungen auf <Link to="/pricing">der Preisseite</Link>.
          </p>
        </section>

        <section id="start" className="lv3-section lv3-start" aria-labelledby="lv3-start-h">
          <h2 id="lv3-start-h" className="lv3-h2 lv3-h2--xl">Wo steht Ihre Website?</h2>
          <p className="lv3-text">Der kostenlose Scan prüft Sicherheit, Einwilligung, Impressum und Datenschutzerklärung Ihrer Website.</p>
          <form className="lv3-form" onSubmit={submitCheck} noValidate>
            <label className="lv3-label">
              Ihre Website
              <input
                className="lv3-input"
                type="text"
                inputMode="url"
                autoComplete="url"
                placeholder="ihr-betrieb.de"
                value={site}
                maxLength={253}
                onChange={(e) => setSite(e.target.value)}
                aria-invalid={siteError ? true : undefined}
                aria-describedby={siteError ? 'lv3-site-error' : 'lv3-site-hint'}
              />
            </label>
            <button type="submit" className="lv3-btn lv3-btn--solid lv3-btn--lg">Weiter zum kostenlosen Scan</button>
          </form>
          {siteError ? <p id="lv3-site-error" role="alert" className="lv3-error">{siteError}</p> : null}
          <p id="lv3-site-hint" className="lv3-fine">
            Im nächsten Schritt geben Sie Ihre E-Mail-Adresse für das Ergebnis an. Details in der <Link to="/datenschutz">Datenschutzerklärung</Link>.
          </p>
        </section>

        <section id="fragen" className="lv3-section lv3-split" aria-labelledby="lv3-fragen-h">
          <div>
            <span className="lv3-eyebrow">Häufige Fragen</span>
            <h2 id="lv3-fragen-h" className="lv3-h2">Kurz beantwortet.</h2>
          </div>
          <div className="lv3-faq">
            {faqs().map((f) => (
              <details key={f.q}>
                <summary>{f.q}<span aria-hidden="true">+</span></summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="lv3-footer">
        <div className="lv3-footer-row">
          <span className="lv3-brand">RealSync Dynamics &amp; AI</span>
          <nav aria-label="Rechtliches" className="lv3-legal">
            {LEGAL_LINKS.map((l) => <Link key={l.to} to={l.to}>{l.label}</Link>)}
            <a href="#top">Nach oben ↑</a>
          </nav>
        </div>
        <p className="lv3-fine">{COMPANY_LINE} · {TAX_NOTE}</p>
      </footer>
    </div>
  );
}

export default LandingV3;
