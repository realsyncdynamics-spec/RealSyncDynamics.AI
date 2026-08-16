import { FormEvent, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Code2, FileCheck2, Lock, Scan, ShieldCheck, Snowflake } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { LandingChannelTools } from '../components/landing/LandingChannelTools';

const BG = 'rgb(3, 7, 18)';
const SANS = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";

const GOVERNANCE_STEPS = [
  ['01', 'DISCOVER', 'KI-Systeme, Agents, Anwendungen, Datenflüsse und relevante Verarbeitungsvorgänge erfassen.'],
  ['02', 'ASSESS', 'Risiken bewerten und Systeme gegen Governance-, DSGVO- und EU-AI-Act-Kriterien prüfen.'],
  ['03', 'GOVERN', 'Ihre Policies, Verantwortlichkeiten und Kontrollanforderungen als operative Regeln definieren.'],
  ['04', 'ENFORCE', 'Governance-Regeln in laufenden Prozessen anwenden und Abweichungen kontrolliert behandeln.'],
  ['05', 'EVIDENCE', 'Prüfungen, Entscheidungen, Änderungen und Kontrollen nachvollziehbar dokumentieren.'],
  ['06', 'VERIFY', 'Kontinuierlich prüfen, ob Systeme und Prozesse noch innerhalb Ihrer Governance liegen.'],
];

const PLATFORM = [
  ['Runtime Monitoring', 'Kontinuierliche Telemetrie über Websites, Datenflüsse, KI-Systeme und Agents.'],
  ['Evidence Vault', 'Nachvollziehbare Nachweise, Snapshots und Audit-Trails für relevante Governance-Ereignisse.'],
  ['AI-Act-Klassifizierung', 'KI-Systeme strukturiert bewerten und relevante Anforderungen dokumentieren.'],
  ['Policy Engine', 'Ihre Governance-Regeln nicht nur dokumentieren, sondern als Kontrolllogik ausführen.'],
  ['AI Agent Governance', 'Identität, Kontext, Policy, Aktion und Evidence für automatisierte Agentenprozesse.'],
  ['Continuous Verification', 'Drift erkennen, Risiken priorisieren und den Governance-Zustand laufend verifizieren.'],
];

const NODES = [
  ['12%', '32%', 'AI AGENTS', '24 online'],
  ['27%', '16%', 'DATA FLOWS', '256 streams'],
  ['48%', '8%', 'AI SYSTEMS', '04 governed'],
  ['72%', '18%', 'APIs', '52 connected'],
  ['84%', '38%', 'WORKFLOWS', '128 active'],
  ['76%', '64%', 'WEBSITES', '37 monitored'],
  ['56%', '76%', 'EVIDENCE', '1,248 verified'],
  ['30%', '70%', 'POLICIES', '17 enforced'],
];

const ORBIT_DOTS = Array.from({ length: 22 }, (_, index) => ({
  left: `${10 + ((index * 37) % 78)}%`,
  top: `${8 + ((index * 53) % 78)}%`,
  delay: `${-(index * 0.37)}s`,
}));

