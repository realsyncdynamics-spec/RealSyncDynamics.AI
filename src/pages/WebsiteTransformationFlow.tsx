import { useMemo, useState } from 'react';
import { ArrowRight, Bot, CalendarDays, Check, Globe2, Loader2, Phone, Search, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';
import { useTenant } from '../core/access/TenantProvider';
import { useSupabaseAuth } from '../features/supabase/SupabaseAuthContext';
import { createSiteOsCheckoutSession } from '../features/billing/checkout';
import { buildSite, errorMessage, runScan } from '../features/siteos/siteOsApi';
import type { SiteBlueprint } from '../../packages/siteos-core/src/index';
import { renderSite } from '../../packages/siteos-core/src/render/renderer';
import { applySiteDesignTemplate, SITE_DESIGN_TEMPLATES, type SiteDesignTemplate } from '../../packages/siteos-core/src/render/templates';
import { ONE_TIME_PRICING_TIERS, PUBLIC_PRICING_TIERS, type PricingTier } from '../config/pricing';
import {
  EdgeFunctionAvailabilityNotice,
  allEdgeFunctionsAvailable,
} from '../components/landing/EdgeFunctionAvailabilityNotice';

/**
 * Die Function, auf der dieser Ablauf steht.
 *
 * Analyse, Scan und Neubau sind drei Pfade **eines** Slots:
 * `siteos/discover`, `siteos/runtime-scan`, `siteos/builder`. Der Slot laeuft
 * derzeit nicht in Produktion (Messung 2026-08-19,
 * `src/config/production-edge-functions.ts`).
 *
 * Anders als beim Onboarding wird hier **vor** dem Versuch geprueft, und der
 * Unterschied ist kein Zufall: Der erste Klick schickt einen nicht
 * angemeldeten Besucher zur Registrierung. Wer sich anmeldet und danach
 * erfaehrt, dass die Funktion nicht existiert, hat bereits bezahlt — mit
 * seinen Daten. Ein Vorbehalt gehoert vor die Kosten, nicht dahinter.
 */
const SITEOS_FLOW_FUNCTIONS = ['siteos'] as const;

const FEATURES = [
  ['chatbot', 'AI-Chat', Bot], ['phonebot', 'Telefon-AI', Phone], ['booking', 'Terminbuchung', CalendarDays],
  ['seo', 'SEO', Search], ['accessibility', 'Barrierefreiheit', Check], ['dsgvo', 'DSGVO', ShieldCheck], ['ai-act', 'EU AI Act', ShieldCheck],
] as const;

type Discovery = { source_url: string; title: string | null; description: string | null; h1: string | null; services: string[]; visible_text: string };
type Phase = 'input' | 'scan' | 'preview' | 'offer';

function recommendedPlan(features: string[], scores: any): PricingTier | undefined {
  const wantsAdvanced = features.includes('phonebot') || features.includes('booking') || features.includes('ai-act');
  const candidates = PUBLIC_PRICING_TIERS.filter((tier) => !tier.isYearly);
  if (!candidates.length) return undefined;
  if (wantsAdvanced) return candidates.find((tier) => tier.planKey === 'growth') ?? candidates[1] ?? candidates[0];
  if (typeof scores?.risk === 'number' && scores.risk < 70) return candidates.find((tier) => tier.planKey === 'growth') ?? candidates[1] ?? candidates[0];
  return candidates.find((tier) => tier.planKey === 'starter') ?? candidates[0];
}

const PHASES: Array<{ id: Phase; label: string }> = [
  { id: 'input', label: 'Analyse' },
  { id: 'scan', label: 'Befund' },
  { id: 'preview', label: 'Vorschau' },
  { id: 'offer', label: 'Transformation' },
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
  const [scan, setScan] = useState<{ scores: any; findings: any[] } | null>(null);
  const [blueprint, setBlueprint] = useState<SiteBlueprint | null>(null);
  const [template, setTemplate] = useState<SiteDesignTemplate>('modern-minimal');
  const [features] = useState<string[]>(FEATURES.map(([id]) => id));

  const previewBlueprint = useMemo(() => blueprint ? applySiteDesignTemplate(blueprint, template) : null, [blueprint, template]);
  const previewHtml = useMemo(() => previewBlueprint ? renderSite(previewBlueprint, { baseUrl: url }).find((page) => page.path === '/')?.html ?? '' : '', [previewBlueprint, url]);
  const launchTier = ONE_TIME_PRICING_TIERS.find((tier) => tier.planKey === 'governance_launch');
  const planTier = recommendedPlan(features, scan?.scores);
  const currentPhaseIndex = PHASES.findIndex((item) => item.id === phase);

  const startScan = async () => {
    const clean = url.trim();
    if (!/^https?:\/\/[^\s]+$/i.test(clean)) { setError('Bitte eine vollständige URL inklusive https:// eingeben.'); return; }
    // Vor dem Login-Redirect, nicht danach — siehe SITEOS_FLOW_FUNCTIONS.
    if (!allEdgeFunctionsAvailable(SITEOS_FLOW_FUNCTIONS)) {
      setError('Die Website-Analyse ist derzeit nicht verfügbar. Bitte legen Sie dafür kein Konto an — wir schalten sie frei, sobald der Dienst läuft.');
      return;
    }
    if (!isAuthenticated) { navigate(`/welcome?next=${encodeURIComponent(`/handwerk-website?source_url=${encodeURIComponent(clean)}`)}`); return; }
    if (!activeTenantId) { setError('Bitte zuerst den Workspace einrichten.'); return; }
    setBusy(true); setError('');
    try {
      const sb = getSupabase();
      const { data, error: discoveryError } = await sb.functions.invoke('siteos/discover', { body: { tenant_id: activeTenantId, url: clean } });
      if (discoveryError) throw discoveryError;
      const found = data as Discovery;
      if (!found?.source_url) throw new Error('Die Website konnte nicht analysiert werden.');
      setDiscovery(found);
      const scanned = await runScan({ tenant_id: activeTenantId, url: found.source_url, trigger: 'manual' });
      if (scanned.kind !== 'ok') throw new Error(errorMessage(scanned));
      setScan({ scores: scanned.data.scores, findings: scanned.data.findings });
      setPhase('scan');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Der Scan konnte nicht gestartet werden.'); }
    finally { setBusy(false); }
  };

  const buildPreview = async () => {
    if (!discovery || !activeTenantId) return;
    setBusy(true); setError('');
    try {
      const selected = FEATURES.filter(([id]) => features.includes(id)).map(([, label]) => label);
      const prompt = [
        'Erstelle ein echtes Redesign der bestehenden Website als neues RealSync SiteOS-Projekt.',
        `Gewünschte Funktionen: ${selected.join(', ')}.`,
        `Ausgangsseite: ${discovery.source_url}.`,
        `Titel: ${discovery.title ?? discovery.h1 ?? 'unbekannt'}.`,
        `Leistungen: ${discovery.services.join(', ')}.`,
        'Nicht nur Farben ändern: Informationsarchitektur, visuelle Hierarchie, Typografie, responsive Layouts und Conversion-Struktur modernisieren.',
        'Bestehende Website niemals verändern. Keine fremden Scripts, Tracker oder DOM-Anweisungen übernehmen.',
      ].join('\n');
      const args = { tenant_id: activeTenantId, prompt, locale: 'de', enrichment: { name: discovery.title ?? discovery.h1 ?? undefined, summary: discovery.description ?? discovery.visible_text.slice(0, 500), services: discovery.services } };
      const built = await buildSite(args as Parameters<typeof buildSite>[0]);
      if (built.kind !== 'ok') throw new Error(errorMessage(built));
      if (!built.data.blueprint) throw new Error('Blueprint wurde erstellt, aber die Vorschau-Daten fehlen.');
      setBlueprint(built.data.blueprint);
      setPhase('preview');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Die neue Website konnte nicht erzeugt werden.'); }
    finally { setBusy(false); }
  };

  const chooseTransformation = async () => {
    if (!activeTenantId || !discovery) { setError('Workspace oder Ausgangs-Website fehlt.'); return; }
    setBusy(true); setError('');
    try {
      const result = await createSiteOsCheckoutSession({
        tenantId: activeTenantId,
        sourceUrl: discovery.source_url,
        siteSlug: blueprint?.slug,
        projectName: discovery.title ?? discovery.h1 ?? undefined,
      });
      if (!result.ok || !result.url) { setError(result.error?.message ?? 'Stripe Checkout konnte nicht vorbereitet werden.'); return; }
      window.location.assign(result.url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Stripe Checkout konnte nicht vorbereitet werden.'); }
    finally { setBusy(false); }
  };

  const declineTransformation = () => navigate(planTier?.cta.href ?? '/pricing');

  const phaseCopy = {
    input: {
      eyebrow: 'SITEOS · WEBSITE TRANSFORMATION',
      title: 'Ihre Website. Klarer. Schneller. Stärker.',
      text: 'Wir analysieren Ihre bestehende Website und zeigen Ihnen konkret, wo Design, SEO, Performance und Compliance verbessert werden können.',
    },
    scan: {
      eyebrow: 'ANALYSE · LIVE BEFUND',
      title: 'Jetzt sehen Sie, was wirklich zählt.',
      text: 'Technische Schwachstellen, SEO-Potenzial und Compliance-Risiken — kompakt auf einer Oberfläche.',
    },
    preview: {
      eyebrow: 'TRANSFORMATION · VORSCHAU',
      title: 'So kann Ihre Website aussehen.',
      text: 'Aus dem Befund entsteht eine echte SiteOS-Vorschau — nicht nur ein Screenshot und kein loses Design-Mockup.',
    },
    offer: {
      eyebrow: 'TRANSFORMATION · NÄCHSTER SCHRITT',
      title: 'Vom Befund zur fertigen Website.',
      text: 'Sie entscheiden, ob die geprüfte Website jetzt als moderne, SEO-starke und compliance-bewusste Version umgesetzt wird.',
    },
  }[phase];

  return (
    <main className="min-h-screen bg-[#050914] text-white antialiased">
      <div className="mx-auto max-w-7xl px-5 py-5 sm:px-8">
        <header className="flex items-center justify-between border-b border-white/[.08] pb-5">
          <div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg border border-cyan-400/20 bg-cyan-400/10"><Sparkles size={15} className="text-cyan-300" /></span><span className="text-sm font-semibold tracking-tight">RealSyncDynamics.AI</span></div>
          <div className="hidden items-center gap-6 text-xs text-white/45 sm:flex"><span>Website Transformation</span><span>AI Governance</span><button onClick={() => navigate('/login')} className="text-white/70 hover:text-white">Login</button></div>
        </header>

        <div className="mx-auto max-w-5xl pt-7">
          <div className="flex items-center justify-center gap-2 sm:gap-4">
            {PHASES.map((item, index) => <div key={item.id} className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[.16em]"><span className={`grid h-6 w-6 place-items-center rounded-full border ${index <= currentPhaseIndex ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-300' : 'border-white/10 text-white/25'}`}>{index + 1}</span><span className={index <= currentPhaseIndex ? 'text-white/65' : 'hidden text-white/25 sm:inline'}>{item.label}</span>{index < PHASES.length - 1 && <span className="mx-1 h-px w-4 bg-white/10 sm:w-10" />}</div>)}
          </div>

          <section className="relative overflow-hidden pb-14 pt-14 text-center sm:pt-20">
            <div className="pointer-events-none absolute left-1/2 top-8 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-400/[.06] blur-3xl" />
            <div className="relative"><div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/[.06] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[.2em] text-cyan-300"><Zap size={11} /> {phaseCopy.eyebrow}</div><h1 className="mx-auto mt-6 max-w-4xl text-4xl font-extrabold leading-[1.04] tracking-[-.035em] sm:text-6xl lg:text-7xl">{phaseCopy.title}</h1><p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-white/50 sm:text-base">{phaseCopy.text}</p></div>

            {phase === 'input' && <>
              <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-white/[.10] bg-white/[.035] p-2 shadow-2xl shadow-black/30 sm:rounded-3xl sm:p-3"><div className="flex flex-col gap-2 sm:flex-row"><div className="flex min-w-0 flex-1 items-center rounded-xl border border-white/[.08] bg-black/25 px-4 sm:rounded-2xl"><Globe2 className="mr-3 shrink-0 text-cyan-400" size={18}/><input autoFocus value={url} onChange={e => { setUrl(e.target.value); setError(''); }} onKeyDown={e => { if (e.key === 'Enter') void startScan(); }} placeholder="https://ihre-website.de" className="w-full bg-transparent py-4 text-sm outline-none placeholder:text-white/25" aria-label="Website URL" /></div><button onClick={() => void startScan()} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-6 py-4 text-sm font-bold text-[#050914] transition hover:bg-cyan-300 disabled:opacity-50 sm:rounded-2xl">{busy ? <Loader2 className="animate-spin" size={17}/> : <Search size={17}/>} {busy ? 'Website wird analysiert …' : 'Website analysieren'}<ArrowRight size={17}/></button></div></div>
              <EdgeFunctionAvailabilityNotice
                functions={SITEOS_FLOW_FUNCTIONS}
                title="Die Website-Analyse ist derzeit nicht verfügbar"
                detail="Der Dienst, der Ihre Website liest und daraus einen Entwurf baut, läuft noch nicht in Produktion. Wir weisen das hier aus, statt Sie erst nach der Registrierung damit zu überraschen."
                className="mx-auto mt-4 max-w-3xl"
              />
              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] text-white/30"><span>URL genügt</span><span>Keine Änderung an Ihrer Website</span><span>Ergebnis in wenigen Minuten</span></div>
            </>}
          </section>

          {phase === 'input' && <section className="grid gap-4 border-t border-white/[.08] py-12 sm:grid-cols-3"><div className="rounded-2xl border border-white/[.08] bg-white/[.025] p-6"><div className="font-mono text-[10px] text-cyan-300">01</div><h2 className="mt-4 text-base font-semibold">Verstehen</h2><p className="mt-2 text-xs leading-6 text-white/40">Wir erfassen Struktur, Inhalte, Technik und sichtbare Conversion-Punkte Ihrer bestehenden Website.</p></div><div className="rounded-2xl border border-white/[.08] bg-white/[.025] p-6"><div className="font-mono text-[10px] text-cyan-300">02</div><h2 className="mt-4 text-base font-semibold">Bewerten</h2><p className="mt-2 text-xs leading-6 text-white/40">SEO, Performance, DSGVO und AI-Act-relevante Risiken werden in einem Befund zusammengeführt.</p></div><div className="rounded-2xl border border-white/[.08] bg-white/[.025] p-6"><div className="font-mono text-[10px] text-cyan-300">03</div><h2 className="mt-4 text-base font-semibold">Transformieren</h2><p className="mt-2 text-xs leading-6 text-white/40">Aus den Ergebnissen entsteht eine echte SiteOS-Vorschau mit klarer Informationsarchitektur.</p></div></section>}

          {phase === 'scan' && scan && <section className="pb-14"><div className="grid gap-3 sm:grid-cols-5">{[['Website Health', scan.scores.health], ['DSGVO', scan.scores.compliance], ['Performance', scan.scores.performance], ['AI Risk', scan.scores.aiRisk], ['Risiko', scan.scores.risk]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-white/[.08] bg-white/[.025] p-5"><div className="text-xs text-white/40">{label}</div><div className="mt-2 text-3xl font-bold tracking-tight">{typeof value === 'number' ? Math.round(value) : '—'}<span className="text-sm font-normal text-white/20">/100</span></div></div>)}</div><div className="mt-4 rounded-2xl border border-white/[.08] bg-white/[.025] p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="text-sm font-semibold">{scan.findings.length} relevante Findings</div><div className="mt-1 text-xs text-white/35">Die wichtigsten Punkte aus dem aktuellen Scan.</div></div><span className="font-mono text-[9px] uppercase tracking-[.18em] text-cyan-300">Evidence trail</span></div><div className="mt-5 grid gap-2 md:grid-cols-2">{scan.findings.slice(0, 6).map((finding) => <div key={finding.code} className="rounded-xl border border-white/[.07] bg-black/15 p-4"><span className="font-mono text-[9px] uppercase text-cyan-300">{finding.severity}</span><div className="mt-1 text-xs text-white/70">{finding.title}</div></div>)}</div></div><div className="mt-5 flex justify-end"><button onClick={() => void buildPreview()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-xs font-bold text-[#050914] hover:bg-cyan-300 disabled:opacity-50">{busy ? <Loader2 className="animate-spin" size={15}/> : <Sparkles size={15}/>} Transformation vorbereiten <ArrowRight size={15}/></button></div></section>}

          {phase === 'preview' && previewBlueprint && <section className="pb-14"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{SITE_DESIGN_TEMPLATES.map(item => <button key={item.id} onClick={() => setTemplate(item.id)} className={`rounded-full border px-4 py-2 text-xs transition ${template === item.id ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-300' : 'border-white/10 text-white/45 hover:text-white'}`}>{item.label}</button>)}</div><span className="text-[10px] uppercase tracking-[.15em] text-white/25">Live Blueprint Preview</span></div><div className="overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl shadow-black/40"><iframe title="Neue Website Vorschau" srcDoc={previewHtml} className="h-[680px] w-full bg-white" sandbox="allow-same-origin" /></div><div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{FEATURES.map(([id,label,Icon]) => <div key={id} className="flex items-center gap-3 rounded-xl border border-white/[.08] bg-white/[.025] p-3 text-xs"><Icon size={15} className="text-cyan-300"/><span className="text-white/60">{label}</span><Check size={14} className="ml-auto text-emerald-400"/></div>)}</div><div className="mt-6 flex justify-end"><button onClick={() => setPhase('offer')} className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-xs font-bold text-[#050914] hover:bg-cyan-300">Umsetzung ansehen <ArrowRight size={15}/></button></div></section>}

          {phase === 'offer' && <section className="mx-auto max-w-3xl pb-14"><div className="grid gap-4 sm:grid-cols-[1.4fr_.8fr]"><div className="rounded-3xl border border-white/[.08] bg-white/[.025] p-7 sm:p-8"><div className="font-mono text-[9px] uppercase tracking-[.2em] text-cyan-300">SiteOS Transformation</div><h2 className="mt-3 text-2xl font-bold tracking-tight">Aus Analyse wird Umsetzung.</h2><p className="mt-3 text-sm leading-6 text-white/45">Ihre bestehende Website wird auf Basis des Befunds neu strukturiert, modernisiert und als SiteOS-Projekt vorbereitet. Die alte Website bleibt dabei unangetastet.</p><div className="mt-7 space-y-3 text-sm text-white/60"><div className="flex items-center gap-3"><Check size={15} className="text-emerald-400"/> Modernere Informationsarchitektur</div><div className="flex items-center gap-3"><Check size={15} className="text-emerald-400"/> SEO- und Performance-Fokus</div><div className="flex items-center gap-3"><Check size={15} className="text-emerald-400"/> DSGVO- und AI-Act-Workflow</div><div className="flex items-center gap-3"><Check size={15} className="text-emerald-400"/> Nachvollziehbare Evidence-Kette</div></div></div><div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/[.045] p-7 sm:p-8"><div className="text-xs text-white/40">Einmalige Transformation</div><div className="mt-2 text-4xl font-bold tracking-tight">{launchTier ? `${launchTier.priceString} €` : '—'}</div><div className="mt-1 text-xs text-white/30">{launchTier?.priceSuffix ?? 'Preis aus Pricing-SSoT'}</div><button onClick={() => void chooseTransformation()} disabled={!launchTier || busy} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3.5 text-sm font-bold text-[#050914] hover:bg-cyan-300 disabled:opacity-40">{busy ? <Loader2 size={16} className="animate-spin"/> : null}{busy ? 'Checkout wird vorbereitet …' : 'Website transformieren'} {!busy && <ArrowRight size={16}/>}</button><button onClick={declineTransformation} disabled={busy || !planTier} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-5 py-3.5 text-xs font-semibold text-white/55 hover:border-white/20 hover:text-white disabled:opacity-40">Normale Pakete ansehen <ArrowRight size={14}/></button></div></div></section>}

          {error && <div role="alert" className="mx-auto mb-10 max-w-2xl rounded-xl border border-rose-400/20 bg-rose-400/[.06] px-4 py-3 text-center text-xs text-rose-300">{error}</div>}
        </div>
      </div>
    </main>
  );
}
