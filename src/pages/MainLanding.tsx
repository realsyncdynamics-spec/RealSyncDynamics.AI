import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { useHealthStatus } from '../hooks/useHealthStatus';
import { planById, formatLimit, policyPacksFor, checkoutHrefForPlan, type PlanId } from '@/shared/pricing';
import {
  Snowflake, ArrowUp, Plus, Sparkles, Globe2, MessageCircle, Phone, Scan,
  ShieldCheck, FileLock2, Radar, Scale, Code2, ArrowRight, Check, Lock,
  PlayCircle, LineChart, Building2,
} from 'lucide-react';

const BG = 'rgb(3, 7, 18)';
const FONT_STACK = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";

const NAV_LINKS = [
  { label: 'Produkt', to: '#product' },
  { label: 'Funktionen', to: '/features' },
  { label: 'Automatisierung', to: '/automations' },
  { label: 'Evidence', to: '/evidence' },
  { label: 'AI Act', to: '/ai-act' },
  { label: 'Preise', to: '#pricing' },
];

const COMMANDS = [
  { label: 'Website prüfen', icon: Scan, prompt: 'Prüfe meine Website auf DSGVO, EU AI Act und technische Risiken.', to: '/scan/start' },
  { label: 'Website bauen', icon: Globe2, prompt: 'Erstelle eine professionelle Website für mein Unternehmen.', to: '/handwerk-website' },
  { label: 'Chatbot erstellen', icon: MessageCircle, prompt: 'Erstelle einen KI-Chatbot für meine Website.', to: '/chatbot/start' },
  { label: 'Telefonbot erstellen', icon: Phone, prompt: 'Erstelle einen KI-Telefon-Assistenten.', to: '/phonebot/start' },
];

const TRUST = ['DSGVO Art. 32', 'EU AI Act', 'EU-Hosting', 'Evidence-backed'];
const PLAN_IDS: PlanId[] = ['starter', 'growth', 'agency', 'enterprise', 'partner'];

const PRICING = PLAN_IDS.map((id) => {
  const plan = planById(id);
  return {
    name: plan.name,
    price: new Intl.NumberFormat('de-DE').format(plan.price.monthlyEur),
    features: [
      `${formatLimit(plan.limits.domains)} Domains`,
      `${formatLimit(plan.limits.bots)} Bots · ${formatLimit(plan.limits.answersPerMonth)} Antworten`,
      `${formatLimit(plan.limits.automationRunsPerMonth)} Automation-Runs`,
      `${policyPacksFor(plan).length} Policy Packs`,
    ],
    cta: plan.purchaseMode === 'inquiry' ? `${plan.name} anfragen` : '14 Tage testen',
    featured: plan.highlight,
    to: checkoutHrefForPlan(plan, { source: 'home' }),
  };
});

export function MainLanding() {
  return (
    <div className="landing-context min-h-screen bg-[rgb(3,7,18)] text-white antialiased" style={{ backgroundColor: BG, fontFamily: FONT_STACK }}>
      <SEOHead />
      <Header />
      <Hero />
      <TrustStrip />
      <Platform />
      <Pricing />
      <FinalCta />
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-20 sm:px-6 lg:px-10">
        <Link to="/" className="flex items-center gap-2.5">
          <Snowflake className="h-5 w-5 text-cyan-400 sm:h-6 sm:w-6" strokeWidth={1.5} />
          <span className="text-sm font-semibold tracking-tight sm:text-lg">RealSync <span className="font-normal text-white/90">Dynamics.AI</span></span>
        </Link>
        <nav className="hidden items-center gap-6 lg:flex">
          {NAV_LINKS.map((item) => <SmartLink key={item.label} to={item.to} className="text-sm text-white/65 transition-colors hover:text-white">{item.label}</SmartLink>)}
          <SmartLink to="/welcome" className="text-sm text-white/65 transition-colors hover:text-white">Login</SmartLink>
        </nav>
        <SmartLink to="/flow/start-scan" className="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-4 py-2.5 text-xs font-semibold text-[rgb(3,7,18)] transition-colors hover:bg-cyan-300 sm:text-sm">
          Starten <ArrowRight className="h-4 w-4" />
        </SmartLink>
      </div>
    </header>
  );
}

