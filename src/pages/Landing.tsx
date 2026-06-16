/**
 * Landing — Self-Service-Startseite ("European Enterprise Trust" /
 * Governance-Operating-System-Positionierung).
 *
 * Light-Theme (Slate/Petrol): #FFFFFF/#F8FAFC Hintergründe, #0F172A Text,
 * Petrol #0F766E als primärer Akzent. LandingNavbar (weiß) statt Navbar
 * (dunkel) — App/Dashboard bleiben unverändert Hard-Edge Industrial/Obsidian.
 *
 * 10-Sekunden-Botschaft: „RealSyncDynamics.AI ist das Governance Operating
 * System für Websites, KI-Systeme und Unternehmensprozesse — erkennt
 * Risiken, erzeugt Evidence und hält alles audit-ready."
 *
 * Struktur (9 Blöcke):
 *   1 Hero (Split: Botschaft + Trust-Chips / Governance-Dashboard-Vorschau)
 *   2 Trust-Strip (DSGVO · AI Act · EU Hosting · Evidence Vault · Monitoring · Audit Trail)
 *   3 Produktmechanik (Scan → Evidence → Monitoring → Audit Ready)
 *   4 Zielgruppen (Einzelunternehmer, Handwerk, Kanzleien, Arztpraxen, Agenturen)
 *   5 Automation Skills (Katalog-Karten mit Input/Output/Status/Persona)
 *   6 Governance OS Browser (Modul-Übersicht)
 *   7 Beta-Programm (Founding Cohort)
 *   8 Final CTA · 9 Footer mit Compliance-Signalen
 *
 * Design: AGENTS.md „Ausnahme: Public Landing/Marketing" — Petrol/Teal-Akzente,
 * rounded-chip/card/panel, Light-Slate-Neutrals statt Obsidian.
 * CTA-Disziplin: ausschließlich Strings aus `CTA` (runtimeVocab). Keine
 * Beratungs-/Pilot-/Demo-/Call-/Sales-Sprache.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, ShieldCheck, FileCheck2, BadgeCheck, Workflow, Sparkles,
  Globe, Lock, Activity, Scale, Archive, ClipboardCheck, Search, ScanSearch,
} from 'lucide-react';
import { LandingNavbar } from '../components/LandingNavbar';
import { CTA } from '../content/runtimeVocab';
import {
  AUTOMATION_SKILLS,
  AUTOMATION_SKILL_STATUS_LABEL,
  type AutomationSkillCategory,
  type AutomationSkillStatus,
} from '../content/automationSkills';

export function Landing() {
  return (
    <>
      <LandingNavbar />
      <main className="bg-white text-slate-900 pt-14">
        <Hero />
        <TrustStrip />
        <ProductMechanics />
        <AudienceSection />
        <AutomationSkillsTeaser />
        <GovernanceOsBrowser />
        <BetaProgramSection />
        <FinalCta />
        <Footer />
      </main>
    </>
  );
}

// ─── Light-mode Skill-Status-Badge ───────────────────────────────────

const LIGHT_STATUS_CLS: Record<AutomationSkillStatus, string> = {
  available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  beta:      'bg-sky-50 text-sky-700 border-sky-200',
  planned:   'bg-amber-50 text-amber-700 border-amber-200',
};

function LightStatusBadge({ status }: { status: AutomationSkillStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${LIGHT_STATUS_CLS[status]}`}>
      {AUTOMATION_SKILL_STATUS_LABEL[status]}
    </span>
  );
}

// ─── 1 · Hero ────────────────────────────────────────────────────────

const HERO_TRUST_ITEMS = [
  { Icon: Globe,      label: 'EU-Hosting' },
  { Icon: FileCheck2, label: 'Auditierbare Evidence' },
  { Icon: Lock,       label: 'Keine Kreditkarte nötig' },
] as const;

function Hero() {
  const [domain, setDomain] = useState('');
  const navigate = useNavigate();

  function handleScan(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = domain.trim();
    if (trimmed) {
      navigate(`/audit?domain=${encodeURIComponent(trimmed)}&source=hero`);
    } else {
      navigate('/audit?source=hero');
    }
  }

  return (
    <section className="border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white px-4 sm:px-6 py-16 sm:py-24">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div>
          <p className="inline-flex items-center rounded-chip border border-petrol-200 bg-petrol-50 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-petrol-700 mb-5">
            EU AI Act + DSGVO Governance OS
          </p>

          <h1 className="font-display font-bold tracking-tight text-slate-900 text-3xl sm:text-5xl leading-[1.08]">
            Kontinuierliche Governance für<br className="hidden sm:block" /> Websites, KI-Systeme und Prozesse.
          </h1>

          <p className="mt-6 text-base sm:text-lg text-slate-600 max-w-xl leading-relaxed">
            Überwachen Sie DSGVO-, AI-Act- und Compliance-Risiken kontinuierlich
            statt nur beim Audit — RealSyncDynamics.AI erkennt Risiken, erzeugt
            Evidence und hält Sie audit-ready.
          </p>

          <form onSubmit={handleScan} className="mt-10 flex flex-col sm:flex-row max-w-xl rounded-chip border border-slate-200 overflow-hidden focus-within:border-petrol-500 transition-colors shadow-sm">
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="ihre-domain.de"
              className="flex-1 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 font-mono focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 bg-petrol-700 text-white px-6 py-3 text-sm font-semibold hover:bg-petrol-600 transition-colors shrink-0"
            >
              {CTA.startFreeAudit} <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="mt-5">
            <Link
              to="/automations"
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              {CTA.viewAutomationSkills} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-2">
            {HERO_TRUST_ITEMS.map(({ Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-chip border border-slate-200 bg-white px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-slate-500 shadow-sm"
              >
                <Icon className="h-3 w-3 text-petrol-600" /> {label}
              </span>
            ))}
          </div>
        </div>

        <GovernanceDashboardPreview />
      </div>
    </section>
  );
}

// ─── Governance-Dashboard-Vorschau ────────────────────────────────────

const DASHBOARD_METRICS = [
  { label: 'Governance Score',    value: '84', suffix: '/100', tone: 'text-petrol-700' },
  { label: 'Consent Violations',  value: '3',  suffix: '',     tone: 'text-[color:var(--color-risk-medium)]' },
  { label: 'AI Risks',            value: '1',  suffix: '',     tone: 'text-[color:var(--color-risk-high)]' },
  { label: 'Evidence Items',      value: '248',suffix: '',     tone: 'text-slate-900' },
] as const;

function GovernanceDashboardPreview() {
  return (
    <div className="rounded-panel border border-slate-200 bg-slate-50 p-5 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">Beispiel-Ansicht</p>
          <p className="font-display font-semibold text-slate-900 text-sm mt-1">Governance Dashboard · ihre-domain.de</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-chip border border-petrol-200 bg-petrol-50 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-petrol-700">
          <span className="h-1.5 w-1.5 rounded-full bg-petrol-500 animate-pulse" />
          Live Scan
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        {DASHBOARD_METRICS.map(({ label, value, suffix, tone }) => (
          <div key={label} className="rounded-card border border-slate-200 bg-white p-4 shadow-sm">
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400 mb-1.5">{label}</p>
            <p className={`font-display font-bold text-2xl tabular ${tone}`}>
              {value}<span className="text-slate-300 text-sm">{suffix}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 font-mono text-[10px] uppercase tracking-wider text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-petrol-500" /> Drift Detection: Aktiv
        </span>
        <span>Letzter Scan: vor 5 Min</span>
        <span className="inline-flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5" /> EU-Frankfurt
        </span>
      </div>
    </div>
  );
}

// ─── 2 · Trust-Strip ─────────────────────────────────────────────────

const TRUST_STRIP_ITEMS = [
  { Icon: ShieldCheck,   label: 'DSGVO' },
  { Icon: Scale,         label: 'AI Act' },
  { Icon: Globe,         label: 'EU Hosting' },
  { Icon: Archive,       label: 'Evidence Vault' },
  { Icon: Activity,      label: 'Monitoring' },
  { Icon: ClipboardCheck,label: 'Audit Trail' },
] as const;

function TrustStrip() {
  return (
    <section className="border-b border-slate-100 bg-slate-50 px-4 sm:px-6 py-8">
      <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        {TRUST_STRIP_ITEMS.map(({ Icon, label }) => (
          <span
            key={label}
            className="inline-flex items-center gap-1.5 rounded-chip border border-slate-200 bg-white px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-slate-500 shadow-sm"
          >
            <Icon className="h-3.5 w-3.5 text-petrol-600" /> {label}
          </span>
        ))}
      </div>
    </section>
  );
}

// ─── 3 · Produktmechanik ─────────────────────────────────────────────

const MECHANICS_STEPS = [
  { Icon: ScanSearch, title: 'Scan',       metric: '47 Risiken erkannt' },
  { Icon: FileCheck2, title: 'Evidence',   metric: '312 Nachweise erzeugt' },
  { Icon: Activity,   title: 'Monitoring', metric: '24/7 Überwachung aktiv' },
  { Icon: BadgeCheck, title: 'Audit Ready',metric: 'Bereit für Prüfung' },
] as const;

function ProductMechanics() {
  return (
    <section className="border-b border-slate-100 bg-white px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-400 mb-3 text-center">
          Produktmechanik
        </p>
        <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-slate-900 text-center mb-10">
          Vom ersten Scan bis Audit-ready — ein durchgehender Prüfpfad.
        </h2>
        <div className="flex flex-col sm:flex-row items-stretch gap-3">
          {MECHANICS_STEPS.map(({ Icon, title, metric }, i) => (
            <div key={title} className="flex items-center gap-3 flex-1">
              <div className="flex-1 rounded-card border border-slate-200 bg-slate-50 p-5 shadow-sm">
                <Icon className="h-5 w-5 text-petrol-600 mb-3" />
                <h3 className="font-display font-semibold text-slate-900 mb-1">{title}</h3>
                <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500">{metric}</p>
              </div>
              {i < MECHANICS_STEPS.length - 1 && (
                <ArrowRight className="hidden sm:block h-4 w-4 text-slate-300 shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 4 · Zielgruppen ─────────────────────────────────────────────────

const AUDIENCES = [
  { title: 'Einzelunternehmer', body: 'Automatische DSGVO-Prüfung ohne Datenschutzabteilung.' },
  { title: 'Handwerksbetriebe', body: 'Website, Kontaktformulare und Tracking überwachen.' },
  { title: 'Kanzleien',         body: 'Mandanten-Compliance skalierbar überwachen.' },
  { title: 'Arztpraxen',        body: 'Datenschutzrisiken frühzeitig erkennen.' },
  { title: 'Agenturen',         body: 'White-Label Governance für Kunden-Portfolios.' },
] as const;

function AudienceSection() {
  return (
    <section className="border-b border-slate-100 bg-slate-50 px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-400 mb-3">
          Für wen
        </p>
        <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-slate-900 mb-10">
          Für jedes Team, das Verantwortung für Compliance trägt.
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {AUDIENCES.map(({ title, body }) => (
            <div key={title} className="rounded-card border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-display font-semibold text-slate-900 mb-2">{title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 5 · Automation Skills (Teaser) ──────────────────────────────────

const SKILL_PERSONA: Record<AutomationSkillCategory, string> = {
  compliance: 'Compliance-Verantwortliche',
  vertrieb:   'Vertrieb',
  support:    'Support-Teams',
  dokumente:  'Rechts- & Datenschutzteam',
  meetings:   'Projekt- & Teamleads',
};

const SKILL_INPUT: Record<AutomationSkillCategory, string> = {
  compliance: 'Website-URL',
  vertrieb:   'Website-URL (Lead)',
  support:    'Screenshot',
  dokumente:  'Audit-Befunde',
  meetings:   'Notizen / Transkript',
};

function AutomationSkillsTeaser() {
  return (
    <section className="border-b border-slate-100 bg-white px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-end justify-between gap-4 mb-10 flex-wrap">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-400 mb-3">
              Wählen · Aktivieren · Nutzen
            </p>
            <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-slate-900">
              Automation Skills
            </h2>
          </div>
          <Link to="/automations" className="inline-flex items-center gap-2 text-sm font-semibold text-petrol-700 hover:text-petrol-600 transition-colors">
            {CTA.viewAutomationSkills} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {AUTOMATION_SKILLS.map((skill) => (
            <Link
              key={skill.id}
              to="/automations"
              className="rounded-card border border-slate-200 bg-slate-50 p-5 flex flex-col gap-3 hover:border-petrol-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <Workflow className="h-5 w-5 text-petrol-600" />
                <LightStatusBadge status={skill.status} />
              </div>
              <h3 className="font-display font-semibold text-slate-900">{skill.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{skill.shortDescription}</p>

              <dl className="grid grid-cols-2 gap-2 mt-1 font-mono text-[10px] uppercase tracking-wider">
                <div>
                  <dt className="text-slate-400">Input</dt>
                  <dd className="text-slate-700 mt-0.5">{SKILL_INPUT[skill.category]}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Output</dt>
                  <dd className="text-slate-700 mt-0.5">{skill.output[0]}</dd>
                </div>
              </dl>

              <p className="mt-auto pt-2 border-t border-slate-100 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                Für: {SKILL_PERSONA[skill.category]}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 6 · Governance OS Browser ───────────────────────────────────────

const GOVERNANCE_OS_MODULES = [
  { Icon: ScanSearch,    label: 'Scanner' },
  { Icon: Archive,       label: 'Evidence Vault' },
  { Icon: Scale,         label: 'AI Risk Registry' },
  { Icon: Activity,      label: 'Monitoring' },
  { Icon: ClipboardCheck,label: 'Audit Trail' },
  { Icon: ShieldCheck,   label: 'Policies' },
] as const;

function GovernanceOsBrowser() {
  return (
    <section className="border-b border-slate-100 bg-slate-50 px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-petrol-600 mb-3">
          Governance OS Browser
        </p>
        <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-slate-900 mb-3 max-w-2xl">
          Nicht nur ein Scanner. Ein Betriebssystem für Compliance, Governance, Evidence und AI-Risikomanagement.
        </h2>
        <p className="text-sm text-slate-500 max-w-xl mb-10 leading-relaxed">
          Alle Module greifen auf denselben Prüfpfad zu — ein Befund aus dem
          Scanner wird zur Evidence, die Evidence speist die Audit-Trail-Sicht.
        </p>
        <div className="rounded-panel border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {GOVERNANCE_OS_MODULES.map(({ Icon, label }) => (
              <div key={label} className="rounded-card border border-slate-200 bg-slate-50 p-4 flex items-center gap-2.5">
                <Icon className="h-4 w-4 text-petrol-600 shrink-0" />
                <span className="font-mono text-[11px] uppercase tracking-wider text-slate-700">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── 7 · Beta-Programm ───────────────────────────────────────────────

const BETA_GEGENLEISTUNG = ['Feedback geben', 'Screenshots senden', 'Fehler berichten'];

function BetaProgramSection() {
  return (
    <section className="border-b border-slate-100 bg-white px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-3xl mx-auto rounded-panel border border-petrol-200 bg-petrol-50 p-8 sm:p-10 text-center">
        <div className="inline-flex items-center gap-2 mb-4 rounded-chip border border-petrol-200 bg-petrol-100 px-3 py-1 text-petrol-700 text-xs font-mono uppercase tracking-wider">
          <Sparkles className="h-4 w-4" /> Founding Cohort · Beta-Programm
        </div>
        <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-slate-900 mb-3">
          5 Unternehmen erhalten 12 Monate Enterprise kostenlos.
        </h2>
        <p className="text-sm text-slate-600 max-w-xl mx-auto mb-6">
          Im Gegenzug: {BETA_GEGENLEISTUNG.join(' · ')}.
        </p>
        <Link
          to="/welcome?source=landing-beta&intent=founding"
          className="inline-flex items-center justify-center gap-2 rounded-chip bg-petrol-700 text-white px-6 py-3 text-sm font-semibold hover:bg-petrol-600 transition-colors"
        >
          {CTA.applyForBeta} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

// ─── 8 · Final CTA ───────────────────────────────────────────────────

function FinalCta() {
  return (
    <section className="border-b border-slate-100 bg-slate-50 px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-slate-900 mb-3">
          Starten Sie noch heute — völlig kostenlos
        </h2>
        <p className="text-sm text-slate-500 max-w-xl mx-auto mb-8">
          Domain eintragen, Scan startet sofort. Keine Karte, keine versteckten Gebühren.
        </p>
        <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3">
          <Link
            to="/audit?source=final-cta"
            className="inline-flex items-center justify-center gap-2 rounded-chip bg-petrol-700 text-white px-6 py-3 text-sm font-semibold hover:bg-petrol-600 transition-colors"
          >
            {CTA.startFreeAudit} <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/welcome?source=final-cta"
            className="inline-flex items-center justify-center gap-2 rounded-chip border border-slate-300 text-slate-700 px-6 py-3 text-sm font-semibold hover:border-slate-400 hover:text-slate-900 transition-colors"
          >
            {CTA.openDashboard}
          </Link>
        </div>
        <p className="text-xs text-slate-400 mt-6 font-mono uppercase tracking-wider">
          Keine Kreditkarte erforderlich · EU-Hosting · DSGVO-konform
        </p>
      </div>
    </section>
  );
}

// ─── 9 · Footer ──────────────────────────────────────────────────────

function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-white px-4 sm:px-6 py-10 text-slate-400">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap gap-2 mb-6">
          {TRUST_STRIP_ITEMS.map(({ Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-chip border border-slate-100 bg-slate-50 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-slate-400"
            >
              <Icon className="h-3 w-3" /> {label}
            </span>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-[12px] border-t border-slate-100 pt-6">
          <div className="font-mono uppercase tracking-[0.2em] text-slate-500">
            RealSyncDynamics.AI · EU-Frankfurt
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/impressum"  className="hover:text-slate-700 transition-colors">Impressum</Link>
            <Link to="/datenschutz" className="hover:text-slate-700 transition-colors">Datenschutz</Link>
            <Link to="/agb"        className="hover:text-slate-700 transition-colors">AGB</Link>
            <span className="text-slate-300">© {year}</span>
          </nav>
        </div>
      </div>
    </footer>
  );
}
