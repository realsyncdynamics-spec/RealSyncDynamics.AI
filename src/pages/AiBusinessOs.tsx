import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { BusinessOsCockpit } from '../components/business-os/BusinessOsCockpit';
import { readStored, useLandingMode, type LandingMode } from '../components/landing/landing-mode';
import '../styles/landing-v6.css';
import '../styles/business-os.css';

/**
 * /ai-business-os — Produktlinie „AI Business OS": branchenspezifische
 * Unternehmens-Dashboards auf dem Governance OS (Konzept vom 17.10.2026).
 *
 * Nutzt die Tokens der Landing v6 (`.lv6`, gleiche gespeicherte Hell/Dunkel-
 * Wahl), eigenes Layout in `business-os.css`. Die Seite beschreibt eine
 * Produktvision; was heute live ist, steht ausdrücklich im Abschnitt „Stand".
 */
const SOURCE = 'ai-business-os';
const CTA_HREF = `/contact-sales?intent=business-os&source=${SOURCE}`;

const CAPABILITIES = [
  { title: 'Bots einrichten', text: 'Begrüßung, Wissen und Zuständigkeiten Ihrer Assistenten selbst festlegen.' },
  { title: 'Workflows starten', text: 'Wiederkehrende Abläufe per Klick oder nach Zeitplan anstoßen.' },
  { title: 'Ergebnisse prüfen', text: 'Entwürfe, Antworten und Berichte ansehen, bevor sie jemand erhält.' },
  { title: 'Kontrolliert freigeben', text: 'Festlegen, was ein Agent allein darf und was Ihre Zustimmung braucht.' },
] as const;

const LAYERS = [
  ['Mandanten, Benutzer, Rollen', 'Ihr Unternehmensdesign'],
  ['Verwaltung der AI-Bots', 'Assistenten für Ihre Branche'],
  ['Workflow Engine', 'Ihre eigenen Prozessketten'],
  ['Governance und Nachweise', 'Prüfungen, die in Ihrer Branche zählen'],
  ['Monitoring und Warnungen', 'Ihre Kennzahlen und Schwellenwerte'],
  ['API und Integrationen', 'Anbindung Ihrer bestehenden Software'],
] as const;

const STEPS = [
  { title: 'Sie beschreiben Ihr Unternehmen', text: 'Branche, Website, wichtigste Abläufe und welche Aufgaben ein Assistent übernehmen soll.' },
  { title: 'Der Builder stellt Ihr Dashboard zusammen', text: 'Navigation, Kennzahlen, Bots und Workflow-Vorlagen aus geprüften Bausteinen.' },
  { title: 'Sie prüfen die Vorschau', text: 'Design, Inhalte und Funktionen anpassen, bis es zu Ihrem Betrieb passt.' },
  { title: 'Sie gehen in Betrieb', text: 'Konten, Berechtigungen und Integrationen einrichten. Das Monitoring läuft ab dem ersten Tag.' },
] as const;

const OFFER = [
  'Dashboard in Ihrem Unternehmensdesign',
  'Alle AI-Bots und Workflows an einem Ort',
  'Automatisierungen für Ihre Branche',
  'Anbindung vorhandener Software über unterstützte Schnittstellen',
  'Datenschutz, Governance und nachvollziehbare Freigaben',
  'Einstellungen selbst ändern, laufendes Monitoring inklusive',
] as const;

