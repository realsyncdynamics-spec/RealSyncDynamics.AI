import { Link } from 'react-router-dom';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { LandingHeader } from '../../components/landing/LandingShell';
import { CapabilityAvailabilityNotice } from '../../components/landing/CapabilityAvailabilityNotice';
import { usePageMeta } from '../../lib/usePageMeta';

/**
 * /chatbot/start — Einstieg KI-Chat-Assistent.
 *
 * Aufbau angeglichen an die Produkt-Landingpage „KI-Bots“ im Design (15.11.2026):
 * Stationen einer Antwort, Kanäle, klare Grenzen. Die Stationen folgen
 * `supabase/functions/bot-chat/index.ts` (Regelprüfung vor dem Speichern,
 * Kontingent über `consumeUsage`, Budget-Grenze). Der Zustand der Bot-Laufzeit
 * kommt ausschließlich aus dem Registry über `CapabilityAvailabilityNotice`.
 */
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

export function ChatbotStartPage() {
  usePageMeta({
    title: 'KI-Chat-Assistent — Antworten mit Regeln, Kontingent und Protokoll',
    description:
      'Der KI-Chat-Assistent von RealSyncDynamics.AI beantwortet Fragen auf Ihrer Website, prüft jede Nachricht gegen Ihre Regeln und hält Kosten über Kontingent und Budget im Rahmen.',
    url: 'https://realsyncdynamicsai.de/chatbot/start',
  });

  return (
    <div className="rs-paper bg-hero-only min-h-screen flex flex-col text-titanium-50">
      <LandingHeader />

      <section className="px-4 sm:px-6 lg:px-8 pt-14 pb-10 sm:pt-20 sm:pb-14">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-4">
            <MessageCircle className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            02 · Bots · KI-Chat-Assistent
          </div>
          <h1 className="font-display font-bold text-4xl sm:text-6xl text-titanium-50 tracking-tight leading-[1.03] max-w-4xl">
            Antworten für Ihre Kunden. Mit Regeln, die vorher prüfen.
          </h1>
          <p className="mt-6 max-w-3xl text-base sm:text-xl text-silver-300 leading-relaxed">
            Der Chat-Assistent beantwortet Fragen auf Ihrer Website. Jede Nachricht wird gegen
            Ihre Regeln geprüft, bevor sie gespeichert wird – im Standard im Beobachtungsmodus –,
            und jede Antwort zählt gegen ein festes Kontingent.
          </p>

          <CapabilityAvailabilityNotice capabilityId="bots" className="mt-8 max-w-3xl" />

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              to="/app/bots"
              className="surface-mono inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-bold rounded-none"
            >
              Chat-Assistent erstellen <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/pricing?source=chatbot_start"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 border border-silver-500 hover:border-titanium-200 text-silver-100 hover:text-titanium-50 text-base font-semibold rounded-none transition-colors"
            >
              Pläne vergleichen
            </Link>
          </div>
        </div>
      </section>

      <section aria-label="Stationen einer Antwort" className="px-4 sm:px-6 lg:px-8 pb-12">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.25em] text-titanium-100 mb-4">
            Stationen einer Antwort
          </h2>
          <ol className="grid gap-px bg-silver-700/30 border border-silver-700/30 sm:grid-cols-2 lg:grid-cols-5">
            {STATIONS.map((s, i) => (
              <li key={s.k} className="bg-[var(--brand-bg-0,#0b0d10)] p-5 flex flex-col gap-2">
                <span className="font-mono text-[11px] tracking-[0.2em] text-titanium-100">
                  {String(i + 1).padStart(2, '0')} — {s.k}
                </span>
                <span className="font-display text-lg text-titanium-50">{s.t}</span>
                <span className="text-sm text-silver-300 leading-relaxed">{s.d}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-label="Kanäle" className="px-4 sm:px-6 lg:px-8 pb-12">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.25em] text-titanium-100 mb-4">Kanäle</h2>
          <ul className="grid gap-px bg-silver-700/30 border border-silver-700/30 sm:grid-cols-3">
            {CHANNELS.map((c) => (
              <li key={c.n} className="bg-[var(--brand-bg-0,#0b0d10)] p-5 flex items-baseline justify-between gap-3">
                <span className="font-display text-lg text-titanium-50">{c.n}</span>
                <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-silver-300">{c.s}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-label="Grenzen" className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-14">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-titanium-50 tracking-tight mb-5">
            Klare Grenzen.
          </h2>
          <ul className="max-w-3xl space-y-3 border-l border-silver-500 pl-5">
            {LIMITS.map((l) => (
              <li key={l} className="text-sm sm:text-base text-silver-300 leading-relaxed">{l}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
