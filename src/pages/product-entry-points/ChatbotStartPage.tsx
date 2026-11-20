import { Link } from 'react-router-dom';
import { CapabilityAvailabilityNotice } from '../../components/landing/CapabilityAvailabilityNotice';
import { STATUS_TEXT, registryStatus } from '../../components/landing/v3/landingV3Data';
import { StatusPill, V3ModuleSwitch, V3PageShell } from '../../components/landing/v3/V3Shell';
import { usePageMeta } from '../../lib/usePageMeta';

/**
 * /chatbot/start — Einstieg KI-Chat-Assistent.
 *
 * Gestaltung und Navigation wie die Startseite v3 (`V3PageShell`):
 * Hauptnavigation, Brotkrumen, „Auf dieser Seite“, Modulwechsel, Footer.
 * Die Stationen folgen `supabase/functions/bot-chat/index.ts` (Regelprüfung vor
 * dem Speichern, Kontingent über `consumeUsage`, Budget-Grenze). Der Zustand
 * der Bot-Laufzeit kommt ausschließlich aus dem Registry: Status-Pill aus
 * `implementation-status.ts` (`channel-bots`), Hinweis über
 * `CapabilityAvailabilityNotice`.
 */
const SOURCE = 'chatbot_start';

const STATIONS: Array<{ k: string; t: string; d: string }> = [
  { k: 'NACHRICHT', t: 'Frage kommt an', d: 'Eine Besucherin schreibt im Chat auf Ihrer Website.' },
  { k: 'REGELN', t: 'Regelprüfung', d: 'Vor dem Speichern prüft die Plattform die Nachricht gegen Ihre Regeln. Im Standard läuft die Prüfung im Beobachtungsmodus und protokolliert nur; erst im Durchsetzungsmodus beendet eine Blockade die Antwort.' },
  { k: 'KONTINGENT', t: 'Kontingent', d: 'Jede Antwort zählt gegen das Nachrichten-Kontingent Ihres Pakets. Ein festes KI-Budget je Monat begrenzt die Kosten.' },
  { k: 'ANTWORT', t: 'Antwort', d: 'Der Bot antwortet im Ton und mit den Vorgaben, die Sie für ihn festlegen.' },
  { k: 'PROTOKOLL', t: 'Protokoll', d: 'Frage und Antwort werden in Ihrem Konto gespeichert und sind nachvollziehbar.' },
];

const CHANNELS: Array<{ n: string; s: string }> = [
  { n: 'Web-Chat', s: 'Snippet für Ihre Website' },
  { n: 'WhatsApp', s: 'Vorschau' },
  { n: 'Telegram', s: 'Vorschau' },
];

const LIMITS = [
  'Was der Bot sagen darf, legen Sie in seinen Vorgaben fest. Er ersetzt keine Rechtsberatung.',
  'Ist das Kontingent erreicht, antwortet der Bot nicht mehr, bis das nächste Kontingent beginnt oder Sie das Paket wechseln.',
  'Die Übergabe an einen Menschen ist in Vorbereitung.',
];

const SECTIONS = [
  { id: 'ueberblick', label: 'Überblick' },
  { id: 'ablauf', label: 'Ablauf' },
  { id: 'kanaele', label: 'Kanäle' },
  { id: 'grenzen', label: 'Grenzen' },
  { id: 'module', label: 'Weitere Module' },
] as const;

