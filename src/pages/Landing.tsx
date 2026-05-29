/**
 * Landing — minimale, stabile Startseite mit Enterprise-Positionierung.
 *
 * Bewusst kurz, vollständig deutsch, ohne Auto-Scroll, ohne
 * Animations-Loops, ohne IntersectionObserver. Alles Tiefe liegt
 * hinter Buttons auf eigenen Unterseiten (/runtime, /evidence,
 * /ai-act, /security, /developers, /pricing, /agencies, /audit).
 *
 * Struktur:
 *   1. Navbar
 *   2. Hero
 *   3. Zielgruppen — Enterprise & regulierte Teams
 *   4. „Was Sie sofort sehen" — 4 Nutzenkarten
 *   5. Risiko-Abschnitt — was kontinuierlich überwacht wird
 *   6. Evidence-Vorschau — statische Beispieldaten, klar als Demo gelabelt
 *   7. Vertrauen & Nachweise — Audit-Trail, Datenresidenz, Rollen, TOMs
 *   8. CTA-Block — Enterprise-Pfade
 *   9. Footer
 *
 * Keine Animation, kein Auto-Scroll, kein scrollIntoView, kein Observer.
 * Keine unbelegten Behauptungen (ISO-zertifiziert, garantiert
 * bußgeldsicher, rechtsverbindlich). Keine Kundenlogos.
 */
import { Link } from 'react-router-dom';
import {
  ArrowRight, ShieldCheck, AlertTriangle, FileCheck, Target,
  Building2, Scale, Activity, Database, Users, FileText,
  Cookie, Bot, Network, BookOpen,
} from 'lucide-react';
import { Navbar } from '../components/Navbar';