function Hero() {
  const { label: monitoringLabel, pulse } = useHealthStatus();
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState('Auto');

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = prompt.trim().toLowerCase();
    if (!text) return;
    if (text.includes('website') && (text.includes('prüf') || text.includes('scan') || text.includes('audit'))) window.location.href = '/scan/start';
    else if (text.includes('telefon')) window.location.href = '/phonebot/start';
    else if (text.includes('chatbot') || text.includes('chat')) window.location.href = '/chatbot/start';
    else if (text.includes('website') || text.includes('seite') || text.includes('bauen')) window.location.href = '/handwerk-website';
    else window.location.href = '/features';
  }

  return (
    <section className="relative min-h-screen overflow-hidden pt-24">
      <div className="absolute inset-0 z-0">
        <picture>
          <source srcSet="/europe-globe.webp" type="image/webp" />
          <img src="/europe-globe.jpg" alt="Europa-zentrierter Globus bei Nacht" width={1376} height={768} fetchPriority="high" className="h-full w-full object-cover object-right opacity-65" />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-r from-[rgb(3,7,18)] via-[rgb(3,7,18)]/95 to-[rgb(3,7,18)]/55" />
        <div className="absolute inset-0 bg-gradient-to-t from-[rgb(3,7,18)] via-transparent to-[rgb(3,7,18)]/30" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-6rem)] max-w-5xl flex-col items-center justify-center px-4 pb-16 text-center sm:px-6">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/5 px-3 py-1.5 font-mono text-[10px] tracking-[0.18em] text-cyan-300">
          <Sparkles className="h-3.5 w-3.5" /> AI GOVERNANCE RUNTIME
        </div>
        <h1 className="max-w-4xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
          Was möchtest du <span className="text-cyan-400">erstellen, prüfen</span><br className="hidden sm:block" /> oder automatisieren?
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-white/60 sm:text-base">
          Ein zentraler AI-Einstieg für Website, Chat, Telefon und Compliance — mit deinem RealSyncDynamicsAI-Governance-Layer im Hintergrund.
        </p>

        <form onSubmit={submit} className="mt-8 w-full max-w-3xl">
          <div className="rounded-2xl border border-white/15 bg-[rgb(7,12,26)]/90 p-2 shadow-2xl backdrop-blur-xl focus-within:border-cyan-400/50">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="Beschreibe dein Vorhaben …"
              className="w-full resize-none bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 sm:text-base"
              aria-label="AI-Aufgabe beschreiben"
            />
            <div className="flex items-center justify-between gap-2 border-t border-white/10 px-2 pt-2">
              <div className="flex items-center gap-1">
                <button type="button" title="Werkzeuge" aria-label="Werkzeuge" className="rounded-lg p-2 text-white/55 transition hover:bg-white/5 hover:text-white"><Plus className="h-4 w-4" /></button>
                <button type="button" onClick={() => setMode(mode === 'Auto' ? 'Governance' : 'Auto')} className="rounded-lg border border-white/10 px-2.5 py-1.5 font-mono text-[10px] text-white/55 transition hover:border-cyan-400/40 hover:text-cyan-300">{mode} ▾</button>
              </div>
              <button type="submit" disabled={!prompt.trim()} title="Aufgabe starten" aria-label="Aufgabe starten" className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-cyan-400 text-[rgb(3,7,18)] transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-30">
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
          </div>
        </form>

        <div className="mt-5 grid w-full max-w-3xl grid-cols-2 gap-2 sm:grid-cols-4">
          {COMMANDS.map(({ label, icon: Icon, prompt: commandPrompt, to }) => (
            <button key={label} type="button" onClick={() => { setPrompt(commandPrompt); window.location.href = to; }} className="group rounded-xl border border-white/10 bg-white/[0.025] px-3 py-3 text-left transition hover:border-cyan-400/35 hover:bg-cyan-500/[0.05]">
              <Icon className="mb-2 h-4 w-4 text-cyan-400" strokeWidth={1.75} />
              <span className="block text-[11px] font-medium text-white/75 group-hover:text-white">{label}</span>
            </button>
          ))}
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3 font-mono text-[9px] tracking-wider text-white/35">
          <span className={pulse ? 'text-cyan-400' : ''}>● {monitoringLabel}</span>
          <span>•</span><span>EU-HOSTING</span><span>•</span><span>EVIDENCE-BACKED</span><span>•</span><span>DSGVO / AI ACT</span>
        </div>
      </div>
    </section>
  );
}

function TrustStrip() {
  return <section className="border-y border-white/10 bg-white/[0.02]"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-6 py-5 font-mono text-[10px] tracking-wider text-white/45">{TRUST.map((item) => <span key={item}>{item}</span>)}</div></section>;
}

