import { useState, type MouseEvent, type ReactNode } from 'react';
import { Activity, ArrowRight, FileText, Menu, PlayCircle, ShieldCheck, SquareCheckBig, User, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from './Button';
import { handleAnchorClick } from './scroll';
import { HERO_HEADLINE } from './hero-content';

type HeroSectionProps = { onStart?: () => void };
type NavItem = { label: string; href: string; fallback?: string };

const navItems: NavItem[] = [
  { label: 'Produkt', href: '#produkt' },
  { label: 'Automatisierung', href: '#platform', fallback: '#intro' },
  { label: 'Evidence', href: '#evidence', fallback: '#intro' },
  { label: 'AI Act', href: '#evidence', fallback: '#intro' },
  { label: 'Sicherheit', href: '#evidence', fallback: '#intro' },
  { label: 'Preise', href: '#intro', fallback: '#intro' },
];

function Logo() {
  return (
    <a href="#produkt" onClick={(e) => handleAnchorClick(e, '#produkt')} className="group flex items-center gap-3 rounded-md text-white">
      <svg viewBox="0 0 40 40" className="h-9 w-9 text-cyan-300 drop-shadow-[0_0_14px_rgba(34,211,238,.65)]" aria-hidden="true">
        <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M20 2v36M2 20h36M7 7l26 26M33 7L7 33" />
        </g>
        <circle cx="20" cy="20" r="3.2" fill="currentColor" />
      </svg>
      <span className="text-[18px] font-semibold tracking-tight">RealSync <span className="font-normal text-slate-300">Dynamics.AI</span></span>
    </a>
  );
}

function GlassCard({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-xl border border-white/15 bg-[#071522]/90 p-4 shadow-[0_18px_45px_-20px_rgba(0,0,0,.95),0_0_28px_rgba(0,210,255,.10)] backdrop-blur-xl ${className}`}>{children}</div>;
}

function Signal({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[.11em] text-cyan-100"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_#22d3ee]" />{children}</span>;
}

function Stars() {
  const stars = Array.from({ length: 120 }, (_, i) => ({ left: `${(i * 37) % 100}%`, top: `${(i * 61) % 92}%`, size: i % 13 === 0 ? 2 : i % 3 === 0 ? 1.4 : 1, opacity: i % 7 === 0 ? 0.75 : 0.28 }));
  return <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">{stars.map((star, i) => <span key={i} className="absolute rounded-full bg-white" style={{ left: star.left, top: star.top, width: star.size, height: star.size, opacity: star.opacity }} />)}</div>;
}

function EarthPanel() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="absolute bottom-0 left-[24%] right-0 top-[10%] overflow-hidden rounded-tl-[18px] bg-[#02070d] shadow-[-20px_0_80px_rgba(0,0,0,.35)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_48%,rgba(22,170,231,.18),transparent_42%),linear-gradient(115deg,rgba(1,5,9,.94)_0%,rgba(2,10,18,.52)_42%,rgba(2,9,16,.06)_100%)]" />
        <img src="/europe-globe.webp" alt="" className="absolute -right-[13%] -top-[7%] h-[125%] w-[105%] object-contain drop-shadow-[0_0_90px_rgba(37,207,255,.32)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_74%_18%,rgba(255,255,255,.42),transparent_5%,transparent_17%),radial-gradient(circle_at_62%_53%,transparent_34%,rgba(0,0,0,.58)_78%)]" />
        <div className="absolute right-[3%] top-[4%] h-24 w-24 rounded-full bg-white/75 blur-[12px] shadow-[0_0_70px_28px_rgba(255,190,105,.30)]" />
      </div>
      <div className="absolute left-[24%] right-0 bottom-0 h-[28%] bg-gradient-to-t from-[#010409] via-[#010409]/60 to-transparent" />
    </div>
  );
}

function Connector({ className }: { className: string }) {
  return <span className={`pointer-events-none absolute z-30 hidden h-px origin-left bg-gradient-to-r from-cyan-300/75 to-transparent shadow-[0_0_10px_rgba(34,211,238,.5)] lg:block ${className}`} aria-hidden="true" />;
}

function UserNode({ className }: { className: string }) {
  return <span className={`pointer-events-none absolute z-40 hidden h-8 w-8 place-items-center rounded-full border border-cyan-200/45 bg-[#08202f]/85 text-cyan-100 shadow-[0_0_22px_rgba(34,211,238,.35)] backdrop-blur-sm lg:grid ${className}`}><User className="h-4 w-4" /></span>;
}

function GovernanceCard({ className, children }: { className: string; children: ReactNode }) {
  return <GlassCard className={`absolute z-50 ${className}`}>{children}</GlassCard>;
}

function AssistantBar() {
  return <div className="absolute bottom-7 left-[46%] z-[55] hidden w-[405px] -translate-x-1/2 items-center rounded-full border border-white/20 bg-[#071522]/90 px-4 py-2 text-sm shadow-[0_15px_35px_rgba(0,0,0,.55)] backdrop-blur-xl xl:flex">
    <span className="mr-3 grid h-7 w-7 place-items-center rounded-full border border-white/15 bg-black/30 text-cyan-200"><Activity className="h-4 w-4" /></span>
    <span className="font-medium text-white">Assistent</span><span className="mx-3 h-5 w-px bg-white/15" />
    <span className="flex-1 truncate text-white/55">Wie prüfe ich EU AI Act Einhaltung?</span><span className="mx-2 text-cyan-200">♩</span><ArrowRight className="h-4 w-4 text-white/70" />
  </div>;
}

export default function GovernanceHero({ onStart }: HeroSectionProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const start = () => (onStart ? onStart() : navigate('/unified-entry/scan'));
  const handleNav = (event: MouseEvent<HTMLAnchorElement>, item: NavItem) => {
    const target = document.querySelector(item.href) ? item.href : item.fallback ?? '#intro';
    handleAnchorClick(event, target); setMenuOpen(false);
  };

  return (
    <section id="produkt" className="relative isolate min-h-[768px] overflow-hidden bg-[#02070d] text-white lg:h-[100vh] lg:min-h-[720px]">
      <div className="absolute inset-0 bg-[linear-gradient(115deg,#02070d_0%,#03111b_48%,#061521_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_73%_48%,rgba(14,139,190,.17),transparent_38%),radial-gradient(ellipse_at_23%_72%,rgba(8,50,76,.22),transparent_38%)]" />
      <Stars /><EarthPanel />

      <header className="relative z-[80] mx-auto flex h-[78px] max-w-[1448px] items-center justify-between px-6 lg:px-[70px]">
        <Logo />
        <nav className="hidden items-center gap-7 text-[14px] text-slate-200 lg:flex" aria-label="Hauptnavigation">{navItems.map((item) => <a key={item.label} href={item.href} onClick={(e) => handleNav(e, item)} className="transition hover:text-white">{item.label}</a>)}</nav>
        <div className="hidden items-center gap-4 lg:flex"><a href="/welcome" className="px-3 py-2 text-[14px] text-slate-300 transition hover:text-white">Login</a><Button onClick={start} variant="primary" size="md">Kostenlos starten <ArrowRight className="h-4 w-4" /></Button></div>
        <button type="button" aria-label={menuOpen ? 'Menü schließen' : 'Menü öffnen'} aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)} className="rounded-xl border border-white/15 bg-black/20 p-2.5 lg:hidden">{menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
      </header>

      {menuOpen && <div className="relative z-[90] mx-5 rounded-2xl border border-white/10 bg-[#061321]/95 p-4 shadow-2xl backdrop-blur-xl lg:hidden"><nav className="flex flex-col gap-1">{navItems.map((item) => <a key={item.label} href={item.href} onClick={(e) => handleNav(e, item)} className="rounded-xl px-3 py-3 text-sm text-slate-200 hover:bg-white/5">{item.label}</a>)}<a href="/welcome" className="rounded-xl px-3 py-3 text-sm text-slate-200">Login</a><Button onClick={() => { setMenuOpen(false); start(); }} variant="primary" size="md" className="mt-2 w-full justify-center">Kostenlos starten <ArrowRight className="h-4 w-4" /></Button></nav></div>}

      <div className="relative z-50 mx-auto max-w-[1448px] px-6 pt-[92px] lg:px-[70px] lg:pt-[108px]">
        <div className="max-w-[585px]">
          <a href="#intro" onClick={(e) => handleAnchorClick(e, '#intro')} className="mb-8 inline-flex items-center gap-2 rounded-full border border-cyan-300/35 bg-[#0a2533]/75 px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-[.13em] text-cyan-100 shadow-[0_0_25px_rgba(34,211,238,.08)]"><span className="rounded-full bg-cyan-300 px-2 py-0.5 text-[9px] font-bold text-[#03202a]">NEU</span>CLAUDE CODE OPTIMIZER<ArrowRight className="h-3.5 w-3.5" /></a>
          <h1 className="max-w-[590px] text-balance text-[58px] font-bold leading-[.92] tracking-[-.045em] sm:text-[68px] lg:text-[78px] xl:text-[82px]">{HERO_HEADLINE.map((line, lineIndex) => <span key={lineIndex} className="block bg-gradient-to-b from-white via-white to-[#c7d1d9] bg-clip-text text-transparent drop-shadow-[0_5px_15px_rgba(0,0,0,.55)]">{line.map((segment) => segment.text).join('')}</span>)}</h1>
          <p className="mt-7 max-w-[560px] text-[20px] leading-[1.45] text-white/95 sm:text-[22px]">Das KI-Betriebssystem für <span className="font-semibold text-cyan-300">DSGVO, EU AI Act &amp; Code-Compliance.</span></p>
          <p className="mt-5 max-w-[565px] text-[15px] leading-[1.55] text-white/65 sm:text-[16px]">Kontinuierliche Governance, Monitoring und beweisfähige Evidence für KI-Systeme, Daten und Code – in einer operativen Control Plane.</p>
          <div className="mt-7 flex flex-wrap gap-3"><Button onClick={start} variant="primary" size="lg">Kostenlos starten <ArrowRight className="h-5 w-5" /></Button><a href="#intro" onClick={(e) => handleAnchorClick(e, '#intro')} className="inline-flex h-12 items-center gap-2 rounded-lg border border-cyan-200/60 bg-transparent px-5 text-sm font-medium text-white transition hover:bg-white/10"><PlayCircle className="h-4 w-4" />Plattform ansehen</a></div>
          <div className="mt-5 flex flex-wrap gap-2">{['GDPR', 'Risk Score', 'Claude Code Audit', 'EU AI Act'].map((item) => <span key={item} className="rounded-full border border-white/20 bg-[#071522]/60 px-4 py-1.5 text-[11px] text-white/80">{item}</span>)}</div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 z-40" aria-hidden="true">
        <Connector className="left-[55%] top-[31%] w-[125px] rotate-[18deg]" /><Connector className="left-[68%] top-[40%] w-[105px] rotate-[-7deg]" /><Connector className="left-[61%] top-[66%] w-[110px] rotate-[7deg]" />
        <UserNode className="left-[61%] top-[27%]" /><UserNode className="left-[80%] top-[32%]" /><UserNode className="left-[65%] top-[70%]" />

        <GovernanceCard className="left-[46.2%] top-[31.5%] w-[158px] p-3"><div className="flex items-center gap-3"><ShieldCheck className="h-7 w-7 text-cyan-300" /><div><div className="text-[14px] font-semibold">DSGVO</div><div className="mt-0.5 text-[11px] text-white/55">Compliant</div></div><span className="ml-auto grid h-5 w-5 place-items-center rounded-full bg-cyan-300/20 text-cyan-300">✓</span></div></GovernanceCard>
        <GovernanceCard className="left-[72%] top-[30.5%] w-[170px] p-3"><div className="flex items-center gap-3"><ShieldCheck className="h-7 w-7 text-cyan-300" /><div><div className="text-[13px] font-semibold">EU AI Act</div><div className="mt-0.5 text-[11px] text-white/55">Ready</div></div></div></GovernanceCard>
        <GovernanceCard className="left-[46.2%] top-[47.7%] w-[310px] p-4"><div className="flex gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-cyan-300/10 text-cyan-200"><FileText className="h-6 w-6" /></div><div className="min-w-0 flex-1"><Signal>Claude Code Audit</Signal><div className="mt-1 flex items-baseline gap-2"><span className="text-[31px] font-light">94.2%</span><span className="text-xs text-white/60">Code-Ready</span></div><div className="mt-2 grid grid-cols-[1fr_auto] gap-x-2 text-[11px] text-white/60"><span className="border-l-2 border-cyan-300 pl-2">2.1 Mio</span><span>Analysierte Codezeilen</span><span className="border-l-2 border-amber-300 pl-2">11,350</span><span>Sicherheitslücken behoben</span></div></div></div></GovernanceCard>
        <GovernanceCard className="left-[72%] top-[46%] w-[260px] p-4"><Signal>Risk Score</Signal><div className="mt-1 flex items-center gap-3"><div className="grid h-20 w-20 place-items-center rounded-full border-[5px] border-cyan-300/30 shadow-[inset_0_0_25px_rgba(34,211,238,.12),0_0_20px_rgba(34,211,238,.12)]"><span className="text-[17px]">Risk</span></div><div><div className="text-[31px] font-light">87<span className="text-[15px] text-white/45">/100</span></div><div className="mt-2 h-1 w-24 rounded-full bg-white/10"><div className="h-full w-[87%] rounded-full bg-cyan-300" /></div></div></div></GovernanceCard>
        <GovernanceCard className="left-[60.3%] top-[72.5%] w-[255px] p-3"><div className="flex items-center gap-3"><Activity className="h-10 w-10 text-cyan-300" /><div className="flex-1"><div className="h-10 overflow-hidden text-cyan-300"><svg viewBox="0 0 180 40" className="h-full w-full"><path d="M0 23h25l5-15 7 28 7-13h24l7-5 7 8 9-19 8 28 8-13h28l7-4 6 8 9-15 8 21 7-9h25" fill="none" stroke="currentColor" strokeWidth="2" /></svg></div></div><span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">● Live</span></div></GovernanceCard>
        <GovernanceCard className="left-[82.5%] top-[72%] w-[190px] p-3"><Signal>Evidence</Signal><div className="mt-2 flex items-end gap-2"><SquareCheckBig className="h-7 w-7 text-cyan-300" /><span className="text-[30px] font-light">1,248</span></div><div className="text-xs text-white/55">Nachweise</div><div className="mt-2 text-[9px] text-white/35">Letzte update: 17.06.2024 22:09</div></GovernanceCard>
      </div>

      <AssistantBar />
      <div className="absolute bottom-0 left-0 right-0 z-30 h-[80px] bg-gradient-to-t from-[#010409] to-transparent" />
    </section>
  );
}
