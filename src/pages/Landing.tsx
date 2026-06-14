/**
 * Landing — Self-Service-Startseite (v2: radikal vereinfacht).
 *
 * Vollständig statisch: kein Auto-Scroll, kein IntersectionObserver, keine
 * Animations-Loops.
 *
 * 10-Sekunden-Botschaft: „RealSyncDynamics.AI erkennt Risiken, erzeugt
 * Evidence und hält Websites sowie KI-Systeme audit-ready."
 *
 * Struktur (5 Blöcke):
 *   1 Hero · 2 Value Cards (Risiken erkennen / Evidence erzeugen /
 *   Audit-ready bleiben) · 3 Automation Skills (Teaser, 6 Kacheln) ·
 *   4 Beta-Programm · 5 Final CTA + Footer
 *
 * CTA-Disziplin: ausschließlich Strings aus `CTA` (runtimeVocab). Keine
 * Beratungs-/Pilot-/Demo-/Call-/Sales-Sprache.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, ShieldCheck, FileCheck2, BadgeCheck, Workflow, Sparkles,
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { CTA } from '../content/runtimeVocab';
import { AUTOMATION_SKILLS } from '../content/automationSkills';
import { AutomationSkillStatusBadge } from '../features/automations/AutomationSkillCard';

export function Landing() {
  return (
    <>
      <Navbar />
      <main className="bg-obsidian-950 text-titanium-100 pt-14">
        <Hero />
        <ValueCards />
        <AutomationSkillsTeaser />
        <BetaProgramSection />
        <FinalCta />
        <Footer />
      </main>
    </>
  );
}

// ─── 1 · Hero ────────────────────────────────────────────────────────

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
      <div className="max-w-2xl mx-auto text-center">
        <h1 className="font-display font-bold tracking-tight text-titanium-50 text-3xl sm:text-5xl leading-[1.08]">
          DSGVO- und KI-Compliance<br className="hidden sm:block" /> automatisch überwachen.
        </h1>

        <p className="mt-6 text-base sm:text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed">
          RealSyncDynamics.AI erkennt Risiken, erzeugt Evidence und hält
          Websites sowie KI-Systeme audit-ready.
        </p>

        {/* Primary CTA: Domain-Scan */}
        <form onSubmit={handleScan} className="mt-10 flex flex-col sm:flex-row gap-0 max-w-xl mx-auto">
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="ihre-domain.de"
            className="flex-1 bg-obsidian-900 border border-titanium-700 border-r-0 px-4 py-3 text-sm text-titanium-50 placeholder-titanium-600 font-mono focus:outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 bg-cyan-400 text-obsidian-950 px-6 py-3 text-sm font-semibold hover:bg-cyan-300 transition-colors shrink-0"
          >
            {CTA.startFreeAudit} <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* Secondary CTA */}
        <div className="mt-5">
          <Link
            to="/automations"
            className="inline-flex items-center gap-2 text-sm font-semibold text-titanium-300 hover:text-titanium-50 transition-colors"
          >
            {CTA.viewAutomationSkills} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── 2 · Value Cards ─────────────────────────────────────────────────

const VALUES = [
  {
    Icon: ShieldCheck,
    title: 'Risiken erkennen',
    body: 'Tracker, Cookies, Drittlandtransfers und KI-Systeme automatisch scannen.',
  },
  {
    Icon: FileCheck2,
    title: 'Evidence erzeugen',
    body: 'Jeder Befund landet versiegelt im Prüfpfad — exportierbar als Report.',
  },
  {
    Icon: BadgeCheck,
    title: 'Audit-ready bleiben',
    body: 'Continuous Monitoring statt einmaligem PDF — Drift wird automatisch erkannt.',
  },
];

function ValueCards() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-px bg-titanium-900">
        {VALUES.map(({ Icon, title, body }) => (
          <div key={title} className="bg-obsidian-900 p-6">
            <Icon className="h-5 w-5 text-cyan-300 mb-4" />
            <h3 className="font-display font-semibold text-titanium-50 mb-2">{title}</h3>
            <p className="text-sm text-titanium-400 leading-relaxed">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── 3 · Automation Skills (Teaser) ─────────────────────────────────

function AutomationSkillsTeaser() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-end justify-between gap-4 mb-10 flex-wrap">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-titanium-500 mb-3">
              Wählen · Aktivieren · Nutzen
            </p>
            <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50">
              Automation Skills
            </h2>
          </div>
          <Link to="/automations" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200">
            {CTA.viewAutomationSkills} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-titanium-900">
          {AUTOMATION_SKILLS.map((skill) => (
            <Link
              key={skill.id}
              to="/automations"
              className="bg-obsidian-900 p-6 flex flex-col gap-2 hover:bg-obsidian-800 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <Workflow className="h-5 w-5 text-cyan-300" />
                <AutomationSkillStatusBadge status={skill.status} />
              </div>
              <h3 className="font-display font-semibold text-titanium-50">{skill.title}</h3>
              <p className="text-sm text-titanium-400 leading-relaxed line-clamp-2">{skill.shortDescription}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 4 · Beta-Programm ───────────────────────────────────────────────

const BETA_GEGENLEISTUNG = ['Feedback geben', 'Screenshots senden', 'Fehler berichten'];

function BetaProgramSection() {
  return (
    <section className="border-b border-titanium-900 bg-obsidian-900/60 px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-3xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 mb-4 text-amber-300 text-xs font-mono uppercase tracking-wider">
          <Sparkles className="h-4 w-4" /> Beta-Programm
        </div>
        <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50 mb-3">
          5 Unternehmen erhalten 12 Monate Enterprise kostenlos.
        </h2>
        <p className="text-sm text-titanium-400 max-w-xl mx-auto mb-6">
          Im Gegenzug: {BETA_GEGENLEISTUNG.join(' · ')}.
        </p>
        <Link
          to="/welcome?source=landing-beta&intent=founding"
          className="inline-flex items-center justify-center gap-2 border border-amber-500 text-amber-300 px-6 py-3 text-sm font-semibold hover:bg-amber-500/10 transition-colors"
        >
          {CTA.applyForBeta} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

// ─── 5 · Final CTA ───────────────────────────────────────────────────

function FinalCta() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50 mb-3">
          Starten Sie noch heute — völlig kostenlos
        </h2>
        <p className="text-sm text-titanium-400 max-w-xl mx-auto mb-8">
          Domain eintragen, Scan startet sofort. Keine Karte, keine versteckten Gebühren.
        </p>
        <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3">
          <Link
            to="/audit?source=final-cta"
            className="inline-flex items-center justify-center gap-2 bg-cyan-400 text-obsidian-950 px-6 py-3 text-sm font-semibold hover:bg-cyan-300 transition-colors"
          >
            {CTA.startFreeAudit} <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/welcome?source=final-cta"
            className="inline-flex items-center justify-center gap-2 border border-titanium-700 text-titanium-100 px-6 py-3 text-sm font-semibold hover:border-titanium-500 transition-colors"
          >
            {CTA.openDashboard}
          </Link>
        </div>
        <p className="text-xs text-titanium-500 mt-6 font-mono uppercase tracking-wider">
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
