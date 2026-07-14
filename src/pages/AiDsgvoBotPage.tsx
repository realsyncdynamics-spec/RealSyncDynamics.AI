import { SEOHead } from '../components/SEOHead';
import {
  ArrowRight,
  Bot,
  MessageSquareText,
  ListChecks,
  Scale,
  ClipboardList,
  FileText,
  FileLock2,
  ShieldAlert,
} from 'lucide-react';
import {
  SmartLink,
  LandingHeader,
  LandingFooter,
  TRIAL_CTA,
  SCAN_CTA,
} from '../components/landing/LandingShell';

/**
 * AiDsgvoBotPage — Produktseite /ai-dsgvo-bot.
 *
 * Führt den AI DSGVO Bot (Compliance Copilot) als eigenständiges Produktmodul.
 * Light-Theme („European Enterprise Trust"), Trial bleibt primärer CTA, der
 * Website-Scan ist der sekundäre Einstieg in den Funnel.
 */

const CAPABILITIES = [
  {
    icon: MessageSquareText,
    title: 'Scan-Ergebnisse erklären',
    text: 'Der Bot übersetzt technische Befunde aus den Runtime-Scans in verständliche, handlungsfähige Sprache.',
  },
  {
    icon: ListChecks,
    title: 'DSGVO-Risiken priorisieren',
    text: 'Risiken werden nach Dringlichkeit sortiert — Sie wissen, was zuerst zu tun ist.',
  },
  {
    icon: Scale,
    title: 'AI-Act-Pflichten ableiten',
    text: 'Aus der Risikoklassifikation Ihrer KI-Usecases ergeben sich konkrete Transparenz- und Dokumentationspflichten.',
  },
  {
    icon: ClipboardList,
    title: 'Maßnahmenpläne erstellen',
    text: 'Für Website, KI-Usecases und Workflows entstehen nachvollziehbare Maßnahmenvorschläge.',
  },
  {
    icon: FileText,
    title: 'Datenschutztexte vorbereiten',
    text: 'Unterstützung bei Datenschutztexten, TOMs, AVV-Checklisten und internen Richtlinien.',
  },
  {
    icon: FileLock2,
    title: 'Evidence Vault verknüpfen',
    text: 'Antworten werden mit Reports, Risiko-Klassifikation und auditierbarer Evidenz verknüpft.',
  },
];

const QUESTIONS = [
  'Welche Risiken hat meine Website laut DSGVO?',
  'Welche AI-Act-Kategorie hat dieser Usecase?',
  'Welche Pflichten muss ich als Betreiber erfüllen?',
  'Welche Maßnahmen sollte ich zuerst umsetzen?',
  'Welche Nachweise brauche ich für Datenschutzbeauftragte oder Aufsicht?',
];

