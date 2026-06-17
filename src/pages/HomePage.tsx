/**
 * HomePage — die EINE kanonische öffentliche Landingpage ("/").
 *
 * Governance-OS-Positionierung statt Multi-Page-Marketing-Portal: Der Besucher
 * bekommt alles auf einer Seite und springt nicht mehr zwischen 30 Unterseiten.
 * Die LandingNavbar navigiert per Anker innerhalb dieser Seite.
 *
 * Struktur (Vision „Governance Operating System"):
 *   1 Hero            — 10-Sekunden-Botschaft + Self-Serve-CTAs + Trust-Chips
 *   2 Funktionen      (#funktionen)  — Plattform-Module / Governance-OS-Browser
 *   3 Automation      (#automation)  — Automation-Skill-Katalog (Daten: AUTOMATION_SKILLS)
 *   4 Preise          (#preise)      — Self-Service-Tarife (Daten: PUBLIC_PRICING_TIERS)
 *   5 FAQ             (#faq)         — Procurement-/DSB-Vorabfragen
 *   6 Login           (#login)       — Self-Serve-Einstieg in das Governance OS
 *
 * Design: „European Enterprise Trust" Light-Theme (CLAUDE.md) — Slate-Neutrals,
 * Petrol-Akzent, rounded-chip/card/panel, Monospace für Metadaten. Kohärent
 * hell (kein Dark/Light-Mix). CTA-Disziplin: ausschließlich freigegebene
 * Strings aus `CTA` (runtimeVocab) bzw. zentrale Tarif-CTAs aus pricing.ts.
 */
import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight, ShieldCheck, FileCheck2, Scale, Globe, Activity, Archive,
  ClipboardCheck, Workflow, Server, Lock, Home, Cpu, AlertTriangle, Bot,
  GitMerge, FileText, Check,
} from 'lucide-react';
import { LandingNavbar } from '../components/LandingNavbar';
import { CTA } from '../content/runtimeVocab';
import {
  AUTOMATION_SKILLS,
  AUTOMATION_SKILL_STATUS_LABEL,
  type AutomationSkillStatus,
} from '../content/automationSkills';
import {
  PUBLIC_PRICING_TIERS,
  ENTERPRISE_TIER,
  PRICING_TRUST_NOTE,
} from '../config/pricing';

export function HomePage() {
  const { hash } = useLocation();

  // Anker-Scrolling: LandingNavbar verlinkt auf /#funktionen, /#preise … —
  // react-router scrollt nicht automatisch, daher hier zentral behandelt.
  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0 });
      return;
    }
    const el = document.getElementById(hash.slice(1));
    if (el) {
      requestAnimationFrame(() =>
        el.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
    }
  }, [hash]);

  return (
    <>
      <LandingNavbar />
      <main className="bg-white text-slate-900 pt-14">
        <Hero />
        <TrustStrip />
        <FunktionenSection />
        <AutomationSection />
        <PreiseSection />
        <FaqSection />
        <LoginSection />
        <Footer />
      </main>
    </>
  );
}

// ─── 1 · Hero ────────────────────────────────────────────────────────

const HERO_TRUST = [
  { Icon: Globe, label: 'EU-Hosting · Frankfurt' },
  { Icon: FileCheck2, label: 'Auditierbare Evidence' },
  { Icon: Lock, label: 'Keine Kreditkarte nötig' },
] as const;

