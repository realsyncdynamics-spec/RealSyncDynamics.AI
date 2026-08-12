import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, FileCheck2, Globe2, Play, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { AiGovernanceDashboard } from '../features/ai-governance/AiGovernanceDashboard';
import { RuntimeDashboard } from '../features/ai-governance/RuntimeDashboard';
import { BrowserExtensionSection } from '../components/sections/BrowserExtensionSection';
import { PolicyEngineSection } from '../components/sections/PolicyEngineSection';
import { EnterpriseEvidenceVaultSection } from '../components/sections/EnterpriseEvidenceVaultSection';
import { AgentConnectorsSection } from '../components/sections/AgentConnectorsSection';

const SUGGESTIONS = [
  'Prüfe meinen AI Act Compliance Status.',
  'Analysiere meinen Chatbot auf DSGVO-Risiken.',
  'Erstelle eine Risikobewertung für mein AI-System.',
  'Bereite mich auf ein ISO-42001-Audit vor.',
];

const WORK_STAGES = [
  ['RESEARCH', 'Kontext, Systeme und Quellen ermitteln'],
  ['ANALYZE', 'Risiken und Anforderungen bewerten'],
  ['EXECUTE', 'Freigegebene Maßnahmen durchführen'],
  ['VERIFY', 'Ergebnis erneut prüfen'],
  ['PROVE', 'Evidence und Prüfpfad erzeugen'],
] as const;

