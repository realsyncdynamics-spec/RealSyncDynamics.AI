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
  // Referenz (Gemini-Entwurf): Szene beginnt bei x ≈ 327 px (24 % von 1365)
  // und läuft ohne sichtbare Naht bis an den oberen Rand.
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div data-testid="hero-visual-panel" className="absolute bottom-0 left-[24%] right-0 top-0 overflow-hidden bg-[#02070d]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_48%,rgba(22,170,231,.18),transparent_42%),linear-gradient(115deg,rgba(1,5,9,.94)_0%,rgba(2,10,18,.52)_42%,rgba(2,9,16,.06)_100%)]" />
        <img src="/europe-globe.webp" alt="" className="absolute -right-[13%] -top-[7%] h-[125%] w-[105%] object-contain drop-shadow-[0_0_90px_rgba(37,207,255,.32)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_74%_18%,rgba(255,255,255,.42),transparent_5%,transparent_17%),radial-gradient(circle_at_62%_53%,transparent_34%,rgba(0,0,0,.58)_78%)]" />
        <div className="absolute right-[3%] top-[4%] h-24 w-24 rounded-full bg-white/75 blur-[12px] shadow-[0_0_70px_28px_rgba(255,190,105,.30)]" />
      </div>
      <div className="absolute left-[24%] right-0 bottom-0 h-[28%] bg-gradient-to-t from-[#010409] via-[#010409]/60 to-transparent" />
    </div>
  );
}

/**
 * Frankfurt-Skyline als SVG-Silhouette am unteren Rand (Gemini-Referenz:
 * Bankenviertel mit Commerzbank-Turm, Messeturm, Main Tower, Europaturm und
 * Mainbrücke vor Abendhimmel). Kein Foto-Asset im Repo — die Silhouette
 * approximiert die Komposition; Sonne rechts als warmer Glow.
 */
