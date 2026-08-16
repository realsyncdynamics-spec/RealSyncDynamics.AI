import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MouseEvent, ReactNode } from 'react';
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Code2,
  Gauge,
  Menu,
  PlayCircle,
  ScrollText,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import SpaceBackdrop from './SpaceBackdrop';
import Button from './Button';
import { handleAnchorClick } from './scroll';

const highlights = [
  { icon: ShieldCheck, title: 'DSGVO-konform', desc: 'Nachweise, Prozesse und Richtlinien automatisiert.' },
  { icon: ScrollText, title: 'AI-Act-ready', desc: 'Risikobewertung, Transparenz & Dokumentation.' },
  { icon: Activity, title: 'Kontinuierlich', desc: 'Monitoring, Alerts & Evidence in Echtzeit.' },
];

function Logo() {
  return (
    <a href="#produkt" onClick={(e) => handleAnchorClick(e, '#produkt')} className="flex items-center gap-2.5 rounded-md text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300">
      <svg viewBox="0 0 32 32" className="h-7 w-7 text-cyan-400" aria-hidden="true">
        <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M16 3v26M5.4 9.5l21.2 13M26.6 9.5L5.4 22.5" /></g>
        <circle cx="16" cy="16" r="3.4" fill="currentColor" />
      </svg>
      <span className="text-[17px] font-semibold tracking-tight">RealSync <span className="font-normal text-slate-300">Dynamics.AI</span></span>
    </a>
  );
}

