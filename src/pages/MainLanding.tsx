import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  Code2,
  FileCheck2,
  FileBarChart3,
  Lock,
  Menu,
  Scan,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Vault,
  Workflow,
  X,
} from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { LandingChannelTools } from '../components/landing/LandingChannelTools';

const BG = 'rgb(3, 7, 18)';
const SANS = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";

const NAV = [
  ['Produkt', '#platform'],
  ['Automatisierung', '#tools'],
  ['Evidence', '#evidence'],
  ['AI Act', '#governance'],
  ['Sicherheit', '#security'],
] as const;

const PLATFORM = [
  ['Runtime Monitoring', 'Kontinuierliche Telemetrie über Websites, Datenflüsse und KI-Systeme.', Activity, '#governance'],
  ['Evidence Vault', 'Kryptografisch nachvollziehbare Nachweise, Snapshots und Audit-Trails.', Vault, '#evidence'],
  ['AI-Act-Klassifizierung', 'KI-Systeme strukturiert bewerten und relevante Anforderungen dokumentieren.', ShieldCheck, '#governance'],
  ['Policy Engine', 'Governance-Regeln nicht nur dokumentieren, sondern als Kontrolllogik ausführen.', Workflow, '#governance'],
  ['Auto-Remediation', 'Konkrete technische Fixes statt allgemeiner Warnungen und statischer PDFs.', Code2, '/claude-code-optimizer'],
  ['Continuous Governance', 'Drift erkennen, Risiken priorisieren und Abweichungen kontrolliert behandeln.', Scan, '#governance'],
] as const;

const GOVERNANCE = [
  ['01', 'DISCOVER', 'KI-Systeme, Anwendungen, Datenflüsse und relevante Verarbeitungsvorgänge erfassen.'],
  ['02', 'CLASSIFY', 'Risiken bewerten und Systeme gegen Governance-, DSGVO- und EU-AI-Act-Kriterien prüfen.'],
  ['03', 'ENFORCE', 'Policies und Controls operativ durchsetzen und Abweichungen kontrolliert behandeln.'],
  ['04', 'PROVE', 'Prüfungen, Entscheidungen, Änderungen und Kontrollen als Evidence nachvollziehbar sichern.'],
] as const;

const MODULES = [
  ['Website Compliance Scan', 'Domain prüfen, Findings erkennen und einen Governance-Report erzeugen.', Scan, '/unified-entry/scan'],
  ['Claude Code Optimizer', 'Code analysieren und Datenschutz-/Security-Findings technisch bearbeiten.', Code2, '/claude-code-optimizer'],
  ['Evidence Vault', 'Versionierte Nachweise und Audit-Trails aus demselben Governance-System.', Vault, '/evidence'],
  ['WhatsApp & Voice AI', 'Chat- und Telefonbots auf derselben Governance-Ebene betreiben.', Bot, '#tools'],
  ['AI Act Governance', 'Use Cases, Risiken, Controls und Dokumentation zentral steuern.', ShieldCheck, '/ai-act'],
  ['Automation', 'Scans, Alerts, Workflows und Remediation miteinander verbinden.', Workflow, '#tools'],
  ['Audit Reports', 'Management- und Audit-Berichte aus laufenden Governance-Daten erzeugen.', FileBarChart3, '#evidence'],
  ['Security & Trust', 'Governance, Security und Nachweisführung als eine operative Ebene.', Lock, '#security'],
] as const;

