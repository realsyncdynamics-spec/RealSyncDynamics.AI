import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MouseEvent, ReactNode } from 'react';
import { Activity, ArrowRight, Code2, Gauge, Menu, PlayCircle, ScrollText, ShieldCheck, Sparkles, X } from 'lucide-react';
import Button from './Button';
import { handleAnchorClick } from './scroll';

const highlights = [
  { icon: ShieldCheck, title: 'DSGVO-konform', desc: 'Nachweise, Prozesse und Richtlinien automatisiert.' },
  { icon: ScrollText, title: 'AI-Act-ready', desc: 'Risikobewertung, Transparenz & Dokumentation.' },
  { icon: Activity, title: 'Kontinuierlich', desc: 'Monitoring, Alerts & Evidence in Echtzeit.' },
];

type HeroSectionProps = { onStart?: () => void };
type NavItem = { label: string; href: string; fallback?: string };

function Logo() {
  return (
    <a href="#produkt" onClick={(e) => handleAnchorClick(e, '#produkt')} className="flex items-center gap-2.5 rounded-md text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300">
      <svg viewBox="0 0 32 32" className="h-7 w-7 text-cyan-400" aria-hidden="true"><g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M16 3v26M5.4 9.5l21.2 13M26.6 9.5L5.4 22.5" /></g><circle cx="16" cy="16" r="3.4" fill="currentColor" /></svg>
      <span className="text-[17px] font-semibold tracking-tight">RealSync <span className="font-normal text-slate-300">Dynamics.AI</span></span>
    </a>
  );
}

