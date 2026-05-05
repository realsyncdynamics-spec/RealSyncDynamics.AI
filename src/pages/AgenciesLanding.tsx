import React from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase, GitMerge, Layers, ShieldCheck, ArrowRight,
  CheckCircle2, Code, Building, FileText,
} from 'lucide-react';

export function AgenciesLanding() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100 selection:bg-security-500/30 selection:text-titanium-50">
      <Header />
      <main>
        <Hero />
        <ValueProps />
        <UseCases />
        <Onboarding />
        <TrustBlock />
        <FinalCTA />
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
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <span className="font-display font-bold text-titanium-50 tracking-tight">RealSyncDynamics.AI</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link to="/" className="hidden sm:inline px-3 py-1.5 text-sm text-titanium-300 hover:text-titanium-50">Apex (B2B)</Link>
          <Link to="/pricing" className="hidden sm:inline px-3 py-1.5 text-sm text-titanium-300 hover:text-titanium-50">Preise</Link>
          <Link to="/contact-sales?source=agencies_header"
            className="px-4 py-1.5 bg-security-500 hover:bg-security-600 text-white text-sm font-semibold rounded-none">
            Partner-Gespräch
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
      <div className="max-w-4xl mx-auto space-y-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 border border-amber-900 bg-amber-950/30 text-amber-300 text-xs font-bold uppercase tracking-wider rounded-none">
          <Briefcase className="h-3 w-3" /> Für AI-Agenturen + System-Integratoren
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-titanium-50 tracking-tight leading-[1.05]">
          Eure Agentur baut auf EU-souveräner KI —<br className="hidden sm:inline" />
          wir liefern die Infrastruktur.
        </h1>
        <p className="text-lg text-titanium-300 max-w-2xl mx-auto leading-relaxed">
          Multi-Tenant aus dem Karton, Audit-Log pro Mandant, eu_local-Routing.
          Eure Kunden buchen — Ihr behaltet die Kundenbeziehung, Wir den Compliance-Stack.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link to="/contact-sales?source=agencies_hero"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-security-500 hover:bg-security-600 text-white font-bold rounded-none shadow-[0_4px_0_rgba(0,0,0,0.3)]">
            Partner-Gespräch buchen <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/legal/sub-processors"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-obsidian-900 border border-titanium-700 hover:bg-obsidian-800 text-titanium-200 font-semibold rounded-none">
            Architektur ansehen
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Value Props ───────────────────────────────────────────────────────────

function ValueProps() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3">Was Agenturen bekommen</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <ValueCard
            icon={<Layers />}
            title="Multi-Tenant per Default"
            text="Tenant + Memberships + RLS sind in der DB-Schema. Eure Agentur betreibt 5, 50 oder 500 Mandanten ohne Cross-Tenant-Leakage — Postgres-Row-Level-Security erzwingt das auf Storage-Ebene."
          />
          <ValueCard
            icon={<FileText />}
            title="Audit-Log pro Mandant"
            text="Jeder AI-Aufruf landet in `ai_tool_runs`: Provider, Modell, Tokens, Kosten, Residenz, User. Eure Endkunden können den Log selber per `/settings/account` als JSON exportieren."
          />
          <ValueCard
            icon={<Code />}
            title="Stripe-Subscription pro Tenant"
            text="Bronze/Silver/Gold mit Per-Plan-Quotas in der DB. Stripe Customer Portal für Karten- und Rechnungs-Management. Pricing setzt Ihr für Eure Endkunden — wir liefern das Backend."
          />
        </div>
      </div>
    </section>
  );
}

function ValueCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="p-5 bg-obsidian-900 border border-titanium-900 rounded-none">
      <div className="w-9 h-9 mb-3 bg-security-900/30 border border-security-800 text-security-300 flex items-center justify-center [&>svg]:h-4 [&>svg]:w-4">
        {icon}
      </div>
      <h4 className="font-display font-bold text-titanium-50 mb-1.5">{title}</h4>
      <p className="text-sm text-titanium-400 leading-relaxed">{text}</p>
    </div>
  );
}

// ─── Use Cases ─────────────────────────────────────────────────────────────

