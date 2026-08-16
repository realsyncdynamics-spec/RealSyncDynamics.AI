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
  return (
    <div className={`rounded-2xl border border-white/15 bg-[#061321]/80 p-4 shadow-[0_20px_60px_-25px_rgba(0,0,0,.95),0_0_35px_rgba(0,210,255,.12)] backdrop-blur-xl ${className}`}>
      {children}
    </div>
  );
}

function Signal({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[.12em] text-cyan-100">
      <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_#22d3ee]" />
      {children}
    </span>
  );
}

function Stars() {
  const stars = Array.from({ length: 105 }, (_, i) => ({
    left: `${(i * 37) % 100}%`,
    top: `${(i * 61) % 88}%`,
    size: i % 13 === 0 ? 2 : i % 3 === 0 ? 1.4 : 1,
    opacity: i % 7 === 0 ? 0.8 : 0.32,
  }));

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {stars.map((star, i) => (
        <span key={i} className="absolute rounded-full bg-white" style={{ left: star.left, top: star.top, width: star.size, height: star.size, opacity: star.opacity }} />
      ))}
    </div>
  );
}

function Skyline() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[220px] overflow-hidden sm:h-[250px] lg:h-[285px]" aria-hidden="true">
      <div className="absolute inset-0 bg-gradient-to-t from-[#010409] via-[#02070e]/55 to-transparent" />
      <div className="absolute bottom-0 left-1/2 h-[175px] w-[150%] -translate-x-1/2 opacity-95 sm:h-[205px] lg:h-[220px]">
        <svg viewBox="0 0 1600 260" preserveAspectRatio="none" className="h-full w-full">
          <defs>
            <linearGradient id="cityFade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#17344b" stopOpacity=".72" />
              <stop offset="1" stopColor="#01050a" stopOpacity="1" />
            </linearGradient>
            <linearGradient id="cityWindows" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff4c7" stopOpacity=".95" />
              <stop offset=".6" stopColor="#67e8f9" stopOpacity=".42" />
              <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0 260V178h70v-25h58v46h54v-72h45v53h53v-90h50v82h36v-38h64v63h45v-105h42v74h28v-38h50v57h44v-120h43v105h27v-55h60v80h43v-135h46v116h29v-69h50v88h52v-105h36v93h43v-54h55v76h38v-96h42v110h54v-66h54v75h43v-125h40v103h40v-75h54v93h54v-112h46v138h50v-83h70v169Z" fill="url(#cityFade)" />
          <g fill="url(#cityWindows)">
            {Array.from({ length: 185 }, (_, i) => (
              <rect key={i} x={(i * 83) % 1580 + 5} y={132 + ((i * 29) % 98)} width="2" height="5" rx="1" />
            ))}
          </g>
          <path d="M720 260V92h15V54h8v38h15v168" fill="#06101a" stroke="#4edcff" strokeOpacity=".25" />
          <path d="M726 53h12M729 39h6M732 25v14" stroke="#7eeaff" strokeOpacity=".55" strokeWidth="2" />
          <path d="M0 225 C250 195 420 247 650 222 S1100 204 1600 231" fill="none" stroke="#7be8ff" strokeOpacity=".18" strokeWidth="2" />
        </svg>
      </div>
    </div>
  );
}

function EarthScene() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="absolute right-[-27%] top-[5%] h-[560px] w-[820px] sm:right-[-22%] sm:top-[3%] sm:h-[690px] sm:w-[1040px] lg:right-[-17%] lg:top-[-1%] lg:h-[820px] lg:w-[1220px] xl:right-[-12%] xl:h-[900px] xl:w-[1340px]">
        <div className="absolute inset-[9%] rounded-full bg-cyan-400/15 blur-[95px]" />
        {/* Das Bild bringt einen eigenen dunklen Sternenhintergrund mit. Ohne
            Maske zeichnet sich sein Rechteck als harte Kante gegen den Hero ab
            (ab ~1900px Breite deutlich sichtbar). Die radiale Maske blendet die
            Raender aus, damit die Kugel im Verlauf steht statt in einem Kasten. */}
        <img
          src="/europe-globe.webp"
          alt=""
          className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_0_105px_rgba(40,210,255,.34)]"
          style={{
            maskImage: 'radial-gradient(circle at 50% 46%, #000 52%, transparent 72%)',
            WebkitMaskImage: 'radial-gradient(circle at 50% 46%, #000 52%, transparent 72%)',
          }}
        />
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_66%_31%,rgba(255,246,214,.55),transparent_7%,transparent_25%),radial-gradient(circle_at_56%_52%,transparent_42%,rgba(0,0,0,.58)_76%)]" />
        <div className="absolute right-[18%] top-[11%] h-20 w-20 rounded-full bg-white/95 blur-[8px] shadow-[0_0_80px_30px_rgba(255,190,105,.42)]" />
        <div className="absolute right-[21%] top-[16%] h-2 w-32 rotate-[16deg] rounded-full bg-white/75 blur-[3px] shadow-[0_0_35px_12px_rgba(255,196,116,.5)]" />
        <div className="absolute left-[19%] top-[42%] h-32 w-32 rounded-full bg-cyan-300/10 blur-3xl" />
      </div>
      <div className="absolute right-[5%] top-[29%] h-28 w-28 rounded-full border border-cyan-200/20 bg-cyan-300/5 blur-[1px]" />
    </div>
  );
}

