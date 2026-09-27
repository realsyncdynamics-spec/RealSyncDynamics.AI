import { Link } from 'react-router-dom';
import {
  Layers,
  ScanSearch,
  Scale,
  ShieldCheck,
  BadgeCheck,
  Activity,
  Check,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import {
  AlternativeLanding,
  Section,
  ComparisonTable,
  WarningCallout,
} from './alternative/AlternativeLanding';
import {
  IMPLEMENTATION_MEASURED_AT,
  STATUS_LABEL,
  getImplementation,
} from '../product/implementation-status';

/**
 * /caralegal-alternative — Kategorie-Abgrenzung statt Feature-Duell.
 *
 * ## Warum diese Seite anders aufgebaut ist als die anderen Alternative-Seiten
 *
 * caralegal tritt als „Data Responsibility Plattform" auf und deckt Datenschutz-
 * und KI-Governance-Dokumentation ab; in der hier verwendeten Einordnung ist das
 * ein System of Record für die Datenschutzorganisation.
 * Ein Frontalvergleich „wer hat mehr DSGVO-Features" wäre hier strategisch
 * falsch: Er zwingt uns in eine Kategorie, in der ein etablierter Anbieter
 * den Heimvorteil hat, und verschenkt den Integrations-/Partnermarkt.
 *
 * Die Seite führt deshalb mit dem Kategorie-Claim (DSMS sagt, was compliant
 * *sein soll* — die Runtime prüft, was es *tatsächlich ist*), dann den vier
 * Säulen Detect → Govern → Enforce → Prove, und erst danach der tabellarischen
 * Abgrenzung. Die Tabelle enthält bewusst **keine** Ja/Nein-Häkchen über
 * fremde Produktfunktionen, sondern Kategorie-Merkmale: Fremdfunktionen
 * ändern sich, ohne dass jemand diese Datei anfasst.
 *
 * ## Claim-Hygiene
 *
 * Jede Fähigkeit trägt ihren Status aus `src/product/implementation-status.ts`
 * (SSoT, CI: `scripts/check-landing-claims.mjs`). „Monitor" ist heute
 * ausdrücklich Coming Soon — deshalb steht in der Kopfzeile „wiederholbar",
 * nicht „kontinuierlich".
 */

interface PillarCapability {
  /** id aus implementation-status.ts — Status + Route kommen von dort. */
  id: string;
  /** Was diese Fähigkeit in dieser Säule leistet (nicht die Registry-Prosa). */
  role: string;
}

interface Pillar {
  step: string;
  title: string;
  claim: string;
  Icon: LucideIcon;
  capabilities: PillarCapability[];
}

const PILLARS: Pillar[] = [
  {
    step: '01',
    title: 'Detect',
    claim: 'Den technischen Ist-Zustand erheben — Websites, Tracking, KI-Systeme.',
    Icon: ScanSearch,
    capabilities: [
      { id: 'free-audit', role: 'Öffentlicher Einstiegs-Scan ohne Vertrag' },
      { id: 'gdpr-audit-module', role: 'Cookie-/Tracker-Befunde mit Bericht' },
      {
        id: 'ai-act-classify',
        role: 'Gefundene KI-Systeme nach Risikoklasse einordnen — aus dem Befund, nicht aus dem gepflegten Inventar',
      },
    ],
  },
  {
    step: '02',
    title: 'Govern',
    claim: 'Anforderungen als ausführbare Regeln hinterlegen statt als Textdokument.',
    Icon: Scale,
    capabilities: [
      { id: 'policy-engine', role: 'Governance-Regeln als Kontrolllogik' },
      { id: 'governance-runtime-core', role: 'Risiko, Vorfälle, DSR, DSFA, Vendors, Freigaben' },
    ],
  },
  {
    step: '03',
    title: 'Enforce',
    claim: 'Die Regel greift am Aufrufpunkt — nicht erst im Quartalsbericht.',
    Icon: ShieldCheck,
    capabilities: [
      { id: 'ai-gateway', role: 'Modellaufrufe kontrolliert, protokolliert, kostenerfasst' },
      { id: 'agent-governance', role: 'Action Request → Policy → Risk → Permission' },
    ],
  },
  {
    step: '04',
    title: 'Prove',
    claim: 'Jeder Befund und jede Entscheidung wird als Nachweis ablegbar.',
    Icon: BadgeCheck,
    capabilities: [
      { id: 'evidence-surfaces', role: 'Nachweisflächen und Export' },
      { id: 'provenance', role: 'Inhalte signieren, Herkunft überprüfbar machen' },
    ],
  },
];

/**
 * Badge-Klassen je Status — literale Tailwind-Strings (purge-safe).
 *
 * Statuslabel, Säulen-Index und Messdatum sind Metadaten und tragen deshalb
 * `font-mono` (AGENTS.md: „Monospace-Schriften für technische Daten und
 * Metadaten", ausdrücklich auch im Light-Theme).
 */
const STATUS_BADGE: Record<string, string> = {
  live: 'border-emerald-900 bg-emerald-950/40 text-emerald-300',
  preview: 'border-sky-900 bg-sky-950/40 text-sky-300',
  'coming-soon': 'border-amber-900 bg-amber-950/40 text-amber-300',
};

function CapabilityRow({ capability }: { capability: PillarCapability }) {
  const item = getImplementation(capability.id);
  if (!item) return null;

  const label = (
    <span className="text-titanium-100 font-medium">{item.name}</span>
  );

  // `/app/*` liegt hinter dem AppGate — ein öffentlicher Link dorthin schickt
  // anonyme Besucher auf die Anmeldung statt auf den versprochenen Inhalt.
  const publicRoute = item.route && !item.route.startsWith('/app') ? item.route : null;

  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      {publicRoute ? (
        <Link to={publicRoute} className="hover:text-security-300">
          {label}
        </Link>
      ) : (
        label
      )}
      <span
        className={`inline-flex items-center px-1.5 py-0.5 border font-mono text-[10px] font-bold uppercase tracking-wider rounded-none ${STATUS_BADGE[item.status]}`}
      >
        {STATUS_LABEL[item.status]}
      </span>
      <span className="text-titanium-400">— {capability.role}</span>
    </li>
  );
}