function FrankfurtSkyline() {
  return (
    <div data-testid="hero-skyline" className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[230px] overflow-hidden" aria-hidden="true">
      {/* Abendrot hinter der Stadt — Sonne rechts wie in der Referenz */}
      <div className="absolute bottom-[36px] right-[10%] h-[150px] w-[150px] rounded-full bg-[radial-gradient(circle,rgba(255,214,140,.55),rgba(255,166,77,.25)_45%,transparent_70%)] blur-[6px]" />
      <div className="absolute inset-x-0 bottom-0 h-[170px] bg-[linear-gradient(to_top,rgba(255,158,66,.16),rgba(255,158,66,.06)_45%,transparent)]" />

      <svg viewBox="0 0 1365 220" preserveAspectRatio="xMidYMax slice" className="absolute bottom-0 h-[220px] w-full">
        {/* Hintere Häuserzeile (entfernt, bläulich) */}
        <g fill="#13293e" opacity=".8">
          <path d="M0 220V150h38v-18h20v28h30V138h26v22h34v-30h22v40h40V152h30v68zM1120 220v-58h26v-16h18v26h30v-20h24v30h32v-40h20v24h30v-16h24v70zM980 220v-50h30v-22h20v32h36v-24h26v64z" />
          {/* Europaturm (Fernsehturm) links der Mitte */}
          <path d="M330 220v-92h8V96h4l2-34h4l2 34h4v32h8v92z" />
        </g>

        {/* Vordere Skyline — Bankenviertel */}
        <g fill="#081624">
          {/* linke niedrige Bebauung */}
          <path d="M0 220v-44h46v-14h28v22h40v-16h30v52z" />
          {/* Messeturm: Schaft + Pyramidenspitze */}
          <path d="M420 220V92h10l16-34 16 34h10v128z" />
          {/* Doppeltürme Deutsche Bank */}
          <path d="M520 220V104h30v116zM556 220V104h30v116z" />
          {/* Commerzbank: gestufter Turm mit Antenne (höchster) */}
          <path d="M640 220V60h14V30h4V8h4v22h4v30h14v40h16v100z" />
          {/* Main Tower: runde Krone + Antenne */}
          <path d="M730 220V84h6V64h4V40h4v24h4v20h6v136z" />
          {/* weitere Hochhäuser */}
          <path d="M790 220V110h28v-22h20v132zM860 220V132h34v-16h22v104z" />
          {/* rechte, abfallende Bebauung */}
          <path d="M930 220v-64h28v-18h22v30h30v-20h24v72zM1050 220v-46h30v-16h20v62z" />
        </g>

        {/* vereinzelt erleuchtete Fenster */}
        <g fill="#ffc97e" opacity=".75">
          <rect x="648" y="90" width="3" height="4" /><rect x="658" y="120" width="3" height="4" /><rect x="666" y="150" width="3" height="4" />
          <rect x="527" y="130" width="3" height="4" /><rect x="563" y="150" width="3" height="4" />
          <rect x="736" y="110" width="3" height="4" /><rect x="744" y="160" width="3" height="4" />
          <rect x="797" y="130" width="3" height="4" /><rect x="868" y="150" width="3" height="4" />
          <rect x="428" y="120" width="3" height="4" /><rect x="438" y="160" width="3" height="4" />
        </g>

        {/* Main mit Brücke (links der Mitte, wie in der Referenz) */}
        <g>
          <rect x="0" y="206" width="1365" height="14" fill="#04101c" />
          <path d="M120 206h240v-8H120z" fill="#071522" />
          <path d="M132 206a30 14 0 0 1 60 0zM204 206a30 14 0 0 1 60 0zM276 206a30 14 0 0 1 60 0z" fill="#020a12" />
          <rect x="150" y="188" width="3" height="10" fill="#0a1826" /><rect x="230" y="188" width="3" height="10" fill="#0a1826" /><rect x="310" y="188" width="3" height="10" fill="#0a1826" />
        </g>
      </svg>

      {/* Bodennebel zum Abdunkeln der Kante */}
      <div className="absolute inset-x-0 bottom-0 h-[46px] bg-gradient-to-t from-[#010409] to-transparent" />
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
  // Exakt unten mittig ausgerichtet (Vorgabe Pixel-Match-Pass, 2026-08-16).
  return <div data-testid="hero-assistant-bar" className="absolute bottom-4 left-1/2 z-[55] hidden w-[405px] -translate-x-1/2 items-center rounded-full border border-white/20 bg-[#071522]/90 px-4 py-2 text-sm shadow-[0_15px_35px_rgba(0,0,0,.55)] backdrop-blur-xl xl:flex">
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
      <Stars /><EarthPanel /><FrankfurtSkyline />

      <header className="relative z-[80] mx-auto flex h-[78px] max-w-[1448px] items-center justify-between px-6 lg:px-[70px]">
        <Logo />
        <nav className="hidden items-center gap-7 text-[14px] text-slate-200 lg:flex" aria-label="Hauptnavigation">{navItems.map((item) => <a key={item.label} href={item.href} onClick={(e) => handleNav(e, item)} className="transition hover:text-white">{item.label}</a>)}</nav>
        <div className="hidden items-center gap-4 lg:flex"><a href="/welcome" className="px-3 py-2 text-[14px] text-slate-300 transition hover:text-white">Login</a><Button onClick={start} variant="primary" size="md">Kostenlos starten <ArrowRight className="h-4 w-4" /></Button></div>
        <button type="button" aria-label={menuOpen ? 'Menü schließen' : 'Menü öffnen'} aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)} className="rounded-xl border border-white/15 bg-black/20 p-2.5 lg:hidden">{menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
      </header>

      {menuOpen && <div className="relative z-[90] mx-5 rounded-2xl border border-white/10 bg-[#061321]/95 p-4 shadow-2xl backdrop-blur-xl lg:hidden"><nav className="flex flex-col gap-1">{navItems.map((item) => <a key={item.label} href={item.href} onClick={(e) => handleNav(e, item)} className="rounded-xl px-3 py-3 text-sm text-slate-200 hover:bg-white/5">{item.label}</a>)}<a href="/welcome" className="rounded-xl px-3 py-3 text-sm text-slate-200">Login</a><Button onClick={() => { setMenuOpen(false); start(); }} variant="primary" size="md" className="mt-2 w-full justify-center">Kostenlos starten <ArrowRight className="h-4 w-4" /></Button></nav></div>}

      {/* Linke Spalte — Position/Zeilenhöhe gemäß Gemini-Referenz (1365×768):
          Badge ~y110 · H1 ~y150 · Subline ~y305 · CTAs ~y460 · Chips ~y515. */}
      <div className="relative z-50 mx-auto max-w-[1448px] px-6 pt-[56px] lg:px-[70px] lg:pt-[30px]">
        <div className="max-w-[585px]">
          <a href="#intro" onClick={(e) => handleAnchorClick(e, '#intro')} className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/35 bg-[#0a2533]/75 px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-[.13em] text-cyan-100 shadow-[0_0_25px_rgba(34,211,238,.08)]"><span className="rounded-full bg-cyan-300 px-2 py-0.5 text-[9px] font-bold text-[#03202a]">NEU</span>CLAUDE CODE OPTIMIZER<ArrowRight className="h-3.5 w-3.5" /></a>
          <h1 className="max-w-[640px] text-balance text-[56px] font-bold leading-[.95] tracking-[-.045em] sm:text-[66px] lg:text-[80px]">{HERO_HEADLINE.map((line, lineIndex) => <span key={lineIndex} className="block bg-gradient-to-b from-white via-white to-[#c7d1d9] bg-clip-text text-transparent drop-shadow-[0_5px_15px_rgba(0,0,0,.55)]">{line.map((segment) => segment.text).join('')}</span>)}</h1>
          <p className="mt-4 text-[20px] leading-[1.4] text-white/95 sm:text-[21px]">Das KI-Betriebssystem für<br /><span className="font-semibold text-cyan-300">DSGVO, EU AI Act &amp; Code-Compliance.</span></p>
          <p className="mt-4 max-w-[455px] text-[15px] leading-[1.55] text-white/65">Kontinuierliche Governance, Monitoring und beweisfähige Evidence für KI-Systeme, Daten und Code – in einer operativen Control Plane.</p>
          <div className="mt-6 flex flex-wrap gap-3"><Button onClick={start} variant="primary" size="lg">Kostenlos starten <ArrowRight className="h-5 w-5" /></Button><a href="#intro" onClick={(e) => handleAnchorClick(e, '#intro')} className="inline-flex h-12 items-center gap-2 rounded-lg border border-cyan-200/60 bg-transparent px-5 text-sm font-medium text-white transition hover:bg-white/10"><PlayCircle className="h-4 w-4" />Plattform ansehen</a></div>
          <div className="mt-4 flex flex-wrap gap-2">{['GDPR', 'Risk Score', 'Claude Code Audit', 'EU AI Act'].map((item) => <span key={item} className="rounded-full border border-cyan-200/25 bg-[#071522]/60 px-4 py-1.5 text-[11px] text-cyan-100/90">{item}</span>)}</div>
        </div>
      </div>

      {/* Karten-Koordinaten = X-Anteile der Gemini-Referenz × Viewport
          (bei 1365×768: DSGVO x≈730 · Risk x≈1166 · Audit x≈929 ·
          EU-AI-Act x≈1154 · Evidence x≈560 · Monitoring x≈744). */}
      <div className="pointer-events-none absolute inset-0 z-40" aria-hidden="true">
        <Connector className="left-[62%] top-[15%] w-[120px] rotate-[12deg]" /><Connector className="left-[75.5%] top-[30%] w-[110px] rotate-[24deg]" /><Connector className="left-[50%] top-[43%] w-[95px] rotate-[-14deg]" />
        <UserNode className="left-[66.5%] top-[12%]" /><UserNode className="left-[48%] top-[34.5%]" /><UserNode className="left-[93%] top-[32.5%]" />

        <GovernanceCard className="left-[53.5%] top-[12.5%] w-[150px] p-3"><div className="flex items-center gap-3"><ShieldCheck className="h-7 w-7 text-cyan-300" /><div><div className="text-[14px] font-semibold">DSGVO</div><div className="mt-0.5 text-[11px] text-white/55">Compliant</div></div><span className="ml-auto grid h-5 w-5 place-items-center rounded-full bg-cyan-300/20 text-cyan-300">✓</span></div></GovernanceCard>
        <GovernanceCard className="left-[85.4%] top-[21.5%] w-[145px] p-3"><Signal>Risk Score</Signal><div className="mt-1 text-[30px] font-light">87<span className="text-[14px] text-white/45">/100</span></div><div className="mt-2 h-1 w-full rounded-full bg-white/10"><div className="h-full w-[87%] rounded-full bg-cyan-300" /></div></GovernanceCard>
        <GovernanceCard className="left-[68%] top-[34.5%] w-[258px] p-4"><div className="flex gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-cyan-300/10 text-cyan-200"><FileText className="h-5 w-5" /></div><div className="min-w-0 flex-1"><Signal>Claude Code Audit</Signal><div className="mt-1 flex items-baseline gap-2 whitespace-nowrap"><span className="text-[28px] font-light">94.2%</span><span className="text-[11px] text-white/60">Code-Ready</span></div><div className="mt-1.5 space-y-0.5 whitespace-nowrap text-[10.5px] leading-snug text-white/60"><div>Analysierte Codezeilen: 2.1 Mio</div><div>Sicherheitslücken behoben: 11,350</div></div></div></div></GovernanceCard>
        <GovernanceCard className="left-[84.5%] top-[52.5%] w-[152px] p-3"><div className="flex items-center gap-3"><ShieldCheck className="h-7 w-7 text-cyan-300" /><div><div className="text-[13px] font-semibold">EU AI ACT</div><div className="mt-0.5 text-[11px] font-semibold uppercase tracking-[.08em] text-cyan-300">Ready</div></div></div></GovernanceCard>
        <GovernanceCard className="left-[41%] top-[40.5%] w-[152px] p-3"><div className="flex items-start gap-2.5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-cyan-300/10 text-cyan-200"><SquareCheckBig className="h-5 w-5" /></span><div><Signal>Evidence</Signal><div className="mt-0.5 text-[26px] font-light leading-none">1,248</div><div className="mt-1 text-[11px] text-white/55">Nachweise</div></div></div></GovernanceCard>
        <GovernanceCard className="left-[54.5%] top-[57%] w-[168px] p-3"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-cyan-300/10 text-cyan-200"><Activity className="h-5 w-5" /></span><div><div className="font-mono text-[10px] font-semibold uppercase tracking-[.11em] text-cyan-100">Monitoring</div><div className="mt-0.5 flex items-center gap-1.5 text-[13px] text-white">Live<span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /></div></div></div></GovernanceCard>
      </div>

      <AssistantBar />
      <div className="absolute bottom-0 left-0 right-0 z-30 h-[80px] bg-gradient-to-t from-[#010409] to-transparent" />
    </section>
  );
}
