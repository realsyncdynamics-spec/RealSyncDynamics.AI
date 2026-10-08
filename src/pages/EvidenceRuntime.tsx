import { SEOHead } from '../components/SEOHead';
import { ArrowRight, BadgeCheck, FileCheck2, RefreshCw } from 'lucide-react';
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
 * Positionierung: RealSyncDynamics.AI als Continuous Governance Control
 * Plane und Evidence Runtime für digitale und KI-Systeme. Differenzierung
 * ist nicht „Continuous Governance" an sich, sondern der geschlossene Loop:
 * beobachteter Ist-Zustand → Entscheidung → Fix → erneute Verifikation →
 * Evidence. Zwei Kreisläufe: der Plattform-Loop (Scan → Build → Automate →
 * Govern) und die Control Runtime (Request → … → Evidence) als sein Motor.
 *
 * Ehrlichkeit: Die Architektur-Ebenen zeigen ihren Status aus
 * `src/product/implementation-status.ts` (SSoT). Ebenen ohne Registry-
 * Eintrag (Reality Matrix, Verification Plane) stehen als ZIELBILD da —
 * nie als Live-Versprechen. Status flippen in der Registry, nicht hier.
 * Wettbewerber werden nicht genannt (§ 6 UWG).
 *
 * Light-Theme mit den vorhandenen Tokens und dem geteilten LandingShell —
 * keine neue Optik, nur neuer Inhalt (Landing v4 bleibt unberührt).
 */

type BadgeKind = ImplementationStatus | 'zielbild';

const BADGE_CLASS: Record<BadgeKind, string> = {
  live: 'border-petrol-200 bg-petrol-50 text-petrol-700',
  preview: 'border-slate-300 bg-white text-slate-700',
  'coming-soon': 'border-dashed border-slate-300 bg-slate-50 text-slate-500',
  zielbild: 'border-dashed border-slate-300 bg-white text-slate-400',
};

function StatusBadge({ kind }: { kind: BadgeKind }) {
  return (
    <span
      className={`shrink-0 rounded-chip border px-2 py-0.5 font-mono text-[10px] tracking-widest uppercase ${BADGE_CLASS[kind]}`}
    >
      {kind === 'zielbild' ? 'ZIELBILD' : STATUS_LABEL[kind]}
    </span>
  );
}

