/**
 * Landing — Self-Service-Startseite ("European Enterprise Trust" /
 * Governance-Operating-System-Positionierung).
 *
 * Vollständig statisch: kein Auto-Scroll, kein IntersectionObserver, keine
 * Animations-Loops (Ausnahme: ein einzelner CSS `animate-pulse`-Status-Dot,
 * respektiert `prefers-reduced-motion` global).
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
 * Design: siehe AGENTS.md „Ausnahme: Public Landing/Marketing (European
 * Enterprise Trust)" — Petrol/Teal-Akzente, rounded-chip/card/panel (10–14px).
 * CTA-Disziplin: ausschließlich Strings aus `CTA` (runtimeVocab). Keine
 * Beratungs-/Pilot-/Demo-/Call-/Sales-Sprache.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, ShieldCheck, FileCheck2, BadgeCheck, Workflow, Sparkles,
  Globe, Lock, Activity, Scale, Archive, ClipboardCheck, ScanSearch,
  Home, Cpu, AlertTriangle, Bot, GitMerge, FileText,
  Boxes, Network, Server, Eye, Package, Landmark,
} from 'lucide-react';
import { LandingNavbar } from '../components/LandingNavbar';
import { CTA } from '../content/runtimeVocab';
import { AUTOMATION_SKILLS, type AutomationSkillCategory } from '../content/automationSkills';
import { AutomationSkillStatusBadge } from '../features/automations/AutomationSkillCard';
import { AUTOMATION_SKILL_STATUS_LABEL, type AutomationSkillStatus } from '../content/automationSkills';

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
        <DigitalSovereigntySection />
        <SupplyChainGovernanceSection />
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
  { Icon: Globe, label: 'EU-Hosting' },
  { Icon: FileCheck2, label: 'Auditierbare Evidence' },
  { Icon: Lock, label: 'Keine Kreditkarte nötig' },
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
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-24">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div>
          <p className="inline-flex items-center rounded-chip border border-petrol-500/40 bg-petrol-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-petrol-300 mb-5">
            Governance OS · DSGVO · EU AI Act · Digitale Souveränität
          </p>

          <h1 className="font-display font-bold tracking-tight text-titanium-50 text-3xl sm:text-5xl leading-[1.08]">
            Das Governance OS für DSGVO, EU AI Act und digitale Souveränität.
          </h1>

          <p className="mt-6 text-base sm:text-lg text-titanium-300 max-w-xl leading-relaxed">
            RealSyncDynamics.AI überwacht Websites, KI-Systeme, Drittanbieter,
            Risiken und Nachweise kontinuierlich — mit Evidence Vault, Governance
            Agents und auditfähiger Dokumentation im Browser-Format.
          </p>

          {/* Primary CTA: Self-Serve, kein Demo-Zwang */}
          <div className="mt-10 flex flex-col sm:flex-row gap-3">
            <Link
              to="/app"
              className="inline-flex items-center justify-center gap-2 rounded-chip bg-petrol-400 text-obsidian-950 px-6 py-3 text-sm font-semibold hover:bg-petrol-300 transition-colors"
            >
              {CTA.startTrial} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/audit?source=hero"
              className="inline-flex items-center justify-center gap-2 rounded-chip border border-titanium-700 text-titanium-200 px-6 py-3 text-sm font-semibold hover:border-titanium-500 transition-colors"
            >
              {CTA.startGovernanceAudit}
            </Link>
          </div>

          {/* Domain-Scan Teaser */}
          <form onSubmit={handleScan} className="mt-5 flex flex-col sm:flex-row max-w-sm rounded-chip border border-titanium-800 overflow-hidden focus-within:border-petrol-500/50 transition-colors">
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="ihre-domain.de scannen …"
              className="flex-1 bg-obsidian-900 px-4 py-2 text-xs text-titanium-200 placeholder-titanium-600 font-mono focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center px-4 py-2 text-xs font-mono text-petrol-300 hover:text-petrol-100 border-l border-titanium-800 transition-colors shrink-0"
            >
              Scan <ArrowRight className="h-3 w-3 ml-1" />
            </button>
          </form>

          <div className="mt-8 flex flex-wrap gap-2">
            {HERO_TRUST_ITEMS.map(({ Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-chip border border-titanium-800 bg-obsidian-900 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-titanium-400"
              >
                <Icon className="h-3 w-3 text-petrol-300" /> {label}
              </span>
            ))}
          </div>
        </div>

        <GovernanceDashboardPreview />
      </div>
    </section>
  );
}

