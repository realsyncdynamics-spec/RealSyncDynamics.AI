/**
 * Landing — Startseite im Governance-Operating-System-Framing.
 *
 * Bewusst statisch: vollständig deutsch, ohne Auto-Scroll, ohne
 * Animations-Loops, ohne IntersectionObserver. Die schweren animierten
 * Sektions-Komponenten (RuntimeCanvas, LiveScan, GlobalRuntimeFeed,
 * AiActSequence, GovernanceAgents) bleiben absichtlich ungenutzt — die
 * Stabilitätsgarantie dieser Seite wird nicht aufgegeben. Die hier
 * gezeigte Narrative ist daher als leichte, statische Eigenkomposition
 * gebaut, nicht durch Re-Mount der heavy sections.
 *
 * Narrative-Reihenfolge (Enterprise-/Government-Lese-Logik):
 *   1. Navbar
 *   2. Hero ............... Mission: was die Plattform ist
 *   3. Problem ........... Risiken ohne Governance
 *   4. Lösung ............ Detect · Monitor · Govern · Automate
 *   5. Architektur ....... Website → Scanner → Policy → Runtime → Evidence → Audit
 *   6. „Was Sie sofort sehen" — 4 Nutzenkarten
 *   7. Evidence-Vorschau — statische Beispieldaten, klar als Demo gelabelt
 *   8. Layer-Teaser ...... Compliance · Evidence · Security · Rollen
 *   9. CTA-Block
 *  10. Footer
 *
 * Positionierung: „Governance Operating System für KI und Websites",
 * EU-souverän (siehe docs/strategy/government-enterprise-restructure.md
 * und docs/positioning/positioning-v1.md). Verbotene Phrasen
 * („rechtssicher", „garantiert", „Bußgeld droht") werden vermieden.
 */
import { Link } from 'react-router-dom';
import {
  ArrowRight, ShieldCheck, AlertTriangle, FileCheck, Target,
  ScanLine, Eye, Gavel, Workflow, EyeOff, Building2, FileStack,
} from 'lucide-react';
import { Navbar } from '../components/Navbar';

export function Landing() {
  return (
    <>
      <Navbar />
      <main className="bg-obsidian-950 text-titanium-100 pt-14">
        <Hero />
        <ProblemSection />
        <SolutionSection />
        <ArchitectureSection />
        <ValueSection />
        <EvidencePreview />
        <LayerTeaser />
        <CtaBlock />
        <Footer />
      </main>
    </>
  );
}

// ─── Hero — Mission ──────────────────────────────────────────────────