function UseCases() {
  const cases = [
    {
      title: 'Compliance-Workflow-Automation',
      body: 'Automatisierte Prüfroutinen für regulierte Dokumente. Eure Agentur konfiguriert n8n-Workflows, der Endkunde operiert sie — Run-History + Cost-Tracking pro Tenant.',
    },
    {
      title: 'KI-gestützte Dokumentenprüfung',
      body: 'Vertragsanalyse, Risiko-Klassifikation, Redlining auf Anthropic/Google/OpenAI-Modellen. Endkunde wählt EU-lokal-Modus → Anfragen laufen ausschließlich auf Ollama in Frankfurt.',
    },
    {
      title: 'Multi-Mandanten-Setup für Anwälte',
      body: 'Pro Kanzlei ein Tenant, pro Mandanten-Akte ein Workspace-Member-Set. Mandantengeheimnis auf RLS-Level erzwungen, Audit-Trail für jede AI-Interaktion.',
    },
    {
      title: 'DSGVO-Selfservice für Endkunden',
      body: 'Eure Kunden bekommen Auskunfts- (Art. 15) und Löschungsanspruch (Art. 17) als API + UI eingebaut. Spart Eurer Agentur den manuellen Bearbeitungs-Aufwand.',
    },
  ];
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3">Agentur-Szenarien</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {cases.map((c) => (
            <div key={c.title} className="p-5 bg-obsidian-900 border border-titanium-900 rounded-none">
              <h4 className="font-display font-bold text-titanium-50 mb-1.5">{c.title}</h4>
              <p className="text-sm text-titanium-400 leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Onboarding ────────────────────────────────────────────────────────────

function Onboarding() {
  const steps = [
    { n: '01', title: 'Partner-Gespräch (30 Min)', body: 'Wir gehen Eure Use-Cases + 2-3 Pilot-Endkunden durch. Klärung Tech-Fit, Pricing, AVV.' },
    { n: '02', title: 'Pilot-Tenant (1-2 Wochen)', body: 'Wir setzen einen Test-Tenant für Euch + einen Eurer Endkunden auf. Ihr testet eu_local, Workflows, GDPR-Selfservice end-to-end.' },
    { n: '03', title: 'Live mit Production-Tenant', body: 'Bei grünem Pilot: eigene Domain (white-label optional), Stripe-Subscription für Euch, Eure Endkunden buchen über Euch.' },
  ];
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-8">So funktioniert's</h2>
        <ol className="space-y-5 max-w-3xl">
          {steps.map((s) => (
            <li key={s.n} className="flex gap-5 items-start">
              <span className="font-display text-3xl font-black text-security-500/60 leading-none shrink-0 w-12">
                {s.n}
              </span>
              <div>
                <p className="font-display font-bold text-titanium-50">{s.title}</p>
                <p className="text-sm text-titanium-400 mt-1 leading-relaxed">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ─── Trust Block — nur was wirklich ist ────────────────────────────────────

function TrustBlock() {
  const items = [
    { value: 'EU-only', label: 'Hostinger Frankfurt + Supabase EU' },
    { value: 'Audit',   label: 'Jeder AI-Call dokumentiert' },
    { value: 'Open',    label: 'Sub-Prozessoren-Liste public' },
    { value: 'GDPR',    label: 'Art. 15 + 17 als Selfservice' },
  ];
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16">
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map((i) => (
          <div key={i.label} className="p-5 bg-obsidian-900 border border-titanium-900 rounded-none">
            <div className="font-display text-2xl font-bold text-emerald-400 leading-none">{i.value}</div>
            <div className="text-[11px] text-titanium-500 uppercase tracking-wider mt-2 leading-snug">
              {i.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Final CTA ─────────────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section className="px-4 sm:px-6 py-20">
      <div className="max-w-3xl mx-auto text-center space-y-5">
        <h2 className="text-3xl sm:text-4xl font-display font-bold text-titanium-50 tracking-tight">
          30-Min-Walkthrough — kein Sales-Druck.
        </h2>
        <p className="text-titanium-300 leading-relaxed">
          Wir zeigen Euch live: Tenant-Anlage, Workflow-Konfiguration, Audit-Log-Export
          und Stripe-Billing-Setup. Kein Deck.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/contact-sales?source=agencies_cta"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-security-500 hover:bg-security-600 text-white font-bold rounded-none">
            Partner-Gespräch buchen <ArrowRight className="h-4 w-4" />
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
        <div>© 2026 RealSync Dynamics · Made in Germany</div>
        <div className="flex flex-wrap gap-4">
          <Link to="/" className="hover:text-titanium-300">Apex</Link>
          <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>
          <Link to="/legal/sub-processors" className="hover:text-titanium-300">Sub-Prozessoren</Link>
          <Link to="/pricing" className="hover:text-titanium-300">Preise</Link>
          <Link to="/contact-sales" className="hover:text-titanium-300">Kontakt</Link>
        </div>
      </div>
    </footer>
  );
}
