import { ArrowRight, BadgeCheck, Menu, PlayCircle, ShieldCheck, ScrollText, Activity, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GlobeVisual from './GlobeVisual';

const highlights = [
  ['DSGVO-konform','Nachweise, Prozesse und Richtlinien automatisiert.', ShieldCheck],
  ['AI-Act-ready','Risikobewertung, Transparenz & Dokumentation.', ScrollText],
  ['Kontinuierlich','Monitoring, Alerts & Evidence in Echtzeit.', Activity],
] as const;

// Jeder Navigationspunkt zeigt auf ein Ziel, das es wirklich gibt (CLAUDE.md §14:
// keine Elemente vortaeuschen, die nichts tun). `hash` scrollt innerhalb der
// Landing, `to` wechselt die Route — Letzteres ueber <Link>, damit die SPA nicht
// neu laedt.
const NAV: ReadonlyArray<{ label: string; hash?: string; to?: string }> = [
  { label: 'Produkt',          hash: '#produkt' },
  { label: 'Automatisierung',  hash: '#tools' },
  { label: 'Runtime',          hash: '#intro' },
  { label: 'Evidence',         hash: '#evidence' },
  { label: 'AI Act',           to: '/ai-act' },
  { label: 'Sicherheit',       to: '/sicherheit' },
  { label: 'Preise',           to: '/pricing' },
  { label: 'Login',            to: '/welcome' },
];

// Beispielwerte — bewusst KEINE Live-Daten. Ein anonymer Besucher hat keinen
// Mandanten und damit keine belegbaren Kennzahlen; das Panel wird deshalb als
// Beispielansicht ausgewiesen statt als "LIVE" (Truth Layer,
// docs/architecture/target-architecture.md §3.1).
const SAMPLE_METRICS = [['RISK','87/100'],['EVIDENCE','1.248'],['AI SYSTEMS','04']] as const;
const SAMPLE_STATES = [
  ['DSGVO','PASS','text-emerald-300'],
  ['EU AI ACT','READY','text-cyan-300'],
  ['AI AGENTS','GOVERNED','text-cyan-300'],
  ['EVIDENCE','VERIFIED','text-cyan-300'],
] as const;

export default function GovernanceHero({ onStart }: { onStart?: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const start = () => onStart ? onStart() : navigate('/unified-entry/scan');
  const navClass = 'text-sm text-white/60 transition-colors hover:text-white';

  return <section id="produkt" className="relative isolate min-h-screen overflow-hidden bg-[#02060d] text-slate-200">
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_44%,rgba(34,211,238,.16),transparent_36%),radial-gradient(circle_at_90%_12%,rgba(14,165,233,.12),transparent_28%),#02060d]"/><div className="absolute -right-[18%] top-[8%] h-[900px] w-[900px] rounded-full bg-cyan-400/[.07] blur-[130px]"/><div className="absolute inset-0 bg-[linear-gradient(90deg,#02060d_0%,rgba(2,6,13,.96)_28%,rgba(2,6,13,.55)_58%,rgba(2,6,13,.08)_100%)]"/><div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#02060d] to-transparent"/>
    </div>

    <header className="relative z-30 mx-auto flex h-20 max-w-[1400px] items-center justify-between px-6 lg:px-10">
      <Link to="/" className="flex items-center gap-2.5 text-white"><span className="grid h-8 w-8 place-items-center rounded-full border border-cyan-400/40 bg-cyan-400/10 text-cyan-300" aria-hidden="true">✦</span><span className="text-[17px] font-semibold tracking-tight">RealSync <span className="font-normal text-white/75">Dynamics.AI</span></span></Link>
      <nav className="hidden items-center gap-6 lg:flex">
        {NAV.map(item => item.to
          ? <Link key={item.label} to={item.to} className={navClass}>{item.label}</Link>
          : <a key={item.label} href={item.hash} className={navClass}>{item.label}</a>)}
        <button onClick={start} className="rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-[#031019] shadow-[0_0_40px_-10px_rgba(34,211,238,.9)] transition hover:bg-cyan-300">Kostenlosen Audit starten</button>
      </nav>
      <button onClick={()=>setMenuOpen(v=>!v)} className="rounded-lg border border-white/10 p-2 lg:hidden" aria-label="Menü" aria-expanded={menuOpen}>{menuOpen?<X size={18}/>:<Menu size={18}/>}</button>
    </header>

    {menuOpen&&<div className="relative z-30 mx-6 rounded-2xl border border-white/10 bg-[#071320]/95 p-5 backdrop-blur-xl lg:hidden">
      <div className="flex flex-col gap-4 text-sm text-white/70">
        {NAV.map(item => item.to
          ? <Link key={item.label} to={item.to} onClick={()=>setMenuOpen(false)}>{item.label}</Link>
          : <a key={item.label} href={item.hash} onClick={()=>setMenuOpen(false)}>{item.label}</a>)}
        <button onClick={()=>{setMenuOpen(false);start()}} className="rounded-full bg-cyan-400 px-5 py-3 font-semibold text-[#031019]">Kostenlosen Audit starten</button>
      </div>
    </div>}

    <div className="relative z-10 mx-auto grid min-h-[calc(100vh-80px)] max-w-[1400px] items-center gap-8 px-6 pb-14 pt-8 lg:grid-cols-[.82fr_1.18fr] lg:px-10 lg:pb-16">
      <div className="max-w-[46rem]"><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/35 bg-cyan-400/[.07] px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[.2em] text-cyan-300">GOVERNANCE AI · BY REALSYNCDYNAMICS.AI</div><div className="mb-4 font-mono text-[10px] uppercase tracking-[.24em] text-white/40">REALSYNC GOVERNANCE RUNTIME™</div><h1 className="text-[2.8rem] font-medium leading-[.96] tracking-[-.04em] text-white sm:text-6xl lg:text-[5.5rem]" style={{fontFamily:"Georgia,'Times New Roman',serif"}}>Ihre Prozesse bleiben Ihre.<br/><span className="text-cyan-300 [text-shadow:0_0_35px_rgba(34,211,238,.28)]">Ihre KI wird EU-ready.</span></h1><p className="mt-7 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">Governance AI by RealSyncDynamics.AI macht KI-gestützte Geschäftsprozesse kontrollierbar, nachvollziehbar und EU-ready – für DSGVO, EU AI Act und Ihre eigenen Unternehmensregeln.</p><p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/50 sm:text-base">Ihre Systeme bleiben bestehen. Die Governance Runtime legt eine technische Kontrollschicht darüber, prüft Prozesse kontinuierlich und erzeugt belastbare Evidence.</p><div className="mt-6 grid gap-5 sm:grid-cols-3">{highlights.map(([title,desc,Icon])=><div key={title}><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.14em] text-cyan-300"><Icon size={14}/>{title}</div><p className="mt-2 text-[12px] leading-relaxed text-white/45">{desc}</p></div>)}</div><div className="mt-9 flex flex-wrap gap-3"><button onClick={start} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-teal-300 px-7 py-3.5 font-semibold text-[#03212b] shadow-[0_0_45px_-8px_rgba(34,211,238,.95)] hover:brightness-110">Kostenlosen Audit starten <ArrowRight size={16}/></button><a href="#intro" className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[.03] px-7 py-3.5 font-medium text-white hover:border-cyan-300/50 hover:bg-cyan-400/[.06]"><PlayCircle size={17} className="text-cyan-300"/> Einführung</a></div><p className="mt-6 flex items-center gap-2 text-xs text-white/35"><BadgeCheck size={14} className="text-emerald-400"/> Hosting &amp; Verarbeitung in der EU · ISO-orientierte Prozesse</p></div>

      <div className="relative min-h-[560px] lg:min-h-[760px]">
        <GlobeVisual/>
        <div className="pointer-events-none absolute inset-x-[8%] top-[18%] z-20 rounded-2xl border border-cyan-300/30 bg-[#06131f]/72 p-5 shadow-[0_0_100px_rgba(34,211,238,.22)] backdrop-blur-xl">
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[.18em] text-cyan-300">
            <span>Governance AI · Control Plane</span>
            <span className="rounded-full border border-white/20 px-2 py-0.5 text-[9px] tracking-[.14em] text-white/50">Beispielansicht</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {SAMPLE_METRICS.map(([label,value])=><div key={label} className="rounded-lg border border-white/10 bg-black/25 p-3"><span className="font-mono text-[9px] text-white/35">{label}</span><strong className="mt-1 block text-xl text-white">{value}</strong></div>)}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-[9px] uppercase tracking-[.12em]">
            {SAMPLE_STATES.map(([label,state,tone])=><span key={label} className="text-white/40">{label} <b className={`float-right ${tone}`}>{state}</b></span>)}
          </div>
          <p className="mt-4 border-t border-white/10 pt-3 text-[10px] leading-relaxed text-white/35">
            Beispielwerte zur Veranschaulichung. Ihre echten Kennzahlen entstehen erst mit dem ersten Audit.
          </p>
        </div>
      </div>
    </div>
  </section>;
}