function Hero() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-24">
      <div className="max-w-5xl mx-auto">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-titanium-500 mb-4">
          Governance Operating System für KI und Websites · EU-souverän
        </p>
        <h1 className="font-display font-bold tracking-tight text-titanium-50 text-3xl sm:text-5xl leading-[1.05] max-w-4xl">
          Den regulatorischen Zustand Ihrer Systeme messen, versionieren und beweisen.
        </h1>
        <p className="mt-6 text-base sm:text-lg text-titanium-300 max-w-3xl leading-relaxed">
          RealSyncDynamics.AI ist eine Runtime-native Governance-Plattform.
          Sie analysiert Websites, KI-Systeme und Agenten kontinuierlich,
          erkennt DSGVO-, AI-Act-, Vendor- und Shadow-AI-Risiken und erzeugt
          auditfähige Evidenzketten — kein einmaliger Snapshot, sondern
          laufende Nachweisbarkeit.
        </p>

        <ul className="mt-8 space-y-2 text-sm sm:text-base text-titanium-200 max-w-2xl">
          {[
            'Kontinuierliche Telemetrie statt veraltetem PDF-Audit',
            'Ein Event beweist mehrere Frameworks gleichzeitig',
            'Auditfähige Evidence — append-only, exportierbar',
            'EU-souverän: Frankfurt-Hosting, On-Premise-Option',
          ].map((b) => (
            <li key={b} className="flex items-start gap-2">
              <span className="mt-2 inline-block h-1.5 w-1.5 bg-cyan-400 shrink-0" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to="/audit"
            className="inline-flex items-center gap-2 bg-cyan-400 text-obsidian-950 px-5 py-3 text-sm font-semibold hover:bg-cyan-300 transition-colors"
          >
            Kostenlosen Audit starten <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/runtime"
            className="inline-flex items-center gap-2 border border-titanium-700 text-titanium-100 px-5 py-3 text-sm font-semibold hover:border-titanium-500 transition-colors"
          >
            Plattform ansehen
          </Link>
          <Link
            to="/contact-sales"
            className="inline-flex items-center gap-2 border border-titanium-800 text-titanium-300 px-5 py-3 text-sm font-medium hover:text-titanium-100 hover:border-titanium-600 transition-colors"
          >
            Demo anfragen
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Problem ─────────────────────────────────────────────────────────

const RISKS = [
  { Icon: ShieldCheck,  title: 'DSGVO',        body: 'Consent-Timing, Drittlandtransfer und veraltete Erklärungen — täglich im Wandel, manuell kaum nachzuhalten.' },
  { Icon: Gavel,        title: 'EU AI Act',    body: 'High-Risk-Klassifikation, Transparenz- und Dokumentationspflichten (Annex IV) ohne laufenden Nachweis.' },
  { Icon: AlertTriangle,title: 'Vendor-Risk',  body: 'Sub-Prozessoren, DPA-Status und Adäquanz ändern sich — ohne Inventar bleibt die Blast-Radius unklar.' },
  { Icon: EyeOff,       title: 'Shadow AI',    body: 'KI-Nutzung in Browsern und Tools, die niemand erfasst hat — unsichtbar für klassische Audits.' },
  { Icon: FileStack,    title: 'Doku-Aufwand', body: 'VVT, DSFA, Incident- und Vendor-Register manuell zu pflegen kostet Zeit und veraltet sofort.' },
];

function ProblemSection() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto">
        <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50 mb-2">
          Ohne Runtime ist Compliance ein Schnappschuss
        </h2>
        <p className="text-sm text-titanium-400 mb-10 max-w-2xl">
          DSGVO, AI Act, Vendor-Risk und Shadow AI ändern sich täglich — Ihre
          Dokumentation nicht. Ein Audit veraltet in dem Moment, in dem das
          PDF gespeichert wird.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-titanium-900">
          {RISKS.map(({ Icon, title, body }) => (
            <div key={title} className="bg-obsidian-900 p-6">
              <Icon className="h-5 w-5 text-rose-300 mb-4" />
              <h3 className="font-display font-semibold text-titanium-50 mb-2">{title}</h3>
              <p className="text-sm text-titanium-400 leading-relaxed">{body}</p>
            </div>
          ))}
          <div className="bg-obsidian-900 p-6 flex flex-col justify-center">
            <Link to="/ai-act" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200">
              Risiken einordnen <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Lösung — Detect · Monitor · Govern · Automate ───────────────────

const CAPABILITIES = [
  { Icon: ScanLine, key: 'Detect',   body: 'Scanner und Konnektoren erkennen Tracker, Vendor, KI-Systeme und Agenten — auch unbekannte (Shadow AI).' },
  { Icon: Eye,      key: 'Monitor',  body: 'Kontinuierliche Telemetrie und Drift-Detection statt einmaligem Audit. Jede Änderung wird zum Event.' },
  { Icon: Gavel,    key: 'Govern',   body: 'Policy-Auswertung mappt DSGVO, AI Act und NIS2 auf Laufzeit-Checks: allow · warn · approve · block.' },
  { Icon: Workflow, key: 'Automate', body: 'Erkanntes Problem → typisierter Remediation-Vorschlag → Ticket, Webhook oder Snippet. Niemals nur Alert.' },
];

function SolutionSection() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-titanium-500 mb-3">
          Die Governance Runtime
        </p>
        <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50 mb-2">
          Detect · Monitor · Govern · Automate
        </h2>
        <p className="text-sm text-titanium-400 mb-10 max-w-2xl">
          Vier Funktionen, ein kontinuierlicher Loop. Jedes Business-Event
          wird zum Governance-Event mit Evidence, Severity und Remediation.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-titanium-900">
          {CAPABILITIES.map(({ Icon, key, body }) => (
            <div key={key} className="bg-obsidian-900 p-6">
              <Icon className="h-5 w-5 text-cyan-300 mb-4" />
              <h3 className="font-display font-semibold text-titanium-50 mb-2">{key}</h3>
              <p className="text-sm text-titanium-400 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Architektur — die Kette sichtbar machen ─────────────────────────

const PIPELINE = [
  { label: 'Website / KI / Agent', note: 'Telemetrie-Quelle' },
  { label: 'Scanner',              note: 'Tracker- & Vendor-Discovery' },
  { label: 'Policy Engine',        note: 'allow · warn · approve · block' },
  { label: 'Governance Runtime',   note: 'Event-Bus · Risk · Remediation' },
  { label: 'Evidence Chain',       note: 'SHA-256, append-only' },
  { label: 'Audit Bundle',         note: 'Export · Art. 30 · Annex IV' },
];

function ArchitectureSection() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto">
        <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50 mb-2">
          Eine Kette vom Signal zum Nachweis
        </h2>
        <p className="text-sm text-titanium-400 mb-10 max-w-2xl">
          Server-seitige Telemetrie, keine Black-Box. Vom erkannten Request
          bis zum signierbaren Audit-Bundle ist jeder Schritt nachvollziehbar.
        </p>

        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-px bg-titanium-900">
          {PIPELINE.map((step, i) => (
            <li key={step.label} className="bg-obsidian-900 p-4 flex flex-col">
              <span className="font-mono text-[10px] text-titanium-600 mb-2">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="font-display font-semibold text-sm text-titanium-50 leading-snug">
                {step.label}
              </span>
              <span className="mt-1 font-mono text-[10px] uppercase tracking-wider text-cyan-300/80">
                {step.note}
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-6">
          <Link to="/runtime" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200">
            Architektur im Detail <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Was Sie sofort sehen ────────────────────────────────────────────

const VALUE_CARDS = [
  { Icon: AlertTriangle, title: 'Risiko-Score',    body: 'Ein Wert je Property. Zeigt auf einen Blick, ob das System im grünen oder roten Bereich liegt.' },
  { Icon: ShieldCheck,   title: 'Top-Findings',    body: 'Die wichtigsten Verstöße sortiert nach Schweregrad. Consent, Tracker, AVV, AI Act.' },
  { Icon: FileCheck,     title: 'Evidence-Report', body: 'Exportierbares PDF mit Score, Befunden und Belegen — für Dokumentation und Review.' },
  { Icon: Target,        title: 'Nächster Schritt',body: 'Pro Befund eine konkrete Handlungsempfehlung. Keine generischen Hinweise.' },
] as const;

function ValueSection() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto">
        <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50 mb-2">
          Was Sie sofort sehen
        </h2>
        <p className="text-sm text-titanium-400 mb-10 max-w-2xl">
          Der erste Scan liefert vier konkrete Artefakte. Keine Slides,
          keine Theorie.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-titanium-900">
          {VALUE_CARDS.map(({ Icon, title, body }) => (
            <div key={title} className="bg-obsidian-900 p-6">
              <Icon className="h-5 w-5 text-cyan-300 mb-4" />
              <h3 className="font-display font-semibold text-titanium-50 mb-2">{title}</h3>
              <p className="text-sm text-titanium-400 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Evidence-Vorschau (statische Demo) ──────────────────────────────

const DEMO_FINDINGS = [
  { sev: 'kritisch', cls: 'border-rose-500/40 text-rose-200 bg-rose-500/10',   summary: 'Consent-Banner fehlt — Tracker laden vor Einwilligung.' },
  { sev: 'hoch',     cls: 'border-amber-500/40 text-amber-200 bg-amber-500/10', summary: 'Google Analytics lädt vor Consent.' },
  { sev: 'mittel',   cls: 'border-sky-500/40 text-sky-200 bg-sky-500/10',       summary: 'Datenschutzerklärung > 24 Monate alt.' },
] as const;

function EvidencePreview() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-baseline justify-between flex-wrap gap-2 mb-6">
          <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50">
            So sieht ein Report aus
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-amber-300 border border-amber-500/40 bg-amber-500/10 px-2 py-1">
            Beispieldaten · Demo-Vorschau
          </span>
        </div>

        <div className="border border-titanium-800 bg-obsidian-900">
          <div className="border-b border-titanium-800 p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-titanium-500 mb-1">Score</div>
              <div className="font-display font-bold text-4xl tabular-nums text-rose-300">
                38<span className="text-base text-titanium-500 ml-1">/100</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-titanium-500 mb-1">Note</div>
              <div className="font-display font-bold text-4xl text-rose-300">F</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-titanium-500 mb-1">Befunde</div>
              <div className="font-display font-bold text-2xl tabular-nums text-titanium-50">8</div>
              <div className="text-[11px] text-rose-300 mt-1">4 kritisch/hoch</div>
            </div>
          </div>

          <ul>
            {DEMO_FINDINGS.map((f, i) => (
              <li
                key={i}
                className={`p-4 ${i < DEMO_FINDINGS.length - 1 ? 'border-b border-titanium-900' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <span className={`inline-flex items-center px-2 py-0.5 text-[10px] uppercase font-mono tracking-wider border shrink-0 ${f.cls}`}>
                    {f.sev}
                  </span>
                  <p className="text-sm text-titanium-100">{f.summary}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="border-t border-titanium-800 px-5 py-3 text-[11px] text-titanium-500 font-mono">
            Statische Beispieldaten. Echte Reports werden bei einem Scan
            mit Ihrer Domain erzeugt.
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Layer-Teaser — Compliance · Evidence · Security · Rollen ────────

const LAYERS = [
  { Icon: Gavel,       title: 'Compliance Layer', body: 'DSGVO · EU AI Act · NIS2 · Vendor Governance — ein Modell, mehrere Frameworks.', to: '/ai-act',  cta: 'Compliance' },
  { Icon: FileCheck,   title: 'Evidence Layer',   body: 'Kein Claim ohne Hash. Append-only, deterministisch, exportierbar für Behörde und DSB.', to: '/evidence', cta: 'Evidence' },
  { Icon: ShieldCheck, title: 'Security',         body: 'EU-souverän by default: Frankfurt-Hosting, RLS-Tenant-Isolation, On-Premise-Option.', to: '/trust',    cta: 'Trust Center' },
  { Icon: Building2,   title: 'Für jede Rolle',   body: 'DSB, Compliance Officer, CTO/CISO, Agenturen und Behörden — rollenbasierte Sichten.', to: '/branchen', cta: 'Lösungen' },
];

function LayerTeaser() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto">
        <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50 mb-10">
          Ein Betriebssystem, vier Ebenen
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-titanium-900">
          {LAYERS.map(({ Icon, title, body, to, cta }) => (
            <div key={title} className="bg-obsidian-900 p-6 flex flex-col">
              <Icon className="h-5 w-5 text-security-400 mb-4" />
              <h3 className="font-display font-semibold text-titanium-50 mb-2">{title}</h3>
              <p className="text-sm text-titanium-400 leading-relaxed mb-4">{body}</p>
              <Link to={to} className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200">
                {cta} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA-Block ───────────────────────────────────────────────────────

const SECONDARY_LINKS = [
  { to: '/evidence',     label: 'Evidence ansehen' },
  { to: '/ai-act',       label: 'AI Act ansehen' },
  { to: '/trust',        label: 'Security & Trust' },
  { to: '/developers',   label: 'Entwickler' },
  { to: '/pricing',      label: 'Preise' },
  { to: '/fuer-agenturen', label: 'Für Agenturen' },
] as const;

function CtaBlock() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto text-center">
        <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50 mb-3">
          Mit einem Scan starten — zur Runtime skalieren
        </h2>
        <p className="text-sm text-titanium-400 max-w-2xl mx-auto mb-8">
          In zwei Minuten der erste Report, in einem Quartal die laufende
          Governance Runtime. Domain eintragen, erster Scan läuft.
        </p>

        <div className="flex flex-wrap justify-center gap-3 mb-10">
          <Link
            to="/audit"
            className="inline-flex items-center gap-2 bg-cyan-400 text-obsidian-950 px-5 py-3 text-sm font-semibold hover:bg-cyan-300 transition-colors"
          >
            Kostenlosen Audit starten <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/contact-sales"
            className="inline-flex items-center gap-2 border border-titanium-700 text-titanium-100 px-5 py-3 text-sm font-semibold hover:border-titanium-500 transition-colors"
          >
            Demo anfragen
          </Link>
          <Link
            to="/runtime"
            className="inline-flex items-center gap-2 border border-titanium-800 text-titanium-300 px-5 py-3 text-sm font-medium hover:text-titanium-100 hover:border-titanium-600 transition-colors"
          >
            Plattform ansehen
          </Link>
        </div>

        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[12px] text-titanium-500">
          {SECONDARY_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="hover:text-titanium-200 transition-colors underline-offset-4 hover:underline"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────

function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="px-4 sm:px-6 py-10 text-titanium-500">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-[12px]">
        <div className="font-mono uppercase tracking-[0.2em]">
          RealSyncDynamics.AI · EU-Frankfurt
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          <Link to="/impressum" className="hover:text-titanium-200">Impressum</Link>
          <Link to="/datenschutz" className="hover:text-titanium-200">Datenschutz</Link>
          <Link to="/agb" className="hover:text-titanium-200">AGB</Link>
          <span className="text-titanium-700">© {year}</span>
        </nav>
      </div>
    </footer>
  );
}
