import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowUp, Bot, CheckCircle2, Globe2, Plus, Search, ShieldCheck, Sparkles, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';

const STARTERS = [
  ['SEO-Audit', 'Analysiere meine Website technisch und erstelle einen priorisierten SEO-Audit.'],
  ['DSGVO prüfen', 'Prüfe meine Website auf DSGVO- und TDDDG-relevante Risiken.'],
  ['EU AI Act', 'Welche EU-AI-Act-Pflichten gelten für meinen KI-Assistenten?'],
  ['Neue Website', 'Erstelle aus meiner bestehenden Website eine moderne neue Website.'],
];
const TOOLS = [
  ['Website analysieren', Globe2], ['SEO analysieren', Search], ['DSGVO prüfen', ShieldCheck],
  ['EU AI Act prüfen', ShieldCheck], ['Browser-Workflow', Wrench], ['Chatbot / Telefonbot', Bot],
] as const;
const PLACEHOLDERS = [
  'Prüfe meine Website auf technische SEO-Probleme …',
  'Warum rankt meine Website nicht bei Google? …',
  'Prüfe meine Website auf DSGVO- und TDDDG-Risiken …',
  'Welche EU-AI-Act-Pflichten hat mein Chatbot? …',
  'Analysiere meine Website und erstelle einen Maßnahmenplan …',
];