export function MainLanding() {
  const navigate = useNavigate();
  const [domain, setDomain] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);

  const startScan = (event: FormEvent) => {
    event.preventDefault();
    const value = domain.trim();
    navigate(value ? `/unified-entry/scan?domain=${encodeURIComponent(value)}` : '/unified-entry/scan');
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="landing-context min-h-screen overflow-x-hidden bg-[rgb(3,7,18)] text-white antialiased" style={{ backgroundColor: BG, fontFamily: SANS }}>
      <SEOHead
        title="RealSyncDynamics.AI — KI-Betriebssystem für DSGVO, EU AI Act & Code"
        description="Das KI-Betriebssystem für DSGVO, EU AI Act und Code-Compliance. Governance Runtime, Website Audit, Claude Code Optimizer, Evidence Vault, WhatsApp, Voice und Continuous Monitoring."
        canonical="/"
        ogTitle="Das KI-Betriebssystem für DSGVO, EU AI Act & Code-Compliance"
        ogDescription="Discover. Classify. Enforce. Prove. RealSyncDynamics.AI verbindet KI-Governance, Code-Compliance und auditfähige Evidence in einer Runtime."
      />

      <header className="absolute inset-x-0 top-0 z-50">
        <div className="mx-auto flex h-20 max-w-[1500px] items-center justify-between px-5 sm:px-8 lg:px-10">
          <Link to="/" onClick={closeMobile} className="flex shrink-0 items-center gap-2.5">
            <Snowflake className="h-7 w-7 text-cyan-400" strokeWidth={1.5} />
            <span className="text-base font-semibold tracking-tight sm:text-lg">RealSync <span className="font-normal text-white/75">Dynamics.AI</span></span>
          </Link>

          <nav className="hidden items-center gap-6 xl:flex">
            {NAV.map(([label, href]) => <a key={label} href={href} className="text-sm text-white/65 transition hover:text-white">{label}</a>)}
            <Link to="/pricing" className="text-sm text-white/65 transition hover:text-white">Preise</Link>
            <Link to="/welcome" className="text-sm text-white/65 transition hover:text-white">Login</Link>
            <Link to="/unified-entry/scan" className="rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-[rgb(3,7,18)] transition hover:bg-cyan-300">Kostenlos starten <ArrowRight className="ml-1 inline h-3.5 w-3.5" /></Link>
          </nav>

          <button type="button" onClick={() => setMobileOpen(value => !value)} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white xl:hidden" aria-label={mobileOpen ? 'Menü schließen' : 'Menü öffnen'}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="border-t border-white/10 bg-[rgb(3,7,18)]/95 px-5 py-5 backdrop-blur-xl xl:hidden">
            <nav className="flex flex-col gap-1">
              {NAV.map(([label, href]) => <a key={label} href={href} onClick={closeMobile} className="rounded-xl px-3 py-3 text-sm text-white/70 hover:bg-white/5 hover:text-white">{label}</a>)}
              <Link to="/pricing" onClick={closeMobile} className="rounded-xl px-3 py-3 text-sm text-white/70 hover:bg-white/5 hover:text-white">Preise</Link>
              <Link to="/welcome" onClick={closeMobile} className="rounded-xl px-3 py-3 text-sm text-white/70 hover:bg-white/5 hover:text-white">Login</Link>
              <Link to="/unified-entry/scan" onClick={closeMobile} className="mt-2 rounded-xl bg-cyan-400 px-4 py-3 text-center text-sm font-semibold text-[rgb(3,7,18)]">Kostenlosen Audit starten <ArrowRight className="ml-1 inline h-3.5 w-3.5" /></Link>
            </nav>
          </div>
        )}
      </header>

      <main>
        <section className="relative min-h-[850px] overflow-hidden border-b border-white/10">
          <div className="absolute inset-0">
            <picture>
              <source srcSet="/europe-globe.webp" type="image/webp" />
              <img src="/europe-globe.jpg" alt="Europa bei Nacht mit digitalen Datenströmen" width={1376} height={768} fetchPriority="high" className="h-full w-full object-cover object-right opacity-80" />
            </picture>
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/95 to-black/25" />
            <div className="absolute inset-0 bg-gradient-to-t from-[rgb(3,7,18)] via-transparent to-black/45" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_45%,rgba(34,211,238,.12),transparent_25%)]" />
          </div>

          <div className="relative z-10 mx-auto grid min-h-[850px] max-w-[1500px] items-center gap-8 px-5 pb-16 pt-28 sm:px-8 lg:grid-cols-[.92fr_1.08fr] lg:px-10 lg:pt-24">
            <div className="max-w-3xl">
              <Link to="/claude-code-optimizer" className="mb-7 inline-flex items-center gap-2 rounded-full border border-cyan-400/35 bg-cyan-400/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[.2em] text-cyan-200">
                <Sparkles className="h-3.5 w-3.5" /> NEU · CLAUDE CODE OPTIMIZER <ArrowRight className="h-3 w-3" />
              </Link>

              <h1 className="text-5xl leading-[.95] tracking-[-.04em] sm:text-6xl lg:text-[5.25rem]" style={{ fontFamily: SERIF, fontWeight: 500 }}>
                Das KI-Betriebssystem<br />für <span className="text-cyan-400">DSGVO, EU AI Act</span><br />&amp; Code-Compliance
              </h1>
              <p className="mt-6 font-mono text-[10px] uppercase tracking-[.22em] text-white/45 sm:text-xs">AI GOVERNANCE &amp; CODE OPTIMIZATION OS FOR TRUST &amp; VALUE</p>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/65 sm:text-lg">RealSyncDynamics.AI überwacht Websites, KI-Systeme, Code und Evidenz kontinuierlich — DSGVO-konform, EU-AI-Act-ready, Claude-Code-geprüft und auditierbar.</p>

              <div className="mt-6 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
                <MiniTrust title="DSGVO-KONFORM" text="Nachweise, Prozesse und Richtlinien." />
                <MiniTrust title="AI-ACT-READY" text="Risiko, Transparenz und Dokumentation." />
                <MiniTrust title="KONTINUIERLICH" text="Monitoring, Alerts & Evidence." />
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/unified-entry/scan" className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-400 px-7 py-3.5 font-semibold text-[rgb(3,7,18)] transition hover:bg-cyan-300">Kostenlosen Audit starten <ArrowRight className="h-4 w-4" /></Link>
                <a href="#tools" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 px-7 py-3.5 font-medium text-white transition hover:border-white/50 hover:bg-white/5">Live Tools ansehen</a>
              </div>

              <form onSubmit={startScan} className="mt-5 max-w-2xl">
                <div className="flex flex-col gap-2 rounded-2xl border border-white/15 bg-black/40 p-2 backdrop-blur-xl sm:flex-row">
                  <input value={domain} onChange={event => setDomain(event.target.value)} placeholder="Ihre Website für den kostenlosen Governance-Audit" aria-label="Website-URL für Governance-Scan" className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-white/30" />
                  <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[rgb(3,7,18)] transition hover:bg-cyan-50">Audit starten <ArrowRight className="h-4 w-4" /></button>
                </div>
                <p className="mt-2 text-[10px] text-white/35">URL genügt · kein Account vor dem Einstieg · Ergebnis nach dem Scan</p>
              </form>
            </div>

            <div className="relative hidden min-h-[620px] lg:block">
              <div className="absolute left-[5%] top-[8%] h-[72%] w-[72%] rounded-full bg-cyan-400/10 blur-3xl" />
              <div className="absolute left-[8%] top-[12%] h-[72%] w-[72%] rounded-full border border-cyan-200/20 bg-[radial-gradient(circle_at_32%_28%,#eefcff_0%,#43d6ff_7%,#126aa0_22%,#071a2b_55%,#02070d_78%)] shadow-[0_0_120px_rgba(32,211,238,.2)]" />
              <div className="absolute left-[18%] top-[27%] h-px w-[57%] rotate-[18deg] bg-cyan-300/70 shadow-[0_0_18px_rgba(34,211,238,.8)]" />
              <div className="absolute left-[29%] top-[45%] h-px w-[57%] -rotate-[28deg] bg-cyan-300/80 shadow-[0_0_18px_rgba(34,211,238,.8)]" />
              <div className="absolute left-[43%] top-[21%] h-2 w-2 rounded-full bg-cyan-200 shadow-[0_0_18px_8px_rgba(34,211,238,.45)]" />
              <div className="absolute left-[61%] top-[49%] h-2 w-2 rounded-full bg-cyan-200 shadow-[0_0_18px_8px_rgba(34,211,238,.45)]" />
              <div className="absolute left-[34%] top-[64%] h-2 w-2 rounded-full bg-cyan-200 shadow-[0_0_18px_8px_rgba(34,211,238,.45)]" />

              <MetricCard className="right-[0%] top-[14%]" label="RISK SCORE" value="87" suffix="/100" />
              <MetricCard className="left-[0%] top-[55%]" label="EVIDENCE" value="1,248" suffix="auditfähige Nachweise" icon={<Vault className="h-3.5 w-3.5 text-cyan-300" />} />
              <div className="absolute bottom-[7%] right-[0%] w-64 rounded-2xl border border-cyan-300/20 bg-black/55 p-4 shadow-2xl backdrop-blur-xl">
                <div className="font-mono text-[10px] tracking-widest text-cyan-300">CLAUDE CODE AUDIT</div>
                <div className="mt-1 text-3xl font-semibold">94.2%</div>
                <div className="text-xs text-white/45">Code-Ready</div>
                <div className="mt-3 border-t border-white/10 pt-3 text-[10px] text-white/40">2.1 Mio. Zeilen · 11,350 Fixes</div>
              </div>
              <div className="absolute bottom-[0%] left-[18%] flex items-center gap-3 rounded-xl border border-white/15 bg-black/55 px-4 py-3 backdrop-blur-xl"><Activity className="h-5 w-5 text-cyan-300" /><div><div className="font-mono text-[9px] tracking-widest text-white/40">MONITORING</div><div className="text-sm">LIVE</div></div></div>
            </div>
          </div>

          <div className="mx-auto max-w-[1500px] px-5 pb-6 sm:px-8 lg:px-10">
            <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-white/10 pt-5 font-mono text-[10px] uppercase tracking-[.15em] text-white/35"><span>DSGVO Art. 32</span><span>EU AI Act</span><span>TDDDG</span><span>NIS2</span><span>EU Hosting</span></div>
          </div>
        </section>

        <LandingChannelTools />

        <section id="tools" className="border-y border-white/10 bg-white/[.02] py-20 md:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <p className="font-mono text-[10px] tracking-[.25em] text-cyan-400">ONE OPERATING SYSTEM</p>
            <h2 className="mt-3 max-w-3xl text-4xl tracking-tight sm:text-5xl" style={{ fontFamily: SERIF, fontWeight: 500 }}>Unsere Elemente — <span className="text-cyan-400">verbunden statt verteilt.</span></h2>
            <p className="mt-5 max-w-3xl text-white/55">Audit, Code, Bots, Automation und Evidence laufen nicht als isolierte Produkte. Sie hängen an derselben Governance-Ebene.</p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {MODULES.map(([title, text, Icon, to]) => (
                <Link key={title} to={to} className="group">
                  <div className="h-full rounded-2xl border border-white/10 bg-[rgb(5,12,22)] p-5 transition duration-200 group-hover:-translate-y-1 group-hover:border-cyan-300/30 group-hover:bg-[rgb(7,18,30)]">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/5 text-cyan-300"><Icon className="h-5 w-5" /></span>
                    <h3 className="mt-5 text-sm font-semibold">{title}</h3><p className="mt-2 text-xs leading-relaxed text-white/45">{text}</p>
                    <span className="mt-4 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-cyan-300 opacity-0 transition group-hover:opacity-100">Öffnen <ArrowRight className="h-3 w-3" /></span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="platform" className="py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="mb-12 max-w-3xl"><p className="font-mono text-[10px] tracking-[.25em] text-cyan-400">DIE PLATTFORM</p><h2 className="mt-3 text-4xl tracking-tight sm:text-5xl" style={{ fontFamily: SERIF, fontWeight: 500 }}>Eine Runtime. <span className="text-cyan-400">Vollständige KI-Governance.</span></h2><p className="mt-5 leading-relaxed text-white/55">RealSyncDynamics.AI verbindet Erkennung, Risikobewertung, Policies, Enforcement und Evidence zu einem durchgängigen operativen Kontrollprozess.</p></div>
            <div className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-2 lg:grid-cols-3">
              {PLATFORM.map(([title, text, Icon, to]) => <Link key={title} to={to} className="group bg-[rgb(3,7,18)] p-7 transition hover:bg-white/[.025]"><Icon className="h-5 w-5 text-cyan-300" /><h3 className="mt-5 text-base font-semibold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-white/45">{text}</p></Link>)}
            </div>
          </div>
        </section>

        <section id="evidence" className="border-y border-white/10 bg-white/[.02] py-20 md:py-28">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[.8fr_1.2fr] lg:px-10 lg:items-end">
            <div><p className="font-mono text-[10px] tracking-[.25em] text-cyan-400">EVIDENCE &amp; TRUST</p><h2 className="mt-3 text-4xl tracking-tight sm:text-5xl" style={{ fontFamily: SERIF, fontWeight: 500 }}>Compliance, die sich <span className="text-cyan-400">beweisen lässt.</span></h2><p className="mt-5 leading-relaxed text-white/55">PDFs, Logs, Zeitstempel, Evidence Vault und nachvollziehbare Prüfpfade. Auch Bot- und Voice-Prozesse können in die Governance-Historie eingebunden werden.</p></div>
            <div className="grid gap-3 sm:grid-cols-2"><TrustItem icon={ShieldCheck} title="DSGVO" text="Verarbeitung, Risiko, Policy und Evidence im laufenden Prozess." /><TrustItem icon={Lock} title="EU AI Act" text="Risikoklassifikation, Transparenz und Dokumentation für KI-Systeme." /><TrustItem icon={FileCheck2} title="Evidence Vault" text="Versionierte Nachweise und Audit-Trails statt statischer Behauptungen." /><TrustItem icon={Code2} title="Code Compliance" text="Claude Code unterstützt konkrete technische Remediation." /></div>
          </div>
        </section>

        <section id="governance" className="py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10"><p className="font-mono text-[10px] tracking-[.25em] text-cyan-400">GOVERNANCE RUNTIME</p><h2 className="mt-3 max-w-4xl text-4xl tracking-tight sm:text-5xl" style={{ fontFamily: SERIF, fontWeight: 500 }}>Discover → Classify → Enforce → <span className="text-cyan-400">Prove.</span></h2><p className="mt-5 max-w-3xl text-white/55">Governance läuft nicht nur in Dokumenten. Sie wird als operativer Prozess ausgeführt und bleibt nachvollziehbar.</p><div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-4">{GOVERNANCE.map(([no,title,text])=><div key={no} className="bg-[rgb(5,12,22)] p-6"><div className="font-mono text-[10px] text-cyan-300">{no}</div><h3 className="mt-3 text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-white/45">{text}</p></div>)}</div></div>
        </section>

        <section id="security" className="border-t border-white/10 bg-black py-20 md:py-24">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 sm:px-8 lg:grid-cols-2 lg:px-10"><div><p className="font-mono text-[10px] tracking-[.25em] text-cyan-400">SECURITY &amp; SOVEREIGNTY</p><h2 className="mt-3 text-4xl tracking-tight sm:text-5xl" style={{ fontFamily: SERIF, fontWeight: 500 }}>Vom Snapshot zum <span className="text-cyan-400">laufenden Governance-System.</span></h2><p className="mt-5 max-w-2xl leading-relaxed text-white/55">EU-orientierte Architektur, nachvollziehbare Evidence und kontinuierliche Kontrolle statt einzelner Compliance-Checklisten.</p></div><div className="grid gap-4 sm:grid-cols-2"><TrustItem icon={Lock} title="EU-Souveränität" text="Datenresidenz und Secret-Isolation als Architekturprinzip." /><TrustItem icon={Vault} title="Kryptografische Evidence" text="Hash-Chain, Signatur und Audit-Export für nachvollziehbare Nachweise." /><TrustItem icon={ShieldCheck} title="Governance Runtime" text="Policies werden zur Laufzeit bewertet und nicht nur dokumentiert." /><TrustItem icon={FileBarChart3} title="Audit-ready" text="Reports und Evidence aus demselben operativen System." /></div></div>
        </section>

        <section className="relative overflow-hidden border-t border-white/10 py-20 md:py-28"><div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(34,211,238,.12),transparent_45%)]" /><div className="mx-auto max-w-4xl px-5 text-center sm:px-8"><p className="font-mono text-[10px] tracking-[.25em] text-cyan-400">ONE GOVERNANCE PLANE</p><h2 className="mt-4 text-4xl tracking-tight sm:text-6xl" style={{ fontFamily: SERIF, fontWeight: 500 }}>Governance statt Checkliste.</h2><p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/55">Compliance statt Selbstauskunft. Evidence statt Behauptung. Enforcement statt Empfehlung.</p><div className="mt-8 flex flex-wrap justify-center gap-3 text-xs text-white/45"><span className="rounded-full border border-white/10 px-4 py-2">DSGVO</span><span className="rounded-full border border-white/10 px-4 py-2">EU AI Act</span><span className="rounded-full border border-white/10 px-4 py-2">WhatsApp Bot</span><span className="rounded-full border border-white/10 px-4 py-2">Telefonbot</span><span className="rounded-full border border-white/10 px-4 py-2">Claude Code</span><span className="rounded-full border border-white/10 px-4 py-2">Evidence Vault</span></div><div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row"><Link to="/unified-entry/scan" className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-400 px-7 py-3.5 font-semibold text-[rgb(3,7,18)] transition hover:bg-cyan-300">Free Audit starten <ArrowRight className="h-4 w-4" /></Link><Link to="/pricing" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-7 py-3.5 font-semibold text-white transition hover:border-white/40">Preise ansehen</Link></div><p className="mt-5 text-[10px] text-white/30">Self-Service · kein Verkaufsgespräch für den ersten Audit-Einstieg nötig</p></div></section>
      </main>
    </div>
  );
}

