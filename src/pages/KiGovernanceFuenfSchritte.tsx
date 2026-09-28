import { SEOHead } from '../components/SEOHead';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Cpu,
  Database,
  FileCheck2,
  ShieldCheck,
} from 'lucide-react';
import {
  SmartLink,
  LandingHeader,
  LandingFooter,
} from '../components/landing/LandingShell';

/** source attribuiert die Herkunft (gleiche Ziele wie TRIAL_CTA / SCAN_CTA). */
const START_CTA = '/welcome?source=ki-governance-5-schritte';
const SCAN_CTA = '/audit?source=ki-governance-5-schritte';

/**
 * KiGovernanceFuenfSchritte — öffentliche Seite /ki-governance-in-5-schritten.
 *
 * Positionierung gegen Compliance-Assistenten, die den Einstieg als
 * Fragebogen verkaufen (Bestandsaufnahme → Richtlinie → Schulung → Prüfung).
 * Deren Stärke übernehmen wir bewusst: klare Reihenfolge, mobile-first, der
 * erste Schritt ist als „Jetzt" markiert, der Nutzer fühlt sich geführt statt
 * geprüft. Der Unterschied steht im Vergleich: Wir enden nicht bei der
 * Richtlinie, sondern betreiben Governance dauerhaft.
 *
 * Wettbewerber werden bewusst nicht namentlich genannt (vergleichende Werbung,
 * § 6 UWG) — die Seite vergleicht mit der Kategorie „Compliance-Assistent".
 *
 * Light-Theme mit den vorhandenen Tokens und dem geteilten LandingShell —
 * keine neue Optik, nur neuer Inhalt.
 */

const SCHRITTE = [
  {
    icon: Building2,
    titel: 'Unternehmen verstehen',
    text: 'Welche KI-Systeme, Anbieter, Abteilungen und Prozesse gibt es bei Ihnen?',
    ergebnis: 'Überblick über KI-Einsatz und Verantwortliche',
  },
  {
    icon: Database,
    titel: 'KI-Register aufbauen',
    text: 'Jedes System bekommt Status, Zweck, Risiko, Anbieter, Datenarten und Verantwortliche.',
    ergebnis: 'Ein lebendes Register statt einer Excel-Liste',
  },
  {
    icon: ShieldCheck,
    titel: 'Governance-Regeln aktivieren',
    text: 'Policies, Freigaben, Rollen, DSGVO- und EU-AI-Act-Prüfung sowie Eskalationen.',
    ergebnis: 'Regeln, die greifen — nicht nur ein PDF',
  },
  {
    icon: FileCheck2,
    titel: 'Nachweise erzeugen',
    text: 'Audit-Log, Evidence Vault, Richtlinie, Schulungsstatus und Prüfberichte.',
    ergebnis: 'Prüffähig, wenn Aufsicht oder Kunde fragen',
  },
  {
    icon: Cpu,
    titel: 'KI sicher betreiben',
    text: 'Agenten, Browser-KI, lokale Modelle und externe Provider — nur mit Kontrolle, Freigabe und Beweisführung.',
    ergebnis: 'Laufender Betrieb statt einmaliger Aktion',
  },
];

const VERGLEICH: { assistent: string; realsync: string }[] = [
  { assistent: 'Bestandsaufnahme per Fragebogen', realsync: 'KI-Systeme entdecken und registrieren' },
  { assistent: 'KI-Richtlinie als Dokument', realsync: 'Policies als aktive Governance-Regeln' },
  { assistent: 'Mitarbeitende schulen', realsync: 'Rollen, Freigaben und Nachweise' },
  { assistent: 'KI-Systeme einmal prüfen', realsync: 'Laufende Risiko-, Provider- und Evidence-Überwachung' },
];

