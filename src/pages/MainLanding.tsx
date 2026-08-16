import { FormEvent, useState } from 'react';
import { ArrowRight, Code2, FileCheck2, Lock, ShieldCheck, Activity } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import GovernanceHero from '../components/governance-frontend/GovernanceHero';
import { LandingChannelTools } from '../components/landing/LandingChannelTools';

const SERIF = "Georgia, 'Times New Roman', serif";
const PLATFORM = [
  ['Runtime Monitoring','Kontinuierliche Telemetrie über Websites, Datenflüsse, KI-Systeme und Agents.'],
  ['Evidence Vault','Nachweise, Snapshots und Audit-Trails für relevante Governance-Ereignisse.'],
  ['AI-Act-Klassifizierung','KI-Systeme strukturiert bewerten und Anforderungen dokumentieren.'],
  ['Policy Engine','Ihre Governance-Regeln als ausführbare Kontrolllogik.'],
  ['AI Agent Governance','Identität, Kontext, Policy, Aktion und Evidence für Agents.'],
  ['Continuous Verification','Drift erkennen und den Governance-Zustand laufend verifizieren.'],
];
const STEPS = [
  ['01','DISCOVER','KI-Systeme, Agents, Websites, APIs und Datenflüsse erfassen.'],
  ['02','ASSESS','Risiken gegen DSGVO, EU AI Act und Ihre Policies bewerten.'],
  ['03','GOVERN','Regeln und Kontrollgrenzen operationalisieren.'],
  ['04','EVIDENCE','Entscheidungen, Prüfungen und Änderungen nachvollziehbar sichern.'],
  ['05','VERIFY','Governance-Zustand kontinuierlich auf Drift prüfen.'],
];