function Hero() {
  const navigate = useNavigate();

  return (
    <section className="border-b border-slate-100 px-4 sm:px-6 py-16 sm:py-24">
      <div className="max-w-5xl mx-auto text-center">
        <p className="inline-flex items-center rounded-chip border border-petrol-700/30 bg-petrol-700/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-petrol-700 mb-6">
          Governance OS · DSGVO · EU AI Act · Digitale Souveränität
        </p>

        <h1 className="font-display font-bold tracking-tight text-slate-900 text-4xl sm:text-5xl lg:text-6xl leading-[1.05]">
          Das Governance OS für DSGVO,
          <br className="hidden sm:block" />{' '}
          <span className="text-petrol-700">EU AI Act und digitale Souveränität.</span>
        </h1>

        <p className="mt-6 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          RealSyncDynamics.AI überwacht Websites, KI-Systeme, Drittanbieter,
          Risiken und Nachweise kontinuierlich — mit Evidence Vault, Governance
          Agents und auditfähiger Dokumentation. Alles in einer Oberfläche.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row justify-center gap-3">
          <button
            onClick={() => navigate('/welcome?source=hero')}
            className="inline-flex items-center justify-center gap-2 rounded-chip bg-petrol-700 text-white px-6 py-3 text-sm font-semibold hover:bg-petrol-600 transition-colors"
          >
            {CTA.startFree} <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => navigate('/audit?source=hero')}
            className="inline-flex items-center justify-center gap-2 rounded-chip border border-slate-300 text-slate-800 px-6 py-3 text-sm font-semibold hover:border-slate-400 hover:bg-slate-50 transition-colors"
          >
            {CTA.startGovernanceAudit}
          </button>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {HERO_TRUST.map(({ Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-chip border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-slate-500"
            >
              <Icon className="h-3 w-3 text-petrol-700" /> {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Trust-Strip ─────────────────────────────────────────────────────

const TRUST_STRIP = [
  { Icon: ShieldCheck, label: 'DSGVO' },
  { Icon: Scale, label: 'AI Act' },
  { Icon: Globe, label: 'EU Hosting' },
  { Icon: Archive, label: 'Evidence Vault' },
  { Icon: Activity, label: 'Monitoring' },
  { Icon: ClipboardCheck, label: 'Prüfpfad' },
] as const;

function TrustStrip() {
  return (
    <section className="border-b border-slate-100 bg-slate-50 px-4 sm:px-6 py-6">
      <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        {TRUST_STRIP.map(({ Icon, label }) => (
          <span
            key={label}
            className="inline-flex items-center gap-1.5 rounded-chip border border-slate-200 bg-white px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-slate-500"
          >
            <Icon className="h-3.5 w-3.5 text-petrol-700" /> {label}
          </span>
        ))}
      </div>
    </section>
  );
}

// ─── 2 · Funktionen ──────────────────────────────────────────────────

const MODULES = [
  { Icon: Home,           label: 'Übersicht',      route: '/app',            desc: 'Governance-Score, offene Risiken und Aktivität auf einen Blick.' },
  { Icon: Globe,          label: 'Websites',       route: '/app/websites',   desc: 'Tracker, Cookies, Header und Pflichtseiten kontinuierlich prüfen.' },
  { Icon: Cpu,            label: 'KI-Systeme',     route: '/app/ai-systems', desc: 'KI-Systeme registrieren und nach EU-AI-Act-Klasse dokumentieren.' },
  { Icon: AlertTriangle,  label: 'Risiken',        route: '/app/risks',      desc: 'Befunde klassifizieren, priorisieren und bis zum Fix verfolgen.' },
  { Icon: FileCheck2,     label: 'Evidence Vault', route: '/app/evidence',   desc: 'Jeder Befund wird zu versiegelter, auditfähiger Evidence.' },
  { Icon: Activity,       label: 'Monitoring',     route: '/app/monitoring', desc: 'Drift, neue Tracker und Änderungen in Echtzeit erkennen.' },
  { Icon: Bot,            label: 'Agenten',        route: '/app/agents',     desc: 'Governance Agents prüfen Befunde und schlagen Maßnahmen vor.' },
  { Icon: GitMerge,       label: 'Workflows',      route: '/app/workflows',  desc: 'Wiederkehrende Compliance-Abläufe automatisieren.' },
  { Icon: FileText,       label: 'Dokumente',      route: '/app/documents',  desc: 'DSE, AVV, VVT und TOM versioniert und nachweisbar verwalten.' },
] as const;

function FunktionenSection() {
  return (
    <section id="funktionen" className="scroll-mt-20 border-b border-slate-100 px-4 sm:px-6 py-16 sm:py-24">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-2xl mb-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-petrol-700 mb-3">
            Funktionen · Governance OS Browser
          </p>
          <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight text-slate-900 mb-4">
            Ein Betriebssystem für Compliance, Evidence und AI-Risikomanagement.
          </h2>
          <p className="text-slate-600 leading-relaxed">
            Alle Module greifen auf denselben Prüfpfad zu — ein Befund aus
            Websites wird zur Evidence, die Evidence speist Risk Center,
            Monitoring und Audit-Export. Kein Tool-Wechsel, kein Medienbruch.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES.map(({ Icon, label, route, desc }) => (
            <Link
              key={label}
              to={route}
              className="group rounded-card border border-slate-200 bg-white p-6 hover:border-petrol-700/40 hover:shadow-sm transition-all"
            >
              <Icon className="h-6 w-6 text-petrol-700 mb-4" />
              <h3 className="font-display font-semibold text-slate-900 mb-1.5 flex items-center gap-1.5">
                {label}
                <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-petrol-700 group-hover:translate-x-0.5 transition-all" />
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 3 · Automation Skills ───────────────────────────────────────────

const LIGHT_STATUS_CLS: Record<AutomationSkillStatus, string> = {
  available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  beta:      'bg-sky-50 text-sky-700 border-sky-200',
  planned:   'bg-amber-50 text-amber-700 border-amber-200',
};

function StatusBadge({ status }: { status: AutomationSkillStatus }) {
  return (
    <span className={`inline-flex items-center border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide rounded-chip ${LIGHT_STATUS_CLS[status]}`}>
      {AUTOMATION_SKILL_STATUS_LABEL[status]}
    </span>
  );
}

function AutomationSection() {
  return (
    <section id="automation" className="scroll-mt-20 border-b border-slate-100 bg-slate-50 px-4 sm:px-6 py-16 sm:py-24">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-2xl mb-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-petrol-700 mb-3">
            Automation Skills · Wählen · Aktivieren · Nutzen
          </p>
          <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight text-slate-900 mb-4">
            Vordefinierte Workflows statt manueller Arbeit.
          </h2>
          <p className="text-slate-600 leading-relaxed">
            Jeder Skill ist ein fertiger Ablauf — von Input bis Ergebnis. Aktivieren,
            laufen lassen, Nachweis erhalten.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {AUTOMATION_SKILLS.map((skill) => (
            <Link
              key={skill.id}
              to={skill.cta.href}
              className="rounded-card border border-slate-200 bg-white p-6 flex flex-col gap-3 hover:border-petrol-700/40 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <Workflow className="h-5 w-5 text-petrol-700" />
                <StatusBadge status={skill.status} />
              </div>
              <h3 className="font-display font-semibold text-slate-900">{skill.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{skill.shortDescription}</p>
              <dl className="grid grid-cols-2 gap-2 mt-1 font-mono text-[10px] uppercase tracking-wider">
                <div>
                  <dt className="text-slate-400">Output</dt>
                  <dd className="text-slate-700 mt-0.5">{skill.output[0]}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Status</dt>
                  <dd className="text-slate-700 mt-0.5">{AUTOMATION_SKILL_STATUS_LABEL[skill.status]}</dd>
                </div>
              </dl>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 4 · Preise ──────────────────────────────────────────────────────

function PreiseSection() {
  return (
    <section id="preise" className="scroll-mt-20 border-b border-slate-100 px-4 sm:px-6 py-16 sm:py-24">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-petrol-700 mb-3">
            Preise
          </p>
          <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight text-slate-900 mb-4">
            Self-Service-Tarife — vom kostenlosen Audit bis Scale.
          </h2>
          <p className="text-slate-600 leading-relaxed">
            Monatlich kündbar, keine Setup-Gebühren. Sie wählen Governance-Abdeckung,
            nicht „Anzahl Webseiten".
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          {PUBLIC_PRICING_TIERS.map((tier) => (
            <div
              key={tier.id}
              className={`relative flex flex-col rounded-card border p-5 transition-colors ${
                tier.highlight
                  ? 'border-petrol-700 ring-1 ring-petrol-700/30 bg-white'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              {tier.badges?.[0] && (
                <div className="absolute -top-3 left-5 rounded-chip bg-petrol-700 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
                  {tier.badges[0]}
                </div>
              )}
              <div className="font-display font-bold text-slate-900 text-lg mt-1 mb-1">
                {tier.name}
              </div>
              <div className="mb-1">
                <span className="text-2xl font-display font-bold text-petrol-700 tabular-nums">
                  {tier.priceEur > 0 ? `${tier.priceString} €` : (tier.id === 'free' ? '0 €' : tier.priceString)}
                </span>
                {tier.recurring && tier.priceEur > 0 && (
                  <span className="ml-1 text-xs font-mono text-slate-400">/ Monat</span>
                )}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400 mb-4 leading-snug min-h-8">
                {tier.priceSuffix}
              </div>
              <ul className="space-y-2 text-sm text-slate-600 flex-1">
                {tier.bullets.slice(0, 4).map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <Check className="h-3.5 w-3.5 text-petrol-700 shrink-0 mt-0.5" />
                    <span className="leading-snug">{b}</span>
                  </li>
                ))}
              </ul>
              <Link
                to={tier.cta.href}
                className={`mt-5 inline-flex items-center justify-center gap-1.5 rounded-chip px-4 py-2 text-sm font-semibold transition-colors ${
                  tier.highlight
                    ? 'bg-petrol-700 text-white hover:bg-petrol-600'
                    : 'border border-slate-300 text-slate-800 hover:border-petrol-700/50 hover:text-petrol-700'
                }`}
              >
                {tier.cta.label}
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 text-sm font-semibold text-petrol-700 hover:text-petrol-600"
          >
            Alle Preise im Detail <ArrowRight className="h-4 w-4" />
          </Link>
          <span className="hidden sm:inline text-slate-300">·</span>
          <Link
            to={ENTERPRISE_TIER.cta.href}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            {ENTERPRISE_TIER.cta.label}
          </Link>
        </div>

        <p className="mt-4 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-slate-400">
          {PRICING_TRUST_NOTE}
        </p>
      </div>
    </section>
  );
}

// ─── 5 · FAQ ─────────────────────────────────────────────────────────

const FAQ_ENTRIES = [
  {
    q: 'Ist RealSyncDynamics.AI ein Cookie-Banner?',
    a: 'Nein. Es ist keine Consent-Management-Plattform, sondern ein Governance OS zur Überwachung, Erkennung und Nachweisführung über Websites, KI-Systeme und Drittanbieter.',
  },
  {
    q: 'Ersetzt es einen Datenschutzbeauftragten?',
    a: 'Nein. Die Plattform unterstützt DSBs und Compliance-Teams mit technischen Befunden, Evidence und Priorisierung. Die rechtliche Bewertung bleibt Aufgabe qualifizierter Personen.',
  },
  {
    q: 'Wo werden die Daten gehostet?',
    a: 'EU-souverän in Frankfurt. Produktivdaten sind tenant-isoliert (Multi-Tenant mit Row-Level-Security) und nicht öffentlich sichtbar. On-Premise ist möglich.',
  },
  {
    q: 'Was ist der Unterschied zu klassischen DSGVO-Scannern?',
    a: 'Klassische Scanner liefern Momentaufnahmen. Hier läuft kontinuierliche Runtime-Beobachtung mit Event-Historie, Drift-Detection und überprüfbarer Evidence-Chain.',
  },
  {
    q: 'Für wen ist die Plattform geeignet?',
    a: 'Für Unternehmen und Teams mit mehreren Websites, KI-Systemen oder regelmäßigem Audit- und Nachweisdruck — vom Einzelunternehmen bis zur DSB-Kanzlei.',
  },
] as const;

function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-20 border-b border-slate-100 bg-slate-50 px-4 sm:px-6 py-16 sm:py-24">
      <div className="max-w-3xl mx-auto">
        <div className="mb-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-petrol-700 mb-3">
            FAQ
          </p>
          <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight text-slate-900">
            Häufige Fragen.
          </h2>
        </div>

        <div className="space-y-2.5">
          {FAQ_ENTRIES.map((f) => (
            <details
              key={f.q}
              className="group rounded-card border border-slate-200 bg-white open:border-petrol-700/30 transition-colors"
            >
              <summary className="cursor-pointer list-none px-5 py-4 flex items-start justify-between gap-4">
                <span className="font-display font-semibold text-slate-900 text-sm sm:text-base leading-snug">
                  {f.q}
                </span>
                <span className="text-petrol-700 text-lg leading-none transition-transform group-open:rotate-45 select-none">
                  +
                </span>
              </summary>
              <div className="px-5 pb-5 text-sm text-slate-600 leading-relaxed">
                {f.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 6 · Login / Final CTA ───────────────────────────────────────────

function LoginSection() {
  return (
    <section id="login" className="scroll-mt-20 px-4 sm:px-6 py-20 sm:py-28">
      <div className="max-w-3xl mx-auto rounded-panel border border-petrol-700/20 bg-petrol-700/5 p-10 sm:p-12 text-center">
        <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight text-slate-900 mb-3">
          Governance OS — kostenlos starten.
        </h2>
        <p className="text-slate-600 max-w-xl mx-auto mb-8 leading-relaxed">
          Sofort einsatzbereit. Websites, KI-Systeme und Risiken überwachen —
          keine Kreditkarte, kein Setup.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-3">
          <Link
            to="/welcome?source=landing-login"
            className="inline-flex items-center justify-center gap-2 rounded-chip bg-petrol-700 text-white px-6 py-3 text-sm font-semibold hover:bg-petrol-600 transition-colors"
          >
            {CTA.startFree} <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/welcome?source=landing-signin"
            className="inline-flex items-center justify-center gap-2 rounded-chip border border-slate-300 text-slate-800 px-6 py-3 text-sm font-semibold hover:border-slate-400 hover:bg-white transition-colors"
          >
            Anmelden
          </Link>
        </div>
        <p className="mt-6 font-mono text-[11px] uppercase tracking-wider text-slate-400">
          Keine Kreditkarte erforderlich · EU-Hosting · DSGVO-konform
        </p>
      </div>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────

function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-slate-100 bg-slate-50 px-4 sm:px-6 py-10 text-slate-500">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap gap-2 mb-6">
          {TRUST_STRIP.map(({ Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-chip border border-slate-200 bg-white px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-slate-500"
            >
              <Icon className="h-3 w-3 text-petrol-700" /> {label}
            </span>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-[12px] border-t border-slate-200 pt-6">
          <div className="font-mono uppercase tracking-[0.2em] inline-flex items-center gap-2">
            <Server className="h-3.5 w-3.5 text-petrol-700" />
            Governance OS · RealSyncDynamics.AI · EU-Frankfurt
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/sicherheit" className="hover:text-slate-900">Sicherheit</Link>
            <Link to="/docs" className="hover:text-slate-900">Dokumentation</Link>
            <Link to="/impressum" className="hover:text-slate-900">Impressum</Link>
            <Link to="/datenschutz" className="hover:text-slate-900">Datenschutz</Link>
            <Link to="/agb" className="hover:text-slate-900">AGB</Link>
            <span className="text-slate-300">© {year}</span>
          </nav>
        </div>
      </div>
    </footer>
  );
}
