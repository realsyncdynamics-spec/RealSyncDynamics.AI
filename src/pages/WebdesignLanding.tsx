import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import '../styles/webdesign-landing.css';

const MAIL = 'info@realsyncdynamicsai.de';

const audiences = [
  ['Selbstständige', 'Ein Auftritt, der mit dem Geschäft mitwächst — ohne Baukasten-Look.'],
  ['Einzelunternehmen', 'Seriös und persönlich, statt nach großer Agentur von der Stange.'],
  ['Freiberufler', 'Die eigene Arbeitsweise sichtbar machen, nicht eine Branche imitieren.'],
  ['Arztpraxen', 'Ruhe, Vertrauen und ein Terminweg, den Patientinnen sofort verstehen.'],
  ['Rechtsanwälte', 'Präzise Sprache, klare Zuständigkeiten, kein unnötiges Fachchinesisch.'],
  ['Handwerksbetriebe', 'Das Werk zeigen: Material, Leistung, direkter Draht zur Werkstatt.'],
] as const;

const services = [
  'Individuelles Webdesign statt austauschbarer Standardvorlagen',
  'Professionelle One-Page-Websites und Landingpages',
  'Modernes, responsives Design für Smartphone, Tablet und Desktop',
  'Klare Präsentation Ihrer Leistungen und Angebote',
  'Kontaktformulare, Terminbuchung und gezielte Handlungsaufforderungen',
  'Suchmaschinenfreundlicher technischer Aufbau',
  'Auf Wunsch Integration bestehender Logos, Farben und Unternehmensidentität',
  'Technische Unterstützung bei Domain, Hosting und Veröffentlichung',
] as const;

const steps = [
  ['01', 'Kennenlernen', 'Was Ihr Unternehmen ausmacht, wen Sie erreichen wollen und was die Seite konkret tun soll.'],
  ['02', 'Struktur', 'Eine Seite mit klarer Reihenfolge: Angebot, Vertrauen, nächster Schritt.'],
  ['03', 'Gestaltung', 'Ein Entwurf, der zu Ihnen passt — für Smartphone, Tablet und Desktop.'],
  ['04', 'Veröffentlichung', 'Domain, Hosting und der Moment, in dem der Auftritt online geht.'],
] as const;

const studies = [
  {
    id: 'praxis',
    label: 'Arztpraxis',
    promise: 'Ruhe vor Information.',
    note: 'Viel Luft, eine Terminhandlung, Sprechzeiten ohne Suche. Die Seite beruhigt, bevor sie erklärt.',
  },
  {
    id: 'kanzlei',
    label: 'Kanzlei',
    promise: 'Präzision, die man sieht.',
    note: 'Strenge Teilung, kurze Zuständigkeiten, kein Stockfoto-Lächeln. Vertrauen durch Ordnung.',
  },
  {
    id: 'handwerk',
    label: 'Handwerk',
    promise: 'Das Material zuerst.',
    note: 'Der Name groß, das Werk als Fläche, der Kontakt ohne Umweg. Die Werkstatt spricht lauter als ein Slogan.',
  },
  {
    id: 'studio',
    label: 'Freiberuf',
    promise: 'Persönlichkeit im Satz.',
    note: 'Editorial statt Visitenkarte. Der Ton der Arbeit ist schon die Gestaltung — nicht ein Rahmen darum.',
  },
] as const;

type StudyId = (typeof studies)[number]['id'];

