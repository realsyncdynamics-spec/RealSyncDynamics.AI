import React from 'react';
import { Link } from 'react-router-dom';
import { WaitlistSection } from '../components/WaitlistSection';
import { NewsletterForm } from '../components/NewsletterForm';
import {
  ShieldCheck, Lock, FileSearch, Eye, Layers, GitMerge,
  ArrowRight, CheckCircle2, Building2, Briefcase, Stethoscope, Scale,
  Gavel, AlertTriangle, Database, Workflow, X, Minus, ChevronDown, Clock, TrendingUp,
} from 'lucide-react';

export function Landing() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100 selection:bg-security-500/30 selection:text-titanium-50">
      <Header />
      <main>
        <Hero />
        <StatsBar />
        <TrustStrip />
        <WaitlistSection />
        <RegulatoryPressure />
        <ComparisonTable />
        <WhatWeDo />
        <Capabilities />
        <Pricing />
        <Audience />
        <FAQ />
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
          <Link to="/audit" className="hidden sm:inline px-3 py-1.5 text-sm text-emerald-300 hover:text-emerald-200 font-semibold">DSGVO-Audit</Link>
          <a href="#leistungen" className="hidden sm:inline px-3 py-1.5 text-sm text-titanium-300 hover:text-titanium-50">Leistungen</a>
          <a href="#preise" className="hidden sm:inline px-3 py-1.5 text-sm text-titanium-300 hover:text-titanium-50">Preise</a>
          <Link to="/agencies" className="hidden sm:inline px-3 py-1.5 text-sm text-titanium-300 hover:text-titanium-50">Agenturen</Link>
          <Link to="/dashboard" className="hidden sm:inline px-3 py-1.5 text-sm text-titanium-300 hover:text-titanium-50">Login</Link>
          <Link to="/contact-sales?source=apex_header" className="px-4 py-1.5 bg-security-500 hover:bg-security-600 text-white text-sm font-semibold rounded-none">
            Demo buchen
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
          <ShieldCheck className="h-3 w-3" /> DSGVO Art. 32 · AI Act · BAIT · MaRisk · Audit-by-default
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-titanium-50 tracking-tight leading-[1.05]">
          KI nutzen — ohne dabei <span className="text-security-400">DSGVO-Bußgeld</span> zu riskieren.
        </h1>
        <p className="text-lg text-titanium-300 max-w-2xl mx-auto leading-relaxed">
          Wir liefern die Compliance-Schicht für AI-Workflows in regulierten Branchen:
          EU-Datenresidenz, lückenloser Audit-Trail, automatisierte Auskunfts-/Löschanfragen.
          Damit du KI einsetzen kannst, <strong className="text-titanium-50">und der Datenschutzbeauftragte trotzdem unterschreibt</strong>.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link to="/contact-sales?source=apex_hero"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-security-500 hover:bg-security-600 text-white font-bold rounded-none shadow-[0_4px_0_rgba(0,0,0,0.3)]">
            Demo buchen <ArrowRight className="h-4 w-4" />
          </Link>
          <a href="#preise"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-obsidian-900 border border-titanium-700 hover:bg-obsidian-800 text-titanium-200 font-semibold rounded-none">
            Preise ansehen
          </a>
        </div>
        <div className="pt-6 text-xs text-titanium-500">
          Hosted in EU · DSGVO-konformes AVV inklusive · Sub-Prozessoren öffentlich gelistet
        </div>
      </div>
    </section>
  );
}

// ─── Stats Bar (Enterprise-Trust) ─────────────────────────────────────────

