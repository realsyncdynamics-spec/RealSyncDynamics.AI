import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, Lock, FileSearch, Eye, Layers, GitMerge,
  ArrowRight, CheckCircle2, Building2, Briefcase, Stethoscope, Scale,
} from 'lucide-react';

export function Landing() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100 selection:bg-security-500/30 selection:text-titanium-50">
      <Header />
      <main>
        <Hero />
        <Problem />
        <Solution />
        <Capabilities />
        <Audience />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}

// ─── Header ────────────────────────────────────────────────────────────────

function Header() {
  return (
    <header className="border-b border-titanium-900 bg-obsidian-950/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <span className="font-display font-bold text-titanium-50 tracking-tight">RealSyncDynamics.AI</span>
        </div>
        <nav className="flex items-center gap-2">
          <Link to="/agencies" className="hidden sm:inline px-3 py-1.5 text-sm text-titanium-300 hover:text-titanium-50">For Agencies</Link>
          <Link to="/legal/sub-processors" className="hidden sm:inline px-3 py-1.5 text-sm text-titanium-300 hover:text-titanium-50">Sub-Processors</Link>
          <Link to="/dashboard" className="hidden sm:inline px-3 py-1.5 text-sm text-titanium-300 hover:text-titanium-50">Login</Link>
          <Link to="/contact-sales" className="px-4 py-1.5 bg-security-500 hover:bg-security-600 text-white text-sm font-semibold rounded-none">
            Book Demo
          </Link>
        </nav>
      </div>
    </header>
  );
}

// ─── Hero ──────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-20 sm:py-28">
      <div className="max-w-4xl mx-auto text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 border border-emerald-900 bg-emerald-950/30 text-emerald-300 text-xs font-bold uppercase tracking-wider rounded-none">
          <ShieldCheck className="h-3 w-3" /> EU Sovereign · DSGVO-konform · Audit-by-default
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-titanium-50 tracking-tight leading-[1.05]">
          EU-konforme KI-Infrastruktur für regulierte Unternehmen
        </h1>
        <p className="text-lg text-titanium-300 max-w-2xl mx-auto leading-relaxed">
          Baue AI-Workflows mit vollständiger Auditierbarkeit, DSGVO-konformer Datenresidenz und striktem EU-Routing —
          ohne Abhängigkeit von US-gehosteten Black-Boxes.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link to="/contact-sales?source=apex_hero"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-security-500 hover:bg-security-600 text-white font-bold rounded-none shadow-[0_4px_0_rgba(0,0,0,0.3)]">
            Demo buchen <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/legal/sub-processors"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-obsidian-900 border border-titanium-700 hover:bg-obsidian-800 text-titanium-200 font-semibold rounded-none">
            Sub-Prozessoren ansehen
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Problem ───────────────────────────────────────────────────────────────

function Problem() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3">Problem</h2>
        <h3 className="text-2xl sm:text-3xl font-display font-bold text-titanium-50 mb-8 max-w-3xl">
          Heutige AI-Tools waren nicht für regulierte Branchen gebaut.
        </h3>
        <div className="grid md:grid-cols-3 gap-4">
          <ProblemCard
            icon={<Lock />}
            title="Daten verlassen die EU"
            text="Anfragen laufen durch US-Cloud-APIs — Schrems-II-Risiko, ungeeignet für besonders sensible personenbezogene Daten."
          />
          <ProblemCard
            icon={<FileSearch />}
            title="Kein Audit-Trail"
            text="Welcher Prompt mit welchem Output, von wem ausgelöst, mit welchem Kostenanteil — meist nicht dokumentierbar."
          />
          <ProblemCard
            icon={<Eye />}
            title="DSGVO-Anfragen manuell"
            text="Auskunfts- und Löschanfragen (Art. 15/17) werden per E-Mail bearbeitet — fehleranfällig, nicht skalierbar."
          />
        </div>
      </div>
    </section>
  );
}

function ProblemCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="p-5 bg-obsidian-900 border border-titanium-900 rounded-none">
      <div className="w-9 h-9 mb-3 bg-red-950/40 border border-red-900 text-red-400 flex items-center justify-center [&>svg]:h-4 [&>svg]:w-4">
        {icon}
      </div>
      <h4 className="font-display font-bold text-titanium-50 mb-1.5">{title}</h4>
      <p className="text-sm text-titanium-400 leading-relaxed">{text}</p>
    </div>
  );
}

// ─── Solution ──────────────────────────────────────────────────────────────