function Chain({ steps, label, accent }: { steps: readonly string[]; label: string; accent?: string }) {
  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label={label}>
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span
            className={`rounded-chip border px-3 py-1.5 font-mono text-xs ${
              s === accent
                ? 'border-petrol-700 bg-petrol-700 text-white'
                : 'border-slate-200 bg-white text-slate-700'
            }`}
          >
            {s}
          </span>
          {i < steps.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}

function Eyebrow({ children }: { children: string }) {
  return (
    <p className="font-mono text-[11px] tracking-[0.25em] text-petrol-700 uppercase mb-4">{children}</p>
  );
}

const REGELWERKE = ['DSGVO', 'TDDDG', 'EU AI Act', 'Organisatorische und technische Policies'];

const CLOSED_LOOP = ['Detect', 'Understand', 'Decide', 'Fix', 'Verify', 'Prove', 'Monitor'];

const PLATTFORM_LOOP = ['Scan', 'Build', 'Automate', 'Govern'];

const CONTROL_RUNTIME = [
  'Request',
  'Identity',
  'Tenant',
  'Policy',
  'Risk',
  'Approval',
  'Execution',
  'Verification',
  'Evidence',
];

const NUTZEN: { bereich: string; nutzen: string }[] = [
  { bereich: 'Website-Compliance', nutzen: 'Wiederkehrende Sichtbarkeit von Datenschutz-, Consent- und Tracking-Risiken statt punktueller Einzelprüfungen.' },
  { bereich: 'KI-Governance', nutzen: 'KI-Use-Cases erfassen, entlang des EU AI Act bewerten und über Policies steuern.' },
  { bereich: 'Evidence & Audit', nutzen: 'Nachvollziehbare Evidenzen, Zeitverläufe und Entscheidungsgrundlagen für interne und externe Audits.' },
  { bereich: 'Umsetzung', nutzen: 'Befunde nicht nur melden, sondern beheben — und die Behebung erneut prüfen.' },
];

const BEWEISKETTE: { feld: string; wert: string }[] = [
  { feld: 'Erkannt', wert: '05.10.2026 · 11:32' },
  { feld: 'Asset', wert: 'example.de' },
  { feld: 'Befund', wert: 'Google Analytics lädt vor Einwilligung' },
  { feld: 'Control', wert: 'Consent vor Tracking' },
  { feld: 'Maßnahme', wert: 'GA-Initialisierung hinter Consent verschoben' },
  { feld: 'Geändert durch', wert: 'Builder · Automation' },
  { feld: 'Freigegeben durch', wert: 'Datenschutzverantwortliche Person' },
  { feld: 'Re-Scan', wert: 'PASS' },
  { feld: 'Evidence', wert: 'Snapshot mit Zeitbezug und Policy-Version' },
];

/**
 * Architektur-Ebenen. `ids` verweist auf die Registry; leeres Array =
 * noch kein messbarer Baustein → ZIELBILD.
 */
const EBENEN: { ebene: string; frage: string; ziel: string; ids: readonly string[] }[] = [
  {
    ebene: 'Reality Layer',
    frage: 'Was existiert tatsächlich?',
    ziel: 'Website, Tracker, Cookies, APIs, Datenflüsse, KI-Modelle, Agents, Anbieter und Prozesse erkennen.',
    ids: ['free-audit', 'ai-act-classify'],
  },
  {
    ebene: 'Reality Matrix',
    frage: 'Wie hängt alles zusammen?',
    ziel: 'Assets ↔ Daten ↔ Verantwortliche ↔ Policies ↔ Risiken ↔ Kontrollen ↔ Evidence als ein Graph.',
    ids: [],
  },
  {
    ebene: 'Control Plane',
    frage: 'Was darf passieren?',
    ziel: 'Identität, Mandant, Rollen, Policy, Risiko und Freigabe.',
    ids: ['policy-engine', 'governance-runtime-core', 'agent-governance'],
  },
  {
    ebene: 'Execution Plane',
    frage: 'Aktion kontrolliert ausführen',
    ziel: 'Provider-neutraler Gateway für Modelle, Agents, APIs und Automationen.',
    ids: ['ai-gateway'],
  },
  {
    ebene: 'Verification Plane',
    frage: 'Ist passiert, was erlaubt wurde?',
    ziel: 'Output-, Policy-, Datenschutz-, Security- und Zustandsprüfung nach jeder Aktion.',
    ids: [],
  },
  {
    ebene: 'Evidence Runtime',
    frage: 'Was können wir beweisen?',
    ziel: 'Ereignis, Entscheidung, Policy, Freigabe, Ergebnis, Änderung und Verifikation mit Zeitbezug.',
    ids: ['evidence-surfaces', 'provenance'],
  },
  {
    ebene: 'Remediation Plane',
    frage: 'Wie beheben wir einen Befund?',
    ziel: 'Integrierter Builder und Workflows als konkrete Fixes — kein separates Produkt.',
    ids: ['web-builder'],
  },
  {
    ebene: 'Continuous Governance',
    frage: 'Ist der Zustand noch korrekt?',
    ziel: 'Re-Scan, Drift-Erkennung, Risiko-Delta, erneute Freigabe und Evidence-Update.',
    ids: ['gdpr-audit-module', 'continuous-domain-monitoring'],
  },
];

const CLAIM = [
  'Den realen Zustand erkennen.',
  'Regeln durchsetzen.',
  'Abweichungen beheben.',
  'Ergebnisse verifizieren.',
  'Nachweise erzeugen.',
];

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
              Evidence Runtime für digitale und KI-Systeme
            </span>
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.08] text-slate-900">
            Continuous Governance Control Plane
          </h1>
          <p className="mt-5 text-lg sm:text-xl text-slate-600 leading-relaxed">
            Die europäische Kontroll- und Nachweisschicht für Websites, KI und automatisierte
            Geschäftsprozesse. Den realen Zustand erkennen, Regeln durchsetzen, Abweichungen
            beheben, Ergebnisse verifizieren, Nachweise erzeugen — fortlaufend als Zielbild.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2" aria-label="Regelwerke">
            {REGELWERKE.map((r) => (
              <li
                key={r}
                className="rounded-chip border border-slate-200 bg-white px-3 py-1 font-mono text-xs text-slate-600"
              >
                {r}
              </li>
            ))}
          </ul>
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

      {/* KERNFRAGE + NUTZEN */}
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
            <ul className="divide-y divide-slate-100">
              {NUTZEN.map((n) => (
                <li key={n.bereich} className="grid grid-cols-[minmax(0,2fr)_minmax(0,5fr)]">
                  <span className="px-4 sm:px-6 py-4 text-sm sm:text-base font-semibold text-slate-900">
                    {n.bereich}
                  </span>
                  <span className="px-4 sm:px-6 py-4 text-sm sm:text-base text-slate-600 border-l border-slate-100">
                    {n.nutzen}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CLOSED LOOP */}
      <section className="bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <Eyebrow>Der Unterschied</Eyebrow>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Governance verwalten reicht nicht. Der Loop muss sich schließen.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            Viele Plattformen verwalten Governance. Das Zielbild von RealSyncDynamics.AI
            verbindet den beobachteten Ist-Zustand mit Entscheidung, technischer Umsetzung,
            erneuter Verifikation und Evidence. Ein Befund soll erst als behoben gelten, wenn
            ein bestätigender Re-Scan den neuen Zustand belegt — nicht nach einem Klick.
          </p>
          <div className="mt-8 rounded-panel border border-slate-200 bg-white p-5 sm:p-6">
            <Chain steps={CLOSED_LOOP} label="Closed Loop von Detect bis Monitor" accent="Verify" />
            <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
              <RefreshCw className="h-4 w-4 text-petrol-600 shrink-0" strokeWidth={1.75} />
              Zielbild: Monitor führt zurück zu Detect — jede Änderung startet den Loop neu.
            </p>
          </div>
        </div>
      </section>

      {/* BEWEISKETTE */}
      <section className="bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <Eyebrow>Beweiskette statt Score</Eyebrow>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            „87 % compliant" beweist nichts. Eine Kette schon.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            Aus einem Scan-Befund wird kein Warnhinweis, sondern ein nachvollziehbarer Ablauf:
            Befund → Regelwerk → Policy → Control → Maßnahme → Änderung → Re-Scan →
            Verifikation → Evidence.
          </p>

          <figure className="mt-8 rounded-panel border border-slate-200 bg-slate-50 overflow-hidden">
            <figcaption className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-6 py-3">
              <span className="font-mono text-xs text-slate-900">Finding #8421</span>
              <span className="font-mono text-[10px] tracking-widest text-slate-400 uppercase">Beispiel</span>
            </figcaption>
            <dl className="divide-y divide-slate-200">
              {BEWEISKETTE.map((b) => (
                <div key={b.feld} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 px-4 sm:px-6 py-2.5">
                  <dt className="font-mono text-xs text-slate-500">{b.feld}</dt>
                  <dd
                    className={`font-mono text-xs ${
                      b.wert === 'PASS' ? 'font-semibold text-petrol-700' : 'text-slate-800'
                    }`}
                  >
                    {b.wert}
                  </dd>
                </div>
              ))}
            </dl>
          </figure>
        </div>
      </section>

      {/* ZWEI KREISLÄUFE */}
      <section className="bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <Eyebrow>Zwei Kreisläufe, ein Kern</Eyebrow>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Der Plattform-Loop und sein Motor
          </h2>

          <div className="mt-8 space-y-4">
            <div className="rounded-panel border border-slate-200 bg-white p-5 sm:p-6">
              <h3 className="text-lg font-semibold text-slate-900">Plattform-Loop</h3>
              <p className="mt-1.5 mb-4 text-sm sm:text-base text-slate-600 leading-relaxed">
                Der Weg des Kunden: vom ersten Scan bis zum laufenden Nachweis — und
                zurück zum nächsten Scan.
              </p>
              <Chain steps={[...PLATTFORM_LOOP, 'Scan …']} label="Plattform-Loop" />
            </div>
            <div className="rounded-panel border border-slate-200 bg-white p-5 sm:p-6">
              <h3 className="text-lg font-semibold text-slate-900">Control Runtime</h3>
              <p className="mt-1.5 mb-4 text-sm sm:text-base text-slate-600 leading-relaxed">
                Innerhalb von Govern durchläuft jede kontrollierte Aktion dieselbe Kette.
                Das Modell führt aus — die Governance-Schicht entscheidet.
              </p>
              <Chain steps={CONTROL_RUNTIME} label="Control Runtime von Request bis Evidence" accent="Execution" />
            </div>
          </div>
        </div>
      </section>

      {/* ARCHITEKTUR */}
      <section className="bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <Eyebrow>Architektur</Eyebrow>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Acht Ebenen — mit ehrlichem Stand
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            Reality Matrix, Control Plane und Evidence Runtime sind der Kern. Scanner,
            Builder und KI sind Ein- und Ausgänge dieses Kerns. Unter jeder Ebene steht,
            was davon heute live ist und was Zielbild.
          </p>

          <ol className="mt-8 space-y-3">
            {EBENEN.map((e) => {
              const items = e.ids.flatMap((id) => {
                const item = getImplementation(id);
                return item ? [item] : [];
              });
              return (
                <li key={e.ebene} className="rounded-panel border border-slate-200 bg-white p-5 sm:p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-lg font-semibold text-slate-900">{e.ebene}</h3>
                    <span className="text-sm text-slate-500">{e.frage}</span>
                  </div>
                  <p className="mt-1.5 text-sm sm:text-base text-slate-600 leading-relaxed">{e.ziel}</p>
                  <ul className="mt-3 space-y-1.5">
                    {items.length === 0 ? (
                      <li className="flex items-center justify-between gap-3 text-sm text-slate-500">
                        <span>Noch kein messbarer Baustein</span>
                        <StatusBadge kind="zielbild" />
                      </li>
                    ) : (
                      items.map((item) => (
                        <li key={item.id} className="flex items-center justify-between gap-3 text-sm text-slate-700">
                          <span className="min-w-0">{item.name}</span>
                          <StatusBadge kind={item.status} />
                        </li>
                      ))
                    )}
                  </ul>
                </li>
              );
            })}
          </ol>
          <p className="mt-4 font-mono text-[11px] tracking-widest text-slate-400 uppercase">
            Status gemessen am {IMPLEMENTATION_MEASURED_AT}
          </p>
        </div>
      </section>

      {/* CLAIM + CTA */}
      <section className="bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <blockquote className="rounded-panel border border-petrol-200 bg-petrol-50 p-6 sm:p-8">
            {CLAIM.map((c) => (
              <p key={c} className="text-lg sm:text-xl font-semibold text-slate-900 leading-relaxed">
                {c}
              </p>
            ))}
            <p className="mt-4 flex items-start gap-2 text-base text-slate-600">
              <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-petrol-700" strokeWidth={1.75} />
              Nicht „Compliance-Software". Nicht „KI-Chatbot". Eine Evidence Runtime für
              vertrauenswürdige digitale und KI-gestützte Systeme.
            </p>
          </blockquote>

          <h2 className="mt-12 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Beginnen Sie mit dem realen Zustand
          </h2>
          <p className="mt-3 text-base sm:text-lg text-slate-600 leading-relaxed">
            Der kostenlose Scan zeigt, was Ihre Website heute tatsächlich tut — der erste
            Schritt im Loop.
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
