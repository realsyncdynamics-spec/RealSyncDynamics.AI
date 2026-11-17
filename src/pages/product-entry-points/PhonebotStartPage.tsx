import { Link } from 'react-router-dom';
import { ArrowRight, AudioLines, Bot, CheckCircle2, ShieldCheck } from 'lucide-react';
import { SEOHead } from '../../components/SEOHead';
import { formatPriceEur, VOICE_STANDALONE_OFFERS } from '@/shared/pricing';
import { getImplementation, STATUS_LABEL } from '../../product/implementation-status';

/**
 * Eigenständiger Voice-Agent-Einstieg auf der BESTEHENDEN Route /phonebot/start.
 *
 * Voice-Pakete sind bereits im Stripe-Livekatalog angelegt, aber die
 * Verbindung Preis → eigenständiges Abo → Entitlement → Agent-Provisioning →
 * produktive Telefonnummer ist noch nicht Ende-zu-Ende freigegeben.
 * Deshalb gibt es hier ausdrücklich keinen Stripe-Zahlungsbutton.
 *
 * Das Governance-Voice-Add-on (150 EUR) ist NICHT Teil dieses Katalogs.
 * Preise stammen ausschließlich aus shared/pricing.ts.
 */
const ONBOARDING_URL = 'https://voice.realsyncdynamicsai.de/onboarding.html';
const WAITLIST_URL = '/warteliste?interest=bots&utm_source=voice-product&utm_medium=product-page&utm_campaign=voice-agent-preview';

const STEPS = [
  {
    title: 'Betrieb auswählen',
    text: 'Branche und Einsatzbereich im bestehenden Voice-Konfigurator festlegen.',
  },
  {
    title: 'Assistent gestalten',
    text: 'Stimme, Anwendungsfall und erlaubte Aufgaben im Vorschau-Onboarding auswählen.',
  },
  {
    title: 'Freigabe und Aktivierung',
    text: 'Vor dem ersten produktiven Anruf werden Vertrag, Telefonanbindung und Berechtigungen geprüft.',
  },
] as const;

export function PhonebotStartPage() {
  const implementation = getImplementation('voice-telephony');
  const statusLabel = implementation ? STATUS_LABEL[implementation.status] : 'IN VORBEREITUNG';

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SEOHead />
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link to="/" className="text-lg font-bold tracking-tight text-slate-950">
            RealSync Dynamics <span className="text-teal-700">& AI</span>
          </Link>
          <Link to="/" className="text-sm font-medium text-slate-600 hover:text-teal-700">
            Zur Plattform
          </Link>
        </div>
      </header>

      <main>
        <section className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <p className="mb-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-teal-700">
              <AudioLines className="h-4 w-4" aria-hidden="true" /> RealSync AI Voice Agent
            </p>
            <h1 className="max-w-4xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
              Ihr KI-Empfang für Kundenanfragen und Telefonie.
            </h1>
            <p className="mt-7 max-w-3xl text-lg leading-relaxed text-slate-600">
              Gestalten Sie Ihren eigenen Sprachassistenten für Handwerk, Dienstleistung,
              Praxis oder Kanzlei. Wählen Sie Branche und Stimme im vorhandenen
              Voice-Konfigurator. Die produktive Telefonanbindung ist noch in Vorbereitung.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href={ONBOARDING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center gap-2 rounded-md bg-teal-800 px-6 py-3 font-semibold text-white hover:bg-teal-900"
              >
                Voice Agent konfigurieren <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <Link
                to={WAITLIST_URL}
                className="inline-flex min-h-12 items-center rounded-md border border-slate-300 px-6 py-3 font-semibold text-slate-800 hover:border-teal-700"
              >
                Verfügbarkeit vormerken
              </Link>
            </div>
            <p className="mt-4 max-w-3xl text-sm text-slate-500" role="note">
              Produktstatus: {statusLabel}. Der Konfigurator dient derzeit der Vorbereitung.
              Es wird hier weder ein Abonnement abgeschlossen noch eine Telefonnummer aktiviert.
            </p>
          </div>
        </section>

        <section className="px-5 py-16 sm:px-8" aria-labelledby="voice-packages">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">Eigenständige Pakete</p>
            <h2 id="voice-packages" className="mt-3 text-3xl font-semibold tracking-tight">
              Drei Voice-Agent-Angebote
            </h2>
            <p className="mt-4 max-w-3xl text-slate-600">
              Diese Angebote sind separat von den Governance-Abonnements geplant.
              Die monatlichen Katalogpreise sind in Stripe hinterlegt. Leistungsgrenzen,
              Minutenkontingente und die steuerliche Behandlung werden vor Verkaufsfreigabe
              verbindlich bestätigt.
            </p>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {VOICE_STANDALONE_OFFERS.map((offer) => (
                <article key={offer.id} className="flex flex-col rounded-lg border border-slate-200 bg-white p-7 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <Bot className="h-6 w-6 text-teal-700" aria-hidden="true" />
                    <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900">
                      Vorschau
                    </span>
                  </div>
                  <h3 className="mt-6 text-xl font-semibold">{offer.name}</h3>
                  <p className="mt-4 text-3xl font-bold tracking-tight">{formatPriceEur(offer.monthlyEur)}
                    <span className="text-sm font-normal text-slate-500"> / Monat</span>
                  </p>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">
                    Monatliches Angebot im Stripe-Livekatalog angelegt; kein freigeschalteter Sofortkauf.
                  </p>
                  <a
                    href={ONBOARDING_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-7 inline-flex items-center justify-center gap-2 rounded-md border border-teal-800 px-4 py-3 text-sm font-semibold text-teal-900 hover:bg-teal-50"
                  >
                    Paket vorbereiten <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-slate-50 px-5 py-16 sm:px-8" aria-labelledby="voice-steps">
          <div className="mx-auto max-w-6xl">
            <h2 id="voice-steps" className="text-3xl font-semibold tracking-tight">Vom Entwurf zum eigenen Voice Agent</h2>
            <ol className="mt-8 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="rounded-lg border border-slate-200 bg-white p-6">
                  <span className="text-xs font-semibold tracking-widest text-teal-700">SCHRITT {String(index + 1).padStart(2, '0')}</span>
                  <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{step.text}</p>
                </li>
              ))}
            </ol>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="flex gap-3 rounded-lg border border-slate-200 bg-white p-5">
                <ShieldCheck className="h-5 w-5 shrink-0 text-teal-700" aria-hidden="true" />
                <p className="text-sm text-slate-600">Mandantenrechte, Einwilligung und kritische Aktionen werden über die vorhandene Governance-Architektur kontrolliert.</p>
              </div>
              <div className="flex gap-3 rounded-lg border border-slate-200 bg-white p-5">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-teal-700" aria-hidden="true" />
                <p className="text-sm text-slate-600">Stripe, Supabase und die ElevenLabs-Bereitstellungsfunktion sind bereits angelegt. Die vollständige Aktivierungskette wird separat geprüft.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-slate-200 bg-white px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-4 text-sm text-slate-500">
          <span>RealSync Dynamics & AI · Voice Agent</span>
          <div className="flex gap-5">
            <Link to="/impressum" className="hover:text-slate-900">Impressum</Link>
            <Link to="/datenschutz" className="hover:text-slate-900">Datenschutz</Link>
            <Link to="/kontakt" className="hover:text-slate-900">Kontakt</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