export function WebdesignLanding() {
  const [studyId, setStudyId] = useState<StudyId>('praxis');
  const study = studies.find((item) => item.id === studyId) ?? studies[0];
  const [draft, setDraft] = useState('');
  const [mailHref, setMailHref] = useState('');
  const [error, setError] = useState('');

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const company = String(data.get('company') ?? '').trim();
    const topic = String(data.get('topic') ?? '').trim();
    const message = String(data.get('message') ?? '').trim();
    if (name.length < 2 || !email.includes('@') || message.length < 12) {
      setDraft('');
      setMailHref('');
      setError('Bitte Name, eine gültige E-Mail und ein paar Sätze zu Ihrem Vorhaben angeben.');
      return;
    }
    const text = [`Name: ${name}`, `E-Mail: ${email}`, `Unternehmen: ${company || '—'}`, `Anliegen: ${topic}`, '', message].join('\n');
    setError('');
    setDraft(text);
    setMailHref(`mailto:${MAIL}?subject=${encodeURIComponent(`Anfrage Webdesign – ${name}`)}&body=${encodeURIComponent(text)}`);
  }

  return (
    <div className="wd">
      <header className="wd-wrap wd-header">
        <Link to="/webdesign" className="wd-brand">
          <span className="wd-mark">DS</span>
          <span>
            Dominik Steiner
            <small>RealSyncDynamics.AI</small>
          </span>
        </Link>
        <nav className="wd-nav" aria-label="Webdesign">
          <a href="#fuer-wen">Für wen</a>
          <a href="#studien">Stilstudien</a>
          <a href="#leistungen">Leistungen</a>
          <a href="#kontakt">Kontakt</a>
        </nav>
        <Link className="wd-cta" to="/audit?source=webdesign">
          Demo starten
        </Link>
      </header>

      <main>
        <section className="wd-wrap wd-hero">
          <div>
            <p className="wd-kicker">One-Page-Websites · Landingpages</p>
            <h1>
              Ihr Unternehmen ist einzigartig.
              <span>Ihre Website sollte es auch sein.</span>
            </h1>
            <p className="wd-lead">
              Individuelles Webdesign für Selbstständige, Freiberufler und Unternehmen — hochwertige
              One-Page-Websites und Landingpages, die Professionalität sichtbar machen. Persönlich
              gestaltet, modern umgesetzt und auf Ihre Zielgruppe abgestimmt.
            </p>
            <div className="wd-actions">
              <Link className="wd-cta" to="/audit?source=webdesign">
                Demo starten
              </Link>
              <a className="wd-ghost" href="#kontakt">
                Projekt anfragen
              </a>
            </div>
            <p className="wd-fine">
              <Link to="/audit?source=webdesign">realsyncdynamicsai.de/audit</Link>
              {' · kostenlos, ohne Konto, unter 90 Sekunden'}
            </p>
          </div>
          <figure>
            <div className="wd-sheet">
              <div className="wd-sheet-bar">
                <span className="wd-dots" aria-hidden="true"><i /><i /><i /></span>
                <span className="wd-kicker" style={{ color: 'var(--muted)' }}>Eine Seite</span>
              </div>
              <div className="wd-sheet-body">
                <p className="wd-kicker">Praxis · Kanzlei · Handwerk</p>
                <strong>Alles, was zählt.</strong>
                <p className="wd-muted" style={{ marginTop: '0.6rem' }}>
                  Leistungen, Vertrauen und ein nächster Schritt — ohne Menü und ohne Umweg.
                </p>
                <div className="wd-steps3">
                  <p><span>01</span>Angebot</p>
                  <p><span>02</span>Vertrauen</p>
                  <p><span>03</span>Kontakt</p>
                </div>
              </div>
            </div>
            <figcaption className="wd-caption">Kein Baukasten · ein Auftritt</figcaption>
          </figure>
        </section>

        <ul className="wd-wrap wd-proof">
          <li><b>Eine Seite</b><p className="wd-muted">Angebot, Vertrauen und der nächste Schritt an einem Ort.</p></li>
          <li><b>Jedes Format</b><p className="wd-muted">Dieselbe Klarheit auf Smartphone, Tablet und Desktop.</p></li>
          <li><b>Demo sofort</b><p className="wd-muted">Kostenloser Check, ohne Konto, Daten in Frankfurt.</p></li>
        </ul>

        <section className="wd-section wd-cream">
          <div className="wd-wrap">
            <p className="wd-kicker">Schwerpunkt</p>
            <h2>Alle wichtigen Informationen auf einer einzigen, ruhig gestalteten Seite.</h2>
            <p className="wd-lead">
              Ich entwickle professionelle, maßgeschneiderte Websites und Landingpages für Selbstständige,
              Einzelunternehmen, Freiberufler, Arztpraxen, Rechtsanwälte, Handwerksbetriebe und kleine Unternehmen.
            </p>
            <p className="wd-muted" style={{ marginTop: '1rem', fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: '1.6rem', fontStyle: 'italic', color: 'var(--ink)' }}>
              Dominik Steiner
            </p>
            <p className="wd-muted">Inhaber, RealSync Dynamics · RealSyncDynamics.AI</p>
          </div>
        </section>

        <section id="fuer-wen" className="wd-section">
          <div className="wd-wrap">
            <p className="wd-kicker">Für wen</p>
            <h2>Nicht eine Vorlage für alle.</h2>
            <div className="wd-grid">
              {audiences.map(([name, line]) => (
                <article key={name}>
                  <h3>{name}</h3>
                  <p className="wd-muted" style={{ marginTop: '0.4rem' }}>{line}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="studien" className="wd-section wd-cream">
          <div className="wd-wrap">
            <p className="wd-kicker">Stilstudien</p>
            <h2>Dieselbe Aufgabe, vier verschiedene Stimmen.</h2>
            <div className="wd-tabs" role="tablist" aria-label="Stilstudien">
              {studies.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={item.id === study.id}
                  onClick={() => setStudyId(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="wd-study">
              <div>
                <h3 style={{ fontSize: '2rem' }}>{study.promise}</h3>
                <p style={{ marginTop: '0.7rem' }}>{study.note}</p>
              </div>
              <div className={`wd-frame ${study.id}`}>
                {study.id === 'kanzlei' ? <aside>Kanzlei</aside> : null}
                <div>
                  <p className="wd-kicker">{study.label}</p>
                  <h3>{study.promise}</h3>
                  <p>Ein nächster Schritt. Sonst nichts, das man suchen muss.</p>
                  {study.id === 'handwerk' ? <div className="wd-swatches" aria-hidden="true"><i /><i /><i /></div> : null}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="leistungen" className="wd-section">
          <div className="wd-wrap">
            <p className="wd-kicker">Leistungen</p>
            <h2>Was die Zusammenarbeit umfasst.</h2>
            <ol className="wd-services">
              {services.map((service, index) => (
                <li key={service}>
                  <b>{String(index + 1).padStart(2, '0')}</b>
                  <span>{service}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="ablauf" className="wd-section wd-cream">
          <div className="wd-wrap">
            <p className="wd-kicker">Ablauf</p>
            <h2>Vier Schritte, ein Auftritt.</h2>
            <ol className="wd-process">
              {steps.map(([n, title, text]) => (
                <li key={n}>
                  <b>{n}</b>
                  <h3 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '1.05rem', letterSpacing: 0, marginTop: '0.4rem' }}>{title}</h3>
                  <p className="wd-muted" style={{ marginTop: '0.35rem' }}>{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="realsync" className="wd-section">
          <div className="wd-wrap">
            <p className="wd-kicker">RealSyncDynamics.AI</p>
            <h2>Die Website ist der Auftritt. Die Prüfung läuft daneben.</h2>
            <p className="wd-lead">
              Diese Seiten entstehen bei RealSync Dynamics, dem Einzelunternehmen von Dominik Steiner.
              RealSyncDynamics.AI ist das Governance OS dazu: Es prüft Website und KI-Einsatz nach DSGVO
              und EU AI Act — mit konkretem Befund, nicht mit einem allgemeinen Ratgeber.
            </p>
            <p className="wd-fine">
              Kostenloser Website-Check, Ergebnis in unter 90 Sekunden, ohne Konto. Datenhaltung in Frankfurt.
            </p>
            <div className="wd-actions">
              <Link className="wd-cta" to="/audit?source=webdesign">Demo starten</Link>
              <Link className="wd-ghost" to="/">Zum Governance OS</Link>
            </div>
          </div>
        </section>

        <section className="wd-section wd-claim">
          <div className="wd-wrap">
            <blockquote>Ihr Unternehmen ist einzigartig. Ihre Website sollte es auch sein.</blockquote>
          </div>
        </section>

        <section id="kontakt" className="wd-section">
          <div className="wd-wrap wd-contact">
            <div>
              <p className="wd-kicker">Kontakt</p>
              <h2>Erzählen Sie kurz von Ihrem Unternehmen.</h2>
              <p className="wd-lead">
                Die Anfrage wird nicht gespeichert. Sie öffnen damit Ihr E-Mail-Programm.
              </p>
              <p className="wd-fine">
                <a href={`mailto:${MAIL}`}>{MAIL}</a>
                {' · '}
                <a href="tel:+4917640132161">+49 176 4013 2161</a>
              </p>
            </div>
            <form className="wd-form" onSubmit={onSubmit} noValidate>
              <div className="wd-fields two">
                <label>Name<input name="name" autoComplete="name" required /></label>
                <label>E-Mail<input name="email" type="email" autoComplete="email" required /></label>
                <label>Unternehmen<input name="company" autoComplete="organization" /></label>
                <label>
                  Anliegen
                  <select name="topic" defaultValue="One-Page-Website">
                    <option>One-Page-Website</option>
                    <option>Landingpage</option>
                    <option>Bestehende Seite überarbeiten</option>
                    <option>Noch offen</option>
                  </select>
                </label>
              </div>
              <label className="wd-fields" style={{ marginTop: '0.9rem' }}>
                Vorhaben
                <textarea name="message" required />
              </label>
              {error ? <p className="wd-error" style={{ marginTop: '0.8rem' }}>{error}</p> : null}
              <div className="wd-actions">
                <button className="wd-cta" type="submit">Nachricht vorbereiten</button>
                {mailHref ? <a className="wd-ghost" href={mailHref}>Im E-Mail-Programm öffnen</a> : null}
              </div>
              {draft ? <p className="wd-fine">Text ist fertig. Es wurde nichts gespeichert.</p> : null}
            </form>
          </div>
        </section>
      </main>

      <footer className="wd-wrap wd-footer">
        <p>
          Dominik Steiner · Einzelunternehmen · Schwarzburger Str. 31, 98724 Neuhaus am Rennweg ·{' '}
          <Link to="/impressum">Impressum</Link>
          {' · '}
          <Link to="/datenschutz">Datenschutz</Link>
          {' · '}
          <Link to="/">RealSyncDynamics.AI</Link>
        </p>
        <p style={{ marginTop: '0.4rem' }}>Kleinunternehmer nach § 19 UStG. Keine Umsatzsteuer.</p>
      </footer>
    </div>
  );
}