export function AiDsgvoBotPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased font-sans">
      <SEOHead
        title="AI DSGVO Bot – Compliance Copilot | RealSyncDynamics.AI"
        description="Stellen Sie Fragen zu DSGVO, AI Act, Website-Risiken und KI-Usecases – und erhalten Sie strukturierte Antworten, Maßnahmen und exportierbare Dokumentationsbausteine."
      />
      <LandingHeader />

      {/* HERO */}
      <section className="bg-gradient-to-b from-slate-50 to-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-chip border border-petrol-200 bg-petrol-50 px-3 py-1 mb-7">
              <Bot className="h-3.5 w-3.5 text-petrol-700" />
              <span className="font-mono text-[11px] tracking-widest text-petrol-700 uppercase">
                Produktmodul · Compliance Copilot
              </span>
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.08] text-slate-900">
              Der AI DSGVO Bot für prüfbare Compliance-Workflows
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl">
              Stellen Sie Fragen zu DSGVO, AI Act, Website-Risiken und KI-Usecases – und
              erhalten Sie strukturierte Antworten, Maßnahmen und exportierbare
              Dokumentationsbausteine.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row gap-3 sm:gap-4">
              <SmartLink
                to={TRIAL_CTA}
                className="group inline-flex items-center justify-center gap-2 rounded-chip bg-petrol-700 px-7 py-4 text-base font-semibold text-white hover:bg-petrol-600 transition-colors"
              >
                AI DSGVO Bot testen
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </SmartLink>
              <SmartLink
                to={SCAN_CTA}
                className="inline-flex items-center justify-center gap-2 rounded-chip border border-slate-300 bg-white px-7 py-4 text-base font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition-colors"
              >
                Website zuerst scannen
              </SmartLink>
            </div>
          </div>
        </div>
      </section>

      {/* WAS DER BOT KANN */}
      <Section eyebrow="Funktionen" title="Was der AI DSGVO Bot kann">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CAPABILITIES.map((c) => (
            <div key={c.title} className="rounded-panel border border-slate-200 bg-white p-7">
              <span className="flex h-11 w-11 items-center justify-center rounded-card bg-petrol-50 border border-petrol-100 mb-5">
                <c.icon className="h-5 w-5 text-petrol-700" strokeWidth={1.75} />
              </span>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">{c.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{c.text}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* TYPISCHE FRAGEN */}
      <Section eyebrow="Anwendungsfälle" title="Typische Fragen" tint>
        <div className="max-w-3xl space-y-3">
          {QUESTIONS.map((q) => (
            <div
              key={q}
              className="flex items-center gap-3 rounded-panel border border-slate-200 bg-white px-6 py-4"
            >
              <MessageSquareText className="h-5 w-5 text-petrol-600 shrink-0" strokeWidth={1.75} />
              <span className="text-base text-slate-700">{q}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ABGRENZUNG */}
      <Section eyebrow="Abgrenzung" title="Governance-Assistenz, keine Rechtsberatung">
        <div className="max-w-3xl rounded-panel border border-slate-200 bg-slate-50 p-7 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-card bg-white border border-slate-200 shrink-0">
              <ShieldAlert className="h-5 w-5 text-petrol-700" strokeWidth={1.75} />
            </span>
            <p className="text-base text-slate-600 leading-relaxed">
              Der AI DSGVO Bot ist kein Rechtsanwalt und gibt keine verbindliche
              Rechtsberatung. Er hilft, Risiken strukturiert zu erkennen, Maßnahmen
              vorzubereiten und Compliance-Prozesse nachvollziehbar zu dokumentieren.
            </p>
          </div>
        </div>
      </Section>

      {/* CTA */}
      <section className="bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 sm:pb-24">
          <div className="rounded-panel border border-petrol-200 bg-petrol-50 p-10 sm:p-14 text-center">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mb-4">
              Testen Sie den AI DSGVO Bot 14 Tage kostenlos
            </h2>
            <p className="mx-auto max-w-2xl text-base sm:text-lg text-slate-600 leading-relaxed mb-9">
              Scannen Sie eine Website und lassen Sie sich die Ergebnisse vom AI DSGVO Bot
              erklären — inklusive priorisierter Maßnahmen und Dokumentationsbausteine.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <SmartLink
                to={TRIAL_CTA}
                className="group inline-flex items-center justify-center gap-2 rounded-chip bg-petrol-700 px-8 py-4 text-base font-semibold text-white hover:bg-petrol-600 transition-colors"
              >
                AI DSGVO Bot testen
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </SmartLink>
              <SmartLink
                to={SCAN_CTA}
                className="inline-flex items-center justify-center gap-2 rounded-chip border border-slate-300 bg-white px-8 py-4 text-base font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition-colors"
              >
                Website zuerst scannen
              </SmartLink>
            </div>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="max-w-2xl mb-12">
          <p className="font-mono text-[11px] tracking-[0.25em] text-petrol-700 uppercase mb-4">{eyebrow}</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">{title}</h2>
        </div>
        {children}
      </div>
    </section>
  );
}