export function AiGovernancePage() {
  const [prompt, setPrompt] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [mode, setMode] = useState<'Auto' | 'Research' | 'Execute'>('Auto');

  const intent = useMemo(() => {
    const value = prompt.toLowerCase();
    if (value.includes('ai act') || value.includes('ki-verordnung')) return 'EU AI Act';
    if (value.includes('dsgvo') || value.includes('datenschutz')) return 'DSGVO';
    if (value.includes('iso')) return 'ISO 42001';
    if (value.includes('website') || value.includes('browser')) return 'Browser / Web';
    return 'Governance';
  }, [prompt]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!prompt.trim()) return;
    setSubmitted(true);
  }

  return (
    <main className="min-h-screen bg-[rgb(3,7,18)] text-white antialiased">
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 text-sm font-semibold">
            <ShieldCheck className="h-5 w-5 text-cyan-300" />
            Governance AI
            <span className="text-xs font-normal text-white/30">by RealSyncDynamics.AI</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/ai-act-faq" className="hidden text-xs text-white/45 hover:text-white sm:block">EU AI Act</Link>
            <Link to="/welcome" className="text-xs text-white/45 hover:text-white">Login</Link>
            <Link to="/contact-sales?intent=ai-governance" className="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-3.5 py-2 text-xs font-semibold text-[rgb(3,7,18)] hover:bg-cyan-300">Starten <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-14 pt-14 sm:px-6 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="font-mono text-[10px] uppercase tracking-[.24em] text-cyan-300">Governance AI · EU Governance Workspace</div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">Was möchtest du prüfen, bewerten oder umsetzen?</h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-6 text-white/45">Eine KI-Arbeitsoberfläche für AI Act, DSGVO, ISO 42001, Risiken, Policies und Evidence — mit freigegebenen Browser- und Agent-Workflows.</p>

          <form onSubmit={submit} className="mt-8 rounded-2xl border border-white/15 bg-white/[.035] p-3 text-left shadow-2xl shadow-cyan-950/20">
            <textarea value={prompt} onChange={(event) => { setPrompt(event.target.value); setSubmitted(false); }} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') submit(event as unknown as FormEvent); }} rows={4} placeholder="Frag Governance AI … z. B. „Prüfe meinen AI Act Status und zeige mir die offenen Maßnahmen.“" className="w-full resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-white/25" />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2">
              <div className="flex items-center gap-2">
                {(['Auto', 'Research', 'Execute'] as const).map((item) => <button key={item} type="button" onClick={() => setMode(item)} className={`rounded-lg px-2.5 py-1.5 text-[10px] uppercase tracking-wider ${mode === item ? 'bg-cyan-400/10 text-cyan-200' : 'text-white/30 hover:text-white/60'}`}>{item}</button>)}
                <span className="hidden text-[10px] text-white/20 sm:inline">Kontext: {intent}</span>
              </div>
              <button type="submit" disabled={!prompt.trim()} className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-xs font-semibold text-[rgb(3,7,18)] disabled:opacity-25"><Play className="h-3.5 w-3.5" /> Aufgabe starten</button>
            </div>
          </form>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((item) => <button key={item} type="button" onClick={() => { setPrompt(item); setSubmitted(false); }} className="rounded-full border border-white/10 px-3 py-2 text-xs text-white/45 hover:border-cyan-400/30 hover:text-white">{item}</button>)}
          </div>
        </div>

        {submitted && (
          <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-cyan-400/20 bg-cyan-400/[.035] p-5">
            <div className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Aufgabe erkannt</div>
            <p className="mt-2 text-xs leading-5 text-white/45">Governance AI würde die Anfrage jetzt in den passenden Workflow überführen. Ausführung und Browser-Aktionen benötigen die jeweils erforderliche Freigabe; Quellen, Entscheidungen und Ergebnisse werden anschließend als Evidence dokumentiert.</p>
          </div>
        )}
      </section>

      <section className="border-y border-white/10 bg-white/[.015]">
        <div className="mx-auto grid max-w-6xl gap-px bg-white/10 sm:grid-cols-5">
          {WORK_STAGES.map(([stage, text], index) => <div key={stage} className="bg-[rgb(3,7,18)] p-5"><div className="font-mono text-[10px] text-cyan-300">0{index + 1}</div><div className="mt-2 text-sm font-semibold">{stage}</div><p className="mt-2 text-xs leading-5 text-white/30">{text}</p></div>)}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-12 sm:px-6 md:grid-cols-3">
        <Link to="/ai-act" className="rounded-2xl border border-white/10 bg-white/[.02] p-5 hover:border-cyan-400/25"><Sparkles className="h-5 w-5 text-cyan-300" /><h2 className="mt-3 text-sm font-semibold">AI Act & Risiko</h2><p className="mt-2 text-xs leading-5 text-white/35">KI-Systeme klassifizieren, Anforderungen bewerten und offene Maßnahmen verfolgen.</p></Link>
        <Link to="/ai-governance" className="rounded-2xl border border-white/10 bg-white/[.02] p-5 hover:border-cyan-400/25"><Search className="h-5 w-5 text-cyan-300" /><h2 className="mt-3 text-sm font-semibold">DSGVO & Policies</h2><p className="mt-2 text-xs leading-5 text-white/35">Verarbeitungen, Policies, Risiken und Kontrollen aus einer zentralen KI-Arbeitsfläche bearbeiten.</p></Link>
        <Link to="/app/siteos" className="rounded-2xl border border-white/10 bg-white/[.02] p-5 hover:border-cyan-400/25"><Globe2 className="h-5 w-5 text-cyan-300" /><h2 className="mt-3 text-sm font-semibold">Browser & Websites</h2><p className="mt-2 text-xs leading-5 text-white/35">Websites analysieren und freigegebene Browser-Workflows ausführen — mit Governance-Prüfpfad.</p></Link>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="mb-6 flex items-end justify-between gap-4"><div><div className="font-mono text-[10px] uppercase tracking-[.2em] text-cyan-300">Live Governance Context</div><h2 className="mt-2 text-2xl font-semibold">Was Governance AI bereits überwacht</h2></div><div className="flex items-center gap-2 text-[10px] text-white/25"><FileCheck2 className="h-3.5 w-3.5" /> Evidence-backed</div></div>
        <AiGovernanceDashboard />
      </section>

      <section className="border-t border-white/10"><RuntimeDashboard /></section>
      <BrowserExtensionSection />
      <PolicyEngineSection />
      <EnterpriseEvidenceVaultSection />
      <AgentConnectorsSection />

      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 text-xs text-white/25 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>Governance AI · by RealSyncDynamics.AI</span>
          <span>Understand · Assess · Act · Verify · Prove</span>
          <Link to="/" className="hover:text-white/60">RealSyncDynamics.AI</Link>
        </div>
      </footer>
    </main>
  );
}