export function KiGovernanceFuenfSchritte() {
  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased font-sans">
      <SEOHead />
      <LandingHeader />

      {/* HERO */}
      <section className="bg-gradient-to-b from-slate-50 to-white border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <span className="inline-flex items-center gap-2 rounded-chip border border-petrol-200 bg-petrol-50 px-3 py-1 mb-6">
            <BadgeCheck className="h-3.5 w-3.5 text-petrol-700" />
            <span className="font-mono text-[11px] tracking-widest text-petrol-700 uppercase">
              Onboarding · Governance OS
            </span>
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.08] text-slate-900">
            KI-Governance in 5 Schritten
          </h1>
          <p className="mt-5 text-lg sm:text-xl text-slate-600 leading-relaxed">
            Wir sind nicht der Fragebogen. Wir sind die Kontrollzentrale danach — geführt
            vom ersten Überblick bis zum laufenden, prüffähigen KI-Betrieb.
          </p>
        </div>
      </section>

      {/* GEFÜHRTER PFAD */}
      <section className="bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <p className="font-mono text-[11px] tracking-[0.25em] text-petrol-700 uppercase mb-6">
            Ihr Weg
          </p>
          <ol className="space-y-4">
            {SCHRITTE.map((s, i) => {
              const jetzt = i === 0;
              return (
                <li
                  key={s.titel}
                  className={`rounded-panel border p-5 sm:p-6 ${
                    jetzt ? 'border-petrol-300 bg-petrol-50' : 'border-slate-200 bg-white'
                  }`}
                  aria-current={jetzt ? 'step' : undefined}
                >
                  <div className="flex items-start gap-4">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-card font-mono text-sm font-semibold ${
                        jetzt ? 'bg-petrol-700 text-white' : 'border border-slate-200 bg-slate-50 text-slate-500'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-slate-900">{s.titel}</h2>
                        {jetzt && (
                          <span className="rounded-chip bg-petrol-700 px-2.5 py-0.5 font-mono text-[10px] tracking-widest text-white uppercase">
                            Jetzt
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-base text-slate-600 leading-relaxed">{s.text}</p>
                      <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                        <s.icon className="h-4 w-4 text-petrol-600 shrink-0" strokeWidth={1.75} />
                        {s.ergebnis}
                      </p>
                      {jetzt && (
                        <SmartLink
                          to={START_CTA}
                          className="group mt-5 inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-chip bg-petrol-700 px-6 py-3.5 text-base font-semibold text-white hover:bg-petrol-600 transition-colors"
                        >
                          Mit Schritt 1 starten
                          <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                        </SmartLink>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* VERGLEICH */}
      <section className="bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <p className="font-mono text-[11px] tracking-[0.25em] text-petrol-700 uppercase mb-4">
            Der Unterschied
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Vom Dokument zum Betriebssystem
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            Ein Compliance-Assistent ist ein guter Einstieg. Nach der Richtlinie beginnt
            aber erst die eigentliche Arbeit: KI-Systeme dauerhaft registrieren, bewerten,
            steuern, freigeben und beweisen.
          </p>

          <div className="mt-8 rounded-panel border border-slate-200 bg-white overflow-hidden">
            <div className="grid grid-cols-2 border-b border-slate-100 bg-slate-50">
              <span className="px-4 sm:px-6 py-3 font-mono text-[11px] tracking-widest text-slate-400 uppercase">
                Compliance-Assistent
              </span>
              <span className="px-4 sm:px-6 py-3 font-mono text-[11px] tracking-widest text-petrol-700 uppercase border-l border-slate-100">
                RealSyncDynamics.AI
              </span>
            </div>
            <ul className="divide-y divide-slate-100">
              {VERGLEICH.map((v) => (
                <li key={v.realsync} className="grid grid-cols-2">
                  <span className="px-4 sm:px-6 py-4 text-sm sm:text-base text-slate-500">{v.assistent}</span>
                  <span className="px-4 sm:px-6 py-4 text-sm sm:text-base font-medium text-slate-900 border-l border-slate-100">
                    {v.realsync}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <blockquote className="mt-10 rounded-panel border border-petrol-200 bg-petrol-50 p-6 sm:p-8">
            <p className="text-lg sm:text-xl font-semibold text-slate-900 leading-relaxed">
              „Ein Compliance-Assistent erstellt Ihnen eine KI-Richtlinie.
              RealSyncDynamics.AI macht daraus ein laufendes Betriebssystem für
              KI-Governance."
            </p>
          </blockquote>
        </div>
      </section>

      {/* ABSCHLUSS-CTA */}
      <section className="bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Starten Sie mit dem Überblick
          </h2>
          <p className="mt-3 text-base sm:text-lg text-slate-600 leading-relaxed">
            Schritt 1 dauert wenige Minuten. Alles Weitere baut darauf auf.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3 sm:gap-4">
            <SmartLink
              to={START_CTA}
              className="group inline-flex items-center justify-center gap-2 rounded-chip bg-petrol-700 px-7 py-4 text-base font-semibold text-white hover:bg-petrol-600 transition-colors"
            >
              Onboarding starten
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </SmartLink>
            <SmartLink
              to={SCAN_CTA}
              className="inline-flex items-center justify-center gap-2 rounded-chip border border-slate-300 bg-white px-7 py-4 text-base font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition-colors"
            >
              Erst kostenlos scannen
            </SmartLink>
          </div>
          <p className="mt-6 text-sm text-slate-500">
            Wie sich bestehende Systeme anbinden lassen, zeigt{' '}
            <SmartLink to="/onboarding-erklaert" className="text-petrol-700 underline underline-offset-2 hover:text-petrol-600">
              Onboarding erklärt
            </SmartLink>
            .
          </p>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