function StatsBar() {
  const stats = [
    { value: '29', unit: 'Heuristiken', sub: 'pro DSGVO-Audit-Run', icon: <FileSearch className="h-4 w-4" /> },
    { value: '14', unit: 'Tage', sub: 'Pilot-Trial kostenlos', icon: <Clock className="h-4 w-4" /> },
    { value: '4 %', unit: 'Jahresumsatz', sub: 'Bußgeld-Risiko ohne Compliance', icon: <AlertTriangle className="h-4 w-4" /> },
    { value: '< 30', unit: 'Sekunden', sub: 'pro Site-Audit ohne Account', icon: <TrendingUp className="h-4 w-4" /> },
  ];
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-10 bg-obsidian-950/40">
      <div className="max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((s) => (
          <div key={s.unit} className="flex items-start gap-3">
            <div className="shrink-0 w-9 h-9 rounded-none bg-emerald-950/40 border border-emerald-900 flex items-center justify-center text-emerald-400">
              {s.icon}
            </div>
            <div>
              <div className="font-display text-2xl sm:text-3xl font-bold text-titanium-50 tabular-nums leading-none">
                {s.value} <span className="text-sm font-normal text-titanium-400">{s.unit}</span>
              </div>
              <div className="text-xs text-titanium-500 mt-1.5">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Regulatory Pressure ───────────────────────────────────────────────────

function RegulatoryPressure() {
  const items = [
    {
      law: 'DSGVO Art. 32',
      title: 'Stand der Technik bei AI-Verarbeitung',
      consequence: 'Bei Datenpanne mit US-AI: bis 4% Jahresumsatz Bußgeld + Meldepflicht 72h',
    },
    {
      law: 'DSGVO Art. 28 (AVV)',
      title: 'AVV mit jedem AI-Anbieter Pflicht',
      consequence: 'OpenAI/Anthropic-AVVs decken Schrems-II-Risiko nicht — du bleibst haftbar',
    },
    {
      law: 'EU AI Act',
      title: 'Risk-Klassifikation + Transparenz-Pflicht ab 2026',
      consequence: 'High-Risk-AI ohne Audit-Log = 7% Jahresumsatz Bußgeld + Marktverbot',
    },
    {
      law: 'DSGVO Art. 15 + 17',
      title: 'Auskunft + Löschung in 30 Tagen',
      consequence: 'Manuelle Bearbeitung = Reklamation an Aufsicht + Imageschaden',
    },
  ];
  return (
    <section className="border-b border-titanium-900 bg-amber-950/5 px-4 sm:px-6 py-16">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-xs font-bold text-amber-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5" /> Das Risiko
        </h2>
        <h3 className="text-2xl sm:text-3xl font-display font-bold text-titanium-50 mb-8 max-w-3xl">
          Vier Gesetze, die jede deutsche Firma zu nachweisbarer KI-Compliance zwingen.
        </h3>
        <div className="grid md:grid-cols-2 gap-3">
          {items.map((it) => (
            <div key={it.law} className="p-5 bg-obsidian-900 border border-titanium-900 rounded-none">
              <div className="flex items-center gap-2 mb-2">
                <Gavel className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300">{it.law}</span>
              </div>
              <h4 className="font-display font-bold text-titanium-50 mb-1.5">{it.title}</h4>
              <p className="text-sm text-titanium-400 leading-relaxed">{it.consequence}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Trust Strip ──────────────────────────────────────────────────────────
// Renders nothing while the array is empty. Add { name, logoSrc?, role? }
// rows once first paying customers have agreed to be named publicly.

const trustedBy: { name: string; role?: string }[] = [];

function TrustStrip() {
  if (trustedBy.length === 0) return null;
  return (
    <section aria-label="Vertraut von" className="border-y border-titanium-900 bg-obsidian-950/50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center text-[11px] uppercase tracking-[0.2em] text-titanium-500 mb-5">
          Vertraut von
        </div>
        <div className="flex flex-wrap justify-center gap-x-10 gap-y-4 items-center">
          {trustedBy.map((c) => (
            <div key={c.name} className="text-titanium-300 font-display font-semibold text-sm">
              {c.name}{c.role && <span className="text-titanium-500 ml-2 text-xs">· {c.role}</span>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Comparison: Eigenbau vs RealSync ─────────────────────────────────────

function ComparisonTable() {
  const rows: { feature: string; diy: 'no' | 'partial' | 'yes' | string; rsd: 'yes' | string }[] = [
    { feature: 'EU-Datenresidenz erzwingbar pro Tenant', diy: 'partial', rsd: 'yes' },
    { feature: 'Audit-Log pro AI-Call (Provider, Token, Kosten)', diy: 'no', rsd: 'yes' },
    { feature: 'AVV-Generator gemäß DSGVO Art. 28 Abs. 3', diy: 'no', rsd: 'yes' },
    { feature: 'DSGVO-Selfservice (Art. 15 + 17) automatisiert', diy: 'no', rsd: 'yes' },
    { feature: 'Sub-Prozessor-Liste öffentlich + AVV-verlinkt', diy: 'no', rsd: 'yes' },
    { feature: 'AI-Provider-Routing (Anthropic + Google + Ollama EU)', diy: 'no', rsd: 'yes' },
    { feature: 'Multi-Tenant + SSO + Org-Governance (Gold/Enterprise)', diy: 'partial', rsd: 'yes' },
    { feature: 'Setup-Zeit', diy: '6 Monate Eigenbau', rsd: '14 Tage Pilot' },
    { feature: 'Wartungsaufwand', diy: '~1 FTE', rsd: 'inkl. SaaS-Plan' },
    { feature: 'BaFin-/Aufsichts-Sonderprüfung-ready', diy: 'no', rsd: 'yes' },
  ];
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3">Build vs Buy</h2>
        <h3 className="text-2xl sm:text-3xl font-display font-bold text-titanium-50 mb-2 max-w-3xl">
          Du kannst das selbst bauen. Aber willst du das wirklich?
        </h3>
        <p className="text-sm text-titanium-400 mb-8 max-w-2xl">
          Vergleich der typischen Eigenbau-Lösung gegen RealSyncDynamics.AI. Keine theoretischen Versprechen — nur Features, die wir heute liefern.
        </p>
        <div className="bg-obsidian-900 border border-titanium-900 rounded-none overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-obsidian-950 text-[11px] font-bold text-titanium-400 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">Feature</th>
                <th className="text-center px-4 py-3 w-32">Eigenbau</th>
                <th className="text-center px-4 py-3 w-32 text-emerald-300">RealSync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-titanium-900">
              {rows.map((r) => (
                <tr key={r.feature} className="hover:bg-obsidian-950">
                  <td className="px-4 py-3 text-titanium-200">{r.feature}</td>
                  <td className="px-4 py-3 text-center">{renderCell(r.diy)}</td>
                  <td className="px-4 py-3 text-center">{renderCell(r.rsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function renderCell(v: string): React.ReactNode {
  if (v === 'yes') return <CheckCircle2 className="h-4 w-4 text-emerald-400 inline" />;
  if (v === 'no') return <X className="h-4 w-4 text-red-400 inline" />;
  if (v === 'partial') return <Minus className="h-4 w-4 text-amber-400 inline" />;
  return <span className="text-xs text-titanium-300">{v}</span>;
}

// ─── What We Do ────────────────────────────────────────────────────────────

function WhatWeDo() {
  const steps = [
    {
      n: '01',
      icon: <Database />,
      title: 'EU-Datenresidenz für jeden AI-Aufruf',
      text: 'Pro User oder Tenant erzwingbar: cloud (Anthropic/Google/OpenAI mit AVV) oder eu_local (Ollama auf unserem EU-Server). Der gewählte Modus wird mit jedem Aufruf revisionssicher protokolliert.',
    },
    {
      n: '02',
      icon: <FileSearch />,
      title: 'Lückenloser Audit-Trail aus der Box',
      text: 'Welcher Mitarbeiter hat wann mit welchem Modell welche Daten verarbeitet, wieviele Token, welche Kosten — pro AI-Aufruf gespeichert, exportierbar als CSV/PDF für Auditor + Datenschutzbeauftragten.',
    },
    {
      n: '03',
      icon: <Workflow />,
      title: 'DSGVO-Selfservice für Endkunden',
      text: 'Auskunfts- (Art. 15) und Löschanfragen (Art. 17) als integrierte API + UI. Endkunde klickt im Self-Service, bekommt Datenexport binnen Sekunden, Löschung dokumentiert mit Audit-Log.',
    },
  ];
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3">Was wir machen</h2>
        <h3 className="text-2xl sm:text-3xl font-display font-bold text-titanium-50 mb-10 max-w-3xl">
          Eine Plattform, drei Schichten — DSGVO als Default, nicht als Add-on.
        </h3>
        <div className="grid md:grid-cols-3 gap-4">
          {steps.map((s) => (
            <div key={s.n} className="p-5 bg-obsidian-900 border border-titanium-900 rounded-none">
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-xs font-bold text-security-400">{s.n}</span>
                <div className="w-9 h-9 bg-security-900/30 border border-security-800 text-security-300 flex items-center justify-center [&>svg]:h-4 [&>svg]:w-4">
                  {s.icon}
                </div>
              </div>
              <h4 className="font-display font-bold text-titanium-50 mb-2 leading-snug">{s.title}</h4>
              <p className="text-sm text-titanium-400 leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Capabilities (Leistungen detailliert) ─────────────────────────────────

function Capabilities() {
  const groups = [
    {
      icon: <ShieldCheck />,
      title: 'Compliance & Audit',
      items: [
        'EU-Datenresidenz erzwingbar pro User & Tenant',
        'Audit-Log: Provider, Modell, Tokens, Kosten, Residenz pro Call',
        'CSV/PDF-Export für Datenschutzbeauftragte',
        'AVV / DPA inklusive (Sub-Prozessoren öffentlich)',
        'Auskunfts- + Lösch-API (DSGVO Art. 15 / 17)',
      ],
    },
    {
      icon: <GitMerge />,
      title: 'Workflow-Engine',
      items: [
        'Visuelle Pipelines (n8n-basiert)',
        'Trigger: AI, Stripe, eigene APIs, Webhooks',
        'Run-History mit Erfolgs-/Fehlerquote',
        'Per-Plan Quotas + Cost-Caps',
        'Audit-Log pro Run',
      ],
    },
    {
      icon: <Database />,
      title: 'Multi-Tenant & Sicherheit',
      items: [
        'Tenants + Memberships mit Row-Level-Security',
        'Magic-Link-Auth (kein Passwort-Risiko)',
        'Bring-Your-Own-Key (BYOK) für AI-Provider',
        'Stripe-Billing mit metered Usage',
        'IP-Hash-Anonymisierung bei Lead-Capture',
      ],
    },
  ];
  return (
    <section id="leistungen" className="border-b border-titanium-900 px-4 sm:px-6 py-16">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3">Leistungen im Detail</h2>
        <h3 className="text-2xl sm:text-3xl font-display font-bold text-titanium-50 mb-10 max-w-3xl">
          Was du in jedem Paket bekommst.
        </h3>
        <div className="grid md:grid-cols-3 gap-4">
          {groups.map((g) => (
            <div key={g.title} className="p-5 bg-obsidian-900 border border-titanium-900 rounded-none">
              <div className="w-9 h-9 mb-3 bg-emerald-900/30 border border-emerald-800 text-emerald-300 flex items-center justify-center [&>svg]:h-4 [&>svg]:w-4">
                {g.icon}
              </div>
              <h4 className="font-display font-bold text-titanium-50 mb-3">{g.title}</h4>
              <ul className="space-y-1.5">
                {g.items.map((it) => (
                  <li key={it} className="flex items-start gap-2 text-sm text-titanium-300 leading-snug">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ───────────────────────────────────────────────────────────────

function Pricing() {
  const tiers: Array<{
    name: string;
    price: string;
    period: string;
    tagline: string;
    features: string[];
    cta: string;
    href: string;
    highlight?: boolean;
  }> = [
    {
      name: 'Bronze',
      price: '29 €',
      period: '/ Monat',
      tagline: 'Solo-Operator · DSGVO-Basis',
      features: [
        'EU-Datenresidenz (eu_local Modus)',
        'Audit-Log + CSV-Export',
        '50 AI-Aufrufe / Monat',
        '100k AI-Token / Monat',
        'DSGVO-Selfservice (Art. 15 + 17)',
      ],
      cta: 'Bronze buchen',
      href: '/pricing?tier=bronze',
    },
    {
      name: 'Silver',
      price: '99 €',
      period: '/ Monat',
      tagline: 'Kleine Teams · Compliance-Standard',
      features: [
        'Alles aus Bronze',
        '+ Workflow-Engine (n8n)',
        '+ AVV / DPA-Generator',
        '+ AI: Code-Erklärung & Log-Analyse',
        '250 AI-Aufrufe / Monat',
        '10 Team-Seats',
      ],
      cta: 'Silver buchen',
      href: '/pricing?tier=silver',
      highlight: true,
    },
    {
      name: 'Gold',
      price: '299 €',
      period: '/ Monat',
      tagline: 'Mittelstand · Audit-tauglich',
      features: [
        'Alles aus Silver',
        '+ API-Zugriff + Bulk-Jobs',
        '+ Compliance-Reports (PDF, signiert)',
        '+ Bring-Your-Own-Key (BYOK)',
        '+ AI: Diagnose + Action-Advisor',
        '2.500 AI-Aufrufe / Monat',
      ],
      cta: 'Gold buchen',
      href: '/pricing?tier=gold',
    },
    {
      name: 'Enterprise',
      price: 'Auf Anfrage',
      period: '',
      tagline: 'Behörden & Konzerne · Public-Sector',
      features: [
        'Alles aus Gold',
        '+ SSO / SAML',
        '+ Org-Governance',
        '+ Public-Sector-Modus',
        '+ Eigene Sub-Prozessoren-Liste',
        'Unlimitierte AI-Aufrufe',
      ],
      cta: 'Vertrieb kontaktieren',
      href: '/contact-sales?source=apex_pricing_enterprise',
    },
  ];
  return (
    <section id="preise" className="border-b border-titanium-900 px-4 sm:px-6 py-16">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3">Preise</h2>
        <h3 className="text-2xl sm:text-3xl font-display font-bold text-titanium-50 mb-2 max-w-3xl">
          Transparent. Kein Setup-Fee. Monatlich kündbar.
        </h3>
        <p className="text-sm text-titanium-400 mb-10 max-w-2xl">
          Alle Pakete inkl. AVV, EU-Hosting, DSGVO-Selfservice. AI-Kontingent rollt nicht über. Upgrade jederzeit anteilig.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`flex flex-col p-5 rounded-none border ${
                t.highlight
                  ? 'border-security-500 bg-security-950/30 ring-1 ring-security-500/30 relative'
                  : 'border-titanium-900 bg-obsidian-900'
              }`}
            >
              {t.highlight && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-security-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
                  Beliebt
                </div>
              )}
              <div className="font-display text-xl font-bold text-titanium-50 mb-1">{t.name}</div>
              <div className="text-xs text-titanium-500 mb-4">{t.tagline}</div>
              <div className="mb-5">
                <span className="font-display text-3xl font-bold text-titanium-50 tabular-nums">{t.price}</span>
                {t.period && <span className="text-sm text-titanium-400 ml-1">{t.period}</span>}
              </div>
              <ul className="space-y-1.5 flex-1 mb-5">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-titanium-300 leading-snug">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                to={t.href}
                className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-bold rounded-none ${
                  t.highlight
                    ? 'bg-security-500 hover:bg-security-600 text-white'
                    : 'bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 hover:text-titanium-50'
                }`}
              >
                {t.cta}
              </Link>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-titanium-500 mt-6 text-center">
          Free-Tier (10 Assets, kein AI) verfügbar via <Link to="/pricing" className="text-security-400 hover:underline">/pricing</Link> · Alle Preise zzgl. USt.
        </p>
      </div>
    </section>
  );
}

// ─── Audience ──────────────────────────────────────────────────────────────

function Audience() {
  const segments = [
    { icon: <Stethoscope />, label: 'HealthTech',  desc: 'Patientendaten · klinische Entscheidungssysteme · §203 StGB' },
    { icon: <Scale />,        label: 'Legal',       desc: 'Mandantengeheimnis · §43e BRAO · beA-Integration' },
    { icon: <Building2 />,    label: 'FinTech',     desc: 'BaFin · MaRisk · DORA · IT-Compliance' },
    { icon: <Briefcase />,    label: 'Behörden',    desc: 'Cloud-Stop-Policies · BSI-IT-Grundschutz · OZG' },
  ];
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3">Zielgruppe</h2>
        <h3 className="text-2xl sm:text-3xl font-display font-bold text-titanium-50 mb-8 max-w-3xl">
          Für Teams, die bei Datensouveränität nicht verhandeln können.
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

// ─── FAQ ──────────────────────────────────────────────────────────────────

function FAQ() {
  const items = [
    {
      q: 'Wie schnell sind wir compliance-ready?',
      a: '14 Tage. Pilot-Tier kostenlos. Nach 7 Tagen Feedback-Call, danach Conversion oder Cancel.',
    },
    {
      q: 'Was passiert mit unseren Daten in den USA?',
      a: 'Standardmäßig nichts. EU-Datenresidenz ist Default — sensible Tenants laufen via Ollama in Frankfurt. Optional via Anthropic/OpenAI mit SCCs + DPF, transparent dokumentiert.',
    },
    {
      q: 'Brauchen wir einen eigenen Datenschutzbeauftragten?',
      a: 'Falls Du nach DSGVO Art. 37 / § 38 BDSG einen brauchst — ja, bleibt extern. Wir liefern Tools, die DSB-Arbeit ersetzen können (DSGVO-Selfservice, Audit-Log, AVV-Templates), nicht die DSB-Rolle.',
    },
    {
      q: 'Wie unterscheidet ihr euch von OneTrust / TrustArc / Usercentrics?',
      a: 'Die machen Cookie-Consent + Privacy-Banner. Wir machen KI-Compliance — kein Overlap. Beides läuft oft parallel.',
    },
    {
      q: 'Funktioniert das mit unserem bestehenden ChatGPT-Enterprise?',
      a: 'Ja. Audit-Log läuft cross-provider — auch wenn Du parallel Claude oder lokales Llama nutzt. Single-Source-of-Truth pro AI-Call: User, Modell, Tokens, Kosten, Datenresidenz.',
    },
    {
      q: 'Wie ist der AVV-Vertrag mit euch?',
      a: 'AVV gemäß DSGVO Art. 28 Abs. 3 inklusive in jedem Plan. EU-Hosting, Sub-Prozessor-Liste öffentlich, ladbar als PDF. Standard-TOM-Anhang. Audit-Rechte für Aufsichts-Sonderprüfungen.',
    },
    {
      q: 'Was passiert bei BaFin-Sonderprüfung?',
      a: 'Audit-Log ist revisionssicher exportierbar (CSV + signiertes PDF in Gold/Enterprise). Wir helfen aktiv beim Q&A-Prozess gegenüber Aufsicht.',
    },
    {
      q: 'Können wir eigene API-Keys nutzen (BYOK)?',
      a: 'Ab Gold-Plan: Bring-Your-Own-Key für Anthropic/OpenAI/Google. Sub-Prozessor wird dann zu „Nutzer-direkt", was AVV-Komplexität reduziert.',
    },
  ];
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3">FAQ</h2>
        <h3 className="text-2xl sm:text-3xl font-display font-bold text-titanium-50 mb-8">
          Die Fragen, die du wahrscheinlich gerade hast.
        </h3>
        <div className="space-y-3">
          {items.map((item, i) => (
            <details key={i} className="group bg-obsidian-900 border border-titanium-900 rounded-none">
              <summary className="cursor-pointer p-4 sm:p-5 list-none flex items-start gap-3 hover:bg-obsidian-950">
                <span className="font-display font-bold text-titanium-50 text-sm flex-1">{item.q}</span>
                <ChevronDown className="h-4 w-4 text-titanium-500 shrink-0 mt-0.5 transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-4 sm:px-5 pb-4 sm:pb-5 -mt-1">
                <p className="text-sm text-titanium-300 leading-relaxed">{item.a}</p>
              </div>
            </details>
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
        <div className="inline-flex items-center gap-2 px-3 py-1 border border-emerald-900 bg-emerald-950/30 text-emerald-300 text-xs font-bold uppercase tracking-wider rounded-none">
          <ShieldCheck className="h-3 w-3" /> 14 Tage Pilot · Kostenlos · Kein Lock-in
        </div>
        <h2 className="text-3xl sm:text-4xl font-display font-bold text-titanium-50 tracking-tight">
          Demo in 30 Min — du entscheidest danach.
        </h2>
        <p className="text-titanium-300 leading-relaxed">
          Live an deinen Daten: eu_local-Modus, Audit-Log, Beispiel-Workflow, DSGVO-Selfservice-API.
          Wenn der Pilot nicht passt, brichst Du in 7 Tagen ab — keine Karte vorab nötig.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/contact-sales?source=apex_cta"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-security-500 hover:bg-security-600 text-white font-bold rounded-none">
            Demo buchen <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/audit?source=apex_cta"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-obsidian-900 border border-emerald-700 hover:bg-emerald-950/30 text-emerald-300 font-semibold rounded-none">
            Kostenloser DSGVO-Scan (30 Sek)
          </Link>
        </div>
        <div className="pt-4 grid sm:grid-cols-3 gap-2 text-[11px] text-titanium-500 max-w-xl mx-auto">
          <div className="flex items-center gap-1.5 justify-center"><CheckCircle2 className="h-3 w-3 text-emerald-400" /> EU-Hosted (Frankfurt)</div>
          <div className="flex items-center gap-1.5 justify-center"><CheckCircle2 className="h-3 w-3 text-emerald-400" /> AVV inklusive</div>
          <div className="flex items-center gap-1.5 justify-center"><CheckCircle2 className="h-3 w-3 text-emerald-400" /> Made in Germany</div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-titanium-900 bg-obsidian-950 px-4 sm:px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-none bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center">
                <ShieldCheck className="h-4 w-4 text-white" />
              </div>
              <span className="font-display font-bold text-titanium-50">RealSyncDynamics.AI</span>
            </div>
            <p className="text-xs text-titanium-400 mb-5 max-w-sm leading-relaxed">
              DSGVO-konforme KI-Compliance-Plattform für regulierte Branchen — HealthTech, Legal, FinTech, Behörden.
              EU-Hosted, Audit-by-default, AVV inklusive.
            </p>
            <div className="text-[11px] text-titanium-500 uppercase tracking-wider mb-2 font-bold">Newsletter</div>
            <NewsletterForm source="footer" variant="footer" />
          </div>
          <div>
            <div className="text-[11px] text-titanium-500 uppercase tracking-wider mb-3 font-bold">Produkt</div>
            <ul className="space-y-1.5 text-xs text-titanium-300">
              <li><Link to="/audit" className="hover:text-emerald-300">DSGVO-Audit (kostenlos)</Link></li>
              <li><Link to="/pricing" className="hover:text-titanium-50">Preise</Link></li>
              <li><Link to="/agencies" className="hover:text-titanium-50">Für Agenturen</Link></li>
              <li><Link to="/contact-sales" className="hover:text-titanium-50">Demo buchen</Link></li>
              <li><Link to="/dashboard" className="hover:text-titanium-50">Login</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-[11px] text-titanium-500 uppercase tracking-wider mb-3 font-bold">Compliance & Legal</div>
            <ul className="space-y-1.5 text-xs text-titanium-300">
              <li><Link to="/dsgvo-ki-checkliste" className="hover:text-titanium-50">DSGVO-KI-Checkliste</Link></li>
              <li><Link to="/ai-act-faq" className="hover:text-titanium-50">EU AI Act FAQ</Link></li>
              <li><Link to="/schrems-ii-erklaert" className="hover:text-titanium-50">Schrems-II erklärt</Link></li>
              <li><Link to="/bait-marisk-compliance-guide" className="hover:text-titanium-50">BAIT &amp; MaRisk</Link></li>
              <li><Link to="/legal/compliance-matrix" className="hover:text-titanium-50">Compliance-Matrix</Link></li>
              <li><Link to="/legal/avv" className="hover:text-titanium-50">AVV-Template</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-titanium-900 pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-titanium-500">
          <div>© 2026 RealSync Dynamics · Made in Germany · EU-Hosted (Frankfurt)</div>
          <div className="flex flex-wrap gap-4">
            <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>
            <Link to="/legal/sub-processors" className="hover:text-titanium-300">Sub-Prozessoren</Link>
            <a href="mailto:privacy@realsyncdynamicsai.de" className="hover:text-titanium-300">privacy@realsyncdynamicsai.de</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