export function ChatbotStartPage() {
  usePageMeta({
    title: 'KI-Chat-Assistent — Antworten mit Regeln, Kontingent und Protokoll',
    description:
      'Der KI-Chat-Assistent von RealSyncDynamics.AI beantwortet Fragen auf Ihrer Website, prüft jede Nachricht gegen Ihre Regeln und hält Kosten über Kontingent und Budget im Rahmen.',
    url: 'https://realsyncdynamicsai.de/chatbot/start',
  });

  const status = registryStatus('channel-bots');
  const statusLabel = status ? STATUS_TEXT[status] : null;

  return (
    <V3PageShell
      current="/chatbot/start"
      source={SOURCE}
      crumbs={[
        { label: 'Start', to: '/' },
        { label: 'Module', to: '/#module' },
        { label: 'KI-Chat-Assistent' },
      ]}
      sections={SECTIONS}
    >
      <section id="ueberblick" className="lv3-section lv3-section--first lv3-split" aria-labelledby="chat-h1">
        <div className="lv3-stack">
          <span className="lv3-meta">
            02 · AUTOMATE · KI-Chat-Assistent
            {statusLabel ? <StatusPill label={statusLabel} /> : null}
          </span>
          <h1 id="chat-h1" className="lv3-page-h1">
            Antworten für Ihre Kunden. Mit Regeln, die vorher prüfen.
          </h1>
          <p className="lv3-text">
            Der Chat-Assistent beantwortet Fragen auf Ihrer Website. Jede Nachricht wird gegen
            Ihre Regeln geprüft, bevor sie gespeichert wird – im Standard im Beobachtungsmodus –,
            und jede Antwort zählt gegen ein festes Kontingent.
          </p>
          <CapabilityAvailabilityNotice capabilityId="bots" tone="light" />
          <div className="lv3-actions">
            <Link to="/app/bots" className="lv3-btn lv3-btn--solid lv3-btn--lg">
              Chat-Assistent erstellen <span aria-hidden="true">&nbsp;→</span>
            </Link>
            <Link to={`/pricing?source=${SOURCE}`} className="lv3-btn lv3-btn--lg">
              Pläne vergleichen
            </Link>
          </div>
        </div>

        <dl className="lv3-facts" aria-label="Kurzüberblick">
          <div><dt>Status</dt><dd>{statusLabel ?? 'Nicht erfasst'}</dd></div>
          <div><dt>Kanäle</dt><dd>Web-Chat · WhatsApp und Telegram als Vorschau</dd></div>
          <div><dt>Regelprüfung</dt><dd>Vor dem Speichern, im Standard im Beobachtungsmodus</dd></div>
          <div><dt>Kosten</dt><dd>Nachrichten-Kontingent je Paket, festes KI-Budget je Monat</dd></div>
          <div><dt>Protokoll</dt><dd>Frage und Antwort in Ihrem Konto</dd></div>
          <div><dt>Übergabe</dt><dd>An einen Menschen: in Vorbereitung</dd></div>
        </dl>
      </section>

      <section id="ablauf" className="lv3-section" aria-labelledby="chat-ablauf-h">
        <span className="lv3-eyebrow">Stationen einer Antwort</span>
        <h2 id="chat-ablauf-h" className="lv3-h2">Von der Frage zum Protokoll.</h2>
        <ol className="lv3-flow">
          {STATIONS.map((s, i) => (
            <li key={s.k}>
              <span className="lv3-meta">{String(i + 1).padStart(2, '0')} · {s.k}</span>
              <strong>{s.t}</strong>
              <p>{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="kanaele" className="lv3-section" aria-labelledby="chat-kanaele-h">
        <span className="lv3-eyebrow">Kanäle</span>
        <h2 id="chat-kanaele-h" className="lv3-h2">Wo der Assistent antwortet.</h2>
        <ul className="lv3-cards lv3-cards--compact lv3-list-reset">
          {CHANNELS.map((c) => (
            <li key={c.n} className="lv3-card">
              <strong className="lv3-card-name">{c.n}</strong>
              <StatusPill label={c.s} />
            </li>
          ))}
        </ul>
      </section>

      <section id="grenzen" className="lv3-section lv3-split" aria-labelledby="chat-grenzen-h">
        <div className="lv3-stack">
          <span className="lv3-eyebrow">Grenzen</span>
          <h2 id="chat-grenzen-h" className="lv3-h2">Klare Grenzen.</h2>
        </div>
        <ul className="lv3-limits">
          {LIMITS.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </section>

      <V3ModuleSwitch currentKey="bots" />

      <section id="loslegen" className="lv3-section lv3-start" aria-labelledby="chat-start-h">
        <h2 id="chat-start-h" className="lv3-h2">Ersten Assistenten anlegen.</h2>
        <p className="lv3-text">Vorgaben festlegen, Regeln wählen, Kontingent über Ihr Paket.</p>
        <div className="lv3-actions">
          <Link to="/app/bots" className="lv3-btn lv3-btn--solid lv3-btn--lg">Chat-Assistent erstellen</Link>
          <Link to={`/pricing?source=${SOURCE}`} className="lv3-btn lv3-btn--lg">Pläne vergleichen</Link>
        </div>
      </section>
    </V3PageShell>
  );
}