function Connector({ className }: { className: string }) {
  return <span className={`pointer-events-none absolute z-20 hidden h-px origin-left bg-gradient-to-r from-cyan-300/70 to-transparent shadow-[0_0_10px_rgba(34,211,238,.45)] xl:block ${className}`} aria-hidden="true" />;
}

// Nutzer-Knoten auf der Kugel — im Zielentwurf sitzen drei davon zwischen den
// Karten und zeigen, dass die Runtime Menschen und Systeme verbindet. Rein
// dekorativ, deshalb aria-hidden ueber den Container.
function UserNode({ className }: { className: string }) {
  return (
    <span className={`pointer-events-none absolute z-30 hidden h-9 w-9 place-items-center rounded-full border border-cyan-200/45 bg-[#08202f]/80 text-cyan-100 shadow-[0_0_22px_rgba(34,211,238,.35)] backdrop-blur-sm lg:grid ${className}`}>
      <User className="h-4 w-4" />
    </span>
  );
}

function GovernanceCard({ className, children }: { className: string; children: ReactNode }) {
  return <GlassCard className={`absolute z-40 ${className}`}>{children}</GlassCard>;
}

export default function GovernanceHero({ onStart }: HeroSectionProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const start = () => (onStart ? onStart() : navigate('/unified-entry/scan'));

  const handleNav = (event: MouseEvent<HTMLAnchorElement>, item: NavItem) => {
    const target = document.querySelector(item.href) ? item.href : item.fallback ?? '#intro';
    handleAnchorClick(event, target);
    setMenuOpen(false);
  };

  return (
    <section id="produkt" className="relative isolate min-h-[860px] overflow-hidden bg-[#02060d] text-white sm:min-h-[930px] lg:min-h-[980px] xl:min-h-[1000px]">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#02060d_0%,#03111d_43%,#071a28_70%,#02060d_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_76%_36%,rgba(22,170,231,.25),transparent_34%),radial-gradient(ellipse_at_78%_72%,rgba(255,172,75,.20),transparent_24%),radial-gradient(ellipse_at_24%_45%,rgba(17,75,111,.25),transparent_34%)]" />
      <Stars />
      <EarthScene />
      <div className="absolute inset-x-0 bottom-0 z-[25] h-[38%] bg-gradient-to-t from-[#010409] via-[#010409]/60 to-transparent" />

      <header className="relative z-[70] mx-auto flex max-w-[1448px] items-center justify-between px-5 py-5 sm:px-8 lg:px-10 xl:py-6">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-slate-200 xl:flex" aria-label="Hauptnavigation">
          {navItems.map((item) => <a key={item.label} href={item.href} onClick={(e) => handleNav(e, item)} className="transition hover:text-white">{item.label}</a>)}
        </nav>
        <div className="hidden items-center gap-4 xl:flex">
          <a href="/welcome" className="px-3 py-2 text-sm text-slate-300 transition hover:text-white">Login</a>
          <Button onClick={start} variant="primary" size="md">Kostenlos starten <ArrowRight className="h-4 w-4" /></Button>
        </div>
        <button type="button" aria-label={menuOpen ? 'Menü schließen' : 'Menü öffnen'} aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)} className="rounded-xl border border-white/15 bg-black/20 p-2.5 xl:hidden">{menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
      </header>

      {menuOpen && (
        <div className="relative z-[80] mx-5 rounded-2xl border border-white/10 bg-[#061321]/95 p-4 shadow-2xl backdrop-blur-xl xl:hidden">
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => <a key={item.label} href={item.href} onClick={(e) => handleNav(e, item)} className="rounded-xl px-3 py-3 text-sm text-slate-200 hover:bg-white/5">{item.label}</a>)}
            <a href="/welcome" className="rounded-xl px-3 py-3 text-sm text-slate-200">Login</a>
            <Button onClick={() => { setMenuOpen(false); start(); }} variant="primary" size="md" className="mt-2 w-full justify-center">Kostenlos starten <ArrowRight className="h-4 w-4" /></Button>
          </nav>
        </div>
      )}

      <div className="relative z-40 mx-auto grid max-w-[1448px] grid-cols-1 px-5 pb-36 pt-12 sm:px-8 sm:pt-14 lg:grid-cols-[47%_53%] lg:px-10 lg:pt-16 xl:grid-cols-[45%_55%]">
        <div className="relative z-50 max-w-[690px] lg:pt-3 xl:pt-5">
          <a href="#intro" onClick={(e) => handleAnchorClick(e, '#intro')} className="mb-7 inline-flex items-center gap-2 rounded-full border border-cyan-300/45 bg-cyan-300/[.08] px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[.12em] text-cyan-100 shadow-[0_0_35px_rgba(34,211,238,.13)]">
            <span className="rounded-full bg-cyan-300 px-2 py-0.5 text-[9px] font-bold text-[#03202a]">NEU</span>
            CLAUDE CODE OPTIMIZER
            <ArrowRight className="h-3.5 w-3.5" />
          </a>

          {/* Die H1 rendert aus hero-content.ts — derselben Quelle, aus der
              FE-001 seine Erwartung zieht. Vorher stand die Headline hier
              hartkodiert, waehrend die "Single Source of Truth" nur noch den
              Test speiste: genau deshalb war main seit 07805ddc siebenmal in
              Folge rot. Headline-Aenderungen gehoeren ausschliesslich in
              hero-content.ts. */}
          <h1 className="max-w-[760px] text-balance text-[56px] font-black leading-[.9] tracking-[-.055em] sm:text-[70px] lg:text-[82px] xl:text-[94px]" style={{ textShadow: '0 2px 0 #f3fbff, 0 4px 0 #a9bfd0, 0 7px 0 #506a80, 0 11px 0 #21384c, 0 18px 34px rgba(0,0,0,.92), 0 0 48px rgba(119,222,255,.30)' }}>
            {HERO_HEADLINE.map((segments, i) => (
              <span key={i} className="block bg-gradient-to-b from-white via-[#eaf7ff] via-[42%] to-[#7592aa] bg-clip-text text-transparent">
                {segments.map((s, j) => <span key={j} className={s.accent ? 'text-cyan-300' : undefined}>{s.text}</span>)}
              </span>
            ))}
          </h1>

          {/* Umbruch fest gesetzt: Die Akzentzeile traegt die Positionierung und
              soll geschlossen stehen, nicht mitten in "Code-Compliance" brechen. */}
          <p className="mt-7 max-w-[680px] text-xl leading-8 text-slate-100 sm:text-2xl lg:text-[24px] lg:leading-9 xl:text-[25px]">Das KI-Betriebssystem für <span className="font-semibold text-cyan-300 drop-shadow-[0_0_15px_rgba(34,211,238,.22)] lg:block">DSGVO, EU AI Act &amp; Code-Compliance.</span></p>
          <p className="mt-5 max-w-[640px] text-base leading-7 text-slate-300 sm:text-lg">Kontinuierliche Governance, Monitoring und beweisfähige Evidence für KI-Systeme, Daten und Code – in einer operativen Control Plane.</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button onClick={start} variant="primary" size="lg">Kostenlos starten <ArrowRight className="h-5 w-5" /></Button>
            <a href="#intro" onClick={(e) => handleAnchorClick(e, '#intro')} className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/20 bg-[#071521]/65 px-5 text-sm font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_10px_30px_rgba(0,0,0,.35)] backdrop-blur-md transition hover:bg-white/10"><PlayCircle className="h-4 w-4" />Plattform ansehen</a>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {['GDPR', 'Risk Score', 'Claude Code Audit', 'EU AI Act'].map((item) => <span key={item} className="rounded-full border border-cyan-300/35 bg-[#061321]/70 px-4 py-2 text-xs font-medium text-cyan-200 shadow-[inset_0_1px_0_rgba(255,255,255,.06)]">{item}</span>)}
          </div>
        </div>

        <div className="relative min-h-[540px] sm:min-h-[640px] lg:min-h-[680px] xl:min-h-[710px]">
          <Connector className="left-[10%] top-[13%] w-[25%] rotate-[7deg]" />
          <Connector className="right-[16%] top-[27%] w-[26%] rotate-[170deg]" />
          <Connector className="left-[20%] top-[55%] w-[24%] rotate-[-7deg]" />
          <Connector className="right-[25%] top-[51%] w-[24%] rotate-[168deg]" />
          <Connector className="left-[44%] top-[77%] w-[22%] rotate-[176deg]" />
          <Connector className="right-[12%] top-[74%] w-[23%] rotate-[174deg]" />

          <GovernanceCard className="left-[0%] top-[5%] w-44 sm:left-[2%] lg:left-[-1%] xl:left-[2%]">
            <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-8 w-8 text-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,.4)]" /><div><div className="text-sm font-semibold">DSGVO</div><div className="mt-1 text-xs text-slate-300">Compliant</div></div></div>
          </GovernanceCard>

          <GovernanceCard className="right-[1%] top-[22%] w-40 sm:right-[4%] xl:right-[7%]">
            <Signal>Risk Score</Signal><div className="mt-1 text-4xl font-light">87<span className="text-lg text-slate-400">/100</span></div><div className="mt-2 h-1 rounded-full bg-slate-700"><div className="h-full w-[87%] rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" /></div>
          </GovernanceCard>

          <GovernanceCard className="left-[8%] top-[50%] w-48 sm:left-[14%] xl:left-[16%]">
            <div className="flex items-start gap-3">
              <FileText className="mt-1 h-7 w-7 shrink-0 text-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,.4)]" />
              <div><Signal>Evidence</Signal><div className="mt-1 text-3xl font-semibold">1,248</div><div className="text-xs text-slate-400">Nachweise</div></div>
            </div>
          </GovernanceCard>

          <GovernanceCard className="right-[9%] top-[43%] w-64 sm:right-[14%] xl:right-[17%]">
            <div className="flex items-center gap-2"><SquareCheckBig className="h-4 w-4 text-cyan-300" /><Signal>Claude Code Audit</Signal></div><div className="mt-2 flex items-baseline gap-2"><span className="text-4xl font-light">94.2%</span><span className="text-xs text-slate-300">Code-Ready</span></div><p className="mt-2 text-xs leading-5 text-slate-300">Analysierte Codezeilen: 2.1 Mio<br />Sicherheitslücken behoben: 11,350</p>
          </GovernanceCard>

          <GovernanceCard className="left-[42%] top-[71%] w-44 xl:left-[39%]">
            <div className="flex items-center gap-2"><Activity className="h-5 w-5 text-cyan-300" /><div><div className="text-sm font-medium">MONITORING</div><div className="text-xs text-slate-300">Kontinuierlich</div></div></div>
          </GovernanceCard>

          <GovernanceCard className="right-[1%] top-[68%] w-44 sm:right-[3%] xl:right-[5%]">
            <div className="flex items-center gap-3"><SquareCheckBig className="h-7 w-7 text-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,.4)]" /><div className="text-sm font-semibold">EU AI ACT<br />READY</div></div>
          </GovernanceCard>

          <UserNode className="left-[38%] top-[9%]" />
          <UserNode className="left-[18%] top-[38%]" />
          <UserNode className="right-[2%] top-[34%]" />

          {/* Truth Layer (docs/architecture/target-architecture.md §3.1): Ein
              anonymer Besucher hat keinen Mandanten und damit keine belegbaren
              Kennzahlen. Die Karten oben zeigen Beispielwerte — das muss am
              Bildschirm stehen, nicht nur im Code, sonst behauptet die Seite
              Messwerte, die es nicht gibt. Aus demselben Grund traegt die
              Monitoring-Karte kein "Live" mehr: nichts davon laeuft live. */}
          {/* Auf grossen Schirmen sitzt der Hinweis unter dem Kartenfeld. Auf
              schmalen stapeln die Karten und schoben ihn unter die Falz — dort
              erfuellt er seinen Zweck nicht, also steht er dort im Fluss. */}
          <p className="relative z-20 mt-6 text-center text-[11px] leading-relaxed text-slate-400/80 lg:absolute lg:inset-x-10 lg:bottom-0 lg:mt-0">
            Beispielansicht mit Musterwerten. Ihre echten Kennzahlen entstehen mit dem ersten Audit.
          </p>
        </div>
      </div>

      <Skyline />

      <div className="absolute bottom-7 left-1/2 z-30 hidden -translate-x-1/2 text-center xl:block">
        <div className="mb-2 text-[10px] font-medium uppercase tracking-[.25em] text-slate-400">EUROPEAN AI GOVERNANCE</div>
        <div className="flex items-center gap-10 whitespace-nowrap text-xs font-semibold text-slate-300/75"><span>GDPR</span><span>EU AI ACT</span><span>CODE SECURITY</span><span>EVIDENCE</span><span>CONTINUOUS MONITORING</span></div>
      </div>
    </section>
  );
}
