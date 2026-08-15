import { useEffect, useState } from 'react';
import {
  ArrowRight,
  ClipboardCheck,
  FileLock2,
  Fingerprint,
  Gauge,
  MailCheck,
  ServerCog,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
// Der FAQ-Text liegt in der SEO-Config, weil er dort zusaetzlich als
// FAQPage-JSON-LD ausgeliefert wird — eine Quelle statt zwei Kopien.
import { WAITLIST_FAQ } from '../config/seo';
import {
  SmartLink,
  LandingHeader,
  LandingFooter,
  SCAN_CTA,
} from '../components/landing/LandingShell';
import { WaitlistForm } from '../components/landing/WaitlistForm';

/**
 * WaitlistLanding — /warteliste (Alias /waitlist).
 *
 * Einstieg fuer Interessenten, die auf Modul-Freigaben warten. Bewusst ohne
 * erfundene Zahlen: der Anmeldezaehler kommt live aus `waitlist-join` (GET)
 * und wird ausgeblendet, wenn das Backend nicht antwortet — lieber kein
 * Sozialbeweis als ein geratener.
 *
 * Design folgt dem Light-Theme "European Enterprise Trust" aus CLAUDE.md §10
 * und verwendet ausschliesslich bestehende Tokens (petrol/slate,
 * rounded-chip/card/panel, Monospace nur fuer Metadaten).
 */

const BENEFITS = [
  {
    icon: ServerCog,
    title: 'Zugang vor der allgemeinen Freigabe',
    text: 'Module werden in Wellen freigeschaltet. Wer auf der Liste steht, bekommt den Zugang, sobald Kapazität frei wird — in der Reihenfolge der Anmeldung.',
  },
  {
    icon: ClipboardCheck,
    title: 'Onboarding mit echtem Setup',
    text: 'Kein leeres Dashboard: Beim Start richten wir gemeinsam Ihr KI-Inventar, die passenden Policy Packs und die erste Risikoklassifikation ein.',
  },
  {
    icon: Users,
    title: 'Einfluss auf die Roadmap',
    text: 'Rückmeldungen aus der Warteliste fließen direkt in die Priorisierung. Was blockiert, wird zuerst gebaut.',
  },
];

const MODULES = [
  {
    icon: Gauge,
    name: 'Governance Runtime',
    text: 'Kontinuierliche Überwachung Ihrer KI-Systeme: Sentinel-Loop, SLO-Tracking und automatische Zuordnung von Assets zu Control-Status.',
  },
  {
    icon: FileLock2,
    name: 'Evidence Vault',
    text: 'Auditierbare Nachweise mit Hash-Kette, Export als PDF/JSON und Compliance-Hold für laufende Prüfungen.',
  },
  {
    icon: ShieldCheck,
    name: 'Policy Packs',
    text: 'DSGVO, EU AI Act und branchenspezifische Regelwerke — inklusive Empfehlung passend zur Branche Ihres Workspaces.',
  },
  {
    icon: Fingerprint,
    name: 'Herkunftsnachweis (C2PA)',
    text: 'Ed25519-signierte Content Credentials, lückenlose Übergabekette und externe Verifizierung gegen Deepfakes.',
  },
];

const STEPS = [
  {
    step: '01',
    title: 'Eintragen',
    text: 'E-Mail plus das Modul, auf das Sie warten. Sie erhalten sofort Ihre Position auf der Liste.',
  },
  {
    step: '02',
    title: 'Einordnung',
    text: 'Wir prüfen, welche Module zu Ihrem Anwendungsfall passen und ob Sie schon heute ohne Warteliste starten können.',
  },
  {
    step: '03',
    title: 'Einladung',
    text: 'Sobald ein Platz frei wird, kommt Ihre Einladung per E-Mail — mit Zugang und einem Termin fürs Setup.',
  },
];

const TRUST = [
  'EU-Hosting (Frankfurt)',
  'DSGVO-konform',
  'EU AI Act',
  'Kein Newsletter',
  'Jederzeit widerrufbar',
];

export function WaitlistLanding() {
  const signupCount = useWaitlistCount();

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 antialiased">
      <SEOHead />
      <LandingHeader />

      {/* HERO */}
      <section className="border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <span className="mb-7 inline-flex items-center gap-2 rounded-chip border border-petrol-200 bg-petrol-50 px-3 py-1">
                <MailCheck className="h-3.5 w-3.5 text-petrol-700" />
                <span className="font-mono text-[11px] uppercase tracking-widest text-petrol-700">
                  Warteliste · Früher Zugang
                </span>
              </span>

              <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                Sichern Sie sich Ihren Platz für die AI Governance Runtime
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl">
                Wir geben neue Module in Wellen frei, damit jedes Onboarding begleitet
                stattfinden kann. Tragen Sie sich ein — Sie bekommen sofort Ihre Position
                und die Einladung, sobald ein Platz frei wird.
              </p>

              <ul className="mt-8 space-y-3">
                {[
                  'Kostenlos und unverbindlich — kein Vertrag, keine Zahlungsdaten',
                  'Position wird sofort angezeigt, Einladung in Reihenfolge der Anmeldung',
                  'Der DSGVO-Website-Scan bleibt ohne Warteliste nutzbar',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-petrol-600" strokeWidth={1.75} />
                    <span className="text-base leading-relaxed text-slate-600">{item}</span>
                  </li>
                ))}
              </ul>

              {/* Zaehler nur, wenn er real aus der DB kommt. */}
              {signupCount !== null && signupCount > 0 && (
                <p className="mt-8 font-mono text-[11px] uppercase tracking-widest text-slate-400">
                  {signupCount} {signupCount === 1 ? 'Anmeldung' : 'Anmeldungen'} bisher
                </p>
              )}

              <div className="mt-8 flex flex-wrap gap-2">
                {TRUST.map((item) => (
                  <span
                    key={item}
                    className="rounded-chip border border-slate-200 bg-white px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-slate-500"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <WaitlistForm id="warteliste-formular" source="warteliste-hero" />
          </div>
        </div>
      </section>

      {/* WARUM EINTRAGEN */}
      <Section eyebrow="Vorteile" title="Was Sie von der Warteliste haben">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {BENEFITS.map((b) => (
            <div key={b.title} className="rounded-panel border border-slate-200 bg-white p-7">
              <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-card border border-petrol-100 bg-petrol-50">
                <b.icon className="h-5 w-5 text-petrol-700" strokeWidth={1.75} />
              </span>
              <h3 className="mb-2 text-lg font-semibold text-slate-900">{b.title}</h3>
              <p className="text-sm leading-relaxed text-slate-600">{b.text}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ABLAUF */}
      <Section eyebrow="Ablauf" title="In drei Schritten zum Zugang" tint>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.step} className="rounded-panel border border-slate-200 bg-white p-7">
              <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.25em] text-petrol-700">
                Schritt {s.step}
              </p>
              <h3 className="mb-2 text-lg font-semibold text-slate-900">{s.title}</h3>
              <p className="text-sm leading-relaxed text-slate-600">{s.text}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* MODULE */}
      <Section eyebrow="Module" title="Worauf Sie warten können">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {MODULES.map((m) => (
            <div key={m.name} className="rounded-panel border border-slate-200 bg-white p-7">
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card border border-petrol-100 bg-petrol-50">
                  <m.icon className="h-5 w-5 text-petrol-700" strokeWidth={1.75} />
                </span>
                <div>
                  <h3 className="mb-2 text-lg font-semibold text-slate-900">{m.name}</h3>
                  <p className="text-sm leading-relaxed text-slate-600">{m.text}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-8 max-w-3xl text-sm leading-relaxed text-slate-500">
          Nicht jedes Modul ist für jeden Workspace freigegeben. Welche Bausteine für Sie
          verfügbar sind, klären wir bei der Einordnung — im Zweifel schneller als die
          Liste vermuten lässt.
        </p>
      </Section>

      {/* SOFORT VERFÜGBAR */}
      <Section eyebrow="Ohne Warten" title="Das können Sie heute schon nutzen" tint>
        <div className="max-w-3xl rounded-panel border border-slate-200 bg-white p-7 sm:p-8">
          <p className="text-base leading-relaxed text-slate-600">
            Der DSGVO-Website-Scan prüft Ihre Seite auf Tracker, fehlende Rechtsdokumente,
            Consent-Probleme und Security-Header — ohne Konto und ohne Warteliste. Die
            Ergebnisse sind später Teil Ihres Governance-Bilds, wenn Sie starten.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <SmartLink
              to={SCAN_CTA}
              className="group inline-flex items-center justify-center gap-2 rounded-chip bg-petrol-700 px-7 py-4 text-base font-semibold text-white transition-colors hover:bg-petrol-600"
            >
              Website kostenlos scannen
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </SmartLink>
            <SmartLink
              to="/tools"
              className="inline-flex items-center justify-center gap-2 rounded-chip border border-slate-300 bg-white px-7 py-4 text-base font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
            >
              Kostenlose Tools ansehen
            </SmartLink>
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section eyebrow="Fragen" title="Häufige Fragen zur Warteliste">
        <div className="max-w-3xl space-y-4">
          {WAITLIST_FAQ.map((item) => (
            <details
              key={item.q}
              className="group rounded-panel border border-slate-200 bg-white px-6 py-5 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 text-base font-semibold text-slate-900">
                {item.q}
                <ArrowRight className="h-4 w-4 shrink-0 text-petrol-600 transition-transform group-open:rotate-90" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.a}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* ABSCHLUSS-CTA */}
      <section className="bg-white">
        <div className="mx-auto max-w-5xl px-4 pb-20 sm:px-6 sm:pb-24 lg:px-8">
          <div className="rounded-panel border border-petrol-200 bg-petrol-50 p-10 sm:p-14">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                Platz sichern — in unter einer Minute
              </h2>
              <p className="mb-9 text-base leading-relaxed text-slate-600 sm:text-lg">
                E-Mail eintragen, Modul auswählen, fertig. Ihre Position sehen Sie sofort.
              </p>
            </div>
            <div className="mx-auto max-w-xl">
              <WaitlistForm source="warteliste-footer" compact />
            </div>
            <p className="mt-8 text-center text-sm text-slate-600">
              Sie haben eine feste Frist oder brauchen Enterprise-Konditionen?{' '}
              <SmartLink
                to="/contact-sales?source=warteliste"
                className="font-semibold text-petrol-700 hover:underline"
              >
                Sprechen Sie direkt mit uns
              </SmartLink>
              .
            </p>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}

/**
 * Liest die reale Anzahl der Wartelisten-Eintraege. Gibt `null` zurueck, solange
 * geladen wird oder wenn das Backend nicht erreichbar ist — die Seite zeigt den
 * Zaehler dann gar nicht, statt eine Zahl zu erfinden.
 */
function useWaitlistCount(): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    // Env lazy im Effect lesen — als Modul-Konstante waere sie schon vor dem
    // ersten Render eingefroren und in Tests nicht mehr stubbar.
    const baseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    if (!baseUrl) return;
    const controller = new AbortController();
    fetch(`${baseUrl}/functions/v1/waitlist-join`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.ok && typeof data.count === 'number') setCount(data.count);
      })
      .catch(() => { /* Zaehler ist Beiwerk — Fehler bleiben still */ });
    return () => controller.abort();
  }, []);

  return count;
}

function Section({
  eyebrow,
  title,
  tint,
  children,
}: {
  eyebrow: string;
  title: string;
  tint?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={tint ? 'bg-slate-50' : 'bg-white'}>
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="mb-12 max-w-2xl">
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.25em] text-petrol-700">
            {eyebrow}
          </p>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            {title}
          </h2>
        </div>
        {children}
      </div>
    </section>
  );
}