export function MainLanding() {
  const navigate = useNavigate();
  const [domain,setDomain] = useState('');
  const startScan=(e:FormEvent)=>{e.preventDefault();const d=domain.trim();navigate(d?`/unified-entry/scan?domain=${encodeURIComponent(d)}`:'/unified-entry/scan');};
  return <div className="min-h-screen bg-[#02060d] text-white antialiased">
    <SEOHead title="Governance AI by RealSyncDynamics.AI — DSGVO & EU AI Act" description="Governance AI by RealSyncDynamics.AI ist die Control Layer für KI-gestützte Geschäftsprozesse: DSGVO, EU AI Act, Policies, Monitoring und Evidence." canonical="/" ogTitle="Ihre Prozesse bleiben Ihre. Ihre KI wird EU-ready." ogDescription="Ihre KI. Ihre Regeln. Ihr Nachweis. Governance AI by RealSyncDynamics.AI." />
    <GovernanceHero />
    <section id="intro" className="border-y border-white/10 bg-[#030811] py-20 md:py-28"><div className="mx-auto max-w-7xl px-6 lg:px-10"><p className="font-mono text-[10px] tracking-[.25em] text-cyan-400">GOVERNANCE AI · RUNTIME</p><h2 className="mt-3 text-4xl tracking-tight sm:text-5xl" style={{fontFamily:SERIF,fontWeight:500}}>Ihre KI arbeitet. <span className="text-cyan-400">Sie behalten die Kontrolle.</span></h2><p className="mt-5 max-w-3xl text-white/55">Die RealSync Governance Runtime legt eine technische Kontroll- und Nachweisschicht über Ihre bestehenden Systeme. Sie ersetzt Ihre Infrastruktur nicht.</p><div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-5">{STEPS.map(([n,t,d])=><div key={t} className="bg-[#02060d] p-6"><div className="font-mono text-[9px] text-cyan-400">{n}</div><h3 className="mt-3 text-sm font-semibold tracking-wide">{t}</h3><p className="mt-2 text-xs leading-relaxed text-white/45">{d}</p></div>)}</div></div></section>
    <LandingChannelTools />
    <section id="platform" className="py-20 md:py-28"><div className="mx-auto max-w-7xl px-6 lg:px-10"><p className="font-mono text-[10px] tracking-[.25em] text-cyan-400">THE CONTROL LAYER</p><h2 className="mt-3 text-4xl tracking-tight sm:text-5xl" style={{fontFamily:SERIF,fontWeight:500}}>Eine Runtime. <span className="text-cyan-400">Ihre Regeln.</span></h2><p className="mt-5 max-w-3xl text-white/55">Policy Engine, Risk Engine, Agent Governance, Continuous Monitoring und Evidence arbeiten als eine operative Governance-Ebene.</p><div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-2 lg:grid-cols-3">{PLATFORM.map(([t,d])=><div key={t} className="bg-[#02060d] p-7"><h3 className="text-base font-semibold">{t}</h3><p className="mt-2 text-sm leading-relaxed text-white/45">{d}</p></div>)}</div></div></section>
    <section id="evidence" className="border-y border-white/10 bg-white/[.02] py-20 md:py-28"><div className="mx-auto max-w-7xl px-6 lg:px-10"><div className="grid gap-8 lg:grid-cols-[.9fr_1.1fr] lg:items-center"><div><p className="font-mono text-[10px] tracking-[.25em] text-cyan-400">EVIDENCE & TRUST</p><h2 className="mt-3 text-4xl tracking-tight sm:text-5xl" style={{fontFamily:SERIF,fontWeight:500}}>Compliance, die sich <span className="text-cyan-400">beweisen lässt.</span></h2><p className="mt-5 text-white/55">Events, Policies, Evaluations, Entscheidungen und Nachweise bleiben in einem nachvollziehbaren Governance-Kontext.</p></div><div className="grid gap-3 sm:grid-cols-2">{[["DSGVO",ShieldCheck,"Verarbeitung, Risiko, Policy und Evidence."],["EU AI Act",Lock,"Klassifikation, Transparenz und Dokumentation."],["Evidence Vault",FileCheck2,"Versionierte Nachweise und Audit-Trails."],["Continuous Monitoring",Activity,"Drift erkennen und Governance verifizieren."]].map(([t,I,d])=>{const Icon=I as typeof ShieldCheck;return <div key={t as string} className="rounded-2xl border border-white/10 bg-black/20 p-6"><Icon className="h-5 w-5 text-cyan-300"/><h3 className="mt-4 font-semibold">{t as string}</h3><p className="mt-2 text-sm leading-relaxed text-white/45">{d as string}</p></div>})}</div></div></div></section>
    <section className="py-20 md:py-28"><div className="mx-auto max-w-5xl px-6 text-center"><p className="font-mono text-[10px] tracking-[.25em] text-cyan-400">FREE GOVERNANCE AUDIT</p><h2 className="mt-4 text-4xl tracking-tight sm:text-6xl" style={{fontFamily:SERIF,fontWeight:500}}>Wie governable ist Ihr Unternehmen?</h2><p className="mx-auto mt-5 max-w-2xl text-white/50">Starten Sie mit einer Website. RealSync zeigt Governance-, Datenschutz-, AI- und technische Signale.</p><form onSubmit={startScan} className="mx-auto mt-8 flex max-w-2xl flex-col gap-2 rounded-2xl border border-white/15 bg-black/30 p-2 sm:flex-row"><input value={domain} onChange={e=>setDomain(e.target.value)} placeholder="Ihre Website" aria-label="Website für Governance Audit" className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-white/25"/><button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-[#02060d]">Audit starten <ArrowRight size={16}/></button></form></div></section>

    {/* Pflichtangaben: § 5 DDG verlangt das Impressum "leicht erkennbar und
        unmittelbar erreichbar" — die Startseite braucht den Link deshalb selbst,
        es gibt kein globales Footer-Layout um <Route path="/">. Der Testkatalog
        haelt das als FE-004 fest (tests/e2e/navigation.spec.ts). */}
    <footer className="border-t border-white/10 py-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-xs text-white/40 sm:flex-row lg:px-10">
        <div>
          <div className="font-semibold text-white/65">Governance AI by RealSyncDynamics.AI</div>
          <span>© 2026 RealSync Dynamics.AI · Powered by RealSync Governance Runtime™</span>
        </div>
        <nav className="flex flex-wrap justify-center gap-5" aria-label="Rechtliches">
          <Link to="/impressum" className="hover:text-white">Impressum</Link>
          <Link to="/datenschutz" className="hover:text-white">Datenschutz</Link>
          <Link to="/agb" className="hover:text-white">AGB</Link>
          <Link to="/sicherheit" className="hover:text-white">Sicherheit</Link>
        </nav>
      </div>
    </footer>
  </div>;
}
