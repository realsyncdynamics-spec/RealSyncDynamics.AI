import { SEOHead } from '../components/SEOHead';
import {
  ArrowRight,
  BadgeCheck,
  FileCheck2,
  Hammer,
  Radar,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import {
  SmartLink,
  LandingHeader,
  LandingFooter,
} from '../components/landing/LandingShell';
import {
  IMPLEMENTATION_MEASURED_AT,
  STATUS_LABEL,
  getImplementation,
  type ImplementationStatus,
} from '../product/implementation-status';

/** source attribuiert die Herkunft (gleiche Ziele wie TRIAL_CTA / SCAN_CTA). */
const SCAN_CTA = '/audit?source=evidence-runtime';
const SALES_CTA = '/contact-sales?source=evidence-runtime';

/**
 * EvidenceRuntime — öffentliche Seite /evidence-runtime.
 *
 * Positionierung: RealSyncDynamics.AI als Continuous-Governance- und
 * Evidence-Runtime — nicht „Compliance-Software", nicht „KI-Chatbot".
 * Erzählt den Loop Scan → Build → Automate → Govern und den Kundennutzen
 * „jederzeit technisch belegen können, was im Betrieb passiert ist".
 *
 * Ehrlichkeit: Jede Loop-Phase und jede Nutzen-Zeile zeigt ihren Status aus
 * `src/product/implementation-status.ts` (SSoT). Preview- und
 * Coming-Soon-Bausteine erscheinen dort mit Badge, nie als Live-Versprechen —
 * Status flippen in der Registry, nicht hier.
 *
 * Light-Theme mit den vorhandenen Tokens und dem geteilten LandingShell —
 * keine neue Optik, nur neuer Inhalt (Landing v4 bleibt unberührt).
 */

const BADGE_CLASS: Record<ImplementationStatus, string> = {
  live: 'border-petrol-200 bg-petrol-50 text-petrol-700',
  preview: 'border-slate-300 bg-white text-slate-700',
  'coming-soon': 'border-dashed border-slate-300 bg-slate-50 text-slate-500',
};

function StatusBadge({ status }: { status: ImplementationStatus }) {
  return (
    <span
      className={`shrink-0 rounded-chip border px-2 py-0.5 font-mono text-[10px] tracking-widest uppercase ${BADGE_CLASS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Registry-Einträge, die eine Loop-Phase heute tatsächlich tragen. */
function registryItems(ids: readonly string[]) {
  return ids.flatMap((id) => {
    const item = getImplementation(id);
    return item ? [item] : [];
  });
}

const LOOP = [
  {
    icon: Radar,
    phase: 'Scan',
    text: 'Erfasst den tatsächlichen Zustand von Website, KI-Use-Cases, Datenflüssen und digitalen Touchpoints.',
    ids: ['free-audit', 'ai-act-classify'],
  },
  {
    icon: Hammer,
    phase: 'Build',
    text: 'Strukturiert Befunde zu konkreten Maßnahmen und setzt Verbesserungen im integrierten Builder um — kein separates Produkt, sondern der Umsetzungsbereich zwischen Analyse und Governance.',
    ids: ['web-builder'],
  },
  {
    icon: Workflow,
    phase: 'Automate',
    text: 'Überführt wiederkehrende Prüfungen, Nachweise und operative Abläufe in automatisierte Workflows.',
    ids: ['gdpr-audit-module', 'continuous-domain-monitoring'],
  },
  {
    icon: ShieldCheck,
    phase: 'Govern',
    text: 'Überwacht Risiken, Änderungen, Verantwortlichkeiten und Evidenzen fortlaufend.',
    ids: ['governance-runtime-core', 'policy-engine', 'evidence-surfaces', 'ai-act-inventory-persist'],
  },
] as const;

const NUTZEN: { bereich: string; nutzen: string; id?: string }[] = [
  {
    bereich: 'Website-Compliance',
    nutzen: 'Wiederkehrende Sichtbarkeit von Datenschutz-, Consent- und Tracking-Risiken statt punktueller Einzelprüfungen.',
    id: 'gdpr-audit-module',
  },
  {
    bereich: 'KI-Governance',
    nutzen: 'Risikobewertung von KI-Use-Cases entlang des EU AI Act — mit zentralem Inventar als nächstem Schritt.',
    id: 'ai-act-inventory-persist',
  },
  {
    bereich: 'Evidence & Audit',
    nutzen: 'Nachvollziehbare Evidenzen, Zeitverläufe und Entscheidungsgrundlagen für interne und externe Audits.',
    id: 'evidence-surfaces',
  },
  {
    bereich: 'Umsetzung',
    nutzen: 'Webauftritte und digitale Prozesse direkt im integrierten Builder verbessern.',
    id: 'web-builder',
  },
  {
    bereich: 'Betrieb',
    nutzen: 'Scan, Umsetzung, Governance und Nachweise in einer Arbeitsumgebung — statt zwischen Einzellösungen zu wechseln.',
  },
];

const LAUFZEIT: { klassisch: string; runtime: string }[] = [
  { klassisch: 'Fragebögen und Selbstauskünfte', runtime: 'Realer Systemzustand als Ausgangspunkt' },
  { klassisch: 'Dokumentenablage', runtime: 'Evidenzen mit Zeitverlauf' },
  { klassisch: 'Einmaliges Audit', runtime: 'Risiko-Deltas, sobald sich etwas ändert' },
  { klassisch: 'Maßnahmen getrennt vom Nachweis', runtime: 'Befund, Maßnahme und Nachweis verknüpft' },
];

const ZIELGRUPPEN = ['Unternehmen', 'Agenturen', 'Regulierte Teams'];

function Eyebrow({ children }: { children: string }) {
  return (
    <p className="font-mono text-[11px] tracking-[0.25em] text-petrol-700 uppercase mb-4">{children}</p>
  );
}

export function EvidenceRuntime() {
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
              Continuous Governance · Evidence Runtime
            </span>
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.08] text-slate-900">
            Die europäische Control- und Evidence-Plattform für digitale Systeme
          </h1>
          <p className="mt-5 text-lg sm:text-xl text-slate-600 leading-relaxed">
            RealSyncDynamics.AI prüft Websites, KI-Anwendungen und operative Prozesse, macht
            Risiken sichtbar und erzeugt nachvollziehbare Nachweise für DSGVO, TDDDG
            (ehem. TTDSG) und EU AI Act — vom ersten Scan bis zum laufenden Betrieb.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4">
            <SmartLink
              to={SCAN_CTA}
              className="group inline-flex items-center justify-center gap-2 rounded-chip bg-petrol-700 px-7 py-4 text-base font-semibold text-white hover:bg-petrol-600 transition-colors"
            >
              Kostenlos scannen
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </SmartLink>
            <SmartLink
              to={SALES_CTA}
              className="inline-flex items-center justify-center gap-2 rounded-chip border border-slate-300 bg-white px-7 py-4 text-base font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition-colors"
            >
              Mit uns sprechen
            </SmartLink>
          </div>
        </div>
      </section>

      {/* KERNFRAGE */}
      <section className="bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <Eyebrow>Wofür Kunden zahlen</Eyebrow>
          <p className="text-base sm:text-lg text-slate-500">
            Nicht nur die Frage „Sind wir compliant?", sondern:
          </p>
          <blockquote className="mt-4 rounded-panel border border-petrol-200 bg-petrol-50 p-6 sm:p-8">
            <p className="text-xl sm:text-2xl font-semibold text-slate-900 leading-snug">
              „Können wir jederzeit technisch belegen, was im Betrieb passiert ist — und
              wie wir darauf reagiert haben?"
            </p>
          </blockquote>

          <div className="mt-10 rounded-panel border border-slate-200 bg-white overflow-hidden">
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,5fr)] border-b border-slate-100 bg-slate-50">
              <span className="px-4 sm:px-6 py-3 font-mono text-[11px] tracking-widest text-slate-400 uppercase">
                Bereich
              </span>
              <span className="px-4 sm:px-6 py-3 font-mono text-[11px] tracking-widest text-petrol-700 uppercase border-l border-slate-100">
                Kundennutzen
              </span>
            </div>
            <ul className="divide-y divide-slate-100">
              {NUTZEN.map((n) => {
                const item = n.id ? getImplementation(n.id) : undefined;
                return (
                  <li key={n.bereich} className="grid grid-cols-[minmax(0,2fr)_minmax(0,5fr)]">
                    <span className="px-4 sm:px-6 py-4 text-sm sm:text-base font-semibold text-slate-900">
                      {n.bereich}
                    </span>
                    <span className="px-4 sm:px-6 py-4 text-sm sm:text-base text-slate-600 border-l border-slate-100">
                      {n.nutzen}
                      {item && item.status !== 'live' && (
                        <span className="mt-2 flex">
                          <StatusBadge status={item.status} />
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* LOOP */}
      <section className="bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <Eyebrow>Kernversprechen</Eyebrow>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Scan → Build → Automate → Govern
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            Eine durchgehende Kette von der Bestandsaufnahme bis zum laufenden
            Compliance-Nachweis. Unter jeder Phase steht, was davon heute live ist.
          </p>

          <ol className="mt-8 space-y-4">
            {LOOP.map((l, i) => (
              <li key={l.phase} className="rounded-panel border border-slate-200 bg-white p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-petrol-700 text-white">
                    <l.icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-semibold text-slate-900">
                      <span className="font-mono text-sm text-slate-400 mr-2">{String(i + 1).padStart(2, '0')}</span>
                      {l.phase}
                    </h3>
                    <p className="mt-1.5 text-base text-slate-600 leading-relaxed">{l.text}</p>
                    <ul className="mt-4 space-y-2">
                      {registryItems(l.ids).map((item) => (
                        <li key={item.id} className="flex items-center justify-between gap-3 text-sm text-slate-700">
                          <span className="min-w-0">{item.name}</span>
                          <StatusBadge status={item.status} />
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 font-mono text-[11px] tracking-widest text-slate-400 uppercase">
            Status gemessen am {IMPLEMENTATION_MEASURED_AT}
          </p>
        </div>
      </section>

      {/* POSITIONIERUNG */}
      <section className="bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <Eyebrow>Für wen</Eyebrow>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Nicht nur dokumentieren — dauerhaft kontrollieren
          </h2>
          <div className="mt-6 flex flex-wrap gap-2">
            {ZIELGRUPPEN.map((z) => (
              <span
                key={z}
                className="rounded-chip border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-600"
              >
                {z}
              </span>
            ))}
          </div>
          <p className="mt-6 text-base sm:text-lg text-slate-600 leading-relaxed">
            Für Teams, die KI und digitale Systeme nicht nur dokumentieren, sondern dauerhaft
            kontrollieren müssen. RealSyncDynamics.AI schafft eine technische
            Governance-Schicht für Websites, KI-Systeme und Prozesse — mit Monitoring,
            Risiko-Telemetrie und auditierbarer Evidence.
          </p>
        </div>
      </section>

      {/* LAUFZEIT STATT FRAGEBOGEN */}
      <section className="bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <Eyebrow>Der Unterschied</Eyebrow>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Laufzeit statt Fragebogen
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            Klassische Compliance-Tools arbeiten mit Fragebögen, Dokumentenablagen und
            einmaligen Audits. Im Mittelpunkt einer Evidence Runtime steht der reale
            Systemzustand: Veränderungen werden erfasst, Risiko-Deltas sichtbar und mit
            Maßnahmen und belastbaren Nachweisen verknüpft.
          </p>

          <div className="mt-8 rounded-panel border border-slate-200 bg-white overflow-hidden">
            <div className="grid grid-cols-2 border-b border-slate-100 bg-slate-50">
              <span className="px-4 sm:px-6 py-3 font-mono text-[11px] tracking-widest text-slate-400 uppercase">
                Klassisches Compliance-Tool
              </span>
              <span className="px-4 sm:px-6 py-3 font-mono text-[11px] tracking-widest text-petrol-700 uppercase border-l border-slate-100">
                Evidence Runtime
              </span>
            </div>
            <ul className="divide-y divide-slate-100">
              {LAUFZEIT.map((v) => (
                <li key={v.runtime} className="grid grid-cols-2">
                  <span className="px-4 sm:px-6 py-4 text-sm sm:text-base text-slate-500">{v.klassisch}</span>
                  <span className="px-4 sm:px-6 py-4 text-sm sm:text-base font-medium text-slate-900 border-l border-slate-100">
                    {v.runtime}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <blockquote className="mt-10 rounded-panel border border-petrol-200 bg-petrol-50 p-6 sm:p-8">
            <p className="text-base sm:text-lg text-slate-600">
              Nicht „Compliance-Software". Nicht „KI-Chatbot".
            </p>
            <p className="mt-2 flex items-start gap-2 text-xl sm:text-2xl font-semibold text-slate-900 leading-snug">
              <FileCheck2 className="mt-1 h-6 w-6 shrink-0 text-petrol-700" strokeWidth={1.75} />
              Sondern eine Evidence Runtime für vertrauenswürdige digitale und KI-gestützte Systeme.
            </p>
          </blockquote>
        </div>
      </section>

      {/* ABSCHLUSS-CTA */}
      <section className="bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Beginnen Sie mit dem realen Zustand
          </h2>
          <p className="mt-3 text-base sm:text-lg text-slate-600 leading-relaxed">
            Der kostenlose Scan zeigt, was Ihre Website heute tatsächlich tut. Darauf bauen
            Umsetzung, Automatisierung und Governance auf.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3 sm:gap-4">
            <SmartLink
              to={SCAN_CTA}
              className="group inline-flex items-center justify-center gap-2 rounded-chip bg-petrol-700 px-7 py-4 text-base font-semibold text-white hover:bg-petrol-600 transition-colors"
            >
              Kostenlos scannen
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </SmartLink>
            <SmartLink
              to="/ki-governance-in-5-schritten"
              className="inline-flex items-center justify-center gap-2 rounded-chip border border-slate-300 bg-white px-7 py-4 text-base font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition-colors"
            >
              KI-Governance in 5 Schritten
            </SmartLink>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
