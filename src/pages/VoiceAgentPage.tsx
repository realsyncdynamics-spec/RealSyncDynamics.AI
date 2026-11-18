import { Link } from 'react-router-dom';
import { NeonModeToggle } from '../components/neon/NeonModeToggle';
import { VoiceBotStage } from '../components/voice-agent/VoiceBotStage';
import { useNeonMode } from '../hooks/useNeonMode';
import { COMPANY_LINE, LEGAL_LINKS, STATUS_TEXT, TAX_NOTE, registryStatus } from '../components/landing/v3/landingV3Data';
import { BETA, betaSignupHref } from '../config/beta';
import '../styles/landing-v3.css';
import '../styles/neon-theme.css';
import '../styles/voice-agent.css';

/**
 * Voice-Agent-Seite unter `/voice-agent` — eigene Produktseite für den
 * Sprachagenten (AI Receptionist am Telefon).
 *
 * Status nur aus der Registry (`src/product/implementation-status.ts`):
 *   - Telefonie: `voice-telephony` (derzeit nicht live)
 *   - Chat-Assistent: `channel-bots`
 * Ohne Registry-Eintrag kein Badge. Kunden-Dashboard und Ablauf sind als
 * geplant beschrieben, Beispieldaten sind gekennzeichnet. Kein Preis: Für den
 * Voice Agent gibt es keinen Eintrag in `shared/pricing.ts`, daher „Preis folgt“.
 *
 * Die 3D-Figur hat einen Anschluss für eine spätere Stimme (`speaking`); die
 * Seite verbindet keine Sprach-API.
 *
 * Gestaltung: Neon-Design wie die Startseite (`.lv3-neon` aus styles/neon-theme.css,
 * Hell/Dunkel-Schalter mit demselben Speicherschlüssel wie die Startseite).
 */

const SOURCE = 'voice-agent-page';
const WAITLIST = (spot: string) => `/warteliste?interest=bots&source=${SOURCE}-${spot}`;
const TRY_CHAT = `/chatbot/start?source=${SOURCE}`;

const AUDIENCES = [
  { name: 'Bäckerei & Metzgerei', text: 'Vorbestellungen für Wochenende, Feiertage und Partyplatten, mit Abholzeit und Name.' },
  { name: 'Friseur & Kosmetik', text: 'Terminwünsche mit Leistung, Wunschzeit und Rückrufnummer. Ihr Team bestätigt.' },
  { name: 'Kanzlei & Beratung', text: 'Erstanfragen mit Anliegen und Dringlichkeit. Keine Rechtsauskunft, nur geordnete Aufnahme.' },
  { name: 'Handwerk', text: 'Auftragsanfragen und Rückrufbitten, während Sie auf der Baustelle sind.' },
] as const;

const STEPS = ['Anfrage annehmen', 'Kontakt erfassen', 'Wunsch aufnehmen', 'An einen Menschen übergeben'] as const;

const SAMPLE_ROWS = [
  { kind: 'Vorbestellung', who: 'Meier', what: '2 × Bauernbrot, 12 × Brötchen', when: 'Sa, 8:30', state: 'neu' },
  { kind: 'Partyplatte', who: 'Schulz', what: 'Platte für 20 Personen, Rückfrage zu Allergenen', when: 'Fr, 16:00', state: 'Rückruf nötig' },
  { kind: 'Anfrage', who: 'Krüger', what: 'Öffnungszeiten an Heiligabend', when: '–', state: 'neu' },
  { kind: 'Vorbestellung', who: 'Becker', what: 'Geburtstagstorte mit Beschriftung', when: 'So, 10:00', state: 'bestätigt' },
] as const;

const PRINCIPLES = [
  { title: 'Keine verbindlichen Zusagen', text: 'Bestellungen und Terminwünsche gelten erst, wenn Ihr Team sie bestätigt.' },
  { title: 'Nur das Nötige erfassen', text: 'Name, Rückrufnummer und Anliegen, soweit die Anfrage es braucht.' },
  { title: 'Übergabe an Menschen', text: 'Bei Unklarheit, Beschwerden oder sensiblen Themen geht die Anfrage an Ihr Team.' },
  { title: 'Nachvollziehbar', text: 'Freigaben laufen über das Governance OS und bleiben dort dokumentiert.' },
] as const;