function CardShell({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-xl border border-white/10 bg-[#071320]/80 p-3.5 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.9)] backdrop-blur-md ${className}`}>{children}</div>;
}

function CardLabel({ children, tone = 'cyan' }: { children: ReactNode; tone?: 'cyan' | 'emerald' }) {
  return <div className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] ${tone === 'emerald' ? 'text-emerald-300' : 'text-cyan-300'}`}><span className={`h-1.5 w-1.5 rounded-full ${tone === 'emerald' ? 'bg-emerald-400' : 'bg-cyan-400'}`} />{children}</div>;
}

type HeroSectionProps = { onStart?: () => void; backgroundImage?: string };
type NavItem = { label: string; href: string; fallback?: string };

export default function GovernanceHero({ onStart }: HeroSectionProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const start = () => (onStart ? onStart() : navigate('/unified-entry/scan'));
  const navItems: NavItem[] = [
    { label: 'Produkt', href: '#produkt' },
    { label: 'Automatisierung', href: '#automatisierung', fallback: '#intro' },
    { label: 'Evidence', href: '#evidence', fallback: '#intro' },
    { label: 'AI Act', href: '#ai-act', fallback: '#intro' },
    { label: 'Sicherheit', href: '#sicherheit', fallback: '#intro' },
    { label: 'Preise', href: '#preise', fallback: '#intro' },
  ];
  const routes = { login: '/welcome', claudeCodeOptimizer: '#intro' } as const;

  const handleNav = (event: MouseEvent<HTMLAnchorElement>, href: string, fallback = '#intro') => {
    const target = document.querySelector(href);
    if (target) { handleAnchorClick(event, href); return; }
    handleAnchorClick(event, fallback);
  };

  return (
    <section id="produkt" className="relative isolate min-h-[780px] overflow-hidden bg-[#02050a] text-white">
      <SpaceBackdrop />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(0,210,255,0.12),transparent_38%)]" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[#02050a] to-transparent" aria-hidden="true" />

      <header className="relative z-30 mx-auto flex max-w-7xl items-center justify-between px-5 py-6 lg:px-8">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-slate-300 lg:flex" aria-label="Hauptnavigation">
          {navItems.map((item) => <a key={item.label} href={item.href} onClick={(e) => handleNav(e, item.href, item.fallback)} className="transition hover:text-white">{item.label}</a>)}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          <a href={routes.login} className="rounded-lg px-4 py-2 text-sm text-slate-300 transition hover:text-white">Login</a>
          <Button onClick={start} variant="primary" size="md">Kostenlos starten <ArrowRight className="h-4 w-4" /></Button>
        </div>
        <button type="button" aria-label={menuOpen ? 'Menü schließen' : 'Menü öffnen'} aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)} className="rounded-lg border border-white/10 p-2 text-slate-200 lg:hidden">
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {menuOpen && <div className="relative z-30 mx-5 rounded-xl border border-white/10 bg-[#071320]/95 p-4 backdrop-blur-xl lg:hidden"><nav className="flex flex-col gap-1" aria-label="Mobile Navigation">
        {navItems.map((item) => <a key={item.label} href={item.href} onClick={(e) => { handleNav(e, item.href, item.fallback); setMenuOpen(false); }} className="rounded-lg px-3 py-2.5 text-sm text-slate-200 hover:bg-white/5">{item.label}</a>)}
        <a href={routes.login} className="rounded-lg px-3 py-2.5 text-sm text-slate-200 hover:bg-white/5">Login</a>
        <Button onClick={() => { setMenuOpen(false); start(); }} variant="primary" size="md" className="mt-2 w-full justify-center">Kostenlos starten <ArrowRight className="h-4 w-4" /></Button>
      </nav></div>}

      <div className="relative z-20 mx-auto max-w-7xl px-5 pb-24 pt-16 lg:px-8 lg:pt-20">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-2 text-xs font-medium tracking-wide text-cyan-200"><Sparkles className="h-3.5 w-3.5" />AI Governance Runtime</div>
          <h1 className="text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.04em] sm:text-6xl lg:text-7xl xl:text-[82px]">Das KI-Betriebssystem<br />für <span className="text-cyan-300">DSGVO, EU AI Act</span><br /><span className="text-cyan-300">&amp; Code-Compliance</span></h1>
          <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">Kontinuierliche Governance, Monitoring und beweisfähige Evidence für KI-Systeme, Daten und Code — in einer operativen Control Plane.</p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"><Button onClick={start} variant="primary" size="lg">Kostenlos starten <ArrowRight className="h-5 w-5" /></Button><a href="#intro" onClick={(e) => handleAnchorClick(e, '#intro')} className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/10"><PlayCircle className="h-4 w-4" />Plattform ansehen</a></div>
        </div>

        <div className="relative mx-auto mt-20 min-h-[300px] max-w-5xl">
          <CardShell className="absolute left-0 top-8 hidden w-56 sm:block"><CardLabel>GDPR</CardLabel><div className="mt-2 flex items-end justify-between"><span className="text-sm font-medium text-white">Compliant</span><BadgeCheck className="h-5 w-5 text-emerald-300" /></div></CardShell>
          <CardShell className="absolute right-0 top-0 hidden w-56 sm:block"><CardLabel>Risk Score</CardLabel><div className="mt-2 flex items-end justify-between"><span className="text-3xl font-semibold text-white">87</span><span className="pb-1 text-xs text-slate-400">/ 100</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[87%] rounded-full bg-cyan-400" /></div></CardShell>
          <CardShell className="absolute bottom-0 left-1/2 hidden w-64 -translate-x-1/2 sm:block"><CardLabel>Claude Code Audit</CardLabel><div className="mt-2 flex items-center justify-between"><div><span className="text-2xl font-semibold text-white">94.2%</span><div className="text-[11px] text-slate-400">Code-Ready</div></div><Code2 className="h-7 w-7 text-cyan-300" /></div></CardShell>
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-3 pt-8 sm:hidden">{highlights.map((item) => { const Icon = item.icon; return <div key={item.title} className="w-full rounded-xl border border-white/10 bg-[#071320]/80 p-4 text-left backdrop-blur-md"><div className="flex items-center gap-2 text-sm font-medium text-white"><Icon className="h-4 w-4 text-cyan-300" />{item.title}</div><p className="mt-1 text-xs leading-5 text-slate-400">{item.desc}</p></div>; })}</div>
        </div>

        <div className="mt-8 flex justify-center"><a href={routes.claudeCodeOptimizer} onClick={(e: MouseEvent<HTMLAnchorElement>) => handleAnchorClick(e, routes.claudeCodeOptimizer)} className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-slate-400 transition hover:border-cyan-400/30 hover:text-cyan-200"><Gauge className="h-3.5 w-3.5" />Governance Intelligence Layer<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></a></div>
      </div>
    </section>
  );
}
