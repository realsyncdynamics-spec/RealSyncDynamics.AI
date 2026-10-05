import { SEOHead } from '../components/SEOHead';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Cpu,
  FileCheck2,
  Fingerprint,
  MessageSquare,
  Scale,
  ScrollText,
  ShieldCheck,
  Stamp,
} from 'lucide-react';
import {
  SmartLink,
  LandingHeader,
  LandingFooter,
} from '../components/landing/LandingShell';

/** source attribuiert die Herkunft (gleiche Ziele wie TRIAL_CTA / SCAN_CTA). */
const SCAN_CTA = '/audit?source=ki-betriebssystem';
const SCHRITTE_CTA = '/ki-governance-in-5-schritten';

/**
 * KiBetriebssystem — öffentliche Seite /ki-betriebssystem.
 *
 * Erklärseite (Pillar) zur Kategorie „AI Governance Operating System":
 * Was ein KI-Betriebssystem für DSGVO und EU AI Act ist, wie es sich von
 * Datenschutz-/Compliance-Plattformen unterscheidet und warum die
 * Governance-Schicht entscheidet, nicht das Modell.
 *
 * Bewusst im Konjunktiv der Kategorie („kann prüfen") formuliert — die Seite
 * beschreibt das Prinzip, keinen Funktionsumfang. Was heute live ist, steht
 * auf den Produktseiten.
 *
 * Light-Theme mit den vorhandenen Tokens und dem geteilten LandingShell —
 * keine neue Optik, nur neuer Inhalt (Landing v4 bleibt unberührt).
 */

const KETTE = [
  { icon: MessageSquare, label: 'Request' },
  { icon: Fingerprint, label: 'Identity' },
  { icon: Building2, label: 'Tenant' },
  { icon: ScrollText, label: 'Policy' },
  { icon: AlertTriangle, label: 'Risk' },
  { icon: Stamp, label: 'Approval' },
  { icon: Cpu, label: 'Execution' },
  { icon: CheckCircle2, label: 'Verification' },
  { icon: FileCheck2, label: 'Evidence' },
];

const VOR_DER_AUSFUEHRUNG = [
  'Wer stellt die Anfrage?',
  'Zu welcher Organisation und welchem Mandanten gehört die Anfrage?',
  'Welche Daten sollen verarbeitet werden?',
  'Welche Richtlinien gelten?',
  'Welche regulatorischen oder organisatorischen Risiken bestehen?',
  'Ist eine menschliche Freigabe erforderlich?',
  'Welches KI-Modell oder welcher Anbieter darf verwendet werden?',
  'Welche technischen Schutzmaßnahmen müssen vor der Verarbeitung greifen?',
];

const VERGLEICH: { plattform: string; os: string }[] = [
  { plattform: 'Datenbestände inventarisieren', os: 'Jede KI-Anfrage vor der Ausführung prüfen' },
  { plattform: 'Risiken dokumentieren', os: 'Risiken im Moment der Verarbeitung bewerten' },
  { plattform: 'Assessments verwalten', os: 'Policies technisch durchsetzen' },
  { plattform: 'Regulatorische Prozesse unterstützen', os: 'Nachweise aus der tatsächlichen Ausführung erzeugen' },
];

const GOVERNANCE_ENTSCHEIDET = [
  'welche personenbezogenen Daten verarbeitet werden dürfen',
  'welches Modell verwendet werden darf',
  'ob eine Verarbeitung freigegeben ist',
  'welche regulatorischen Vorgaben gelten',
  'ob eine menschliche Genehmigung erforderlich ist',
  'welche Nachweise aufbewahrt werden müssen',
];

const ANBIETER = ['OpenAI', 'Anthropic', 'Google', 'Mistral', 'Lokale Modelle', 'Weitere Anbieter'];

const BETRIEBSMODELLE = [
  'Private Cloud',
  'Europäische Cloud-Infrastruktur',
  'On-Premise-Systeme',
  'Lokale Large Language Models',
  'Hybride Architekturen',
  'Externe Enterprise-KI-Anbieter',
];

const SCHUTZ = ['klassifiziert', 'minimiert', 'pseudonymisiert', 'anonymisiert', 'blockiert', 'freigabepflichtig'];

const BAUSTEINE = [
  'Daten- und KI-Inventare',
  'Zweck- und Rechtsgrundlagenverwaltung',
  'Risikoklassifizierung',
  'AI-Act-Kategorisierung',
  'Genehmigungsworkflows',
  'Rollen und Verantwortlichkeiten',
  'Modell- und Providerkontrollen',
  'Datenklassifizierung',
  'Policy Enforcement',
  'Human Oversight',
  'Protokollierung',
  'Versionshistorien',
  'Kontrollnachweise',
  'Audit Trails',
  'Incident- und Exception-Management',
  'Evidence Management',
];

const CREDO = [
  'Modelle erzeugen Ergebnisse.',
  'Policies definieren Grenzen.',
  'Menschen behalten Verantwortung.',
  'Governance kontrolliert die Ausführung.',
  'Evidence macht Entscheidungen nachvollziehbar.',
];