function StatusPill({ label }: { label: string }) {
  return <span className="lv3-pill">{label}</span>;
}

export function VoiceAgentPage() {
  const telephony = registryStatus('voice-telephony');
  const chat = registryStatus('channel-bots');
  const telephonyLive = telephony === 'live';
  const [mode, toggleMode] = useNeonMode('rs-neon-mode-landing', 'light');

  const faqs: Array<{ q: string; a: string }> = [
    {
      q: 'Kann der Voice Agent schon telefonieren?',
      a: telephonyLive
        ? 'Ja, die Telefonie ist live.'
        : 'Noch nicht. Der Assistent beantwortet Anfragen derzeit im Chat. Telefonie: In Vorbereitung. Auf der Warteliste erfahren Sie zuerst, wann sie startet.',
    },
    { q: 'Sagt der Agent Bestellungen oder Termine fest zu?', a: 'Nein. Er nimmt Wünsche auf und legt sie ab. Verbindlich wird es erst, wenn Ihr Team bestätigt.' },
    { q: 'Was kostet der Voice Agent?', a: `Der Preis steht noch nicht fest. Auf der Warteliste erfahren Sie ihn zuerst. ${TAX_NOTE}` },
    { q: 'Für welche Betriebe eignet er sich?', a: 'Für Betriebe mit vielen wiederkehrenden Anfragen: Bäckereien, Metzgereien, Friseure, Kanzleien, Handwerksbetriebe und ähnliche.' },
  ];

  return (
    <div className="lv3 lv3-neon va" data-mode={mode}>
      <a href="#ablauf" className="lv3-skip">Zum Inhalt springen</a>

      {BETA.active && BETA.publicOffer ? (
        <p className="lv3-ribbon">
          <span>{BETA.headline} – bis {BETA.endsLabel}, keine Kreditkarte.</span>{' '}
          <Link to={betaSignupHref(BETA.testPlan, `${SOURCE}-ribbon`)}>Jetzt kostenlos testen</Link>
        </p>
      ) : null}

      <header className="lv3-hero" id="top">
        <nav className="lv3-nav" aria-label="Hauptnavigation">
          <Link to="/" className="lv3-brand">RealSync Dynamics &amp; AI</Link>
          <Link to="/#katalog">Build</Link>
          <Link to="/#govern">Govern</Link>
          <Link to="/voice-agent" aria-current="page">Voice Agent</Link>
          <Link to="/#preise">Preise</Link>
          <a href="#fragen">Fragen</a>
          <Link to="/contact-sales">Kontakt</Link>
          <Link to="/welcome">Anmelden</Link>
          <NeonModeToggle mode={mode} onToggle={toggleMode} />
          <Link className="lv3-btn lv3-btn--solid" to={WAITLIST('nav')}>Auf die Warteliste</Link>
        </nav>

        <div className="lv3-hero-grid">
          <div className="lv3-hero-copy">
            <span className="lv3-eyebrow">
              Voice Agent für Betriebe mit Kundenkontakt
              {telephony ? <> <StatusPill label={`Telefonie: ${STATUS_TEXT[telephony]}`} /></> : null}
            </span>
            <h1 className="lv3-h1" data-testid="va-hero-heading">
              <span>Jede Anfrage angenommen.</span>
              <span className="lv3-h1-2">Auch wenn alle beschäftigt sind.</span>
            </h1>
            <p className="lv3-lead">
              Der Voice Agent soll Bestellungen, Terminwünsche und Rückrufbitten annehmen, die Kontaktdaten erfassen und alles geordnet für Ihr Team ablegen. Entscheidungen trifft weiterhin ein Mensch.
            </p>
            <div className="lv3-actions">
              <Link className="lv3-btn lv3-btn--solid lv3-btn--lg" to={WAITLIST('hero')} data-testid="va-waitlist">Auf die Warteliste</Link>
              <Link className="lv3-btn lv3-btn--lg" to={TRY_CHAT} data-testid="va-try-chat">
                Chat-Assistent ausprobieren
                {chat ? <> <StatusPill label={STATUS_TEXT[chat]} /></> : null}
              </Link>
            </div>
          </div>

          <div className="va-hero-visual">
            <VoiceBotStage statusLabel={telephony ? `Vorschau · ${STATUS_TEXT[telephony]}` : 'Vorschau'} />
            <div className="va-talk" aria-label="Beispielgespräch einer Bäckerei">
              <span className="lv3-meta">Beispielgespräch · Bäckerei</span>
              <p className="va-msg">Hallo, ich hätte gern für Samstag zwei Bauernbrote und zwölf Brötchen.</p>
              <p className="va-msg va-msg--bot">Gern. Auf welchen Namen, und wann möchten Sie abholen?</p>
              <p className="va-msg">Meier, gegen halb neun.</p>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section className="lv3-section" aria-labelledby="va-who-h">
          <span className="lv3-eyebrow">Für wen</span>
          <h2 id="va-who-h" className="lv3-h2">Für Betriebe, in denen das Telefon nie still steht.</h2>
          <div className="lv3-cards">
            {AUDIENCES.map((a) => (
              <div key={a.name} className="lv3-card va-card">
                <span className="lv3-card-name">{a.name}</span>
                <p className="lv3-text">{a.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="ablauf" className="lv3-section lv3-split" aria-labelledby="va-flow-h">
          <div>
            <span className="lv3-eyebrow">Geplanter Ablauf</span>
            <h2 id="va-flow-h" className="lv3-h2">Vom Anruf zur erledigten Aufgabe.</h2>
          </div>
          <ol className="lv3-steps" data-testid="va-steps">
            {STEPS.map((s, i) => (
              <li key={s}><span className="lv3-meta">{String(i + 1).padStart(2, '0')}</span><span>{s}</span></li>
            ))}
          </ol>
        </section>

        <section className="lv3-section" aria-labelledby="va-dash-h">
          <span className="lv3-eyebrow">Geplant: Kunden-Dashboard</span>
          <h2 id="va-dash-h" className="lv3-h2">Alles, was reinkommt, an einem Ort.</h2>
          <p className="lv3-text">Bestellungen, Anfragen und Terminwünsche sollen sortiert im Dashboard Ihres Betriebs landen: was neu ist, was wartet und was erledigt ist.</p>
          <div className="va-table-wrap">
            <table className="va-table">
              <thead><tr><th>Art</th><th>Kunde</th><th>Anliegen</th><th>Wann</th><th>Status</th></tr></thead>
              <tbody>
                {SAMPLE_ROWS.map((r) => (
                  <tr key={`${r.who}-${r.kind}`}>
                    <td data-l="Art">{r.kind}</td>
                    <td data-l="Kunde">{r.who}</td>
                    <td data-l="Anliegen">{r.what}</td>
                    <td data-l="Wann" className="va-nowrap">{r.when}</td>
                    <td data-l="Status"><span className="lv3-pill">{r.state}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="lv3-fine">Beispieldaten zur Veranschaulichung.</p>
        </section>

        <section className="lv3-section lv3-split" aria-labelledby="va-ctrl-h">
          <div>
            <span className="lv3-eyebrow">Kontrolle</span>
            <h2 id="va-ctrl-h" className="lv3-h2">Der Agent nimmt auf. Ihr Team entscheidet.</h2>
          </div>
          <ul className="va-list">
            {PRINCIPLES.map((p) => (
              <li key={p.title}><strong>{p.title}</strong><span>{p.text}</span></li>
            ))}
          </ul>
        </section>

        <section className="lv3-section lv3-split" aria-labelledby="va-price-h">
          <div>
            <span className="lv3-eyebrow">Preis</span>
            <h2 id="va-price-h" className="lv3-h2">Preis folgt.</h2>
            <p className="lv3-text">Auf der Warteliste erfahren Sie zuerst, wann die Telefonie startet und was der Voice Agent kostet. Ohne Verpflichtung.</p>
            <p className="lv3-fine">{TAX_NOTE}</p>
          </div>
          <div className="lv3-actions">
            <Link className="lv3-btn lv3-btn--solid lv3-btn--lg" to={WAITLIST('price')}>Auf die Warteliste</Link>
          </div>
        </section>

        <section id="fragen" className="lv3-section lv3-split" aria-labelledby="va-faq-h">
          <div>
            <span className="lv3-eyebrow">Häufige Fragen</span>
            <h2 id="va-faq-h" className="lv3-h2">Kurz beantwortet.</h2>
          </div>
          <div className="lv3-faq">
            {faqs.map((f) => (
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

export default VoiceAgentPage;