export function AiBusinessOs() {
  const { setMode } = useLandingMode();
  const [stored, setStored] = useState<LandingMode | null>(() => (typeof window === 'undefined' ? null : readStored()));
  const theme: 'dark' | 'light' = stored === 'light' ? 'light' : 'dark';
  const accent: 'gold' | 'cyan' = stored === 'cyan' ? 'cyan' : 'gold';
  const toggleLabel = theme === 'dark' ? 'Hellen Modus aktivieren' : 'Dunklen Modus aktivieren';

  const toggleTheme = () => {
    const next: LandingMode = theme === 'dark' ? 'light' : accent;
    setStored(next);
    setMode(next);
  };

  return (
    <>
      <SEOHead />
      <div className="lv6 bos" data-rs-theme={theme} data-rs-accent={accent} data-testid="ai-business-os">
        <header className="bos-header">
          <div className="bos-wrap bos-header-row">
            <Link to="/" className="bos-brand">
              RealSyncDynamics<span>.AI</span>
            </Link>
            <nav aria-label="Seitennavigation" className="bos-nav">
              <a href="#aufbau" className="bos-nav-link">Aufbau</a>
              <a href="#ablauf" className="bos-nav-link">Ablauf</a>
              <a href="#angebot" className="bos-nav-link">Angebot</a>
              <button type="button" onClick={toggleTheme} aria-label={toggleLabel} title={toggleLabel} className="bos-theme">
                {theme === 'dark' ? (
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>
                ) : (
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>
                )}
              </button>
            </nav>
          </div>
        </header>

        <main id="main">
          <section className="bos-hero" aria-labelledby="bos-h1">
            <div className="bos-wrap bos-hero-grid">
              <div className="bos-hero-copy">
                <p className="bos-kicker">AI Business OS</p>
                <h1 id="bos-h1" className="bos-h1">Ihr Unternehmen. Ihr Dashboard. Ihre KI.</h1>
                <p className="bos-lead">
                  Wir stellen Ihnen ein AI Business Dashboard zusammen, das zu Ihrer Branche, Ihren Abläufen und Ihren Zielen
                  passt. Dort steuern Sie Ihre AI-Assistenten, sehen Anfragen und Freigaben und behalten die wichtigsten
                  Kennzahlen im Blick.
                </p>
                <div className="bos-actions">
                  <Link to={CTA_HREF} className="bos-btn bos-btn-primary" data-testid="business-os-cta">
                    Individuelles AI Dashboard anfragen
                  </Link>
                  <a href="#ablauf" className="bos-btn bos-btn-ghost">So entsteht Ihr Dashboard</a>
                </div>
                <p className="bos-note">Neue Produktlinie im Aufbau. Was heute schon läuft, steht unten unter „Stand“.</p>
              </div>
              <BusinessOsCockpit />
            </div>
          </section>

          <section className="bos-section" aria-labelledby="bos-cap">
            <div className="bos-wrap">
              <h2 id="bos-cap" className="bos-h2">Ein Dashboard, in dem Sie handeln, nicht nur ablesen.</h2>
              <ul className="bos-caps">
                {CAPABILITIES.map((c) => (
                  <li key={c.title}>
                    <h3 className="bos-h3">{c.title}</h3>
                    <p>{c.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section id="aufbau" className="bos-section bos-section-alt" aria-labelledby="bos-layers">
            <div className="bos-wrap bos-split">
              <div>
                <h2 id="bos-layers" className="bos-h2">Ein gemeinsamer Kern, eine Oberfläche nur für Sie.</h2>
                <p className="bos-body">
                  Wir bauen nicht für jeden Kunden eine neue Anwendung. Der Plattformkern ist für alle gleich und geprüft. Ihr
                  Dashboard ist eine eigene Konfiguration aus wiederverwendbaren Bausteinen, zugeschnitten auf Ihren Betrieb.
                </p>
              </div>
              <table className="bos-table">
                <caption className="bos-sr">Aufteilung zwischen Plattformkern und Branchenoberfläche</caption>
                <thead>
                  <tr>
                    <th scope="col">Plattformkern</th>
                    <th scope="col">Ihre Branchenoberfläche</th>
                  </tr>
                </thead>
                <tbody>
                  {LAYERS.map(([core, custom]) => (
                    <tr key={core}>
                      <td>{core}</td>
                      <td>{custom}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="ablauf" className="bos-section" aria-labelledby="bos-steps">
            <div className="bos-wrap">
              <h2 id="bos-steps" className="bos-h2">In vier Schritten von der Beschreibung zum laufenden Cockpit.</h2>
              <ol className="bos-steps">
                {STEPS.map((s, i) => (
                  <li key={s.title}>
                    <span className="bos-step-n" aria-hidden="true">{i + 1}</span>
                    <h3 className="bos-h3">{s.title}</h3>
                    <p>{s.text}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section className="bos-section bos-section-alt" aria-labelledby="bos-model">
            <div className="bos-wrap bos-split">
              <div>
                <h2 id="bos-model" className="bos-h2">Vorlage als Start, KI für alles, was nur Sie brauchen.</h2>
              </div>
              <div className="bos-model">
                <p className="bos-body">
                  Jedes Dashboard beginnt mit einer Vorlage für Ihre Branche. Die enthält erprobte Kennzahlen, Assistenten und
                  Abläufe und ist deshalb schnell und verlässlich bereit.
                </p>
                <p className="bos-body">
                  Was darüber hinausgeht, beschreiben Sie in eigenen Worten: ein zusätzliches Widget, einen eigenen Ablauf, eine
                  Warnung bei bestimmten Werten. Die KI baut es aus denselben geprüften Bausteinen. So bekommen Sie ein
                  individuelles Dashboard, ohne dass jedes Mal neue Software entsteht.
                </p>
              </div>
            </div>
          </section>

          <section id="angebot" className="bos-section" aria-labelledby="bos-offer">
            <div className="bos-wrap bos-split">
              <div>
                <h2 id="bos-offer" className="bos-h2">Eine Plattform, eingerichtet für Ihr Unternehmen.</h2>
                <p className="bos-body">
                  Ob Handwerksbetrieb, Arztpraxis, Kanzlei, Restaurant oder Industrieunternehmen: Ihre digitalen Abläufe laufen an
                  einer Stelle zusammen, vom ersten Entwurf bis zu Ihrem persönlichen AI Business Cockpit.
                </p>
                <div className="bos-actions">
                  <Link to={CTA_HREF} className="bos-btn bos-btn-primary">Individuelles AI Dashboard anfragen</Link>
                </div>
              </div>
              <ul className="bos-offer">
                {OFFER.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </div>
          </section>

          <section className="bos-section bos-section-alt" aria-labelledby="bos-status">
            <div className="bos-wrap bos-split">
              <h2 id="bos-status" className="bos-h2">Stand</h2>
              <dl className="bos-status-list">
                <div>
                  <dt>Live</dt>
                  <dd>
                    Das <Link to="/">Governance OS</Link> mit Prüfungen nach DSGVO und EU AI Act, Freigaben und Nachweisen. Darauf
                    baut das AI Business OS auf.
                  </dd>
                </div>
                <div>
                  <dt>Live</dt>
                  <dd>Der SiteOS-Builder, mit dem wir Websites aus geprüften Bausteinen zusammenstellen.</dd>
                </div>
                <div>
                  <dt>In Entwicklung</dt>
                  <dd>
                    Der Dashboard Builder für Branchen-Cockpits. Wir nehmen Anfragen jetzt entgegen und melden uns mit einem
                    Vorschlag für Ihre Branche.
                  </dd>
                </div>
              </dl>
            </div>
          </section>
        </main>

        <footer className="bos-footer">
          <div className="bos-wrap bos-footer-row">
            <span>© {new Date().getFullYear()} RealSync Dynamics AI</span>
            <nav aria-label="Rechtliches" className="bos-footer-nav">
              <Link to="/">Startseite</Link>
              <Link to="/branchen">Branchen</Link>
              <Link to="/impressum">Impressum</Link>
              <Link to="/datenschutz">Datenschutz</Link>
              <Link to="/kontakt">Kontakt</Link>
            </nav>
          </div>
        </footer>
      </div>
    </>
  );
}