export function Landing() {
  return (
    <>
      <Navbar />
      <main className="bg-obsidian-950 text-titanium-100 pt-14">
        <Hero />
        <AudienceSection />
        <ValueSection />
        <RiskSection />
        <EvidencePreview />
        <TrustSection />
        <CtaBlock />
        <Footer />
      </main>
    </>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-24">
      <div className="max-w-5xl mx-auto">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-titanium-500 mb-4">
          Compliance-, AI-Act- und Datenschutz-Governance — als Runtime
        </p>
        <h1 className="font-display font-bold tracking-tight text-titanium-50 text-3xl sm:text-5xl leading-[1.05] max-w-4xl">
          Kontinuierliche Governance für Websites, Plattformen und digitale Geschäftsprozesse.
        </h1>
        <p className="mt-6 text-base sm:text-lg text-titanium-300 max-w-3xl leading-relaxed">
          RealSyncDynamics.AI überwacht Web-Properties, KI-Features und
          Datenflüsse, erkennt DSGVO-, AI-Act-, Vendor- und Consent-Risiken
          und erzeugt auditfähige Evidence-Reports für Legal, Compliance,
          SEO und IT.
        </p>

        <ul className="mt-8 space-y-2 text-sm sm:text-base text-titanium-200 max-w-2xl">
          {[
            'Websites, KI-Features und Telemetrie kontinuierlich prüfen',
            'AI-Act-, DSGVO- und Vendor-Risiken priorisieren',
            'Evidence-Reports und Audit-Trail exportieren',
            'Weniger manuelle Nachweisarbeit für Legal, Compliance, IT',
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
            Enterprise-Risiko prüfen <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/agencies"
            className="inline-flex items-center gap-2 border border-titanium-700 text-titanium-100 px-5 py-3 text-sm font-semibold hover:border-titanium-500 transition-colors"
          >
            AI-Act-/DSGVO-Pilot starten
          </Link>
          <Link
            to="/runtime"
            className="inline-flex items-center gap-2 border border-titanium-800 text-titanium-300 px-5 py-3 text-sm font-medium hover:text-titanium-100 hover:border-titanium-600 transition-colors"
          >
            Runtime ansehen
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Zielgruppen ─────────────────────────────────────────────────────

const AUDIENCES = [
  {
    Icon: Building2,
    title: 'Enterprise-Websites & Plattformen',
    body:
      'Konzern-Portale, Marken-Seiten, B2B-Plattformen — überwacht im Verbund mit klarer Property- und Mandanten-Trennung.',
  },
  {
    Icon: Network,
    title: 'Automotive & Mobility',
    body:
      'Connected-Services, Händlerportale, Customer-Apps mit hoher Vendor-Dichte und Telemetrie. Ein Inventar je Geschäftsprozess.',
  },
  {
    Icon: Scale,
    title: 'Regulierte Plattformen',
    body:
      'Finanz-, Health-, Public-Sector-nahe Properties mit erhöhten Dokumentations- und Audit-Anforderungen.',
  },
  {
    Icon: Users,
    title: 'Legal, Compliance, SEO & IT',
    body:
      'Ein Datenstand für vier Teams. Legal sieht Risiken und Belege, IT sieht Befunde mit konkretem Fix, SEO sieht den Status pro Property.',
  },
] as const;

function AudienceSection() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-titanium-500 mb-3">
          Für wen
        </p>
        <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50 mb-2">
          Gebaut für Enterprise-Properties und regulierte Teams
        </h2>
        <p className="text-sm text-titanium-400 mb-10 max-w-2xl">
          Wir adressieren Organisationen, deren Web-Properties dauerhaft
          überwacht werden müssen — und Teams, die belegen können müssen,
          was sie wann gesehen und entschieden haben.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-titanium-900">
          {AUDIENCES.map(({ Icon, title, body }) => (
            <div key={title} className="bg-obsidian-900 p-6">
              <Icon className="h-5 w-5 text-cyan-300 mb-4" />
              <h3 className="font-display font-semibold text-titanium-50 mb-2">
                {title}
              </h3>
              <p className="text-sm text-titanium-400 leading-relaxed">
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Was Sie sofort sehen ────────────────────────────────────────────

const VALUE_CARDS = [
  {
    Icon: AlertTriangle,
    title: 'Risiko-Score',
    body:
      'Ein Wert je Property. Zeigt auf einen Blick, ob die Seite im grünen oder roten Bereich liegt — inklusive Trend über Zeit.',
  },
  {
    Icon: ShieldCheck,
    title: 'Top-Findings',
    body:
      'Die wichtigsten Verstöße sortiert nach Schweregrad: Consent, Tracker, AVV, Vendor-Risiken, AI-Act-Pflichten.',
  },
  {
    Icon: FileCheck,
    title: 'Evidence-Report',
    body:
      'Exportierbares PDF mit Score, Befunden und Belegen — für interne Dokumentation, Audits und Aufsichts-Anfragen.',
  },
  {
    Icon: Target,
    title: 'Nächster Schritt',
    body:
      'Pro Befund eine konkrete Handlungsempfehlung mit Verantwortlichkeit. Keine generischen Hinweise.',
  },
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
              <h3 className="font-display font-semibold text-titanium-50 mb-2">
                {title}
              </h3>
              <p className="text-sm text-titanium-400 leading-relaxed">
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Risiko-Abschnitt ────────────────────────────────────────────────

const RISK_AREAS = [
  {
    Icon: Bot,
    title: 'KI-Features & AI-Act-Pflichten',
    body:
      'Chatbots, Empfehlungssysteme, generative Endpunkte: Klassifizierung, Transparenz-Hinweise, Risiko-Einstufung, Dokumentationspflicht.',
  },
  {
    Icon: Activity,
    title: 'Telemetrie & Tracking',
    body:
      'Analytics, Pixel, SDKs — geladen vor Consent, Drittland-Transfer, fehlende Rechtsgrundlage. Erkennung pro Request.',
  },
  {
    Icon: Cookie,
    title: 'Consent & Cookie-Banner',
    body:
      'Dark Patterns, fehlende Ablehnen-Option, Reject-on-Load, Vor-Einwilligungs-Loads, CMP-Konfigurationsdrift.',
  },
  {
    Icon: Network,
    title: 'Vendoren & Subprozessoren',
    body:
      'Welcher Vendor verarbeitet welche Daten — mit oder ohne AVV. Drittland, Zweck, Rechtsgrundlage, Vertragsstatus.',
  },
  {
    Icon: FileText,
    title: 'Dokumentations- & Nachweispflichten',
    body:
      'Datenschutzerklärung, Impressum, VVT-relevante Hinweise, AI-Act-Transparenz, Aktualität und Konsistenz.',
  },
  {
    Icon: BookOpen,
    title: 'Audit-Trail',
    body:
      'Wer hat wann was geändert oder zur Kenntnis genommen — pro Property und pro Befund, lückenlos.',
  },
] as const;

function RiskSection() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-titanium-500 mb-3">
          Was kontinuierlich überwacht wird
        </p>
        <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50 mb-2">
          Risiken, die im Tagesgeschäft entstehen — und unbemerkt bleiben
        </h2>
        <p className="text-sm text-titanium-400 mb-10 max-w-2xl">
          Code-Changes, neue Vendoren, geänderte CMP-Konfigurationen und
          KI-Features verändern den Compliance-Status laufend. Die Runtime
          erkennt Drift, bevor er zum Befund wird.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-titanium-900">
          {RISK_AREAS.map(({ Icon, title, body }) => (
            <div key={title} className="bg-obsidian-900 p-6">
              <Icon className="h-5 w-5 text-cyan-300 mb-4" />
              <h3 className="font-display font-semibold text-titanium-50 mb-2">
                {title}
              </h3>
              <p className="text-sm text-titanium-400 leading-relaxed">
                {body}
              </p>
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

// ─── Vertrauen & Nachweise ───────────────────────────────────────────

const TRUST_ITEMS = [
  {
    Icon: FileCheck,
    title: 'Beispiel-Reports',
    body:
      'Anonymisierte Evidence-Reports einsehen — Aufbau, Tiefe und Belegstruktur eines realen Audit-Outputs.',
    to: '/evidence',
    cta: 'Evidence ansehen',
  },
  {
    Icon: BookOpen,
    title: 'Audit-Trail',
    body:
      'Jede Änderung, Statusübergang und Kenntnisnahme wird mit Zeitstempel, Akteur und Property protokolliert.',
    to: '/evidence',
    cta: 'Prüfpfad verstehen',
  },
  {
    Icon: Database,
    title: 'Datenresidenz EU',
    body:
      'Hosting in EU-Frankfurt, Storage und Auth in der EU. KI-Inference wahlweise EU-lokal (Ollama) oder Cloud-Provider.',
    to: '/security',
    cta: 'Sicherheit ansehen',
  },
  {
    Icon: ShieldCheck,
    title: 'Security-Dokumentation',
    body:
      'Architektur, Verschlüsselung, Schlüssel-Management, RLS-Modell und Incident-Process — auf einer Seite nachlesbar.',
    to: '/security',
    cta: 'Security-Doku öffnen',
  },
  {
    Icon: Users,
    title: 'Rollen & Mandanten',
    body:
      'Trennung nach Property, Mandant und Rolle (Owner, Compliance, IT, SEO, Read-Only). Granulare RLS-Policies pro Tabelle.',
    to: '/security',
    cta: 'Rollenmodell ansehen',
  },
  {
    Icon: Scale,
    title: 'TOMs & AI-Act-Hinweise',
    body:
      'Technische und organisatorische Maßnahmen sowie AI-Act-Klassifizierung pro KI-Feature dokumentiert und versioniert.',
    to: '/ai-act',
    cta: 'AI Act ansehen',
  },
] as const;

function TrustSection() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-titanium-500 mb-3">
          Vertrauen & Nachweise
        </p>
        <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50 mb-2">
          Was Sie prüfen können, bevor Sie unterschreiben
        </h2>
        <p className="text-sm text-titanium-400 mb-10 max-w-2xl">
          Audit-fähig heißt: einsehbar, exportierbar, dokumentiert.
          Sechs Bausteine, alle hinter eigenen Unterseiten.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-titanium-900">
          {TRUST_ITEMS.map(({ Icon, title, body, to, cta }) => (
            <div key={title} className="bg-obsidian-900 p-6 flex flex-col">
              <Icon className="h-5 w-5 text-cyan-300 mb-4" />
              <h3 className="font-display font-semibold text-titanium-50 mb-2">
                {title}
              </h3>
              <p className="text-sm text-titanium-400 leading-relaxed mb-4 flex-1">
                {body}
              </p>
              <Link
                to={to}
                className="inline-flex items-center gap-1 text-[12px] font-mono uppercase tracking-wider text-cyan-300 hover:text-cyan-200 transition-colors"
              >
                {cta} <ArrowRight className="h-3 w-3" />
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
  { to: '/evidence',   label: 'Evidence ansehen' },
  { to: '/ai-act',     label: 'AI Act ansehen' },
  { to: '/security',   label: 'Sicherheit ansehen' },
  { to: '/developers', label: 'Entwickler ansehen' },
  { to: '/pricing',    label: 'Preise ansehen' },
] as const;

function CtaBlock() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto text-center">
        <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50 mb-3">
          In zwei Minuten startbar
        </h2>
        <p className="text-sm text-titanium-400 max-w-2xl mx-auto mb-8">
          Domain eintragen, erster Scan läuft. Score, Befunde und Report
          sind im Anschluss verfügbar — als Grundlage für einen Pilot mit
          Compliance, Legal, SEO und IT.
        </p>

        <div className="flex flex-wrap justify-center gap-3 mb-10">
          <Link
            to="/audit"
            className="inline-flex items-center gap-2 bg-cyan-400 text-obsidian-950 px-5 py-3 text-sm font-semibold hover:bg-cyan-300 transition-colors"
          >
            Enterprise-Risiko prüfen <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/agencies"
            className="inline-flex items-center gap-2 border border-titanium-700 text-titanium-100 px-5 py-3 text-sm font-semibold hover:border-titanium-500 transition-colors"
          >
            Pilot für Compliance, Legal, SEO und IT anfragen
          </Link>
          <Link
            to="/runtime"
            className="inline-flex items-center gap-2 border border-titanium-800 text-titanium-300 px-5 py-3 text-sm font-medium hover:text-titanium-100 hover:border-titanium-600 transition-colors"
          >
            Runtime ansehen
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