// ─── Governance-Dashboard-Vorschau (statisches Beispiel) ────────────

const DASHBOARD_METRICS = [
  { label: 'Governance Score', value: '84', suffix: '/100', tone: 'text-petrol-300' },
  { label: 'Consent Violations', value: '3', suffix: '', tone: 'text-[color:var(--color-risk-medium)]' },
  { label: 'AI Risks', value: '1', suffix: '', tone: 'text-[color:var(--color-risk-high)]' },
  { label: 'Evidence Items', value: '248', suffix: '', tone: 'text-titanium-50' },
] as const;

function GovernanceDashboardPreview() {
  return (
    <div className="rounded-panel border border-titanium-800 bg-obsidian-900 p-5 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-titanium-500">Beispiel-Ansicht</p>
          <p className="font-display font-semibold text-titanium-50 text-sm mt-1">Governance Dashboard · ihre-domain.de</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-chip border border-petrol-500/40 bg-petrol-500/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-petrol-300">
          <span className="h-1.5 w-1.5 rounded-full bg-ai-cyan-400 animate-pulse" />
          Live Scan
        </span>
      </div>

      {/* Metrik-Grid */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {DASHBOARD_METRICS.map(({ label, value, suffix, tone }) => (
          <div key={label} className="rounded-card border border-titanium-800 bg-obsidian-950 p-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-1.5">{label}</p>
            <p className={`font-display font-bold text-2xl tabular ${tone}`}>
              {value}<span className="text-titanium-600 text-sm">{suffix}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Drift Detection + Letzter Scan + EU-Hosting */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-titanium-800 pt-4 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
        <span className="inline-flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-ai-cyan-400" /> Drift Detection: Aktiv
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
  { Icon: ShieldCheck, label: 'DSGVO' },
  { Icon: Scale, label: 'AI Act' },
  { Icon: Globe, label: 'EU Hosting' },
  { Icon: Archive, label: 'Evidence Vault' },
  { Icon: Activity, label: 'Monitoring' },
  { Icon: ClipboardCheck, label: 'Audit Trail' },
] as const;

function TrustStrip() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-6">
      <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        {TRUST_STRIP_ITEMS.map(({ Icon, label }) => (
          <span
            key={label}
            className="inline-flex items-center gap-1.5 rounded-chip border border-titanium-800 bg-obsidian-900 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-titanium-400"
          >
            <Icon className="h-3.5 w-3.5 text-petrol-300" /> {label}
          </span>
        ))}
      </div>
    </section>
  );
}

// ─── 3 · Produktmechanik ─────────────────────────────────────────────

const MECHANICS_STEPS = [
  { Icon: ScanSearch, title: 'Scan', metric: '47 Risiken erkannt' },
  { Icon: FileCheck2, title: 'Evidence', metric: '312 Nachweise erzeugt' },
  { Icon: Activity, title: 'Monitoring', metric: '24/7 Überwachung aktiv' },
  { Icon: BadgeCheck, title: 'Audit Ready', metric: 'Bereit für Prüfung' },
] as const;

function ProductMechanics() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-titanium-500 mb-3 text-center">
          Produktmechanik
        </p>
        <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50 text-center mb-10">
          Vom ersten Scan bis Audit-ready — ein durchgehender Prüfpfad.
        </h2>
        <div className="flex flex-col sm:flex-row items-stretch gap-3">
          {MECHANICS_STEPS.map(({ Icon, title, metric }, i) => (
            <div key={title} className="flex items-center gap-3 flex-1">
              <div className="flex-1 rounded-card border border-titanium-800 bg-obsidian-900 p-5">
                <Icon className="h-5 w-5 text-petrol-300 mb-3" />
                <h3 className="font-display font-semibold text-titanium-50 mb-1">{title}</h3>
                <p className="font-mono text-[11px] uppercase tracking-wider text-titanium-400">{metric}</p>
              </div>
              {i < MECHANICS_STEPS.length - 1 && (
                <ArrowRight className="hidden sm:block h-4 w-4 text-titanium-700 shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 4 · Zielgruppen ──────────────────────────────────────────────────

const AUDIENCES = [
  { title: 'Einzelunternehmer', body: 'Automatische DSGVO-Prüfung ohne Datenschutzabteilung.' },
  { title: 'Handwerksbetriebe', body: 'Website, Kontaktformulare und Tracking überwachen.' },
  { title: 'Kanzleien', body: 'Mandanten-Compliance skalierbar überwachen.' },
  { title: 'Arztpraxen', body: 'Datenschutzrisiken frühzeitig erkennen.' },
  { title: 'Agenturen', body: 'White-Label Governance für Kunden-Portfolios.' },
] as const;

function AudienceSection() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-titanium-500 mb-3">
          Für wen
        </p>
        <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50 mb-10">
          Für jedes Team, das Verantwortung für Compliance trägt.
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {AUDIENCES.map(({ title, body }) => (
            <div key={title} className="rounded-card border border-titanium-800 bg-obsidian-900 p-5">
              <h3 className="font-display font-semibold text-titanium-50 mb-2">{title}</h3>
              <p className="text-sm text-titanium-400 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 5 · Automation Skills (Teaser) ─────────────────────────────────

const SKILL_PERSONA: Record<AutomationSkillCategory, string> = {
  compliance: 'Compliance-Verantwortliche',
  vertrieb: 'Vertrieb',
  support: 'Support-Teams',
  dokumente: 'Rechts- & Datenschutzteam',
  meetings: 'Projekt- & Teamleads',
};

const SKILL_INPUT: Record<AutomationSkillCategory, string> = {
  compliance: 'Website-URL',
  vertrieb: 'Website-URL (Lead)',
  support: 'Screenshot',
  dokumente: 'Audit-Befunde',
  meetings: 'Notizen / Transkript',
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
          <Link to="/automations" className="inline-flex items-center gap-2 text-sm font-semibold text-petrol-300 hover:text-petrol-200">
            {CTA.viewAutomationSkills} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {AUTOMATION_SKILLS.map((skill) => (
            <Link
              key={skill.id}
              to="/automations"
              className="rounded-card border border-titanium-800 bg-obsidian-900 p-5 flex flex-col gap-3 hover:border-petrol-500/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <Workflow className="h-5 w-5 text-petrol-300" />
                <AutomationSkillStatusBadge status={skill.status} />
              </div>
              <h3 className="font-display font-semibold text-titanium-50">{skill.title}</h3>
              <p className="text-sm text-titanium-400 leading-relaxed">{skill.shortDescription}</p>

              <dl className="grid grid-cols-2 gap-2 mt-1 font-mono text-[10px] uppercase tracking-wider">
                <div>
                  <dt className="text-titanium-600">Input</dt>
                  <dd className="text-titanium-300 mt-0.5">{SKILL_INPUT[skill.category]}</dd>
                </div>
                <div>
                  <dt className="text-titanium-600">Output</dt>
                  <dd className="text-titanium-300 mt-0.5">{skill.output[0]}</dd>
                </div>
              </dl>

              <p className="mt-auto pt-2 border-t border-titanium-900 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                Für: {SKILL_PERSONA[skill.category]}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 6 · Governance OS Browser ──────────────────────────────────────

const GOVERNANCE_OS_MODULES = [
  { Icon: Home,          label: 'Übersicht',     route: '/app',           color: 'text-titanium-300' },
  { Icon: Globe,         label: 'Websites',      route: '/app/websites',  color: 'text-petrol-300' },
  { Icon: Cpu,           label: 'KI-Systeme',    route: '/app/ai-systems',color: 'text-petrol-300' },
  { Icon: AlertTriangle, label: 'Risiken',       route: '/app/risks',     color: 'text-red-400' },
  { Icon: FileCheck2,    label: 'Evidence Vault',route: '/app/evidence',  color: 'text-petrol-300' },
  { Icon: Activity,      label: 'Monitoring',    route: '/app/monitoring',color: 'text-ai-cyan-400' },
  { Icon: Bot,           label: 'Agenten',       route: '/app/agents',    color: 'text-petrol-300' },
  { Icon: GitMerge,      label: 'Workflows',     route: '/app/workflows', color: 'text-titanium-300' },
  { Icon: FileText,      label: 'Dokumente',     route: '/app/documents', color: 'text-titanium-300' },
  { Icon: ClipboardCheck,label: 'Audit Export',  route: '/app/audit',     color: 'text-petrol-300' },
] as const;

function GovernanceOsBrowser() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-petrol-300 mb-3">
          Governance OS Browser
        </p>
        <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50 mb-3 max-w-2xl">
          Ein Betriebssystem für Compliance, Evidence und AI-Risikomanagement.
        </h2>
        <p className="text-sm text-titanium-400 max-w-xl mb-10 leading-relaxed">
          Alle Module greifen auf denselben Prüfpfad zu — ein Befund aus Websites
          wird zur Evidence, die Evidence speist Risk Center, Monitoring und
          Audit-Export.
        </p>
        <div className="rounded-panel border border-titanium-800 bg-obsidian-900 p-5 sm:p-6">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-5">
            {GOVERNANCE_OS_MODULES.map(({ Icon, label, route, color }) => (
              <Link
                key={label}
                to={route}
                className="rounded-card border border-titanium-800 bg-obsidian-950 p-3 flex items-center gap-2 hover:border-petrol-500/40 transition-colors group"
              >
                <Icon className={`h-3.5 w-3.5 shrink-0 ${color}`} />
                <span className="font-mono text-[10px] uppercase tracking-wider text-titanium-400 group-hover:text-titanium-200 transition-colors">{label}</span>
              </Link>
            ))}
          </div>
          <div className="flex justify-end border-t border-titanium-800 pt-4">
            <Link
              to="/app"
              className="inline-flex items-center gap-2 text-xs font-mono text-petrol-300 hover:text-petrol-100 transition-colors"
            >
              Governance OS öffnen <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── 6b · Digitale Souveränität ─────────────────────────────────────

const SOVEREIGNTY_PILLARS = [
  { Icon: Network, title: 'Transparente Software- & Anbieterstruktur', body: 'Drittanbieter, Skripte, Tracker und KI-Dienste werden sichtbar gemacht — wer verarbeitet welche Daten, in welcher Region.' },
  { Icon: ShieldCheck, title: 'Nachweisbare DSGVO- & AI-Act-Governance', body: 'Pflichten werden zu prüfbaren Kontrollen — klassifiziert nach DSGVO-Artikel und EU-AI-Act-Risikoklasse.' },
  { Icon: Eye, title: 'Kontrolle über Drittanbieter & Datenflüsse', body: 'Tracker, KI-Systeme, externe Schnittstellen und Datentransfers bleiben unter laufender Kontrolle statt im Verborgenen.' },
  { Icon: Archive, title: 'Evidence Vault für prüfbare Nachweise', body: 'Jeder Befund wird zu auditfähiger Evidence — versioniert, nachvollziehbar und exportierbar für Aufsicht und Audit.' },
  { Icon: Activity, title: 'Kontinuierliches Monitoring statt Einmal-Audit', body: 'Governance läuft als fortlaufender Prozess weiter — Drift, neue Tracker und Änderungen werden erkannt, sobald sie entstehen.' },
  { Icon: Bot, title: 'Governance Agents für Prüfungen & Maßnahmen', body: 'Spezialisierte Agents prüfen Befunde, schlagen Maßnahmen vor und schreiben Nachweise in den Prüfpfad.' },
] as const;

function DigitalSovereigntySection() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-petrol-300 mb-3 inline-flex items-center gap-2">
          <Landmark className="h-3.5 w-3.5" /> Digitale Souveränität
        </p>
        <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50 mb-3 max-w-2xl">
          Digitale Souveränität als Betriebsmodell.
        </h2>
        <p className="text-sm text-titanium-400 max-w-2xl mb-10 leading-relaxed">
          RealSyncDynamics.AI hilft Unternehmen, digitale Souveränität praktisch
          umzusetzen — als laufende, nachweisbare Kontrolle über Software,
          Anbieter, KI-Systeme und Datenflüsse. Europäisch gehostet, auditfähig,
          ohne Abhängigkeit von Einmal-Prüfungen.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SOVEREIGNTY_PILLARS.map(({ Icon, title, body }) => (
            <div key={title} className="rounded-card border border-titanium-800 bg-obsidian-900 p-5">
              <Icon className="h-5 w-5 text-petrol-300 mb-3" />
              <h3 className="font-display font-semibold text-titanium-50 mb-2 text-[15px] leading-snug">{title}</h3>
              <p className="text-sm text-titanium-400 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
        <div className="mt-8">
          <Link
            to="/digitale-souveraenitaet"
            className="inline-flex items-center gap-2 text-sm font-semibold text-petrol-300 hover:text-petrol-200"
          >
            Digitale Souveränität verstehen <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── 6c · Software- & Anbieter-Governance (Supply Chain) ────────────

const SUPPLY_CHAIN_CAPABILITIES = [
  { Icon: Network, label: 'Drittanbieter-Erkennung', ready: true },
  { Icon: ScanSearch, label: 'Tracker- & Script-Erkennung', ready: true },
  { Icon: Cpu, label: 'KI-System-Dokumentation', ready: true },
  { Icon: Globe, label: 'Anbieter- & Transferprüfung', ready: true },
  { Icon: Scale, label: 'Risikoklassifizierung', ready: true },
  { Icon: ClipboardCheck, label: 'Audit-Trail & Evidence', ready: true },
  { Icon: Boxes, label: 'SBOM- & Supply-Chain-Governance', ready: false },
  { Icon: Package, label: 'Open-Source-Komponenten-Inventar', ready: false },
] as const;

function SupplyChainGovernanceSection() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-titanium-500 mb-3 inline-flex items-center gap-2">
          <Server className="h-3.5 w-3.5 text-petrol-300" /> Software Supply Chain
        </p>
        <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50 mb-3 max-w-2xl">
          Governance für Software, Anbieter und Open-Source-Komponenten.
        </h2>
        <p className="text-sm text-titanium-400 max-w-2xl mb-10 leading-relaxed">
          Wer Software einsetzt, verantwortet auch deren Lieferkette.
          RealSyncDynamics.AI macht Drittanbieter, Skripte und KI-Dienste sichtbar,
          bewertet sie evidenzbasiert und ist vorbereitet für SBOM-, Anbieter- und
          Software-Supply-Chain-Governance.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SUPPLY_CHAIN_CAPABILITIES.map(({ Icon, label, ready }) => (
            <div key={label} className="flex items-center gap-3 rounded-card border border-titanium-800 bg-obsidian-900 p-4">
              <Icon className="h-4 w-4 shrink-0 text-petrol-300" />
              <span className="flex-1 text-sm text-titanium-200">{label}</span>
              <span
                className={`inline-flex items-center rounded-chip border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                  ready
                    ? 'border-petrol-500/40 bg-petrol-500/10 text-petrol-300'
                    : 'border-titanium-700 bg-obsidian-950 text-titanium-500'
                }`}
              >
                {ready ? 'Aktiv' : 'Vorbereitet'}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-6 font-mono text-[10px] uppercase tracking-wider text-titanium-600">
          „Vorbereitet" — Roadmap-Funktionen für SBOM- & Software-Supply-Chain-Governance.
        </p>
      </div>
    </section>
  );
}

// ─── 7 · Beta-Programm ───────────────────────────────────────────────

const BETA_GEGENLEISTUNG = ['Feedback geben', 'Screenshots senden', 'Fehler berichten'];

function BetaProgramSection() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-3xl mx-auto rounded-panel border border-petrol-500/30 bg-obsidian-900/60 p-8 sm:p-10 text-center">
        <div className="inline-flex items-center gap-2 mb-4 rounded-chip border border-petrol-500/40 bg-petrol-500/10 px-3 py-1 text-petrol-300 text-xs font-mono uppercase tracking-wider">
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
          className="inline-flex items-center justify-center gap-2 rounded-chip bg-petrol-400 text-obsidian-950 px-6 py-3 text-sm font-semibold hover:bg-petrol-300 transition-colors"
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
        <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50 mb-3">
          Governance OS — kostenlos starten
        </h2>
        <p className="text-sm text-titanium-400 max-w-xl mx-auto mb-8">
          Sofort einsatzbereit. Websites, KI-Systeme und Risiken überwachen —
          keine Kreditkarte, kein Setup.
        </p>
        <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3">
          <Link
            to="/app"
            className="inline-flex items-center justify-center gap-2 rounded-chip bg-petrol-400 text-obsidian-950 px-6 py-3 text-sm font-semibold hover:bg-petrol-300 transition-colors"
          >
            {CTA.startFree} <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/audit?source=final-cta"
            className="inline-flex items-center justify-center gap-2 rounded-chip border border-titanium-700 text-titanium-100 px-6 py-3 text-sm font-semibold hover:border-titanium-500 transition-colors"
          >
            {CTA.startFreeAudit}
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
    <footer className="px-4 sm:px-6 py-10 text-titanium-500">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap gap-2 mb-6">
          {TRUST_STRIP_ITEMS.map(({ Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-chip border border-titanium-900 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-titanium-600"
            >
              <Icon className="h-3 w-3" /> {label}
            </span>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-[12px] border-t border-titanium-900 pt-6">
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
      </div>
    </footer>
  );
}