function Solution() {
  const items = [
    'EU-only Datenrouting — opt-in eu_local-Modus per User oder per Tenant erzwingbar',
    'End-to-End-Audit-Logs für jeden AI-Aufruf (Provider, Modell, Tokens, Kosten, Residenz)',
    'Selfservice-DSGVO-Workflows: Datenexport (Art. 15) + Löschung (Art. 17) als API + UI',
    'Multi-Tenant mit RLS — saubere Isolation für Teams, Mandanten, Pilotprojekte',
    'Stripe-Billing mit metered Usage und transparenten Per-Plan-Quotas',
  ];
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3">Lösung</h2>
        <h3 className="text-2xl sm:text-3xl font-display font-bold text-titanium-50 mb-8 max-w-3xl">
          Eine Plattform die DSGVO und Audit-Pflichten als Default behandelt.
        </h3>
        <ul className="space-y-3 max-w-3xl">
          {items.map((it) => (
            <li key={it} className="flex items-start gap-3 text-titanium-200 leading-relaxed">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ─── Capabilities ──────────────────────────────────────────────────────────

function Capabilities() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3">Kernfunktionen</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <Capability
            icon={<GitMerge />}
            title="Workflow Engine (n8n)"
            text="Visuelle Pipelines mit Audit-Log + Per-Plan-Quotas. Triggert AI, Stripe, eigene APIs, mit Run-History."
            link={{ to: '/workflows', label: 'Workflows ansehen' }}
          />
          <Capability
            icon={<ShieldCheck />}
            title="AI mit Datenresidenz"
            text="Cloud (Anthropic/Google/OpenAI) für Performance, eu_local (Ollama) für strikte EU-Verarbeitung — pro User wählbar."
            link={{ to: '/settings/ai-residency', label: 'Residenz-Modell' }}
          />
          <Capability
            icon={<Layers />}
            title="Multi-Tenant Stripe-Billing"
            text="Tenant + Memberships + RLS. Bronze/Silver/Gold/Enterprise mit metered AI-Calls, Tokens, Workflow-Runs."
            link={{ to: '/pricing', label: 'Preismodelle' }}
          />
        </div>
      </div>
    </section>
  );
}

function Capability({
  icon, title, text, link,
}: { icon: React.ReactNode; title: string; text: string; link: { to: string; label: string } }) {
  return (
    <div className="p-5 bg-obsidian-900 border border-titanium-900 rounded-none flex flex-col">
      <div className="w-9 h-9 mb-3 bg-security-900/30 border border-security-800 text-security-300 flex items-center justify-center [&>svg]:h-4 [&>svg]:w-4">
        {icon}
      </div>
      <h4 className="font-display font-bold text-titanium-50 mb-1.5">{title}</h4>
      <p className="text-sm text-titanium-400 leading-relaxed flex-1">{text}</p>
      <Link to={link.to} className="mt-3 text-sm text-security-400 hover:underline flex items-center gap-1 font-semibold">
        {link.label} <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

// ─── Audience ──────────────────────────────────────────────────────────────

function Audience() {
  const segments = [
    { icon: <Stethoscope />, label: 'HealthTech',  desc: 'Patientendaten, klinische Entscheidungssysteme' },
    { icon: <Scale />,        label: 'Legal',       desc: 'Mandantengeheimnis, Berufsrechtliche Verschwiegenheit (§ 203 StGB)' },
    { icon: <Building2 />,    label: 'FinTech',     desc: 'BaFin-Anforderungen, MaRisk, MaComp' },
    { icon: <Briefcase />,    label: 'Behörden',    desc: 'Cloud-Stop-Policies, IT-Grundschutz' },
  ];
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3">Zielgruppe</h2>
        <h3 className="text-2xl sm:text-3xl font-display font-bold text-titanium-50 mb-8 max-w-3xl">
          Für Teams die bei Datensouveränität nicht verhandeln können.
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {segments.map((s) => (
            <div key={s.label} className="p-4 bg-obsidian-900 border border-titanium-900 rounded-none">
              <div className="w-8 h-8 mb-2 text-emerald-400 [&>svg]:h-4 [&>svg]:w-4 flex items-center">
                {s.icon}
              </div>
              <div className="font-display font-bold text-titanium-50 text-sm">{s.label}</div>
              <div className="text-[11px] text-titanium-500 mt-1 leading-snug">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA ───────────────────────────────────────────────────────────────────

function CTA() {
  return (
    <section className="px-4 sm:px-6 py-20">
      <div className="max-w-3xl mx-auto text-center space-y-5">
        <h2 className="text-3xl sm:text-4xl font-display font-bold text-titanium-50 tracking-tight">
          Demo in 30 Min — keine Kaltakquise.
        </h2>
        <p className="text-titanium-300 leading-relaxed">
          Wir zeigen den eu_local-Modus, das Audit-Log, einen Beispiel-Workflow und die DSGVO-Selfservice-API
          live an Deinen Daten — Du entscheidest danach.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/contact-sales?source=apex_cta"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-security-500 hover:bg-security-600 text-white font-bold rounded-none">
            Demo buchen <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/agencies"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-obsidian-900 border border-titanium-700 hover:bg-obsidian-800 text-titanium-200 font-semibold rounded-none">
            Für Agenturen
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-titanium-900 bg-obsidian-950 px-4 sm:px-6 py-10">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-titanium-500">
        <div>
          © 2026 RealSync Dynamics · Made in Germany
        </div>
        <div className="flex flex-wrap gap-4">
          <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>
          <Link to="/legal/sub-processors" className="hover:text-titanium-300">Sub-Prozessoren</Link>
          <Link to="/pricing" className="hover:text-titanium-300">Preise</Link>
          <Link to="/contact-sales" className="hover:text-titanium-300">Kontakt</Link>
          <a href="mailto:privacy@realsyncdynamicsai.de" className="hover:text-titanium-300">privacy@…</a>
        </div>
      </div>
    </footer>
  );
}