function Platform() {
  const cards = [
    { icon: ShieldCheck, title: 'Discover', text: 'Websites, KI-Systeme, Vendoren und Datenflüsse erkennen.' },
    { icon: Scale, title: 'Classify & Enforce', text: 'Risiken bewerten und Policies zur Laufzeit durchsetzen.' },
    { icon: FileLock2, title: 'Prove', text: 'Kryptografische Evidence für Audits und Nachweisführung.' },
    { icon: Radar, title: 'Runtime Monitoring', text: 'Kontinuierliche Überwachung statt statischer Compliance-PDFs.' },
    { icon: Code2, title: 'AI Development', text: 'Code-Analyse und Governance direkt im Entwicklungsprozess.' },
    { icon: Lock, title: 'EU Sovereignty', text: 'EU-Hosting, Isolation und serverseitige Secrets by design.' },
  ];
  return (
    <section id="product" className="relative z-10 mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-24">
      <div className="mb-10 max-w-2xl"><p className="mb-3 font-mono text-[10px] tracking-[0.25em] text-cyan-400">ONE AI ENTRY POINT</p><h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Ein Interface. Alle Governance-Workflows.</h2><p className="mt-4 text-sm leading-relaxed text-white/55 sm:text-base">Die vielen Einzelbuttons werden zu einem klaren AI-Workflow. Kontextbezogene Aktionen bleiben verfügbar, aber nur dort, wo sie wirklich einen nächsten Schritt auslösen.</p></div>
      <div className="grid overflow-hidden rounded-2xl border border-white/10 bg-white/5 md:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ icon: Icon, title, text }) => <div key={title} className="border-b border-white/10 bg-[rgb(3,7,18)] p-6 transition hover:bg-white/[0.03] lg:p-8"><Icon className="mb-5 h-5 w-5 text-cyan-400" strokeWidth={1.75} /><h3 className="mb-2 text-lg font-semibold">{title}</h3><p className="text-sm leading-relaxed text-white/55">{text}</p></div>)}
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="relative z-10 mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-24">
      <div className="mb-10 max-w-2xl"><p className="mb-3 font-mono text-[10px] tracking-[0.25em] text-cyan-400">PREISE</p><h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Ein Einstieg, der mitwächst.</h2></div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {PRICING.map((p) => <div key={p.name} className={`flex flex-col rounded-2xl border p-6 ${p.featured ? 'border-cyan-400/60 bg-cyan-500/[0.06]' : 'border-white/10 bg-white/[0.02]'}`}>
          <p className="text-lg font-semibold">{p.name}</p><div className="mb-5 mt-2"><span className="font-mono text-3xl font-bold">{p.price} €</span><span className="font-mono text-xs text-white/35"> /Monat</span></div>
          <ul className="mb-6 flex-1 space-y-2.5">{p.features.map((f) => <li key={f} className="flex gap-2 text-xs text-white/65"><Check className="h-4 w-4 shrink-0 text-cyan-400" />{f}</li>)}</ul>
          <SmartLink to={p.to} className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold ${p.featured ? 'bg-cyan-400 text-[rgb(3,7,18)] hover:bg-cyan-300' : 'border border-white/15 text-white hover:bg-white/5'}`}>{p.cta}<ArrowRight className="h-4 w-4" /></SmartLink>
        </div>)}
      </div>
    </section>
  );
}

function FinalCta() {
  return <section className="relative z-10 px-6 py-16 lg:py-24"><div className="mx-auto max-w-4xl rounded-3xl border border-cyan-500/20 bg-cyan-500/[0.05] p-8 text-center sm:p-12"><Sparkles className="mx-auto mb-5 h-6 w-6 text-cyan-400" /><h2 className="text-3xl font-extrabold sm:text-5xl">Nicht mehr suchen. Einfach beschreiben.</h2><p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/60">Der neue zentrale AI-Einstieg macht aus RealSyncDynamicsAI eine Arbeitsoberfläche statt einer Sammlung von Buttons.</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><SmartLink to="/flow/start-scan" className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-400 px-6 py-3 text-sm font-semibold text-[rgb(3,7,18)] hover:bg-cyan-300">Audit starten <ArrowRight className="h-4 w-4" /></SmartLink><SmartLink to="/demo-tour" className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 px-6 py-3 text-sm font-semibold hover:bg-white/5"><PlayCircle className="h-4 w-4" /> Demo ansehen</SmartLink></div></div></section>;
}

function Footer() {
  return <footer className="border-t border-white/10"><div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-8 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between lg:px-10"><Link to="/" className="font-semibold text-white/70">RealSync Dynamics.AI</Link><div className="flex flex-wrap gap-4"><SmartLink to="/impressum">Impressum</SmartLink><SmartLink to="/datenschutz">Datenschutz</SmartLink><SmartLink to="/agb">AGB</SmartLink><SmartLink to="/contact-sales">Kontakt</SmartLink></div><span>EU-Hosting · DSGVO · EU AI Act</span></div></footer>;
}

function SmartLink({ to, className, children }: { to: string; className?: string; children: React.ReactNode }) {
  const classes = className ?? 'text-white/50 transition-colors hover:text-white';
  return to.startsWith('/') ? <Link to={to} className={classes}>{children}</Link> : <a href={to} className={classes}>{children}</a>;
}
