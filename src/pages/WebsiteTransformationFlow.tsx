import { useMemo, useState } from 'react';
import { ArrowRight, Bot, CalendarDays, Check, Globe2, Loader2, Phone, Search, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';
import { useTenant } from '../core/access/TenantProvider';
import { useSupabaseAuth } from '../features/supabase/SupabaseAuthContext';
import { createSiteOsCheckoutSession } from '../features/billing/checkout';
import { buildSite, errorMessage, runScan } from '../features/siteos/siteOsApi';
import type { SiteBlueprint, ScoreSet } from '../../packages/siteos-core/src/index';
import { renderSite } from '../../packages/siteos-core/src/render/renderer';
import { applySiteDesignTemplate, SITE_DESIGN_TEMPLATES, type SiteDesignTemplate } from '../../packages/siteos-core/src/render/templates';
import { ONE_TIME_PRICING_TIERS, PUBLIC_PRICING_TIERS, type PricingTier } from '../config/pricing';

const FEATURES = [
  ['chatbot', 'AI-Chat', Bot], ['phonebot', 'Telefon-AI', Phone], ['booking', 'Terminbuchung', CalendarDays],
  ['seo', 'SEO', Search], ['accessibility', 'Barrierefreiheit', Check], ['dsgvo', 'DSGVO', ShieldCheck], ['ai-act', 'EU AI Act', ShieldCheck],
] as const;

type Discovery = { source_url: string; title: string | null; description: string | null; h1: string | null; services: string[]; visible_text: string };
type Phase = 'input' | 'report' | 'preview' | 'offer';
type Generation = { id: number; template: SiteDesignTemplate; blueprint: SiteBlueprint };
type ScoreKey = 'health' | 'compliance' | 'performance' | 'aiRisk' | 'risk';

function score(value: unknown) {
  return typeof value === 'number' ? Math.max(0, Math.min(100, Math.round(value))) : null;
}

function modernizationPotential(scores: ScoreSet | undefined, findings: any[]) {
  if (!scores) return Math.min(100, findings.length * 6);
  const health = score(scores.health) ?? 50;
  const compliance = score(scores.compliance) ?? 50;
  const performance = score(scores.performance) ?? 50;
  const risk = score(scores.risk) ?? 50;
  return Math.max(0, Math.min(100, Math.round((100 - health) * 0.35 + (100 - compliance) * 0.25 + (100 - performance) * 0.2 + risk * 0.2 + Math.min(findings.length * 2, 10))));
}

function recommendedPlan(features: string[], scores: ScoreSet | undefined): PricingTier | undefined {
  const advanced = features.includes('phonebot') || features.includes('booking') || features.includes('ai-act');
  const candidates = PUBLIC_PRICING_TIERS.filter((tier) => !tier.isYearly);
  if (!candidates.length) return undefined;
  if (advanced || (typeof scores?.risk === 'number' && scores.risk < 70)) return candidates.find((tier) => tier.planKey === 'growth') ?? candidates[1] ?? candidates[0];
  return candidates.find((tier) => tier.planKey === 'starter') ?? candidates[0];
}

const PHASES: Array<{ id: Phase; label: string }> = [
  { id: 'input', label: 'Scan' }, { id: 'report', label: 'Report' }, { id: 'preview', label: 'Generate' }, { id: 'offer', label: 'Publish' },
];

export function WebsiteTransformationFlow() {
  const navigate = useNavigate();
  const { activeTenantId } = useTenant();
  const { isAuthenticated } = useSupabaseAuth();
  const [url, setUrl] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const [scan, setScan] = useState<{ scores: ScoreSet; findings: any[] } | null>(null);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [activeGeneration, setActiveGeneration] = useState(0);
  const [template, setTemplate] = useState<SiteDesignTemplate>('modern-minimal');
  const [features] = useState<string[]>(FEATURES.map(([id]) => id));

  const current = generations[activeGeneration] ?? null;
  const previewBlueprint = useMemo(() => current ? applySiteDesignTemplate(current.blueprint, template) : null, [current, template]);
  const previewHtml = useMemo(() => previewBlueprint ? renderSite(previewBlueprint, { baseUrl: url }).find((page) => page.path === '/')?.html ?? '' : '', [previewBlueprint, url]);
  const modernization = modernizationPotential(scan?.scores, scan?.findings ?? []);
  const launchTier = ONE_TIME_PRICING_TIERS.find((tier) => tier.planKey === 'governance_launch');
  const planTier = recommendedPlan(features, scan?.scores);
  const currentPhaseIndex = PHASES.findIndex((item) => item.id === phase);

  const startScan = async () => {
    const clean = url.trim();
    if (!/^https?:\/\/[^\s]+$/i.test(clean)) { setError('Bitte eine vollständige URL inklusive https:// eingeben.'); return; }
    if (!isAuthenticated) { navigate(`/welcome?next=${encodeURIComponent(`/handwerk-website?source_url=${encodeURIComponent(clean)}`)}`); return; }
    if (!activeTenantId) { setError('Bitte zuerst den Workspace einrichten.'); return; }
    setBusy(true); setError('');
    try {
      const sb = getSupabase();
      const { data, error: discoveryError } = await sb.functions.invoke('siteos-discover', { body: { tenant_id: activeTenantId, url: clean } });
      if (discoveryError) throw discoveryError;
      const found = data as Discovery;
      if (!found?.source_url) throw new Error('Die Website konnte nicht analysiert werden.');
      const scanned = await runScan({ tenant_id: activeTenantId, url: found.source_url, trigger: 'manual' });
      if (scanned.kind !== 'ok') throw new Error(errorMessage(scanned));
      setDiscovery(found);
      setScan({ scores: scanned.data.scores, findings: scanned.data.findings ?? [] });
      setGenerations([]); setActiveGeneration(0); setPhase('report');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Der Scan konnte nicht gestartet werden.'); }
    finally { setBusy(false); }
  };

  const generateWebsite = async (nextTemplate = template) => {
    if (!discovery || !activeTenantId) return;
    setBusy(true); setError('');
    try {
      const selected = FEATURES.filter(([id]) => features.includes(id)).map(([, label]) => label);
      const findings = (scan?.findings ?? []).slice(0, 12).map((finding) => `${finding.severity ?? 'INFO'}: ${finding.title ?? finding.code ?? 'Finding'}`).join('\n');
      const prompt = [
        'Erstelle eine neue, moderne Landingpage als eigenständiges RealSync SiteOS Frontend.',
        `Ausgangs-Website: ${discovery.source_url}.`,
        `Titel: ${discovery.title ?? discovery.h1 ?? 'unbekannt'}.`,
        `Leistungen: ${discovery.services.join(', ')}.`,
        `Audit Findings:\n${findings || 'Keine Findings übermittelt.'}`,
        `Governance/Modernization Potential: ${modernization}/100.`,
        `Designrichtung: ${nextTemplate}.`,
        `Gewünschte Funktionen: ${selected.join(', ')}.`,
        'Backend, APIs, Auth, Datenbank, Stripe und bestehende Business-Logik NICHT verändern oder neu erfinden.',
        'Nur Frontend, Informationsarchitektur, Content-Präsentation, responsive UX, SEO und visuelle Hierarchie modernisieren.',
        'Keine Tracker, Scripts oder DOM-Anweisungen der Quellwebsite übernehmen.',
        'Erzeuge eine hochwertige, conversion-orientierte und DSGVO-bewusste Website statt einer bloßen Kopie.',
      ].join('\n');
      const built = await buildSite({ tenant_id: activeTenantId, prompt, locale: 'de', enrichment: { name: discovery.title ?? discovery.h1 ?? undefined, summary: discovery.description ?? discovery.visible_text.slice(0, 500), services: discovery.services } } as Parameters<typeof buildSite>[0]);
      if (built.kind !== 'ok' || !built.data.blueprint) throw new Error(built.kind !== 'ok' ? errorMessage(built) : 'Blueprint wurde nicht erzeugt.');
      const generation: Generation = { id: generations.length + 1, template: nextTemplate, blueprint: built.data.blueprint };
      setGenerations((items) => [...items, generation]);
      setActiveGeneration(generations.length);
      setTemplate(nextTemplate);
      setPhase('preview');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Die neue Website konnte nicht erzeugt werden.'); }
    finally { setBusy(false); }
  };

  const chooseTransformation = async () => {
    if (!activeTenantId || !discovery) { setError('Workspace oder Ausgangs-Website fehlt.'); return; }
    setBusy(true); setError('');
    try {
      const result = await createSiteOsCheckoutSession({ tenantId: activeTenantId, sourceUrl: discovery.source_url, siteSlug: current?.blueprint.slug, projectName: discovery.title ?? discovery.h1 ?? undefined });
      if (!result.ok || !result.url) { setError(result.error?.message ?? 'Stripe Checkout konnte nicht vorbereitet werden.'); return; }
      window.location.assign(result.url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Stripe Checkout konnte nicht vorbereitet werden.'); }
    finally { setBusy(false); }
  };

  const phaseCopy = {
    input: ['WEBSITE AUDIT · START', 'Was ist mit Ihrer Website wirklich los?', 'URL eingeben. Wir prüfen DSGVO, technische Qualität, SEO, Performance, AI-Risiken und Modernisierungspotenzial.'],
    report: ['GOVERNANCE REPORT · LIVE', 'Hier sehen Sie den echten Befund.', 'Nicht nur ein Score: konkrete Findings, Risiken und der Nachweis, warum eine Modernisierung sinnvoll sein kann.'],
    preview: ['AI WEBSITE GENERATOR · LIVE', 'Aus dem Befund wird eine neue Website.', 'Wählen Sie eine Stilrichtung, generieren Sie Varianten und vergleichen Sie sie — wie ein AI-Studio für Ihre bestehende Website.'],
    offer: ['TRANSFORMATION · PUBLISH', 'Bereit für die neue Version?', 'Das bestehende Backend bleibt bestehen. Wir transformieren das Frontend und führen die Umsetzung als SiteOS-Projekt weiter.'],
  }[phase];

  const scoreCards: Array<[string, ScoreKey]> = [['Website Health', 'health'], ['DSGVO', 'compliance'], ['Performance', 'performance'], ['AI Risk', 'aiRisk'], ['Risiko', 'risk']];

  return (
    <main className="min-h-screen bg-[#050914] text-white antialiased">
      <div className="mx-auto max-w-7xl px-5 py-5 sm:px-8">
        <header className="flex items-center justify-between border-b border-white/[.08] pb-5"><div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg border border-cyan-400/20 bg-cyan-400/10"><Sparkles size={15} className="text-cyan-300" /></span><span className="text-sm font-semibold">RealSyncDynamics.AI</span></div><div className="hidden items-center gap-6 text-xs text-white/45 sm:flex"><span>Audit → Report → Generate → Publish</span><button onClick={() => navigate('/login')} className="text-white/70 hover:text-white">Login</button></div></header>
        <div className="mx-auto max-w-6xl pt-7">
          <div className="flex items-center justify-center gap-2 sm:gap-4">{PHASES.map((item, index) => <div key={item.id} className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[.16em]"><span className={`grid h-6 w-6 place-items-center rounded-full border ${index <= currentPhaseIndex ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-300' : 'border-white/10 text-white/25'}`}>{index + 1}</span><span className={index <= currentPhaseIndex ? 'text-white/65' : 'hidden text-white/25 sm:inline'}>{item.label}</span>{index < PHASES.length - 1 && <span className="mx-1 h-px w-4 bg-white/10 sm:w-10" />}</div>)}</div>
          <section className="relative overflow-hidden pb-10 pt-14 text-center sm:pt-20"><div className="pointer-events-none absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-400/[.07] blur-3xl" /><div className="relative"><div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/[.06] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[.2em] text-cyan-300"><Zap size={11} /> {phaseCopy[0]}</div><h1 className="mx-auto mt-6 max-w-5xl text-4xl font-extrabold leading-[1.02] tracking-[-.04em] sm:text-6xl lg:text-7xl">{phaseCopy[1]}</h1><p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-white/50 sm:text-base">{phaseCopy[2]}</p></div></section>

          {phase === 'input' && <section className="pb-16"><div className="mx-auto max-w-3xl rounded-3xl border border-white/[.10] bg-white/[.035] p-3 shadow-2xl"><div className="flex flex-col gap-2 sm:flex-row"><div className="flex min-w-0 flex-1 items-center rounded-2xl border border-white/[.08] bg-black/25 px-4"><Globe2 className="mr-3 shrink-0 text-cyan-400" size={18}/><input autoFocus value={url} onChange={e => { setUrl(e.target.value); setError(''); }} onKeyDown={e => { if (e.key === 'Enter') void startScan(); }} placeholder="https://ihre-website.de" className="w-full bg-transparent py-4 text-sm outline-none placeholder:text-white/25" aria-label="Website URL" /></div><button onClick={() => void startScan()} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-6 py-4 text-sm font-bold text-[#050914] hover:bg-cyan-300 disabled:opacity-50">{busy ? <Loader2 className="animate-spin" size={17}/> : <Search size={17}/>} {busy ? 'Website wird geprüft …' : 'Kostenlosen Audit starten'} <ArrowRight size={17}/></button></div></div><div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[10px] text-white/30"><span>DSGVO</span><span>SEO</span><span>Performance</span><span>Accessibility</span><span>AI Risk</span><span>Modernisierung</span></div></section>}

          {phase === 'report' && scan && <section className="pb-14"><div className="grid gap-3 sm:grid-cols-5">{scoreCards.map(([label, key]) => <div key={key} className="rounded-2xl border border-white/[.08] bg-white/[.025] p-5"><div className="text-xs text-white/40">{label}</div><div className="mt-2 text-3xl font-bold">{score(scan.scores[key]) ?? '—'}<span className="text-sm font-normal text-white/20">/100</span></div></div>)}</div><div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_.85fr]"><div className="rounded-3xl border border-white/[.08] bg-white/[.025] p-6 sm:p-8"><div className="flex items-start justify-between gap-4"><div><div className="font-mono text-[9px] uppercase tracking-[.2em] text-cyan-300">Governance findings</div><h2 className="mt-2 text-xl font-bold">{scan.findings.length} erkannte Punkte</h2><p className="mt-1 text-xs text-white/35">{discovery?.source_url}</p></div><div className="rounded-xl border border-cyan-400/20 bg-cyan-400/[.06] px-4 py-3 text-right"><div className="text-[9px] uppercase tracking-wider text-white/35">Modernization Potential</div><div className="mt-1 text-2xl font-bold text-cyan-300">{modernization}%</div></div></div><div className="mt-6 grid gap-2 md:grid-cols-2">{scan.findings.slice(0, 10).map((finding, index) => <div key={finding.code ?? `${finding.title}-${index}`} className="rounded-xl border border-white/[.07] bg-black/15 p-4"><div className="flex items-center justify-between gap-2"><span className="font-mono text-[9px] uppercase text-cyan-300">{finding.severity ?? 'INFO'}</span><span className="text-[9px] text-white/20">{finding.code ?? ''}</span></div><div className="mt-2 text-xs text-white/70">{finding.title ?? finding.message ?? 'Governance finding'}</div></div>)}</div></div><div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/[.045] p-6 sm:p-8"><div className="font-mono text-[9px] uppercase tracking-[.2em] text-cyan-300">Transformation recommendation</div><h2 className="mt-3 text-2xl font-bold">{modernization >= 70 ? 'Hoher Modernisierungsbedarf' : modernization >= 45 ? 'Deutliches Optimierungspotenzial' : 'Gezielte Modernisierung möglich'}</h2><p className="mt-3 text-sm leading-6 text-white/45">Der Befund zeigt nicht nur Probleme. Er definiert, welche Frontend- und Governance-Verbesserungen eine neue Version lösen sollte.</p><div className="mt-6 space-y-3 text-xs text-white/60"><div className="flex gap-3"><Check size={15} className="text-emerald-400"/> Bestehendes Backend bleibt unverändert</div><div className="flex gap-3"><Check size={15} className="text-emerald-400"/> Neue Informationsarchitektur</div><div className="flex gap-3"><Check size={15} className="text-emerald-400"/> Moderne responsive UX</div><div className="flex gap-3"><Check size={15} className="text-emerald-400"/> DSGVO-/AI-Act-bewusste Umsetzung</div></div><button onClick={() => void generateWebsite()} disabled={busy} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3.5 text-sm font-bold text-[#050914] hover:bg-cyan-300 disabled:opacity-50">{busy ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16}/>} {busy ? 'Neue Website wird generiert …' : 'Neue Website generieren'} <ArrowRight size={16}/></button></div></div></section>}

          {phase === 'preview' && current && previewBlueprint && <section className="pb-14"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{SITE_DESIGN_TEMPLATES.map(item => <button key={item.id} onClick={() => { setTemplate(item.id); void generateWebsite(item.id); }} disabled={busy} className={`rounded-full border px-4 py-2 text-xs transition ${template === item.id ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-300' : 'border-white/10 text-white/45 hover:text-white'}`}>{item.label}</button>)}</div><button onClick={() => void generateWebsite()} disabled={busy} className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/[.06] px-4 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/[.12] disabled:opacity-50">{busy ? <Loader2 size={13} className="animate-spin"/> : <Sparkles size={13}/>} Generate again</button></div><div className="mb-4 flex flex-wrap items-center gap-2 text-[10px] text-white/30"><span>{discovery?.source_url}</span><span>•</span><span>Generation {current.id}</span><span>•</span><span>{current.template}</span>{generations.length > 1 && <span>• {generations.length} Varianten</span>}</div><div className="overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl shadow-black/40"><iframe title={`Website Vorschau Generation ${current.id}`} srcDoc={previewHtml} className="h-[700px] w-full bg-white" sandbox="allow-same-origin" /></div><div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{FEATURES.map(([id, label, Icon]) => <div key={id} className="flex items-center gap-3 rounded-xl border border-white/[.08] bg-white/[.025] p-3 text-xs"><Icon size={15} className="text-cyan-300"/><span className="text-white/60">{label}</span><Check size={14} className="ml-auto text-emerald-400"/></div>)}</div><div className="mt-6 flex flex-wrap justify-between gap-3"><div className="flex gap-2">{generations.map((generation, index) => <button key={generation.id} onClick={() => { setActiveGeneration(index); setTemplate(generation.template); }} className={`rounded-lg border px-3 py-2 text-[10px] ${index === activeGeneration ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-300' : 'border-white/10 text-white/35'}`}>V{generation.id}</button>)}</div><button onClick={() => setPhase('offer')} className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-xs font-bold text-[#050914] hover:bg-cyan-300">Diese Variante umsetzen <ArrowRight size={15}/></button></div></section>}

          {phase === 'offer' && <section className="mx-auto max-w-4xl pb-14"><div className="rounded-3xl border border-white/[.08] bg-white/[.025] p-7 sm:p-9"><div className="font-mono text-[9px] uppercase tracking-[.2em] text-cyan-300">Frontend Transformation</div><h2 className="mt-3 text-3xl font-bold">Das Backend bleibt. Das Frontend wird neu.</h2><p className="mt-4 max-w-2xl text-sm leading-6 text-white/45">Ihre bestehende Business-Logik, Datenbank, Authentifizierung, APIs und Zahlungslogik werden nicht ersetzt. SiteOS erzeugt die neue Frontend-Version auf Basis des Audit-Befunds.</p><div className="mt-7 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-white/[.08] p-5"><div className="text-xs text-white/35">Audit</div><div className="mt-2 text-2xl font-bold">{modernization}%</div><div className="mt-1 text-[10px] text-white/30">Modernization Potential</div></div><div className="rounded-2xl border border-white/[.08] p-5"><div className="text-xs text-white/35">Varianten</div><div className="mt-2 text-2xl font-bold">{generations.length}</div><div className="mt-1 text-[10px] text-white/30">AI-generierte Versionen</div></div></div><div className="mt-7 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[.04] p-5 text-xs text-white/60">✓ Frontend neu<br/>✓ Responsive UX<br/>✓ SEO-Struktur<br/>✓ Compliance-bewusste Komponenten</div><div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[.04] p-5 text-xs text-white/60">✓ Backend bleibt<br/>✓ Supabase bleibt<br/>✓ Stripe bleibt<br/>✓ APIs und Business-Logik bleiben</div></div><div className="mt-7 flex flex-col gap-2 sm:flex-row"><button onClick={() => void chooseTransformation()} disabled={!launchTier || busy} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3.5 text-sm font-bold text-[#050914] hover:bg-cyan-300 disabled:opacity-40">{busy ? <Loader2 size={16} className="animate-spin"/> : null}{busy ? 'Checkout wird vorbereitet …' : `Transformation starten${launchTier ? ` · ${launchTier.priceString} €` : ''}`} {!busy && <ArrowRight size={16}/>}</button><button onClick={() => navigate(planTier?.cta.href ?? '/pricing')} disabled={busy} className="rounded-xl border border-white/10 px-5 py-3.5 text-xs font-semibold text-white/55 hover:text-white">Andere Pakete</button></div></div></section>}

          {error && <div role="alert" className="mx-auto mb-10 max-w-2xl rounded-xl border border-rose-400/20 bg-rose-400/[.06] px-4 py-3 text-center text-xs text-rose-300">{error}</div>}
        </div>
      </div>
    </main>
  );
}