function PillarCard({ pillar }: { pillar: Pillar }) {
  return (
    <div className="p-5 bg-obsidian-900 border border-titanium-900 rounded-none">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 bg-gradient-to-br from-security-600 to-security-800 flex items-center justify-center rounded-none">
          <pillar.Icon className="h-4 w-4 text-white" />
        </div>
        <div>
          <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-titanium-500">
            {pillar.step}
          </div>
          <h3 className="font-display font-bold text-titanium-50 text-lg leading-tight">
            {pillar.title}
          </h3>
        </div>
      </div>
      <p className="text-sm text-titanium-300 leading-relaxed mb-3">{pillar.claim}</p>
      <ul className="space-y-1.5 text-sm">
        {pillar.capabilities.map((c) => (
          <CapabilityRow key={c.id} capability={c} />
        ))}
      </ul>
    </div>
  );
}

export function CaralegalAlternative() {
  const monitoring = getImplementation('continuous-domain-monitoring');

  return (
    <AlternativeLanding
      config={{
        headerTitle: 'caralegal-Alternative',
        Icon: Layers,
        iconGradient: 'bg-gradient-to-br from-security-500 to-security-800',
        badgeIcon: Activity,
        badgeClass: 'border-security-800 bg-security-950/30 text-security-300',
        badgeText: 'Ergänzung zum DSMS · EU-hosted · Made in Germany',
        headline: (
          <>
            Ihr DSMS sagt, was compliant sein soll.{' '}
            <span className="text-security-400">
              RealSync prüft, was es tatsächlich ist.
            </span>
          </>
        ),
        sublineMaxWidth: 'max-w-3xl',
        subline: (
          <>
            caralegal tritt als „Data Responsibility Plattform" auf; in der hier
            verwendeten Einordnung ist das ein{' '}
            <strong className="text-titanium-50">System of Record</strong> für Prozesse,
            Dokumente und Verantwortlichkeiten. RealSyncDynamics.AI ist die{' '}
            <strong className="text-titanium-50">Governance Runtime</strong> darunter: Sie
            verbindet die Compliance-Anforderung mit dem tatsächlich laufenden technischen
            System — befundbasiert, policy-gesteuert und nachweisbar.
          </>
        ),
        cta: {
          heading: 'Erst der Befund, dann das Gespräch',
          sub: 'Der Scan läuft ohne Vertrag und ohne Datenimport aus Ihrem DSMS. Was er findet, ist die ehrlichste Grundlage für die Frage, ob eine technische Kontrollschicht Ihnen etwas bringt.',
          buttons: [
            { to: '/audit?source=caralegal-alt', label: 'Kostenlosen Scan starten', variant: 'primary' },
            { to: '/dsgvo-tool-vergleich', label: 'Voller Tool-Vergleich', variant: 'secondary' },
            { to: '/roadmap', label: 'Was ist heute live?', variant: 'ghost' },
          ],
        },
        jsonLd: {
          headline: 'caralegal-Alternative — technische Governance-Runtime neben dem DSMS',
          description:
            'caralegal ist auf Datenschutz- und KI-Governance-Dokumentation ausgelegt. RealSyncDynamics.AI ist die technische Compliance-Runtime daneben: Detect, Govern, Enforce, Prove.',
          datePublished: '2026-09-15',
        },
      }}
    >
      <WarningCallout>
        <strong className="text-amber-100">Ehrlicher Hinweis:</strong> Diese Seite ist kein
        Ersatzangebot. Wer ein DSMS für VVT, DSFA, TOM, DSAR, Aufgaben und
        Verantwortlichkeiten sucht, ist bei caralegal richtig — und bleibt es auch mit uns.
        Wir liefern die technische Evidence-Schicht <em>neben</em> Ihrem DSMS: Befund,
        Policy-Entscheidung, Nachweis.
      </WarningCallout>

      <section>
        <h2 className="text-xl sm:text-2xl font-display font-bold text-titanium-50 mb-1">
          Vier Säulen: Detect → Govern → Enforce → Prove
        </h2>
        <p className="text-sm text-titanium-400 mb-4">
          Jede Fähigkeit trägt ihren tatsächlichen Stand aus der Produkt-Registry — nicht
          den Wunschzettel. Gemessen am{' '}
          <span className="font-mono">{IMPLEMENTATION_MEASURED_AT}</span>.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {PILLARS.map((p) => (
            <PillarCard key={p.title} pillar={p} />
          ))}
        </div>
      </section>

      {monitoring && (
        <div className="p-5 bg-obsidian-900 border border-amber-900 rounded-none">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-amber-300" />
            <h3 className="font-display font-bold text-titanium-50">
              Die fünfte Säule — Monitor —{' '}
              <span className="font-mono text-amber-300">{STATUS_LABEL[monitoring.status]}</span>
            </h3>
          </div>
          <p className="text-sm text-titanium-300 leading-relaxed">
            Eine Runtime ist erst dann vollständig, wenn sie Drift bemerkt, ohne dass jemand
            den Scan erneut auslöst. {monitoring.name} ist heute{' '}
            {STATUS_LABEL[monitoring.status].toLowerCase()} — wiederkehrende Nachprüfung
            läuft, der öffentliche Dauerüberwachungs-Funnel noch nicht. Wir schreiben das
            hier hin, statt „kontinuierlich" zu behaupten: Eine Governance-Schicht, die ihre
            eigene Reife falsch darstellt, disqualifiziert sich beim ersten Audit.
          </p>
        </div>
      )}

      <Section title="Zwei Kategorien, zwei Kaufentscheidungen">
        <p>
          Der Unterschied ist keine Funktionsliste, sondern die Architekturposition. Ein DSMS
          beantwortet: <em>Ist unsere Datenschutzorganisation vollständig dokumentiert?</em>{' '}
          Eine Governance Runtime beantwortet:{' '}
          <em>Ist unser technischer Zustand tatsächlich konform?</em> Beide Fragen sind
          berechtigt, und keine beantwortet die andere.
        </p>
      </Section>

      <ComparisonTable
        competitor="DSMS (z. B. caralegal)"
        rows={[
          {
            f: 'Primäre Frage',
            o: 'Ist die Datenschutzorganisation vollständig dokumentiert?',
            r: 'Ist der technische Zustand tatsächlich konform?',
          },
          {
            f: 'Systemtyp',
            o: 'System of Record',
            r: 'Governance Runtime / Control Plane',
          },
          {
            f: 'Input',
            o: 'Prozesse, Dokumente, Verantwortlichkeiten',
            r: 'Websites, APIs, KI-Systeme, Agenten, Vendoren',
          },
          {
            f: 'Arbeitsweise',
            o: 'dokumentieren, organisieren, bearbeiten',
            r: 'erkennen, bewerten, durchsetzen, nachweisen',
          },
          {
            f: 'Zeitmodell',
            o: 'Prozess- und aufgabenorientiert',
            r: 'befund- und ereignisorientiert',
          },
          {
            f: 'Ergebnis',
            o: 'Datenschutzakte, Prozessstatus',
            r: 'Befund + Policy-Entscheidung + Nachweis',
          },
          {
            f: 'Zielgruppe',
            o: 'Datenschutzorganisation, DSB',
            r: 'DSB gemeinsam mit IT, Security, Dev, Product',
          },
          {
            f: 'Rolle von KI',
            o: 'KI-Verzeichnis und Risikoklassifizierung als geführte Dokumentation',
            r: 'Dieselbe Klassifizierung aus dem technischen Befund — plus Kontrolle und Protokoll am Aufrufpunkt',
          },
        ]}
      />

      <p className="text-xs text-titanium-500 leading-relaxed">
        Die Zeilen beschreiben Produktkategorien, keine Funktionsstände einzelner Anbieter.
        „DSMS" ist dabei unsere Einordnung — caralegal beschreibt sich selbst als „Data
        Responsibility Plattform" und bewirbt unter anderem ein KI-Verzeichnis mit
        automatisierter Risikoklassifizierung nach KI-VO.
        Funktionsumfang und Positionierung von caralegal können sich ändern — maßgeblich ist
        die jeweils aktuelle Herstellerangabe unter{' '}
        <a
          href="https://caralegal.eu"
          rel="nofollow noopener noreferrer"
          target="_blank"
          className="underline hover:text-titanium-300"
        >
          caralegal.eu
        </a>
        . Unseren eigenen Stand führen wir öffentlich unter{' '}
        <Link to="/roadmap" className="underline hover:text-titanium-300">
          /roadmap
        </Link>
        .
      </p>

      <Section title="Wann ein DSMS die richtige Wahl ist">
        <ul className="space-y-2 text-sm">
          {[
            'Das Verarbeitungsverzeichnis, DSFA-Workflows und TOM-Dokumentation sind der Engpass — nicht die Technik.',
            'Aufgaben, Fristen und Verantwortlichkeiten müssen über Abteilungen hinweg organisiert werden.',
            'Betroffenenanfragen (DSAR) laufen als geführter Fallprozess mit Nachweisakte.',
          ].map((text) => (
            <li key={text} className="flex items-start gap-2">
              <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Wann eine technische Runtime dazugehört">
        <ul className="space-y-2 text-sm">
          {[
            'Die Akte ist gepflegt — aber niemand kann belegen, dass die Website, das Tracking oder die KI-Aufrufe dem entsprechen.',
            'KI ist im Einsatz und muss nach EU AI Act klassifiziert, dokumentiert und im Betrieb protokolliert werden.',
            'IT, Security und Produkt sollen dieselbe Faktenbasis sehen wie der DSB — nicht eine zweite, ältere.',
            'Ein Audit verlangt Nachweise über das laufende System, nicht nur über die Absicht.',
          ].map((text) => (
            <li key={text} className="flex items-start gap-2">
              <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Zusammen betrieben">
        <p>
          Die belastbare Aufteilung im Enterprise-Fall ist nicht „entweder — oder", sondern
          eine Arbeitsteilung:{' '}
          <strong className="text-titanium-100">
            das DSMS führt die organisatorische Governance
          </strong>{' '}
          — VVT, DSFA, TOM, DSAR, Aufgaben, Verantwortlichkeiten.{' '}
          <strong className="text-titanium-100">
            Die Runtime liefert die technische Verifikation
          </strong>{' '}
          — Scan-Befunde, AI-Act-Klassifizierung, Policy-Entscheidungen am Aufrufpunkt,
          Nachweise. Der Übergabepunkt ist der Nachweis: Was wir feststellen, wird zum Beleg,
          den Ihre Datenschutzakte bisher nur behaupten konnte.
        </p>
        <p>
          <Link
            to="/audit?source=caralegal-alt"
            className="inline-flex items-center gap-1.5 text-security-400 hover:text-security-300 font-bold"
          >
            Mit einem Befund anfangen <ArrowRight className="h-4 w-4" />
          </Link>
        </p>
      </Section>
    </AlternativeLanding>
  );
}
