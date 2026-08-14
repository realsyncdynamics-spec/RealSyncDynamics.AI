import { useMemo, useState } from 'react';
import { ArrowRight, Bot, CalendarDays, Check, Globe2, Loader2, Phone, Search, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';
import { useTenant } from '../core/access/TenantProvider';
import { useSupabaseAuth } from '../features/supabase/SupabaseAuthContext';
import { createCheckoutSession, createSiteOsBundleCheckoutSession, createSiteOsCheckoutSession } from '../features/billing/checkout';
import { buildSite, errorMessage, runPublicAiStudioScan, runScan, type PublicAiStudioScanResponse } from '../features/siteos/siteOsApi';
import type { SiteBlueprint, SitePage } from '../../packages/siteos-core/src/index';
import { renderSite } from '../../packages/siteos-core/src/render/renderer';
import { applySiteDesignTemplate, SITE_DESIGN_TEMPLATES, type SiteDesignTemplate } from '../../packages/siteos-core/src/render/templates';
import { ONE_TIME_PRICING_TIERS, PUBLIC_PRICING_TIERS, type PricingTier } from '../config/pricing';

const FEATURES = [
  ['chatbot', 'AI-Chat', Bot], ['phonebot', 'Telefon-AI', Phone], ['booking', 'Terminbuchung', CalendarDays],
  ['seo', 'SEO', Search], ['accessibility', 'Barrierefreiheit', Check], ['dsgvo', 'DSGVO', ShieldCheck], ['ai-act', 'EU AI Act', ShieldCheck],
] as const;

type Discovery = { source_url: string; title: string | null; description: string | null; h1: string | null; services: string[]; visible_text: string };
type Phase = 'input' | 'scan' | 'preview' | 'offer';
type OfferMode = 'landing' | 'package' | 'bundle';
type ScoreSet = { health?: number; compliance?: number; performance?: number; aiRisk?: number; risk?: number };

function packageCandidates() {
  return PUBLIC_PRICING_TIERS.filter((tier) => tier.plan.purchaseMode === 'checkout' && tier.recurring && !tier.isYearly);
}

function recommendedPlan(features: string[], scores?: ScoreSet): PricingTier | undefined {
  const candidates = packageCandidates();
  const wantsAdvanced = features.includes('phonebot') || features.includes('booking') || features.includes('ai-act');
  if (!candidates.length) return undefined;
  if (wantsAdvanced) return candidates.find((tier) => tier.planKey === 'growth') ?? candidates[1] ?? candidates[0];
  if (typeof scores?.risk === 'number' && scores.risk < 70) return candidates.find((tier) => tier.planKey === 'growth') ?? candidates[1] ?? candidates[0];
  return candidates.find((tier) => tier.planKey === 'starter') ?? candidates[0];
}

/** Convert the public AI Studio PageSpec payload into the deterministic SiteOS preview contract. */
function publicBlueprint(data: PublicAiStudioScanResponse, sourceUrl: string): SiteBlueprint | null {
  if (data.blueprint) return data.blueprint;
  if (!Array.isArray(data.pages) || data.pages.length === 0) return null;

  const pages = data.pages.map((raw, index) => {
    const page = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const blocks = Array.isArray(page.blocks) ? page.blocks : [];
    return {
      path: typeof page.path === 'string' ? page.path : index === 0 ? '/' : `/page-${index + 1}`,
      title: typeof page.title === 'string' ? page.title : 'Neue Website',
      description: typeof page.description === 'string' ? page.description : '',
      blocks: blocks.map((block, blockIndex) => {
        const value = (block && typeof block === 'object' ? block : {}) as Record<string, unknown>;
        return {
          id: typeof value.id === 'string' ? value.id : `public-${index}-${blockIndex}`,
          kind: (typeof value.kind === 'string' ? value.kind : 'hero') as SitePage['blocks'][number]['kind'],
          content: (value.content && typeof value.content === 'object' ? value.content : {}) as Record<string, unknown>,
          processesPersonalData: Boolean(value.processesPersonalData),
          thirdPartyHosts: Array.isArray(value.thirdPartyHosts) ? value.thirdPartyHosts.filter((item): item is string => typeof item === 'string') : [],
          aiGenerated: true,
        };
      }),
      noindex: Boolean(page.noindex),
    } satisfies SitePage;
  });

  const title = data.discovery?.title ?? data.discovery?.h1 ?? 'Neue Website';
  const description = data.discovery?.description ?? 'AI-gestützte Website-Transformation auf Basis von Evidence.';
  return {
    schemaVersion: 1,
    slug: new URL(sourceUrl).hostname.replace(/^www\./, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase(),
    name: title,
    industry: 'sonstiges',
    locales: { default: 'de', supported: ['de'] },
    theme: { mode: 'light', accent: '#145CFF', surface: '#F7F8FA', foreground: '#111827', fontDisplay: 'Inter, system-ui, sans-serif', fontBody: 'Inter, system-ui, sans-serif', radiusPx: 14 },
    pages,
    seo: { siteName: title, defaultTitle: title, defaultDescription: description, keywords: [], structuredDataType: 'WebPage', locality: null },
    compliance: { specialCategories: false, legalBases: [], consentCategories: [], policyPackIds: [], controlRefs: [], dpiaRequired: false },
    transformation: { variant: 'modern', source_domain: new URL(sourceUrl).hostname, evidence_hash: data.evidence_hash ?? 'public-ai-studio', backend_preservation: 'preserve_all' },
    origin: { source: 'ai-builder', model: 'public-ai-studio', promptSha256: null, createdAt: new Date().toISOString() },
  };
}

const PHASES = [
  { id: 'input' as const, label: 'Analyse' },
  { id: 'scan' as const, label: 'Befund' },
  { id: 'preview' as const, label: 'Vorschau' },
  { id: 'offer' as const, label: 'Entscheidung' },
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
  const [blueprint, setBlueprint] = useState<SiteBlueprint | null>(null);
  const [template, setTemplate] = useState<SiteDesignTemplate>('modern-minimal');
  const [offerMode, setOfferMode] = useState<OfferMode>('landing');
  const [selectedPlanKey, setSelectedPlanKey] = useState('');
  const features = FEATURES.map(([id]) => id);
  const packageTiers = useMemo(packageCandidates, []);
  const recommended = recommendedPlan(features, scan?.scores);
  const selectedPlan = packageTiers.find((tier) => tier.planKey === selectedPlanKey) ?? recommended;
  const launchTier = ONE_TIME_PRICING_TIERS.find((tier) => tier.planKey === 'governance_launch');
  const previewBlueprint = useMemo(() => blueprint ? applySiteDesignTemplate(blueprint, template) : null, [blueprint, template]);
  const previewHtml = useMemo(() => previewBlueprint ? renderSite(previewBlueprint, { baseUrl: url }).find((page) => page.path === '/')?.html ?? '' : '', [previewBlueprint, url]);
  const currentPhase = PHASES.findIndex((item) => item.id === phase);

  async function startScan() {
    const clean = url.trim();
    if (!/^https?:\/\/[^\s]+$/i.test(clean)) { setError('Bitte eine vollständige URL inklusive https:// eingeben.'); return; }
    setBusy(true); setError('');
    try {
      if (!isAuthenticated) {
        const result = await runPublicAiStudioScan({ url: clean, locale: 'de' });
        if (result.kind !== 'ok') throw new Error(errorMessage(result));
        const data = result.data;
        const found: Discovery = {
          source_url: data.source_url,
          title: data.discovery?.title ?? null,
          description: data.discovery?.description ?? null,
          h1: data.discovery?.h1 ?? null,
          services: data.discovery?.services ?? [],
          visible_text: data.discovery?.visible_text ?? '',
        };
        const scores = data.audit?.scores ?? data.scores ?? {};
        const findings = data.audit?.findings ?? data.findings ?? [];
        const generatedBlueprint = publicBlueprint(data, data.source_url);
        setDiscovery(found);
        setScan({ scores, findings });
        if (generatedBlueprint) {
          setBlueprint(generatedBlueprint);
          setPhase('preview');
        } else {
          setPhase('scan');
        }
        return;
      }

      if (!activeTenantId) { setError('Bitte zuerst den Workspace einrichten.'); return; }
      const sb = getSupabase();
      const { data, error: discoveryError } = await sb.functions.invoke('siteos-discover', { body: { tenant_id: activeTenantId, url: clean } });
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
  }

  async function generateLanding() {
    if (!discovery) return;
    setBusy(true); setError('');
    try {
      if (!isAuthenticated) {
        const result = await runPublicAiStudioScan({ url: discovery.source_url, locale: 'de' });
        if (result.kind !== 'ok') throw new Error(errorMessage(result));
        const generatedBlueprint = publicBlueprint(result.data, result.data.source_url);
        if (!generatedBlueprint) throw new Error('Der öffentliche AI-Studio-Befund enthält noch keine renderbare PageSpec.');
        setBlueprint(generatedBlueprint);
        setPhase('preview');
        return;
      }
      if (!activeTenantId) { setError('Bitte zuerst den Workspace einrichten.'); return; }
      const selected = FEATURES.map(([, label]) => label).join(', ');
      const prompt = [
        'Erstelle ein vollständiges Redesign der bestehenden Website als neues RealSync SiteOS-Projekt.',
        `Gewünschte Funktionen: ${selected}.`,
        `Ausgangsseite: ${discovery.source_url}.`,
        `Titel: ${discovery.title ?? discovery.h1 ?? 'unbekannt'}.`,
        `Leistungen: ${discovery.services.join(', ')}.`,
        'Nutze die Scan-Befunde als Remediation-Kontext und modernisiere Informationsarchitektur, visuelle Hierarchie, Typografie, responsive Layouts und Conversion-Struktur.',
        'Erzeuge eine strukturierte Landingpage-Spezifikation. Kein direktes Produktions-HTML.',
        'Backend, APIs, Auth, Datenbank und Business Logic der bestehenden Website bleiben unangetastet.',
      ].join('\n');
      const result = await buildSite({ tenant_id: activeTenantId, prompt, locale: 'de', enrichment: { name: discovery.title ?? discovery.h1 ?? undefined, summary: discovery.description ?? discovery.visible_text.slice(0, 500), services: discovery.services } });
      if (result.kind !== 'ok') throw new Error(errorMessage(result));
      if (!result.data.blueprint) throw new Error('Blueprint wurde erstellt, aber die Vorschau-Daten fehlen.');
      setBlueprint(result.data.blueprint);
      setPhase('preview');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Die neue Website konnte nicht erzeugt werden.'); }
    finally { setBusy(false); }
  }

  async function checkout() {
    if (!discovery) { setError('Ausgangs-Website fehlt.'); return; }
    if (!isAuthenticated) {
      const next = `/handwerk-website?source_url=${encodeURIComponent(discovery.source_url)}`;
      navigate(`/welcome?next=${encodeURIComponent(next)}`);
      return;
    }
    if (!activeTenantId) { setError('Bitte zuerst den Workspace einrichten.'); return; }
    if (offerMode !== 'landing' && !selectedPlan) { setError('Bitte ein Governance-Paket auswählen.'); return; }
    setBusy(true); setError('');
    try {
      const common = { tenantId: activeTenantId, sourceUrl: discovery.source_url, siteSlug: blueprint?.slug, projectName: discovery.title ?? discovery.h1 ?? undefined };
      const result = offerMode === 'landing'
        ? await createSiteOsCheckoutSession(common)
        : offerMode === 'bundle'
          ? await createSiteOsBundleCheckoutSession({ ...common, planKey: selectedPlan!.planKey })
          : await createCheckoutSession(activeTenantId, selectedPlan!.planKey);
      if (!result.ok || !result.url) { setError(result.error?.message ?? 'Stripe Checkout konnte nicht vorbereitet werden.'); return; }
      window.location.assign(result.url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Stripe Checkout konnte nicht vorbereitet werden.'); }
    finally { setBusy(false); }
  }

  const copy = {
    input: ['SITEOS · WEBSITE TRANSFORMATION', 'Ihre Website. Klarer. Schneller. Stärker.', 'Wir analysieren Ihre bestehende Website und zeigen Ihnen konkret, wo Design, SEO, Performance und Compliance verbessert werden können.'],
    scan: ['ANALYSE · LIVE BEFUND', 'Jetzt sehen Sie, was wirklich zählt.', 'Technische Schwachstellen, SEO-Potenzial und Compliance-Risiken — kompakt auf einer Oberfläche.'],
    preview: ['TRANSFORMATION · REALSYNC AI STUDIO', 'So kann Ihre Website aussehen.', 'Aus dem Befund entsteht eine echte SiteOS-Vorschau — nicht nur ein Screenshot und kein loses Design-Mockup.'],
    offer: ['TRANSFORMATION · IHRE ENTSCHEIDUNG', 'Sie entscheiden, was Sie mitnehmen.', 'Nur die neue Landingpage, nur ein Governance-Paket oder beides zusammen. Ihre bestehende Website bleibt unangetastet.'],
  }[phase];

  return (
    <main className="min-h-screen bg-[#050914] text-white antialiased">
      <div className="mx-auto max-w-7xl px-5 py-5 sm:px-8">
        <header className="flex items-center justify-between border-b border-white/[.08] pb-5"><div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg border border-cyan-400/20 bg-cyan-400/10"><Sparkles size={15} className="text-cyan-300" /></span><span className="text-sm font-semibold tracking-tight">RealSyncDynamics.AI</span></div><div className="hidden items-center gap-6 text-xs text-white/45 sm:flex"><span>RealSync AI Studio</span><span>Governance</span><button onClick={() => navigate('/login')} className="text-white/70 hover:text-white">Login</button></div></header>
        <div className="mx-auto max-w-6xl pt-7">
          <div className="flex items-center justify-center gap-2 sm:gap-4">{PHASES.map((item, index) => <div key={item.id} className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[.16em]"><span className={`grid h-6 w-6 place-items-center rounded-full border ${index <= currentPhase ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-300' : 'border-white/10 text-white/25'}`}>{index + 1}</span><span className={index <= currentPhase ? 'text-white/65' : 'hidden text-white/25 sm:inline'}>{item.label}</span>{index < PHASES.length - 1 && <span className="mx-1 h-px w-4 bg-white/10 sm:w-10" />}</div>)}</div>
          <section className="relative overflow-hidden pb-12 pt-14 text-center sm:pt-20"><div className="pointer-events-none absolute left-1/2 top-8 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-400/[.06] blur-3xl" /><div className="relative"><div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/[.06] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[.2em] text-cyan-300"><Zap size={11} /> {copy[0]}</div><h1 className="mx-auto mt-6 max-w-4xl text-4xl font-extrabold leading-[1.04] tracking-[-.035em] sm:text-6xl lg:text-7xl">{copy[1]}</h1><p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-white/50 sm:text-base">{copy[2]}</p></div>{phase === 'input' && <><div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-white/[.10] bg-white/[.035] p-2 shadow-2xl shadow-black/30 sm:rounded-3xl sm:p-3"><div className="flex flex-col gap-2 sm:flex-row"><div className="flex min-w-0 flex-1 items-center rounded-xl border border-white/[.08] bg-black/25 px-4 sm:rounded-2xl"><Globe2 className="mr-3 shrink-0 text-cyan-400" size={18} /><input autoFocus value={url} onChange={(event) => { setUrl(event.target.value); setError(''); }} onKeyDown={(event) => { if (event.key === 'Enter') void startScan(); }} placeholder="https://ihre-website.de" className="w-full bg-transparent py-4 text-sm outline-none placeholder:text-white/25" aria-label="Website URL" /></div><button onClick={() => void startScan()} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-6 py-4 text-sm font-bold text-[#050914] hover:bg-cyan-300 disabled:opacity-50 sm:rounded-2xl">{busy ? <Loader2 className="animate-spin" size={17} /> : <Search size={17} />}{busy ? 'Website wird analysiert …' : 'Website analysieren'}<ArrowRight size={17} /></button></div></div><div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] text-white/30"><span>URL genügt</span><span>Keine Änderung an Ihrer Website</span><span>Evidence + AI Transformation</span></div></>}</section>

          {phase === 'scan' && scan && <section className="pb-14"><div className="grid gap-3 sm:grid-cols-5">{[['Website Health', scan.scores.health], ['DSGVO', scan.scores.compliance], ['Performance', scan.scores.performance], ['AI Risk', scan.scores.aiRisk], ['Risiko', scan.scores.risk]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-white/[.08] bg-white/[.025] p-5"><div className="text-xs text-white/40">{label}</div><div className="mt-2 text-3xl font-bold">{typeof value === 'number' ? Math.round(value) : '—'}<span className="text-sm font-normal text-white/20">/100</span></div></div>)}</div><div className="mt-4 rounded-2xl border border-white/[.08] bg-white/[.025] p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="text-sm font-semibold">{scan.findings.length} relevante Findings</div><div className="mt-1 text-xs text-white/35">Technische Evidence und die wichtigsten Befunde.</div></div><span className="font-mono text-[9px] uppercase tracking-[.18em] text-cyan-300">Evidence trail</span></div><div className="mt-5 grid gap-2 md:grid-cols-2">{scan.findings.slice(0, 8).map((finding) => <div key={finding.code} className="rounded-xl border border-white/[.07] bg-black/15 p-4"><span className="font-mono text-[9px] uppercase text-cyan-300">{finding.severity}</span><div className="mt-1 text-xs text-white/70">{finding.title}</div></div>)}</div></div><div className="mt-5 flex justify-end"><button onClick={() => void generateLanding()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-xs font-bold text-[#050914] hover:bg-cyan-300 disabled:opacity-50">{busy ? <Loader2 className="animate-spin" size={15} /> : <Sparkles size={15} />} Neue Landingpage generieren <ArrowRight size={15} /></button></div></section>}

          {phase === 'preview' && previewBlueprint && <section className="pb-14"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{SITE_DESIGN_TEMPLATES.map((item) => <button key={item.id} onClick={() => setTemplate(item.id)} className={`rounded-full border px-4 py-2 text-xs ${template === item.id ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-300' : 'border-white/10 text-white/45 hover:text-white'}`}>{item.label}</button>)}</div><span className="text-[10px] uppercase tracking-[.15em] text-white/25">RealSync AI Studio · Live Blueprint</span></div><div className="overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl shadow-black/40"><iframe title="Neue Website Vorschau" srcDoc={previewHtml} className="h-[680px] w-full bg-white" sandbox="allow-same-origin" /></div><div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{FEATURES.map(([id, label, Icon]) => <div key={id} className="flex items-center gap-3 rounded-xl border border-white/[.08] bg-white/[.025] p-3 text-xs"><Icon size={15} className="text-cyan-300" /><span className="text-white/60">{label}</span><Check size={14} className="ml-auto text-emerald-400" /></div>)}</div><div className="mt-6 flex justify-end"><button onClick={() => setPhase('offer')} className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-xs font-bold text-[#050914] hover:bg-cyan-300">Meine Optionen anzeigen <ArrowRight size={15} /></button></div></section>}

          {phase === 'offer' && <section className="pb-16"><div className="mx-auto max-w-5xl"><div className="mb-6 grid gap-3 md:grid-cols-3">{[['landing', 'Neue Landingpage', '€349 einmalig', 'Die neue Frontend-/Landingpage wird gebaut. Backend, APIs, Auth und Datenbank bleiben unverändert.'], ['package', 'Governance-Paket', 'monatlich', 'Laufende Governance, Monitoring und Compliance — ohne neue Landingpage.'], ['bundle', 'Landingpage + Paket', '€349 + monatlich', 'Transformation und laufende Governance in einem Stripe-Checkout.']].map(([mode, title, price, description]) => <button key={mode} onClick={() => setOfferMode(mode as OfferMode)} className={`text-left rounded-3xl border p-6 transition ${offerMode === mode ? 'border-cyan-400/60 bg-cyan-400/[.07]' : 'border-white/[.08] bg-white/[.025] hover:border-white/20'}`}><div className="flex items-center justify-between"><span className="font-mono text-[9px] uppercase tracking-[.18em] text-cyan-300">{mode === 'bundle' ? 'BESTER WERT' : mode === 'landing' ? 'TRANSFORMATION' : 'GOVERNANCE'}</span>{offerMode === mode && <Check size={16} className="text-cyan-300" />}</div><h2 className="mt-4 text-xl font-bold">{title}</h2><div className="mt-2 text-sm font-semibold text-white/80">{price}</div><p className="mt-3 text-xs leading-6 text-white/40">{description}</p></button>)}</div>{(offerMode === 'package' || offerMode === 'bundle') && <div className="rounded-3xl border border-white/[.08] bg-white/[.025] p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-mono text-[9px] uppercase tracking-[.2em] text-cyan-300">Governance-Paket wählen</div><h3 className="mt-2 text-lg font-semibold">Welches Paket passt zu Ihrer Website?</h3></div><span className="text-xs text-white/35">Preis aus Pricing-SSoT</span></div><div className="mt-5 grid gap-3 md:grid-cols-3">{packageTiers.map((tier) => <button key={tier.planKey} onClick={() => setSelectedPlanKey(tier.planKey)} className={`rounded-2xl border p-4 text-left ${selectedPlan?.planKey === tier.planKey ? 'border-cyan-400/60 bg-cyan-400/[.06]' : 'border-white/[.08] bg-black/10'}`}><div className="font-semibold">{tier.name}</div><div className="mt-1 text-lg font-bold">{tier.priceString} € <span className="text-xs font-normal text-white/35">{tier.priceSuffix}</span></div><div className="mt-2 text-[11px] leading-5 text-white/35">{tier.subline}</div></button>)}</div></div>}
                <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_.7fr]"><div className="rounded-3xl border border-white/[.08] bg-white/[.025] p-7"><div className="font-mono text-[9px] uppercase tracking-[.2em] text-cyan-300">Ihre Entscheidung</div><h2 className="mt-3 text-2xl font-bold">{offerMode === 'landing' ? 'Neue Landingpage für €349.' : offerMode === 'package' ? 'Governance jetzt starten.' : 'Landingpage + Governance zusammen starten.'}</h2><p className="mt-3 text-sm leading-6 text-white/45">{offerMode === 'landing' ? 'Einmalig €349. Ihre neue Landingpage wird nach Zahlung in Ihrem Transformation-Dashboard bereitgestellt.' : offerMode === 'package' ? `Sie starten ${selectedPlan?.name ?? 'Ihr Governance-Paket'} ohne Website-Transformation.` : `Sie erhalten die neue Landingpage für €349 und ${selectedPlan?.name ?? 'Ihr Governance-Paket'} in einem Stripe-Checkout.`}</p><div className="mt-6 space-y-3 text-sm text-white/60"><div className="flex items-center gap-3"><Check size={15} className="text-emerald-400" /> DSGVO / SEO / Governance-Befunde bleiben als Evidence erhalten.</div><div className="flex items-center gap-3"><Check size={15} className="text-emerald-400" /> Backend, API, Auth und Datenbank bleiben unangetastet.</div><div className="flex items-center gap-3"><Check size={15} className="text-emerald-400" /> Nach Stripe geht es direkt ins passende Dashboard.</div></div></div><div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/[.045] p-7"><div className="text-xs text-white/40">Jetzt starten</div><div className="mt-2 text-3xl font-bold">{offerMode === 'landing' ? `${launchTier?.priceString ?? '349'} € einmalig` : offerMode === 'package' ? `${selectedPlan?.priceString ?? '—'} € ${selectedPlan?.priceSuffix ?? ''}` : `${launchTier?.priceString ?? '349'} € + ${selectedPlan?.priceString ?? '—'} € ${selectedPlan?.priceSuffix ?? ''}`}</div><button onClick={() => void checkout()} disabled={busy || (offerMode !== 'landing' && !selectedPlan)} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3.5 text-sm font-bold text-[#050914] hover:bg-cyan-300 disabled:opacity-40">{busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}{busy ? 'Checkout wird vorbereitet …' : 'Mit Stripe fortfahren'}</button><div className="mt-3 text-center text-[10px] leading-5 text-white/30">Sichere Stripe-Zahlung. Entitlements werden ausschließlich serverseitig vergeben.</div></div></div></div></section>}

          {error && <div role="alert" className="mx-auto mb-10 max-w-2xl rounded-xl border border-rose-400/20 bg-rose-400/[.06] px-4 py-3 text-center text-xs text-rose-300">{error}</div>}
        </div>
      </div>
    </main>
  );
}