function Eyebrow({ children }: { children: string }) {
  return (
    <p className="font-mono text-[11px] tracking-[0.25em] text-petrol-700 uppercase mb-4">{children}</p>
  );
}

export function KiBetriebssystem() {
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
              Konzept · AI Governance OS
            </span>
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.08] text-slate-900">
            Ein Betriebssystem für vertrauenswürdige KI
          </h1>
          <p className="mt-5 text-lg sm:text-xl text-slate-600 leading-relaxed">
            Ein „KI-Betriebssystem für DSGVO und EU AI Act" ist kein klassisches
            Betriebssystem wie Windows oder Linux. Gemeint ist eine übergeordnete
            Governance- und Kontrollschicht: Sie legt fest, unter welchen Bedingungen
            KI-Systeme, Modelle, Agenten, Daten und automatisierte Aktionen in einem
            Unternehmen eingesetzt werden dürfen.
          </p>
        </div>
      </section>

      {/* ABGRENZUNG */}
      <section className="bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <Eyebrow>Eine Ebene tiefer</Eyebrow>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Governance trifft Ausführung
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            Klassische Datenschutz- und Compliance-Plattformen beschreiben, was im
            Unternehmen passiert. Ein AI Governance Operating System sitzt dort, wo KI
            tatsächlich ausgeführt wird — und verbindet Regeln mit jeder einzelnen
            Verarbeitung.
          </p>

          <div className="mt-8 rounded-panel border border-slate-200 bg-white overflow-hidden">
            <div className="grid grid-cols-2 border-b border-slate-100 bg-slate-50">
              <span className="px-4 sm:px-6 py-3 font-mono text-[11px] tracking-widest text-slate-400 uppercase">
                Compliance-Plattform
              </span>
              <span className="px-4 sm:px-6 py-3 font-mono text-[11px] tracking-widest text-petrol-700 uppercase border-l border-slate-100">
                Governance OS
              </span>
            </div>
            <ul className="divide-y divide-slate-100">
              {VERGLEICH.map((v) => (
                <li key={v.os} className="grid grid-cols-2">
                  <span className="px-4 sm:px-6 py-4 text-sm sm:text-base text-slate-500">{v.plattform}</span>
                  <span className="px-4 sm:px-6 py-4 text-sm sm:text-base font-medium text-slate-900 border-l border-slate-100">
                    {v.os}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* GRUNDPRINZIP */}
      <section className="bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <Eyebrow>Das Grundprinzip</Eyebrow>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Erst prüfen, dann ausführen, dann beweisen
          </h2>

          <ol
            className="mt-8 flex flex-wrap items-center gap-2"
            aria-label="Governance-Kette von Request bis Evidence"
          >
            {KETTE.map((k, i) => (
              <li key={k.label} className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-chip border px-3 py-1.5 font-mono text-xs ${
                    k.label === 'Execution'
                      ? 'border-petrol-700 bg-petrol-700 text-white'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <k.icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                  {k.label}
                </span>
                {i < KETTE.length - 1 && (
                  <ArrowRight className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />
                )}
              </li>
            ))}
          </ol>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-panel border border-slate-200 bg-white p-5 sm:p-6">
              <h3 className="text-lg font-semibold text-slate-900">Vor der Ausführung</h3>
              <ul className="mt-3 space-y-2">
                {VOR_DER_AUSFUEHRUNG.map((q) => (
                  <li key={q} className="flex items-start gap-2 text-sm sm:text-base text-slate-600 leading-relaxed">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-petrol-600" aria-hidden="true" />
                    {q}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-panel border border-slate-200 bg-white p-5 sm:p-6">
              <h3 className="text-lg font-semibold text-slate-900">Nach der Ausführung</h3>
              <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
                Erst nach diesen Prüfungen erfolgt die eigentliche KI-Ausführung.
                Anschließend wird überprüft, ob die Aktion innerhalb der definierten
                Regeln lief — und welche Nachweise für Audit, Revision, Datenschutz oder
                regulatorische Prüfungen gespeichert werden müssen.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* GOVERNANCE ENTSCHEIDET */}
      <section className="bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <Eyebrow>Architekturprinzip</Eyebrow>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Das KI-Modell führt aus. Die Governance-Schicht entscheidet.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            KI-Anbieter sind austauschbare Ausführungsinstanzen. Sie erhalten nicht
            automatisch die Autorität über Governance-Fragen.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {ANBIETER.map((a) => (
              <span
                key={a}
                className="rounded-chip border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-600"
              >
                {a}
              </span>
            ))}
          </div>

          <div className="mt-8 rounded-panel border border-petrol-200 bg-petrol-50 p-5 sm:p-6">
            <p className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <ShieldCheck className="h-5 w-5 text-petrol-700 shrink-0" strokeWidth={1.75} />
              In der unabhängigen Governance-Schicht wird entschieden,
            </p>
            <ul className="mt-3 space-y-2">
              {GOVERNANCE_ENTSCHEIDET.map((g) => (
                <li key={g} className="flex items-start gap-2 text-sm sm:text-base text-slate-700 leading-relaxed">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-petrol-600" strokeWidth={1.75} />
                  {g}.
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* DATENHOHEIT */}
      <section className="bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <Eyebrow>Datenschutz und Datenhoheit</Eyebrow>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Nicht der Anbieter entscheidet, sondern die Policy
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            Für jede Verarbeitung muss nachvollziehbar sein, welche Daten verwendet werden,
            wo sie verarbeitet werden dürfen, welche Anbieter zugelassen sind und welche
            Schutzmaßnahmen gelten. So gelangen sensible oder personenbezogene
            Informationen nicht unkontrolliert an ein externes KI-Modell.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-panel border border-slate-200 bg-white p-5 sm:p-6">
              <h3 className="text-lg font-semibold text-slate-900">Betriebsmodelle</h3>
              <ul className="mt-3 space-y-2">
                {BETRIEBSMODELLE.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm sm:text-base text-slate-600">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-petrol-600" aria-hidden="true" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-panel border border-slate-200 bg-white p-5 sm:p-6">
              <h3 className="text-lg font-semibold text-slate-900">Je nach Policy werden Daten …</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {SCHUTZ.map((s) => (
                  <span
                    key={s}
                    className="rounded-chip border border-petrol-200 bg-petrol-50 px-3 py-1 font-mono text-xs text-petrol-700"
                  >
                    {s}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-sm text-slate-500 leading-relaxed">
                … bevor überhaupt ein Modell sie sieht.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* DSGVO + AI ACT */}
      <section className="bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <Eyebrow>Zwei Regelwerke, ein Workflow</Eyebrow>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            DSGVO und EU AI Act gemeinsam operationalisieren
          </h2>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-panel border border-slate-200 bg-white p-5 sm:p-6">
              <p className="font-mono text-[11px] tracking-widest text-slate-400 uppercase">DSGVO</p>
              <p className="mt-2 text-base text-slate-700 leading-relaxed">
                Betrifft insbesondere die Verarbeitung personenbezogener Daten.
              </p>
            </div>
            <div className="rounded-panel border border-slate-200 bg-white p-5 sm:p-6">
              <p className="font-mono text-[11px] tracking-widest text-slate-400 uppercase">EU AI Act</p>
              <p className="mt-2 text-base text-slate-700 leading-relaxed">
                Stellt zusätzliche Anforderungen an bestimmte KI-Systeme, Anbieter und Betreiber.
              </p>
            </div>
          </div>

          <p className="mt-8 flex items-center gap-2 text-base sm:text-lg text-slate-600">
            <Scale className="h-5 w-5 text-petrol-700 shrink-0" strokeWidth={1.75} />
            Übersetzt in gemeinsame technische und organisatorische Bausteine:
          </p>
          <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {BAUSTEINE.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm sm:text-base text-slate-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-petrol-600" strokeWidth={1.75} />
                {b}
              </li>
            ))}
          </ul>

          <p className="mt-8 text-base sm:text-lg text-slate-600 leading-relaxed">
            Damit entsteht kein weiterer KI-Chatbot und kein weiteres Datenschutzformular,
            sondern eine Kontrollschicht zwischen Mensch, Unternehmen, Daten, Richtlinien
            und künstlicher Intelligenz.
          </p>
        </div>
      </section>

      {/* REALSYNC + CREDO */}
      <section className="bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <Eyebrow>RealSyncDynamics.AI</Eyebrow>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Provider-neutral. Kontrollierbar. Nachweisbar.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            RealSyncDynamics.AI verfolgt diesen Ansatz als provider-neutrales AI Governance
            Operating System. Das Ziel ist nicht, ein bestimmtes KI-Modell zu ersetzen —
            sondern kontrollierbar zu machen, wann, warum, durch wen, mit welchen Daten und
            unter welchen Regeln KI eingesetzt werden darf. So nutzen Unternehmen
            verschiedene Anbieter und eigene Modelle, ohne ihre Governance an einen
            einzelnen Provider abzugeben.
          </p>

          <blockquote className="mt-10 rounded-panel border border-petrol-200 bg-petrol-50 p-6 sm:p-8">
            {CREDO.map((c) => (
              <p key={c} className="text-lg sm:text-xl font-semibold text-slate-900 leading-relaxed">
                {c}
              </p>
            ))}
            <p className="mt-4 text-sm sm:text-base text-slate-600">
              Das ist die Funktion eines AI Governance Operating Systems.
            </p>
          </blockquote>
        </div>
      </section>

      {/* ABSCHLUSS-CTA */}
      <section className="bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Wo steht Ihr Unternehmen heute?
          </h2>
          <p className="mt-3 text-base sm:text-lg text-slate-600 leading-relaxed">
            Starten Sie mit einem kostenlosen Scan oder sehen Sie, wie der Weg zum
            laufenden KI-Betrieb in fünf Schritten aussieht.
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
              to={SCHRITTE_CTA}
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