function CardShell({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-2xl border border-cyan-300/15 bg-[#071321]/80 p-3.5 shadow-[0_18px_55px_-18px_rgba(0,0,0,0.95),0_0_35px_rgba(34,211,238,0.08)] backdrop-blur-xl ${className}`}>{children}</div>;
}

function CardLabel({ children, tone = 'cyan' }: { children: ReactNode; tone?: 'cyan' | 'emerald' }) {
  return <div className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] ${tone === 'emerald' ? 'text-emerald-300' : 'text-cyan-200'}`}><span className={`h-1.5 w-1.5 rounded-full shadow-[0_0_10px_currentColor] ${tone === 'emerald' ? 'bg-emerald-400 text-emerald-400' : 'bg-cyan-400 text-cyan-400'}`} />{children}</div>;
}

function FrankfurtSkyline() {
  return (
    <svg viewBox="0 0 1200 250" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-[185px] w-full" aria-hidden="true">
      <defs>
        <linearGradient id="cityFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#10243a" stopOpacity="0.15" /><stop offset="1" stopColor="#02050a" stopOpacity="0.98" /></linearGradient>
        <linearGradient id="cityLight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7de9ff" stopOpacity="0.95" /><stop offset="1" stopColor="#7de9ff" stopOpacity="0.08" /></linearGradient>
      </defs>
      <rect width="1200" height="250" fill="url(#cityFade)" />
      <g fill="#071321" stroke="#2dd4bf" strokeOpacity="0.12">
        <rect x="0" y="145" width="95" height="105" /><rect x="78" y="118" width="62" height="132" /><rect x="128" y="135" width="88" height="115" />
        <rect x="205" y="98" width="70" height="152" /><rect x="266" y="128" width="78" height="122" /><rect x="335" y="84" width="56" height="166" />
        <rect x="385" y="125" width="92" height="125" /><rect x="468" y="104" width="65" height="146" /><rect x="525" y="55" width="70" height="195" />
        <rect x="592" y="115" width="84" height="135" /><rect x="666" y="78" width="54" height="172" /><rect x="715" y="122" width="88" height="128" />
        <rect x="795" y="92" width="76" height="158" /><rect x="861" y="132" width="94" height="118" /><rect x="942" y="105" width="62" height="145" />
        <rect x="994" y="135" width="82" height="115" /><rect x="1060" y="98" width="74" height="152" /><rect x="1122" y="125" width="78" height="125" />
      </g>
      <g fill="url(#cityLight)">
        {Array.from({ length: 72 }, (_, i) => <rect key={i} x={(i * 47) % 1180 + 8} y={132 + ((i * 23) % 78)} width="2" height="7" rx="1" />)}
      </g>
      <path d="M0 205 C210 183 355 224 540 203 S900 185 1200 211 V250 H0Z" fill="#02050a" opacity="0.78" />
      <path d="M0 215 C220 197 400 232 610 212 S930 195 1200 218" fill="none" stroke="#7de9ff" strokeOpacity="0.12" strokeWidth="2" />
      <g fill="#b7f7ff" opacity="0.8"><circle cx="552" cy="56" r="3" /><circle cx="694" cy="79" r="2.5" /><circle cx="832" cy="93" r="2" /></g>
    </svg>
  );
}

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
    <section id="produkt" className="relative isolate min-h-[820px] overflow-hidden bg-[#02050a] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_68%_24%,rgba(22,180,255,0.16),transparent_30%),radial-gradient(circle_at_82%_74%,rgba(255,177,72,0.10),transparent_26%),linear-gradient(180deg,#02050a_0%,#04111f_58%,#02050a_100%)]" aria-hidden="true" />
      <div className="absolute right-[-10%] top-[8%] h-[560px] w-[560px] rounded-full bg-cyan-400/10 blur-[120px]" aria-hidden="true" />
      <div className="absolute right-[11%] top-[13%] h-24 w-24 rounded-full bg-amber-100/90 blur-[8px] shadow-[0_0_90px_38px_rgba(255,195,115,0.26)]" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 h-80 bg-gradient-to-t from-[#02050a] via-[#02050a]/40 to-transparent" aria-hidden="true" />

      <header className="relative z-50 mx-auto flex max-w-7xl items-center justify-between px-5 py-6 lg:px-8">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-slate-300 lg:flex" aria-label="Hauptnavigation">
          {navItems.map((item) => <a key={item.label} href={item.href} onClick={(e) => handleNav(e, item.href, item.fallback)} className="transition hover:text-white">{item.label}</a>)}
        </nav>
        <div className="hidden items-center gap-3 lg:flex"><a href={routes.login} className="rounded-lg px-4 py-2 text-sm text-slate-300 transition hover:text-white">Login</a><Button onClick={start} variant="primary" size="md">Kostenlos starten <ArrowRight className="h-4 w-4" /></Button></div>
        <button type="button" aria-label={menuOpen ? 'Menü schließen' : 'Menü öffnen'} aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)} className="rounded-lg border border-white/10 p-2 text-slate-200 lg:hidden">{menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
      </header>

      {menuOpen && <div className="relative z-50 mx-5 rounded-xl border border-white/10 bg-[#071320]/95 p-4 backdrop-blur-xl lg:hidden"><nav className="flex flex-col gap-1" aria-label="Mobile Navigation">{navItems.map((item) => <a key={item.label} href={item.href} onClick={(e) => { handleNav(e, item.href, item.fallback); setMenuOpen(false); }} className="rounded-lg px-3 py-2.5 text-sm text-slate-200 hover:bg-white/5">{item.label}</a>)}<a href={routes.login} className="rounded-lg px-3 py-2.5 text-sm text-slate-200 hover:bg-white/5">Login</a><Button onClick={() => { setMenuOpen(false); start(); }} variant="primary" size="md" className="mt-2 w-full justify-center">Kostenlos starten <ArrowRight className="h-4 w-4" /></Button></nav></div>}

      <div className="relative z-20 mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-5 pb-28 pt-8 lg:grid-cols-[44%_56%] lg:px-8 lg:pt-4">
        <div className="relative z-40 max-w-2xl lg:pt-8">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/8 px-4 py-2 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,0.10)]"><Sparkles className="h-3.5 w-3.5" />NEU&nbsp;&nbsp; CLAUDE CODE OPTIMIZER <ArrowRight className="h-3.5 w-3.5" /></div>
          <h1 className="text-balance text-6xl font-black leading-[0.88] tracking-[-0.055em] sm:text-7xl lg:text-[76px] xl:text-[88px]" style={{ textShadow: '0 2px 0 #9fb9d2, 0 4px 0 #55718b, 0 7px 0 #213b55, 0 12px 28px rgba(0,0,0,.78), 0 0 38px rgba(92,212,255,.30)' }}>
            <span className="block bg-gradient-to-b from-white via-[#d9efff] to-[#7b9bb7] bg-clip-text text-transparent">AI Governance</span>
            <span className="block bg-gradient-to-b from-white via-[#cfe8ff] to-[#6f8da8] bg-clip-text text-transparent">Runtime</span>
          </h1>
          <p className="mt-7 max-w-xl text-xl leading-8 text-slate-200 sm:text-2xl">Das KI-Betriebssystem für <span className="font-semibold text-cyan-300">DSGVO, EU AI Act &amp; Code-Compliance.</span></p>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">Kontinuierliche Governance, Monitoring und beweisfähige Evidence für KI-Systeme, Daten und Code – in einer operativen Control Plane.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3"><Button onClick={start} variant="primary" size="lg">Kostenlos starten <ArrowRight className="h-5 w-5" /></Button><a href="#intro" onClick={(e) => handleAnchorClick(e, '#intro')} className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/20 bg-white/[0.04] px-5 text-sm font-medium text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] transition hover:bg-white/10"><PlayCircle className="h-4 w-4" />Plattform ansehen</a></div>
          <div className="mt-6 flex flex-wrap gap-2">{['GDPR','Risk Score','Claude Code Audit','EU AI Act'].map((item) => <span key={item} className="rounded-full border border-cyan-300/30 bg-[#071321]/70 px-4 py-2 text-xs font-medium text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,.06)]">{item}</span>)}</div>
        </div>

        <div className="relative min-h-[650px] lg:min-h-[700px]" aria-label="Europa Satellitenansicht und Governance telemetry">
          <div className="absolute right-[-14%] top-[0%] h-[650px] w-[820px] max-w-none overflow-visible">
            <div className="absolute inset-[7%] rounded-full bg-cyan-300/10 blur-3xl" />
            <img src="/europe-globe.webp" alt="Europa bei Nacht aus Satellitenperspektive" className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_0_90px_rgba(59,208,255,.32)]" />
            <div className="absolute right-[11%] top-[13%] h-20 w-20 rounded-full bg-white/80 blur-[7px] shadow-[0_0_80px_30px_rgba(255,195,115,.24)]" />
            <div className="absolute right-[17%] top-[16%] h-12 w-48 rounded-full bg-amber-100/40 blur-2xl" />
            <div className="absolute inset-x-[12%] bottom-[5%] h-32 bg-gradient-to-t from-[#02050a]/95 via-[#02050a]/50 to-transparent" />
          </div>

          <FrankfurtSkyline />

          <CardShell className="absolute left-[4%] top-[8%] z-20 w-44"><CardLabel>DSGVO</CardLabel><div className="mt-2 text-sm font-medium text-slate-100">Compliant</div></CardShell>
          <CardShell className="absolute right-[4%] top-[26%] z-20 w-44"><CardLabel>Risk Score</CardLabel><div className="mt-1 flex items-end gap-1"><span className="text-3xl font-semibold">87</span><span className="pb-1 text-xs text-slate-400">/100</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[87%] rounded-full bg-gradient-to-r from-cyan-400 to-cyan-200 shadow-[0_0_12px_rgba(34,211,238,.7)]" /></div></CardShell>
          <CardShell className="absolute right-[15%] bottom-[22%] z-20 w-64"><CardLabel>Claude Code Audit</CardLabel><div className="mt-1 flex items-center justify-between"><div><span className="text-3xl font-semibold">94.2%</span><div className="text-xs text-slate-400">Code-Ready</div></div><Code2 className="h-7 w-7 text-cyan-300" /></div><div className="mt-2 text-[10px] text-slate-500">Analysierte Codezeilen: 2.1 Mio</div><div className="text-[10px] text-slate-500">Sicherheitslücken behoben: 11.350</div></CardShell>
          <CardShell className="absolute left-[8%] bottom-[18%] z-20 w-48"><CardLabel>Evidence</CardLabel><div className="mt-1 text-3xl font-semibold">1,248</div><div className="text-xs text-slate-400">Nachweise</div></CardShell>
          <CardShell className="absolute left-[34%] bottom-[7%] z-20 w-48"><CardLabel>Monitoring</CardLabel><div className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-100">Live <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.9)]" /></div></CardShell>
          <CardShell className="absolute right-[0%] bottom-[18%] z-20 w-40"><CardLabel tone="emerald">EU AI Act</CardLabel><div className="mt-1 text-sm font-semibold text-emerald-300">READY</div></CardShell>
          <div className="absolute left-[46%] top-[48%] z-10 hidden font-mono text-[8px] leading-4 text-cyan-300/70 lg:block">GOVERNANCE_RUNTIME v2.0.1<br />policy_enforced: true<br />evidence: signed<br />monitoring: active</div>
        </div>

        <div className="relative z-40 flex flex-col gap-3 lg:hidden"><div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#071321]/70 p-2"><img src="/europe-globe.webp" alt="Europa bei Nacht aus Satellitenperspektive" className="w-full object-contain" /></div><div className="grid grid-cols-2 gap-3">{['DSGVO Compliant','Risk Score 87/100','Claude Code Audit 94.2%','EU AI Act READY'].map((item) => <CardShell key={item}><span className="text-sm font-medium text-slate-100">{item}</span></CardShell>)}</div></div>
      </div>

      <div className="relative z-40 mx-auto flex max-w-7xl justify-center px-5 pb-7 lg:px-8"><a href={routes.claudeCodeOptimizer} onClick={(e: MouseEvent<HTMLAnchorElement>) => handleAnchorClick(e, routes.claudeCodeOptimizer)} className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-slate-400 transition hover:border-cyan-400/30 hover:text-cyan-200"><Gauge className="h-3.5 w-3.5" />Governance Intelligence Layer<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></a></div>
    </section>
  );
}
