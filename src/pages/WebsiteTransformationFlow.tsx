import { useMemo, useState } from 'react';
import { ArrowRight, Bot, CalendarDays, Check, Globe2, Loader2, Phone, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';
import { useTenant } from '../core/access/TenantProvider';
import { useSupabaseAuth } from '../features/supabase/SupabaseAuthContext';
import { buildSite, errorMessage, runScan } from '../features/siteos/siteOsApi';
import type { SiteBlueprint } from '../../packages/siteos-core/src/index';
import { renderSite } from '../../packages/siteos-core/src/render/renderer';
import { applySiteDesignTemplate, SITE_DESIGN_TEMPLATES, type SiteDesignTemplate } from '../../packages/siteos-core/src/render/templates';
import { ONE_TIME_PRICING_TIERS, PUBLIC_PRICING_TIERS, type PricingTier } from '../config/pricing';

const FEATURES = [
  ['chatbot', 'Chatbot', Bot], ['phonebot', 'Telefonbot', Phone], ['booking', 'Booking', CalendarDays],
  ['seo', 'SEO', Search], ['accessibility', 'Barrierefreiheit', Check], ['dsgvo', 'DSGVO', ShieldCheck], ['ai-act', 'AI Act', ShieldCheck],
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
  const [dsgvoUpgrade, setDsgvoUpgrade] = useState<boolean | null>(null);
  const [features] = useState<string[]>(FEATURES.map(([id]) => id));

  const previewBlueprint = useMemo(() => blueprint ? applySiteDesignTemplate(blueprint, template) : null, [blueprint, template]);
  const previewHtml = useMemo(() => previewBlueprint ? renderSite(previewBlueprint, { baseUrl: url }).find((page) => page.path === '/')?.html ?? '' : '', [previewBlueprint, url]);
  const launchTier = ONE_TIME_PRICING_TIERS.find((tier) => tier.planKey === 'governance_launch');
  const planTier = recommendedPlan(features, scan?.scores);

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

  const goToOffer = () => { setDsgvoUpgrade(null); setPhase('offer'); };

  const chooseTransformation = () => {
    if (!launchTier?.cta.href) return;
    setDsgvoUpgrade(true);
    window.location.href = launchTier.cta.href;
  };

  const declineTransformation = () => {
    setDsgvoUpgrade(false);
    navigate(planTier?.cta.href ?? '/pricing');
  };

  return (
    <main className="min-h-screen bg-[rgb(3,7,18)] text-white antialiased">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8">
        <header className="flex items-center justify-between border-b border-white/10 pb-5"><span className="text-sm text-white/55">RealSyncDynamics.AI</span><span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-cyan-300"><Sparkles size={13}/> Website Intelligence</span></header>
        <section className="mx-auto max-w-5xl py-12">
          <div className="text-center"><div className="font-mono text-[10px] uppercase tracking-[.2em] text-cyan-300">{phase === 'input' ? '01 / WEBSITE SCAN' : phase === 'scan' ? '02 / ANALYSE' : phase === 'preview' ? '03 / REDESIGN' : '04 / ANGEBOT'}</div><h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-6xl">{phase === 'input' ? 'Aus Ihrer Website wird eine bessere Website.' : phase === 'scan' ? 'Wir zeigen Ihnen, was Ihre Website besser machen kann.' : phase === 'preview' ? 'So kann Ihre neue Website aussehen.' : 'Sie entscheiden, wie wir weitermachen.'}</h1><p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/50">{phase === 'input' ? 'Wir analysieren zuerst Ihre bestehende Website. Danach erstellen wir daraus eine moderne, SEO-starke und DSGVO-orientierte neue Version – inklusive der Funktionen, die Ihr Unternehmen wirklich braucht.' : phase === 'scan' ? 'Wir verbinden technische Analyse, SEO, DSGVO und EU-AI-Act-Anforderungen mit konkreten Modernisierungsmöglichkeiten für Ihre neue Website.' : phase === 'preview' ? 'Keine Design-Folie: Die Vorschau wird aus einem echten SiteOS-Blueprint gerendert und kann als Grundlage für den späteren Umbau dienen.' : 'Nach der Vorschau sehen Sie transparent, was der einmalige Umbau umfasst und welches laufende Paket zu Ihrer neuen Website passt.'}</p></div>

          {phase === 'input' && <div className="mx-auto mt-10 max-w-3xl rounded-3xl border border-white/10 bg-white/[.035] p-3"><div className="flex flex-col gap-3 sm:flex-row"><div className="flex flex-1 items-center rounded-2xl border border-white/10 bg-black/25 px-4"><Globe2 className="mr-3 text-cyan-400" size={18}/><input autoFocus value={url} onChange={e => { setUrl(e.target.value); setError(''); }} placeholder="z. B. https://ihre-website.de" className="w-full bg-transparent py-4 text-sm outline-none placeholder:text-white/25" /></div><button onClick={() => void startScan()} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-6 py-4 text-sm font-bold text-[rgb(3,7,18)]">{busy ? <Loader2 className="animate-spin" size={17}/> : <Search size={17}/>} {busy ? 'Website wird analysiert …' : 'Website prüfen'}<ArrowRight size={17}/></button></div></div>}

          {phase === 'scan' && scan && <div className="mt-10"><div className="grid gap-3 sm:grid-cols-5">{[['Health', scan.scores.health], ['DSGVO', scan.scores.compliance], ['Performance', scan.scores.performance], ['AI Risk', scan.scores.aiRisk], ['Risiken', scan.scores.risk]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[.03] p-5"><div className="text-xs text-white/40">{label}</div><div className="mt-2 text-3xl font-bold">{typeof value === 'number' ? Math.round(value) : '—'}<span className="text-sm text-white/25">/100</span></div></div>)}</div><div className="mt-5 rounded-2xl border border-white/10 bg-white/[.03] p-5"><div className="flex items-center justify-between"><span className="text-sm font-semibold">{scan.findings.length} Optimierungspotenziale erkannt</span><span className="font-mono text-[10px] text-cyan-300">SCAN EVIDENCE</span></div><div className="mt-4 grid gap-2 md:grid-cols-2">{scan.findings.slice(0, 6).map((finding) => <div key={finding.code} className="rounded-xl border border-white/10 p-3 text-xs"><span className="font-mono text-cyan-300">{finding.severity}</span><div className="mt-1 text-white/70">{finding.title}</div></div>)}</div></div><div className="mt-6 flex justify-end"><button onClick={() => void buildPreview()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-xs font-bold text-[rgb(3,7,18)]">{busy ? <Loader2 className="animate-spin" size={15}/> : <Sparkles size={15}/>} Neue Website erstellen <ArrowRight size={15}/></button></div></div>}

          {phase === 'preview' && previewBlueprint && <div className="mt-8"><div className="mb-4 flex flex-wrap gap-2">{SITE_DESIGN_TEMPLATES.map(item => <button key={item.id} onClick={() => setTemplate(item.id)} className={`rounded-full border px-4 py-2 text-xs ${template === item.id ? 'border-cyan-400 bg-cyan-400/10 text-cyan-300' : 'border-white/10 text-white/50'}`}>{item.label}</button>)}</div><div className="overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl"><iframe title="Vorschau der neuen Website" srcDoc={previewHtml} className="h-[680px] w-full bg-white" sandbox="allow-same-origin" /></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{FEATURES.map(([id,label,Icon]) => <div key={id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] p-3 text-xs"><Icon size={15} className="text-cyan-300"/><span>{label}</span><Check size={14} className="ml-auto text-emerald-400"/></div>)}</div><div className="mt-6 flex justify-end"><button onClick={goToOffer} className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-xs font-bold text-[rgb(3,7,18)]">Umbau & Angebot ansehen <ArrowRight size={15}/></button></div></div>}

          {phase === 'offer' && <div className="mx-auto mt-10 max-w-2xl"><div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/[.04] p-8"><div className="font-mono text-[10px] uppercase tracking-[.18em] text-cyan-300">Website Transformation</div><h2 className="mt-3 text-2xl font-bold">DSGVO-/SEO-Umbau durchführen?</h2><p className="mt-3 text-sm leading-6 text-white/55">Ihre bestehende Website wurde analysiert und eine neue Version als SiteOS-Blueprint erzeugt. Der einmalige Umbaupreis kommt ausschließlich aus der zentralen Pricing-SSoT.</p><div className="mt-7 rounded-2xl border border-white/10 bg-black/20 p-5"><div className="text-xs text-white/40">Einmaliger Website-Umbau</div><div className="mt-2 text-4xl font-bold">{launchTier ? `${launchTier.priceString} €` : 'Preis folgt aus Pricing-SSoT'}</div><div className="mt-1 text-xs text-white/35">{launchTier?.priceSuffix ?? 'Einmalangebot'}</div></div><div className="mt-7 grid gap-3 sm:grid-cols-2"><button onClick={chooseTransformation} disabled={!launchTier} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3.5 text-sm font-bold text-[rgb(3,7,18)] disabled:opacity-40">Ja, Website umbauen <ArrowRight size={16}/></button><button onClick={declineTransformation} disabled={!planTier} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-5 py-3.5 text-sm font-semibold hover:border-cyan-400/40 disabled:opacity-40">Nein, normale Pakete <ArrowRight size={16}/></button></div></div><div className="mt-4 text-center text-xs text-white/30">Ja → Stripe für den einmaligen Umbau. Nein → normale Stripe-Pakete. Nach dem Kauf → Dashboard.</div></div>}

          {error && <p role="alert" className="mt-5 text-center text-xs text-rose-300">{error}</p>}
        </section>
      </div>
    </main>
  );
}