export function MainLanding() {
  const navigate = useNavigate();
  const [domain, setDomain] = useState('');
  const nodes = useMemo(() => NODES, []);

  const startScan = (event: FormEvent) => {
    event.preventDefault();
    const value = domain.trim();
    navigate(value ? `/unified-entry/scan?domain=${encodeURIComponent(value)}` : '/unified-entry/scan');
  };

  return (
    <div className="landing-context min-h-screen bg-[rgb(3,7,18)] text-white antialiased" style={{ backgroundColor: BG, fontFamily: SANS }}>
      <SEOHead
        title="Governance AI by RealSyncDynamics.AI — DSGVO & EU AI Act"
        description="Governance AI by RealSyncDynamics.AI macht KI-gestützte Geschäftsprozesse kontrollierbar, nachvollziehbar und EU-ready – mit DSGVO, EU AI Act, Policies, Continuous Monitoring und Evidence."
        canonical="/"
        ogTitle="Ihre Prozesse bleiben Ihre. Ihre KI wird EU-ready."
        ogDescription="Governance AI by RealSyncDynamics.AI — The Control Layer for AI-Driven Business. Ihre KI. Ihre Regeln. Ihr Nachweis."
      />

      <style>{`
        @keyframes rs-orbit-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes rs-orbit-spin-reverse { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        @keyframes rs-node-pulse { 0%, 100% { opacity: .45; transform: scale(.82); box-shadow: 0 0 0 rgba(34,211,238,0); } 50% { opacity: 1; transform: scale(1.12); box-shadow: 0 0 22px rgba(34,211,238,.7); } }
        @keyframes rs-globe-breathe { 0%, 100% { transform: scale(1) translate3d(0,0,0); } 50% { transform: scale(1.018) translate3d(0,-4px,0); } }
        @keyframes rs-data-flow { from { transform: translateX(-30%); opacity: 0; } 15% { opacity: 1; } 75% { opacity: 1; } to { transform: translateX(130%); opacity: 0; } }
        @keyframes rs-scan-line { from { transform: translateY(-110%); } to { transform: translateY(110%); } }
        @keyframes rs-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
        .rs-globe-wrap { animation: rs-globe-breathe 8s ease-in-out infinite; }
        .rs-orbit-a { animation: rs-orbit-spin 28s linear infinite; }
        .rs-orbit-b { animation: rs-orbit-spin-reverse 21s linear infinite; }
        .rs-orbit-c { animation: rs-orbit-spin 36s linear infinite; }
        .rs-node { animation: rs-node-pulse 2.8s ease-in-out infinite; }
        .rs-flow { animation: rs-data-flow 4.5s linear infinite; }
        .rs-scan { animation: rs-scan-line 6s linear infinite; }
        .rs-float { animation: rs-float 5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .rs-globe-wrap, .rs-orbit-a, .rs-orbit-b, .rs-orbit-c, .rs-node, .rs-flow, .rs-scan, .rs-float { animation: none !important; }
        }
      `}</style>

      <header className="absolute inset-x-0 top-0 z-50">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-10">
          <Link to="/" className="flex items-center gap-2.5">
            <Snowflake className="h-6 w-6 text-cyan-400" strokeWidth={1.5} />
            <span className="text-base font-semibold tracking-tight sm:text-lg">RealSync<span className="font-normal text-white/80">Dynamics.AI</span></span>
          </Link>
          <nav className="hidden items-center gap-7 md:flex">
            <a href="#platform" className="text-sm text-white/65 transition-colors hover:text-white">Produkt</a>
            <a href="#evidence" className="text-sm text-white/65 transition-colors hover:text-white">Evidence</a>
            <Link to="/pricing" className="text-sm text-white/65 transition-colors hover:text-white">Preise</Link>
            <Link to="/welcome" className="text-sm text-white/65 transition-colors hover:text-white">Login</Link>
            <Link to="/unified-entry/scan" className="rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-[rgb(3,7,18)] transition hover:bg-cyan-300">Kostenlosen Audit starten</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative min-h-[900px] overflow-hidden border-b border-cyan-400/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_38%,rgba(6,182,212,.13),transparent_32%),radial-gradient(circle_at_88%_65%,rgba(14,165,233,.08),transparent_30%),linear-gradient(180deg,#020617_0%,#030712_65%,#02040a_100%)]" />
          <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(34,211,238,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,.035)_1px,transparent_1px)] [background-size:80px_80px]" />

          <div className="relative z-10 mx-auto grid min-h-[900px] max-w-[1600px] items-center gap-4 px-6 pb-12 pt-28 lg:grid-cols-[.72fr_1.28fr] lg:px-10 xl:px-14">
            <div className="relative z-30 max-w-2xl lg:pb-12">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[.2em] text-cyan-300">
                <Scan className="h-3.5 w-3.5" /> Governance AI · by RealSyncDynamics.AI
              </div>
              <div className="mb-5 font-mono text-[10px] uppercase tracking-[.24em] text-white/40">THE CONTROL LAYER FOR AI-DRIVEN BUSINESS</div>
              <h1 className="text-5xl leading-[.94] tracking-[-.045em] sm:text-6xl lg:text-[5.5rem] xl:text-[6.4rem]" style={{ fontFamily: SERIF, fontWeight: 500 }}>
                Ihre Prozesse bleiben Ihre.<br />
                <span className="text-cyan-400">Ihre KI wird EU-ready.</span>
              </h1>
              <p className="mt-7 max-w-xl text-base leading-relaxed text-white/72 sm:text-lg">
                Governance AI by RealSyncDynamics.AI macht KI-gestützte Geschäftsprozesse kontrollierbar, nachvollziehbar und EU-ready – für DSGVO, EU AI Act und Ihre eigenen Unternehmensregeln.
              </p>
              <div className="mt-5 grid max-w-xl grid-cols-3 gap-3">
                <MiniPromise icon={ShieldCheck} title="Ihre KI." text="Sie nutzen." />
                <MiniPromise icon={Lock} title="Ihre Regeln." text="Sie definieren." />
                <MiniPromise icon={CheckCircle2} title="Ihr Nachweis." text="Wir beweisen." />
              </div>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/unified-entry/scan" className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-7 py-3.5 font-semibold text-[rgb(3,7,18)] transition hover:bg-cyan-300">
                  Kostenlosen Audit starten <ArrowRight className="h-4 w-4" />
                </Link>
                <a href="#platform" className="inline-flex items-center gap-2 rounded-full border border-white/25 px-7 py-3.5 font-medium text-white transition hover:border-cyan-300/60 hover:bg-white/5">
                  Assurance Runtime ansehen
                </a>
              </div>
              <form onSubmit={startScan} className="mt-5 max-w-xl">
                <div className="flex flex-col gap-2 rounded-2xl border border-white/12 bg-black/35 p-2 backdrop-blur-xl sm:flex-row">
                  <input value={domain} onChange={event => setDomain(event.target.value)} placeholder="Website für kostenlosen Governance-Audit" aria-label="Website-URL für Governance-Scan" className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-white/30" />
                  <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[rgb(3,7,18)] transition hover:bg-cyan-50">Audit starten <ArrowRight className="h-4 w-4" /></button>
                </div>
              </form>
            </div>

            <div className="relative z-20 -mr-8 h-[650px] sm:h-[720px] lg:h-[820px] xl:-mr-16">
              <div className="rs-globe-wrap absolute left-1/2 top-1/2 aspect-square w-[720px] -translate-x-1/2 -translate-y-1/2 sm:w-[820px] lg:w-[900px] xl:w-[980px]">
                <div className="absolute inset-[10%] rounded-full bg-[radial-gradient(circle_at_35%_28%,rgba(255,255,255,.95),rgba(34,211,238,.45)_12%,rgba(2,20,40,.96)_52%,#01040a_72%)] shadow-[0_0_90px_rgba(34,211,238,.28),inset_-60px_-40px_120px_rgba(0,0,0,.9)]" />
                <div className="absolute inset-[10%] overflow-hidden rounded-full border border-cyan-300/30">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_48%_43%,transparent_0,transparent_30%,rgba(0,0,0,.5)_72%,rgba(0,0,0,.95)_100%)]" />
                  <div className="absolute left-[22%] top-[27%] h-[38%] w-[48%] rotate-[-12deg] rounded-[45%] bg-[radial-gradient(ellipse_at_center,rgba(255,222,150,.92),rgba(255,185,80,.35)_35%,transparent_70%)] opacity-75 blur-[1px]" />
                  <div className="absolute left-[35%] top-[37%] h-3 w-3 rounded-full bg-cyan-200 shadow-[0_0_30px_8px_rgba(34,211,238,.8)]" />
                  <div className="absolute left-[50%] top-[31%] h-2 w-2 rounded-full bg-cyan-200 shadow-[0_0_22px_6px_rgba(34,211,238,.8)]" />
                  <div className="absolute left-[57%] top-[49%] h-2 w-2 rounded-full bg-cyan-200 shadow-[0_0_24px_7px_rgba(34,211,238,.75)]" />
                  <div className="absolute left-[43%] top-[57%] h-2 w-2 rounded-full bg-cyan-200 shadow-[0_0_22px_6px_rgba(34,211,238,.7)]" />
                  <div className="rs-scan absolute left-0 top-0 h-1/3 w-full bg-gradient-to-b from-transparent via-cyan-300/10 to-transparent" />
                </div>

                <div className="rs-orbit-a absolute inset-[2%] rounded-full border border-cyan-300/25 [transform:rotateX(66deg) rotateY(-18deg)]" />
                <div className="rs-orbit-b absolute inset-[7%] rounded-full border border-sky-300/20 [transform:rotateX(68deg) rotateY(35deg)]" />
                <div className="rs-orbit-c absolute inset-[-2%] rounded-full border border-cyan-300/10 [transform:rotateX(72deg) rotateY(-42deg)]" />
                <div className="rs-orbit-a absolute inset-[18%] rounded-full border border-cyan-300/10 [transform:rotateX(70deg) rotateY(55deg)]" />

                {ORBIT_DOTS.map((dot, index) => (
                  <span key={index} className="rs-node absolute h-1.5 w-1.5 rounded-full bg-cyan-300" style={{ left: dot.left, top: dot.top, animationDelay: dot.delay }} />
                ))}

                <div className="absolute inset-0 overflow-hidden rounded-full pointer-events-none">
                  <span className="rs-flow absolute left-[-15%] top-[35%] h-px w-[45%] bg-gradient-to-r from-transparent via-cyan-300 to-transparent" />
                  <span className="rs-flow absolute left-[-20%] top-[58%] h-px w-[52%] bg-gradient-to-r from-transparent via-sky-300 to-transparent" style={{ animationDelay: '-2.1s' }} />
                  <span className="rs-flow absolute left-[-10%] top-[70%] h-px w-[38%] bg-gradient-to-r from-transparent via-cyan-200 to-transparent" style={{ animationDelay: '-3.4s' }} />
                </div>

                {nodes.map(([left, top, title, value], index) => (
                  <div key={title} className={`rs-float absolute hidden min-w-[150px] rounded-xl border border-cyan-300/20 bg-[rgba(2,8,18,.78)] px-3 py-2 shadow-[0_0_30px_rgba(8,145,178,.12)] backdrop-blur-xl md:block ${index % 2 ? 'text-right' : ''}`} style={{ left, top, animationDelay: `${-(index * .55)}s` }}>
                    <div className="font-mono text-[8px] tracking-[.16em] text-cyan-300">{title}</div>
                    <div className="mt-0.5 text-[10px] text-white/55">{value}</div>
                  </div>
                ))}

                <div className="absolute bottom-[9%] left-[18%] right-[5%] rounded-[1.6rem] border border-cyan-300/20 bg-[rgba(2,8,18,.78)] p-4 shadow-[0_20px_80px_rgba(0,0,0,.55)] backdrop-blur-2xl sm:p-5">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <span className="font-mono text-[9px] tracking-[.2em] text-cyan-300">GOVERNANCE AI · LIVE CONTROL PLANE</span>
                    <span className="flex items-center gap-1.5 font-mono text-[8px] text-emerald-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />LIVE MONITORING</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 py-4 sm:grid-cols-4">
                    {[
                      ['RISK SCORE', '87/100'],
                      ['EVIDENCE', '1,248'],
                      ['AI SYSTEMS', '04'],
                      ['POLICIES', '17'],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-white/10 bg-white/[.035] p-2.5">
                        <div className="font-mono text-[7px] tracking-wider text-white/35">{label}</div>
                        <div className="mt-1 text-base font-semibold text-white sm:text-xl">{value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-1.5 font-mono text-[8px] text-white/45 sm:grid-cols-2">
                    <StatusLine label="DSGVO / DATENSCHUTZ" status="PASS" />
                    <StatusLine label="EU AI ACT" status="READY" />
                    <StatusLine label="AI AGENTS" status="GOVERNED" />
                    <StatusLine label="WHATSAPP / VOICE" status="CONTROLLED" />
                    <StatusLine label="EVIDENCE CHAIN" status="VERIFIED" />
                    <StatusLine label="CONTINUOUS VERIFY" status="ACTIVE" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-40 mx-auto -mt-10 max-w-7xl px-6 lg:px-10">
            <div className="overflow-hidden rounded-2xl border border-cyan-300/10 bg-[rgba(2,8,18,.72)] backdrop-blur-xl">
              <div className="grid grid-cols-2 divide-x divide-white/10 sm:grid-cols-4 lg:grid-cols-6">
                <Metric value="87/100" label="RISK SCORE" />
                <Metric value="1,248" label="EVIDENCE EVENTS" />
                <Metric value="04" label="AI SYSTEMS" />
                <Metric value="17" label="ACTIVE POLICIES" />
                <Metric value="24/7" label="MONITORING" />
                <Metric value="EU" label="READY BY DESIGN" />
              </div>
            </div>
          </div>
        </section>

        <LandingChannelTools />

        <section id="platform" className="py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <div className="mb-12 max-w-3xl">
              <p className="font-mono text-[10px] tracking-[.25em] text-cyan-400">GOVERNANCE AI · THE CONTROL LAYER</p>
              <h2 className="mt-3 text-4xl tracking-tight sm:text-5xl" style={{ fontFamily: SERIF, fontWeight: 500 }}>Eine Runtime. <span className="text-cyan-400">Ihre Regeln. Ihre Kontrolle.</span></h2>
              <p className="mt-5 leading-relaxed text-white/55">Governance AI verbindet Discovery, Risk, Policies, Enforcement und Evidence zu einer operativen Kontrollschicht über Ihren bestehenden KI- und Geschäftsprozessen.</p>
            </div>
            <div className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-2 lg:grid-cols-3">
              {PLATFORM.map(([title, text]) => <div key={title} className="bg-[rgb(3,7,18)] p-7"><h3 className="text-base font-semibold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-white/50">{text}</p></div>)}
            </div>
          </div>
        </section>

        <section id="evidence" className="border-y border-white/10 bg-white/[.02] py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
              <div>
                <p className="font-mono text-[10px] tracking-[.25em] text-cyan-400">EVIDENCE &amp; TRUST</p>
                <h2 className="mt-3 text-4xl tracking-tight sm:text-5xl" style={{ fontFamily: SERIF, fontWeight: 500 }}>Compliance, die sich <span className="text-cyan-400">beweisen lässt.</span></h2>
                <p className="mt-5 leading-relaxed text-white/55">Governance AI macht aus laufenden System- und Prozessaktivitäten nachvollziehbare Evidence. Policies, Prüfungen, Entscheidungen und Änderungen bleiben in einem konsistenten Governance-Kontext.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TrustItem icon={ShieldCheck} title="DSGVO" text="Verarbeitung, Risiko, Policy und Evidence im laufenden Governance-Prozess." />
                <TrustItem icon={Lock} title="EU AI Act" text="Risikoklassifikation, Transparenz und Dokumentation für KI-Systeme." />
                <TrustItem icon={FileCheck2} title="Evidence Vault" text="Versionierte Nachweise und Audit-Trails statt statischer Behauptungen." />
                <TrustItem icon={Code2} title="Code & Agents" text="Technische Controls für Code, APIs und agentische Prozesse." />
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <div className="mb-12 max-w-3xl">
              <p className="font-mono text-[10px] tracking-[.25em] text-cyan-400">REALSYNC GOVERNANCE RUNTIME™</p>
              <h2 className="mt-3 text-4xl tracking-tight sm:text-5xl" style={{ fontFamily: SERIF, fontWeight: 500 }}>Von der KI-Nutzung zur <span className="text-cyan-400">kontrollierten KI-Organisation.</span></h2>
              <p className="mt-5 max-w-2xl leading-relaxed text-white/55">Ihre KI soll arbeiten. Governance AI sorgt dafür, dass sie innerhalb Ihrer Regeln arbeitet – und dass Sie es nachweisen können.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {GOVERNANCE_STEPS.map(([no, title, text]) => <div key={no} className="rounded-2xl border border-white/10 bg-white/[.02] p-7"><span className="font-mono text-3xl text-cyan-400/35">{no}</span><h3 className="mt-4 text-lg font-semibold tracking-wide">{title}</h3><p className="mt-2 text-sm leading-relaxed text-white/50">{text}</p></div>)}
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 bg-black py-20 md:py-28">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <p className="font-mono text-[10px] tracking-[.25em] text-cyan-400">GOVERNANCE AI BY REALSYNCDYNAMICS.AI</p>
            <h2 className="mt-4 text-4xl tracking-tight sm:text-6xl" style={{ fontFamily: SERIF, fontWeight: 500 }}>Ihre KI. Ihre Regeln. <span className="text-cyan-400">Ihr Nachweis.</span></h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/55">Sie behalten die Entscheidungshoheit. Governance AI schafft Transparenz, Kontrollierbarkeit, Policy Enforcement und nachvollziehbare Evidence über Ihre KI-gestützten Prozesse.</p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row"><Link to="/unified-entry/scan" className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-400 px-7 py-3.5 font-semibold text-[rgb(3,7,18)] transition hover:bg-cyan-300">Kostenlosen Audit starten <ArrowRight className="h-4 w-4" /></Link><Link to="/pricing" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-7 py-3.5 font-semibold text-white transition hover:border-white/40">Preise ansehen</Link></div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-xs text-white/40 sm:flex-row lg:px-10"><div><div className="font-semibold text-white/65">Governance AI by RealSyncDynamics.AI</div><span>© 2026 RealSync Dynamics.AI · Powered by RealSync Governance Runtime™</span></div><div className="flex gap-5"><Link to="/impressum">Impressum</Link><Link to="/datenschutz">Datenschutz</Link><Link to="/agb">AGB</Link></div></div>
      </footer>
    </div>
  );
}

function MiniPromise({ icon: Icon, title, text }: { icon: typeof ShieldCheck; title: string; text: string }) {
  return <div className="rounded-xl border border-white/8 bg-white/[.025] p-3"><Icon className="h-4 w-4 text-cyan-400" /><div className="mt-2 text-xs font-semibold">{title}</div><div className="mt-0.5 text-[10px] text-white/40">{text}</div></div>;
}

function StatusLine({ label, status }: { label: string; status: string }) {
  return <div className="flex items-center justify-between rounded-md border border-white/5 bg-white/[.02] px-2 py-1.5"><span>{label}</span><span className="text-cyan-300">{status}</span></div>;
}

function Metric({ value, label }: { value: string; label: string }) {
  return <div className="px-4 py-4 text-center sm:px-5"><div className="text-lg font-semibold text-white sm:text-xl">{value}</div><div className="mt-1 font-mono text-[8px] tracking-[.12em] text-white/35">{label}</div></div>;
}

function TrustItem({ icon: Icon, title, text }: { icon: typeof ShieldCheck; title: string; text: string }) {
  return <div className="rounded-2xl border border-white/10 bg-[rgb(3,7,18)] p-6"><Icon className="h-5 w-5 text-cyan-400" /><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-white/50">{text}</p></div>;
}
