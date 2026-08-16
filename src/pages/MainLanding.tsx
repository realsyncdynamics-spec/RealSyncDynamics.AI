import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Code2, FileCheck2, Lock, Scan, ShieldCheck, Snowflake } from 'lucide-react';
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

export function MainLanding() {
  const navigate = useNavigate();
  const [domain, setDomain] = useState('');

  const startScan = (event: FormEvent) => {
    event.preventDefault();
    const value = domain.trim();
    navigate(value ? `/unified-entry/scan?domain=${encodeURIComponent(value)}` : '/unified-entry/scan');
  };

  return (
    <div className="landing-context min-h-screen bg-[rgb(3,7,18)] text-white antialiased" style={{ backgroundColor: BG, fontFamily: SANS }}>
      <SEOHead
        title="Governance AI by RealSyncDynamics.AI — DSGVO & EU AI Act"
        description="Governance AI by RealSyncDynamics.AI macht KI-gestützte Geschäftsprozesse kontrollierbar, nachvollziehbar und EU-ready – mit DSGVO, EU AI Act, Policies, Continuous Monitoring und Evidence in einer Governance Runtime."
        canonical="/"
        ogTitle="Ihre Prozesse bleiben Ihre. Ihre KI wird EU-ready."
        ogDescription="Governance AI by RealSyncDynamics.AI verbindet Policies, Risk, DSGVO, EU AI Act, AI Agents und Evidence in einer kontinuierlichen Governance Runtime."
      />

      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-10">
          <Link to="/" className="flex items-center gap-2.5">
            <Snowflake className="h-6 w-6 text-cyan-400" strokeWidth={1.5} />
            <span className="text-base font-semibold tracking-tight sm:text-lg">RealSync <span className="font-normal text-white/80">Dynamics.AI</span></span>
          </Link>
          <nav className="hidden items-center gap-7 md:flex">
            <a href="#tools" className="text-sm text-white/65 transition-colors hover:text-white">Tools</a>
            <a href="#platform" className="text-sm text-white/65 transition-colors hover:text-white">Produkt</a>
            <a href="#evidence" className="text-sm text-white/65 transition-colors hover:text-white">Evidence</a>
            <Link to="/pricing" className="text-sm text-white/65 transition-colors hover:text-white">Preise</Link>
            <Link to="/welcome" className="text-sm text-white/65 transition-colors hover:text-white">Login</Link>
            <Link to="/unified-entry/scan" className="rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-[rgb(3,7,18)] transition hover:bg-cyan-300">Kostenlosen Audit starten</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative min-h-[820px] overflow-hidden">
          <div className="absolute inset-0">
            <picture>
              <source srcSet="/europe-globe.webp" type="image/webp" />
              <img src="/europe-globe.jpg" alt="Europa bei Nacht mit digitalen KI- und Datenverbindungen" width={1376} height={768} fetchPriority="high" className="h-full w-full object-cover object-right opacity-90" />
            </picture>
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/90 to-black/15" />
            <div className="absolute inset-0 bg-gradient-to-t from-[rgb(3,7,18)] via-transparent to-black/30" />
          </div>

          <div className="relative z-10 mx-auto grid min-h-[820px] max-w-7xl items-center gap-10 px-6 pb-20 pt-28 lg:grid-cols-[.9fr_1.1fr] lg:px-10">
            <div className="max-w-3xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[.2em] text-cyan-300">
                <Scan className="h-3.5 w-3.5" /> Governance AI · by RealSyncDynamics.AI
              </div>

              <div className="mb-5 font-mono text-[10px] uppercase tracking-[.22em] text-white/45">REALSYNC GOVERNANCE RUNTIME™</div>

              <h1 className="text-5xl leading-[.98] tracking-[-.035em] sm:text-6xl lg:text-8xl" style={{ fontFamily: SERIF, fontWeight: 500 }}>
                Ihre Prozesse bleiben Ihre.<br />
                <span className="text-cyan-400">Ihre KI wird EU-ready.</span>
              </h1>

              <p className="mt-7 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
                Governance AI by RealSyncDynamics.AI macht KI-gestützte Geschäftsprozesse kontrollierbar, nachvollziehbar und EU-ready – für DSGVO, EU AI Act und Ihre eigenen Unternehmensregeln.
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/50 sm:text-base">
                Ihre Systeme bleiben bestehen. Die Governance Runtime legt eine technische Kontrollschicht darüber, prüft Prozesse kontinuierlich und erzeugt belastbare Evidence.
              </p>

              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/55">
                <span>✓ DSGVO</span>
                <span>✓ EU AI Act</span>
                <span>✓ AI Agents</span>
                <span>✓ Continuous Monitoring</span>
                <span>✓ Audit Evidence</span>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/unified-entry/scan" className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-7 py-3.5 font-semibold text-[rgb(3,7,18)] transition hover:bg-cyan-300">
                  Kostenlosen Audit starten <ArrowRight className="h-4 w-4" />
                </Link>
                <a href="#platform" className="inline-flex items-center gap-2 rounded-full border border-white/25 px-7 py-3.5 font-medium text-white transition hover:border-white/50 hover:bg-white/5">
                  Governance Runtime ansehen
                </a>
              </div>

              <form onSubmit={startScan} className="mt-5 max-w-2xl">
                <div className="flex flex-col gap-2 rounded-2xl border border-white/15 bg-black/35 p-2 backdrop-blur-xl sm:flex-row">
                  <input value={domain} onChange={event => setDomain(event.target.value)} placeholder="Ihre Website für den kostenlosen Governance-Audit" aria-label="Website-URL für Governance-Scan" className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-white/30" />
                  <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[rgb(3,7,18)] transition hover:bg-cyan-50">
                    Audit starten <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-2 text-[10px] text-white/35">URL genügt · kein Account vor dem Einstieg · Ergebnis in wenigen Minuten</p>
              </form>
            </div>

            <div className="hidden lg:block">
              <div className="ml-auto max-w-xl rounded-[2rem] border border-cyan-400/20 bg-black/45 p-5 shadow-2xl shadow-cyan-950/40 backdrop-blur-xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <span className="font-mono text-[10px] tracking-[.22em] text-cyan-300">GOVERNANCE AI · LIVE CONTROL PLANE</span>
                  <span className="flex items-center gap-2 text-[10px] text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />LIVE</span>
                </div>
                <div className="grid grid-cols-2 gap-3 py-5 sm:grid-cols-4">
                  {[
                    ['RISK SCORE', '87/100'],
                    ['EVIDENCE', '1,248'],
                    ['AI SYSTEMS', '04'],
                    ['POLICIES', '17'],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-white/10 bg-white/[.035] p-3">
                      <div className="font-mono text-[8px] tracking-wider text-white/35">{label}</div>
                      <div className="mt-2 text-xl font-semibold text-white">{value}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-2.5 font-mono text-[10px] text-white/45">
                  <div className="flex justify-between"><span>DSGVO / DATENSCHUTZ</span><span className="text-emerald-300">PASS</span></div>
                  <div className="flex justify-between"><span>EU AI ACT</span><span className="text-emerald-300">READY</span></div>
                  <div className="flex justify-between"><span>AI AGENTS</span><span className="text-cyan-300">GOVERNED</span></div>
                  <div className="flex justify-between"><span>WHATSAPP / VOICE</span><span className="text-cyan-300">CONTROLLED</span></div>
                  <div className="flex justify-between"><span>EVIDENCE CHAIN</span><span className="text-cyan-300">VERIFIED</span></div>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 font-mono text-[9px] tracking-[.15em] text-white/45">
                  <span>DISCOVER</span><span>→</span><span>ASSESS</span><span>→</span><span>GOVERN</span><span>→</span><span>EVIDENCE</span><span>→</span><span>VERIFY</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <LandingChannelTools />

        <section id="platform" className="py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <div className="mb-12 max-w-3xl">
              <p className="font-mono text-[10px] tracking-[.25em] text-cyan-400">GOVERNANCE AI · THE CONTROL LAYER</p>
              <h2 className="mt-3 text-4xl tracking-tight sm:text-5xl" style={{ fontFamily: SERIF, fontWeight: 500 }}>
                Eine Runtime. <span className="text-cyan-400">Ihre Regeln. Ihre Kontrolle.</span>
              </h2>
              <p className="mt-5 leading-relaxed text-white/55">
                Governance AI verbindet Discovery, Risk, Policies, Enforcement und Evidence zu einer operativen Kontrollschicht über Ihren bestehenden KI- und Geschäftsprozessen.
              </p>
            </div>
            <div className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-2 lg:grid-cols-3">
              {PLATFORM.map(([title, text]) => (
                <div key={title} className="bg-[rgb(3,7,18)] p-7">
                  <h3 className="text-base font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/50">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="evidence" className="border-y border-white/10 bg-white/[.02] py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
              <div>
                <p className="font-mono text-[10px] tracking-[.25em] text-cyan-400">EVIDENCE &amp; TRUST</p>
                <h2 className="mt-3 text-4xl tracking-tight sm:text-5xl" style={{ fontFamily: SERIF, fontWeight: 500 }}>
                  Compliance, die sich <span className="text-cyan-400">beweisen lässt.</span>
                </h2>
                <p className="mt-5 leading-relaxed text-white/55">
                  Governance AI macht aus laufenden System- und Prozessaktivitäten nachvollziehbare Evidence. Policies, Prüfungen, Entscheidungen und Änderungen bleiben in einem konsistenten Governance-Kontext.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TrustItem icon={ShieldCheck} title="DSGVO" text="Verarbeitung, Risiko, Policy und Evidence im laufenden Governance-Prozess." />
                <TrustItem icon={Lock} title="EU AI Act" text="Risikoklassifikation, Transparenz und Dokumentation für KI-Systeme." />
                <TrustItem icon={FileCheck2} title="Evidence Vault" text="Versionierte Nachweise und Audit-Trails statt statischer Behauptungen." />
                <TrustItem icon={Code2} title="Code &amp; Agents" text="Technische Controls für Code, APIs und agentische Prozesse." />
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <div className="mb-12 max-w-3xl">
              <p className="font-mono text-[10px] tracking-[.25em] text-cyan-400">REALSYNC GOVERNANCE RUNTIME™</p>
              <h2 className="mt-3 text-4xl tracking-tight sm:text-5xl" style={{ fontFamily: SERIF, fontWeight: 500 }}>
                Von der KI-Nutzung zur <span className="text-cyan-400">kontrollierten KI-Organisation.</span>
              </h2>
              <p className="mt-5 max-w-2xl leading-relaxed text-white/55">
                Ihre KI soll arbeiten. Governance AI sorgt dafür, dass sie innerhalb Ihrer Regeln arbeitet – und dass Sie es nachweisen können.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {GOVERNANCE_STEPS.map(([no, title, text]) => (
                <div key={no} className="rounded-2xl border border-white/10 bg-white/[.02] p-7">
                  <span className="font-mono text-3xl text-cyan-400/35">{no}</span>
                  <h3 className="mt-4 text-lg font-semibold tracking-wide">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/50">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 bg-black py-20 md:py-28">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <p className="font-mono text-[10px] tracking-[.25em] text-cyan-400">GOVERNANCE AI BY REALSYNCDYNAMICS.AI</p>
            <h2 className="mt-4 text-4xl tracking-tight sm:text-6xl" style={{ fontFamily: SERIF, fontWeight: 500 }}>
              Ihre KI. Ihre Regeln. <span className="text-cyan-400">Ihr Nachweis.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/55">
              Sie behalten die Entscheidungshoheit. Governance AI schafft Transparenz, Kontrollierbarkeit, Policy Enforcement und nachvollziehbare Evidence über Ihre KI-gestützten Prozesse.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 text-xs text-white/50">
              {['DSGVO', 'EU AI Act', 'AI Agents', 'WhatsApp', 'Voice', 'Code & APIs', 'Evidence Vault'].map(item => (
                <span key={item} className="rounded-full border border-white/10 px-4 py-2">{item}</span>
              ))}
            </div>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/unified-entry/scan" className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-400 px-7 py-3.5 font-semibold text-[rgb(3,7,18)] transition hover:bg-cyan-300">
                Kostenlosen Audit starten <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/pricing" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-7 py-3.5 font-semibold text-white transition hover:border-white/40">
                Preise ansehen
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-xs text-white/40 sm:flex-row lg:px-10">
          <div>
            <div className="font-semibold text-white/65">Governance AI by RealSyncDynamics.AI</div>
            <span>© 2026 RealSync Dynamics.AI · Powered by RealSync Governance Runtime™</span>
          </div>
          <div className="flex gap-5"><Link to="/impressum">Impressum</Link><Link to="/datenschutz">Datenschutz</Link><Link to="/agb">AGB</Link></div>
        </div>
      </footer>
    </div>
  );
}

function TrustItem({ icon: Icon, title, text }: { icon: typeof ShieldCheck; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[rgb(3,7,18)] p-6">
      <Icon className="h-5 w-5 text-cyan-400" />
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/50">{text}</p>
    </div>
  );
}