function MiniTrust({ title, text }: { title: string; text: string }) {
  return <div className="border-l border-cyan-400/40 pl-3"><div className="font-mono text-[10px] font-bold tracking-[.16em] text-cyan-300">{title}</div><div className="mt-1 text-xs text-white/40">{text}</div></div>;
}

function MetricCard({ className, label, value, suffix, icon }: { className: string; label: string; value: string; suffix?: string; icon?: React.ReactNode }) {
  return <div className={`absolute w-48 rounded-2xl border border-white/15 bg-black/55 p-4 shadow-2xl backdrop-blur-xl ${className}`}><div className="flex items-center gap-2 font-mono text-[10px] tracking-widest text-white/40">{icon}{label}</div><div className="mt-2 text-3xl font-semibold">{value}<span className="ml-1 text-xs font-normal text-white/35">{suffix}</span></div></div>;
}

function TrustItem({ icon: Icon, title, text }: { icon: typeof Lock; title: string; text: string }) {
  return <div className="rounded-2xl border border-white/10 bg-[rgb(5,12,22)] p-5"><Icon className="h-5 w-5 text-cyan-300" /><h3 className="mt-4 text-sm font-semibold">{title}</h3><p className="mt-2 text-xs leading-relaxed text-white/45">{text}</p><CheckCircle2 className="mt-4 h-4 w-4 text-cyan-400/60" /></div>;
}