export function AiSeoWorkbench() {
  const [prompt, setPrompt] = useState('');
  const [toolOpen, setToolOpen] = useState(false);
  const [mode, setMode] = useState<'Auto' | 'Research' | 'Execute'>('Auto');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setPlaceholderIndex((index) => (index + 1) % PLACEHOLDERS.length), 3200);
    return () => window.clearInterval(timer);
  }, []);
  const suggestions = useMemo(() => STARTERS, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = prompt.trim(); if (!value) return;
    const lower = value.toLowerCase();
    if (lower.includes('website') && /(erstell|bauen|neu)/.test(lower)) { window.location.assign(`/website-builder?prompt=${encodeURIComponent(value)}`); return; }
    if (lower.includes('telefonbot')) { window.location.assign('/phonebot/start'); return; }
    if (lower.includes('chatbot')) { window.location.assign('/chatbot/start'); return; }
    if (lower.includes('audit') || lower.includes('seo') || lower.includes('dsgvo') || lower.includes('ai act')) { window.location.assign(`/scan/start?prompt=${encodeURIComponent(value)}&mode=${encodeURIComponent(mode)}`); return; }
    window.location.assign(`/features?prompt=${encodeURIComponent(value)}&mode=${encodeURIComponent(mode)}`);
  }

  return (
    <div className="min-h-screen bg-[rgb(3,7,18)] text-white antialiased">
      <SEOHead />
      <header className="border-b border-white/10 bg-[rgb(3,7,18)]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight"><span className="grid h-7 w-7 place-items-center rounded-lg border border-cyan-400/30 bg-cyan-400/10"><Sparkles className="h-4 w-4 text-cyan-300" /></span>RealSync <span className="font-normal text-white/65">Dynamics.AI</span></Link>
          <div className="hidden items-center gap-2 text-[11px] text-white/40 sm:flex"><span className="h-2 w-2 rounded-full bg-emerald-400" /> AI SEO · DSGVO · EU AI Act · Browser Agent</div>
          <Link to="/welcome" className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/65 hover:border-white/20 hover:text-white">Login</Link>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col px-4 pb-12 pt-16 sm:px-6 sm:pt-24">
        <section className="flex flex-1 flex-col justify-center">
          <div className="mx-auto w-full max-w-4xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[.16em] text-cyan-300"><Sparkles className="h-3.5 w-3.5" /> AI SEO & Compliance Workbench</div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">Was möchtest du erstellen, prüfen oder automatisieren?</h1>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-6 text-white/55 sm:text-base">Eine KI-Arbeitsoberfläche, die deine Website, dein SEO und deine Compliance versteht — und aus Fragen konkrete nächste Schritte macht.</p>

            <form onSubmit={submit} className="mx-auto mt-9 max-w-4xl rounded-2xl border border-cyan-400/15 bg-white/[.035] p-2 shadow-2xl shadow-black/30 ring-1 ring-white/[.03]">
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') submit(event as unknown as FormEvent); }} placeholder={PLACEHOLDERS[placeholderIndex]} rows={4} aria-label="Aufgabe für den KI-Assistenten" className="w-full resize-none bg-transparent px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/25" />
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-2 pt-2"><div className="flex items-center gap-1"><button type="button" onClick={() => setToolOpen((open) => !open)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs text-white/50 hover:bg-white/5 hover:text-white"><Plus className="h-4 w-4" /> Tools</button>{(['Auto', 'Research', 'Execute'] as const).map((item) => <button key={item} type="button" onClick={() => setMode(item)} className={`rounded-lg px-2.5 py-2 text-xs ${mode === item ? 'bg-cyan-400/10 text-cyan-300' : 'text-white/40 hover:text-white'}`}>{item}</button>)}</div><button type="submit" disabled={!prompt.trim()} className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-400 text-[rgb(3,7,18)] transition hover:bg-cyan-300 disabled:opacity-25" aria-label="Aufgabe starten"><ArrowUp className="h-4 w-4" /></button></div>
            </form>

            <div className="mx-auto mt-3 flex max-w-4xl items-center justify-between px-2 text-[10px] text-white/30"><span>Beispiel: <button type="button" className="text-cyan-300/70 hover:text-cyan-200" onClick={() => setPrompt('Prüfe meine Website auf DSGVO Art. 32 und technische SEO-Probleme.')}>„Prüfe meine Website auf DSGVO Art. 32 und SEO-Probleme.“</button></span><span className="hidden sm:inline">⌘/Ctrl + Enter</span></div>

            {toolOpen && <div className="relative mx-auto mt-2 grid max-w-4xl gap-2 rounded-xl border border-white/10 bg-[rgb(9,14,28)] p-3 text-left shadow-xl sm:grid-cols-2">{TOOLS.map(([label, Icon]) => <button key={label} type="button" onClick={() => { setPrompt(`${label}: `); setToolOpen(false); }} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/65 hover:bg-white/5 hover:text-white"><Icon className="h-4 w-4 text-cyan-300" />{label}</button>)}</div>}

            <div className="mt-6 flex flex-wrap justify-center gap-2">{suggestions.map(([label, value]) => <button key={label} type="button" onClick={() => setPrompt(value)} className="rounded-full border border-white/10 bg-white/[.02] px-3.5 py-2 text-xs text-white/50 hover:border-cyan-400/30 hover:bg-cyan-400/5 hover:text-cyan-200">{label}</button>)}</div>

            <section className="mx-auto mt-10 max-w-4xl rounded-2xl border border-white/10 bg-white/[.025] p-4 text-left sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-mono text-[10px] uppercase tracking-[.16em] text-cyan-300">So arbeitet der Assistent</div><p className="mt-1 text-xs text-white/45">Aus einer Frage wird ein nachvollziehbarer Arbeitsablauf.</p></div><span className="rounded-full border border-emerald-400/15 bg-emerald-400/5 px-2.5 py-1 text-[10px] text-emerald-300">Evidence-backed</span></div><div className="mt-4 grid gap-2 sm:grid-cols-3">{[['1', 'RESEARCH', 'SEO, Inhalte, technische Signale und relevante Quellen analysieren.'], ['2', 'EXECUTE', 'Freigegebene Browser- und Agent-Workflows ausführen.'], ['3', 'VERIFY', 'Ergebnis erneut prüfen und Governance-Evidence dokumentieren.']].map(([step, title, text]) => <article key={title} className="rounded-xl border border-white/10 bg-black/10 p-3"><div className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-full bg-cyan-400/10 font-mono text-[10px] text-cyan-300">{step}</span><span className="font-mono text-[10px] tracking-[.16em] text-white/65">{title}</span></div><p className="mt-2 text-[11px] leading-5 text-white/35">{text}</p></article>)}</div></section>

            <section className="mx-auto mt-5 grid max-w-4xl gap-2 sm:grid-cols-3">{[['Governance-Evidence', 'Nachvollziehbare Nachweise statt bloßer KI-Antworten.', CheckCircle2], ['DSGVO & EU AI Act', 'Relevante Anforderungen verständlich einordnen.', ShieldCheck], ['Browser Agent', 'Kontrollierte Web-Workflows mit Nutzerfreigabe.', Wrench]].map(([title, text, Icon]) => <article key={title as string} className="flex gap-3 rounded-xl border border-white/10 bg-white/[.02] p-3 text-left"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" /><div><div className="text-xs font-medium text-white/70">{title as string}</div><p className="mt-1 text-[10px] leading-4 text-white/35">{text as string}</p></div></article>)}</section>

            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"><button type="button" onClick={() => setPrompt('Analysiere meine Website technisch und erstelle einen priorisierten SEO-Audit.')} className="rounded-xl bg-cyan-400 px-5 py-2.5 text-xs font-semibold text-[rgb(3,7,18)] hover:bg-cyan-300">Kostenlosen Audit starten</button><Link to="/website-builder" className="rounded-xl border border-white/10 px-5 py-2.5 text-xs text-white/60 hover:border-cyan-400/30 hover:text-white">Website neu erstellen</Link></div>
          </div>
        </section>
        <p className="mx-auto mt-8 max-w-3xl text-center text-[10px] leading-5 text-white/25">Browser-Aktionen werden nur innerhalb freigegebener Workflows ausgeführt. Rechtliche Antworten unterscheiden zwischen Quelle, Interpretation und Handlungsempfehlung.</p>
      </main>
    </div>
  );
}
export default AiSeoWorkbench;
