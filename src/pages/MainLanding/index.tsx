import { FormEvent, useState } from 'react';
import { ArrowUp, Globe2, Plus, Search, ShieldCheck, Sparkles, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';

const STARTERS = [
  ['SEO-Audit', 'Analysiere meine Website technisch und erstelle einen priorisierten SEO-Audit.'],
  ['DSGVO prüfen', 'Prüfe meine Website auf DSGVO- und TDDDG-relevante Risiken.'],
  ['EU AI Act', 'Erkläre mir die relevanten EU-AI-Act-Pflichten für mein KI-System.'],
  ['Website erstellen', 'Erstelle aus meiner bestehenden Website eine moderne neue Website.'],
];
const TOOLS = [['Website analysieren', Globe2], ['SEO analysieren', Search], ['DSGVO prüfen', ShieldCheck], ['Browser-Workflow', Wrench]] as const;

export function MainLanding() {
  const [prompt, setPrompt] = useState('');
  const [toolsOpen, setToolsOpen] = useState(false);
  const [mode, setMode] = useState('Auto');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = prompt.trim(); if (!value) return;
    const text = value.toLowerCase();
    if (text.includes('website') && /(erstell|bauen|neu)/.test(text)) window.location.assign(`/website-builder?prompt=${encodeURIComponent(value)}`);
    else if (text.includes('telefonbot')) window.location.assign('/phonebot/start');
    else if (text.includes('chatbot')) window.location.assign('/chatbot/start');
    else if (text.includes('audit') || text.includes('seo')) window.location.assign(`/scan/start?prompt=${encodeURIComponent(value)}`);
    else window.location.assign(`/features?prompt=${encodeURIComponent(value)}`);
  };
  return <div className="min-h-screen bg-[rgb(3,7,18)] text-white antialiased">
    <SEOHead />
    <header className="border-b border-white/10 bg-[rgb(3,7,18)]/90 backdrop-blur"><div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6"><Link to="/" className="flex items-center gap-2 text-sm font-semibold"><span className="grid h-7 w-7 place-items-center rounded-lg border border-cyan-400/30 bg-cyan-400/10"><Sparkles className="h-4 w-4 text-cyan-300" /></span>RealSync <span className="font-normal text-white/60">Dynamics.AI</span></Link><span className="hidden text-[11px] text-white/40 sm:block">SEO · DSGVO · EU AI Act · Agent Workflows</span><Link to="/welcome" className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60">Login</Link></div></header>
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl flex-col px-4 pb-10 pt-20 sm:px-6 sm:pt-28"><section className="flex flex-1 flex-col justify-center"><div className="mx-auto w-full max-w-3xl text-center">
      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[.16em] text-cyan-300"><Sparkles className="h-3.5 w-3.5" /> AI SEO & Compliance Workbench</div>
      <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">Was möchtest du erledigen?</h1>
      <p className="mx-auto mt-5 max-w-2xl text-sm leading-6 text-white/50 sm:text-base">Eine KI-Arbeitsoberfläche für SEO, Website, Business-Fragen, DSGVO und EU AI Act.</p>
      <form onSubmit={submit} className="mx-auto mt-9 max-w-3xl rounded-2xl border border-white/10 bg-white/[.035] p-2 shadow-2xl"><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Frag mich etwas über SEO, deine Website, DSGVO, EU AI Act oder einen Workflow …" rows={4} className="w-full resize-none bg-transparent px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/25" /><div className="flex items-center justify-between border-t border-white/10 px-2 pt-2"><div className="flex items-center gap-1"><button type="button" onClick={()=>setToolsOpen(v=>!v)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs text-white/50 hover:bg-white/5 hover:text-white"><Plus className="h-4 w-4" /> Tools</button>{['Auto','Research','Execute'].map(item=><button key={item} type="button" onClick={()=>setMode(item)} className={`rounded-lg px-2.5 py-2 text-xs ${mode===item?'bg-cyan-400/10 text-cyan-300':'text-white/40'}`}>{item}</button>)}</div><button type="submit" disabled={!prompt.trim()} className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-400 text-[rgb(3,7,18)] disabled:opacity-25" aria-label="Absenden"><ArrowUp className="h-4 w-4" /></button></div></form>
      {toolsOpen&&<div className="mx-auto mt-2 grid max-w-3xl gap-2 rounded-xl border border-white/10 bg-[rgb(9,14,28)] p-3 text-left sm:grid-cols-2">{TOOLS.map(([label,Icon])=><button key={label} type="button" onClick={()=>{setPrompt(label+': ');setToolsOpen(false)}} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/65 hover:bg-white/5"><Icon className="h-4 w-4 text-cyan-300" />{label}</button>)}</div>}
      <div className="mt-6 flex flex-wrap justify-center gap-2">{STARTERS.map(([label,value])=><button key={label} type="button" onClick={()=>setPrompt(value)} className="rounded-full border border-white/10 bg-white/[.02] px-3.5 py-2 text-xs text-white/50 hover:border-cyan-400/30 hover:text-cyan-200">{label}</button>)}</div>
    </div><section className="mx-auto mt-16 grid w-full max-w-3xl gap-3 sm:grid-cols-3">{[['RESEARCH','SEO, Wettbewerber, Inhalte und Rechtsquellen analysieren.'],['EXECUTE','Kontrollierte Aktionen über freigegebene Agent-Workflows ausführen.'],['VERIFY','Ergebnisse erneut prüfen und Governance-Evidence dokumentieren.']].map(([title,text])=><article key={title} className="rounded-xl border border-white/10 bg-white/[.025] p-4 text-left"><div className="font-mono text-[10px] tracking-[.16em] text-cyan-300">{title}</div><p className="mt-2 text-xs leading-5 text-white/40">{text}</p></article>)}</section></section></main>
  </div>;
}
export default MainLanding;
