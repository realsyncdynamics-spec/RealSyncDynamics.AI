import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, ChevronLeft, Loader2, Monitor, Palette, RefreshCw, Smartphone, Sparkles, Tablet, Wand2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSupabase } from '../../lib/supabase';
import { useTenant } from '../../core/access/TenantProvider';
import { useSupabaseAuth } from '../../features/supabase/SupabaseAuthContext';
import { buildSite, errorMessage } from '../../features/siteos/siteOsApi';
import type { SiteBlueprint } from '../../../packages/siteos-core/src/index';
import { renderSite } from '../../../packages/siteos-core/src/render/renderer';
import { applySiteDesignTemplate, SITE_DESIGN_TEMPLATES, type SiteDesignTemplate } from '../../../packages/siteos-core/src/render/templates';
import { createSiteOsCheckoutSession } from '../../features/billing/checkout';

type Discovery = { source_url: string; title: string | null; description: string | null; h1: string | null; services: string[]; visible_text: string };
type Device = 'desktop' | 'tablet' | 'mobile';

const DEVICE_WIDTH: Record<Device, string> = { desktop: '100%', tablet: '820px', mobile: '390px' };
const SECTIONS = ['Hero', 'Leistungen', 'Über uns', 'Vorteile', 'Referenzen', 'FAQ', 'Kontakt', 'Footer'];

export default function PreviewSelectionPage() {
  const navigate = useNavigate();
  const { activeTenantId } = useTenant();
  const { isAuthenticated } = useSupabaseAuth();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const sourceUrl = params.get('url') || params.get('domain') || '';
  const auditId = params.get('auditId') || params.get('auditid') || '';
  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const [blueprint, setBlueprint] = useState<SiteBlueprint | null>(null);
  const [template, setTemplate] = useState<SiteDesignTemplate>((params.get('variant') as SiteDesignTemplate) || 'modern-minimal');
  const [device, setDevice] = useState<Device>('desktop');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [instruction, setInstruction] = useState('');

  const build = useCallback(async (instructionOverride = '') => {
    if (!activeTenantId || !sourceUrl) return;
    setBusy(true); setError('');
    try {
      const sb = getSupabase();
      const { data: found, error: discoveryError } = await sb.functions.invoke('siteos-discover', { body: { tenant_id: activeTenantId, url: sourceUrl } });
      if (discoveryError) throw discoveryError;
      const site = found as Discovery;
      if (!site?.source_url) throw new Error('Die Ausgangswebsite konnte nicht analysiert werden.');
      setDiscovery(site);
      const prompt = [
        'Erstelle ein vollständiges, hochwertiges Redesign als echtes RealSync SiteOS-Projekt.',
        `Ausgangswebsite: ${site.source_url}.`,
        `Titel: ${site.title ?? site.h1 ?? 'Website'}.`,
        `Leistungen: ${site.services.join(', ')}.`,
        'Baue eine echte responsive Startseite mit Hero, Leistungen, Vertrauensbereich, Referenzen, FAQ, Kontakt und Footer.',
        'Premium-B2B-Design, klare Informationsarchitektur, starke Typografie und Conversion-Führung.',
        'SEO-fähig, DSGVO-bewusst, barrierearm, EU-AI-Act-ready und ohne fremde Tracker oder Scripts.',
        instructionOverride ? `Zusätzliche Kundenanweisung: ${instructionOverride}` : '',
      ].filter(Boolean).join('\n');
      const result = await buildSite({ tenant_id: activeTenantId, prompt, locale: 'de', enrichment: { name: site.title ?? site.h1 ?? undefined, summary: site.description ?? site.visible_text.slice(0, 600), services: site.services } });
      if (result.kind !== 'ok' || !result.data.blueprint) throw new Error(result.kind === 'ok' ? 'Blueprint fehlt.' : errorMessage(result));
      setBlueprint(result.data.blueprint);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Die neue Website konnte nicht erzeugt werden.'); }
    finally { setBusy(false); }
  }, [activeTenantId, sourceUrl]);

  useEffect(() => {
    if (!isAuthenticated) { navigate(`/welcome?next=${encodeURIComponent(window.location.pathname + window.location.search)}`); return; }
    void build();
  }, [build, isAuthenticated, navigate]);

  const previewBlueprint = useMemo(() => blueprint ? applySiteDesignTemplate(blueprint, template) : null, [blueprint, template]);
  const previewHtml = useMemo(() => previewBlueprint ? renderSite(previewBlueprint, { baseUrl: sourceUrl }).find(page => page.path === '/')?.html ?? '' : '', [previewBlueprint, sourceUrl]);

  const checkout = async () => {
    if (!activeTenantId || !discovery) return;
    setBusy(true); setError('');
    try {
      const result = await createSiteOsCheckoutSession({ tenantId: activeTenantId, sourceUrl: discovery.source_url, siteSlug: blueprint?.slug, projectName: discovery.title ?? discovery.h1 ?? undefined });
      if (!result.ok || !result.url) throw new Error(result.error?.message ?? 'Checkout konnte nicht vorbereitet werden.');
      window.location.assign(result.url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Checkout konnte nicht vorbereitet werden.'); setBusy(false); }
  };

  return (
    <main className="min-h-screen bg-[#f3f5f7] text-[#111827]">
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-black/[.08] bg-white/95 px-4 backdrop-blur sm:px-6">
        <div className="flex items-center gap-3"><button onClick={() => navigate(-1)} className="rounded-lg p-2 hover:bg-black/[.05]" aria-label="Zurück"><ChevronLeft size={18}/></button><div className="grid h-8 w-8 place-items-center rounded-lg bg-[#07111f] text-cyan-300"><Sparkles size={15}/></div><div><div className="text-sm font-bold">RealSync SiteOS Builder</div><div className="text-[10px] text-black/45">Ihre neue Website ist bereits gebaut</div></div></div>
        <div className="flex items-center gap-2"><span className="hidden rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-semibold text-emerald-700 sm:inline">Live Preview</span><button onClick={() => void checkout()} disabled={!blueprint || busy} className="inline-flex items-center gap-2 rounded-lg bg-[#111827] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">Fertig umsetzen <ArrowRight size={14}/></button></div>
      </header>
      <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-[230px_minmax(0,1fr)_300px]">
        <aside className="hidden border-r border-black/[.07] bg-white p-4 lg:block"><div className="mb-4 text-[10px] font-bold uppercase tracking-[.16em] text-black/35">Seitenstruktur</div>{SECTIONS.map((s, i) => <button key={s} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs hover:bg-black/[.04]"><span className="grid h-6 w-6 place-items-center rounded-md bg-black/[.04] text-[9px] text-black/45">{i + 1}</span>{s}</button>)}<div className="mt-7 border-t border-black/[.07] pt-5"><div className="mb-3 text-[10px] font-bold uppercase tracking-[.16em] text-black/35">Design</div>{SITE_DESIGN_TEMPLATES.map(item => <button key={item.id} onClick={() => setTemplate(item.id)} className={`mb-2 flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-xs ${template === item.id ? 'border-cyan-400/40 bg-cyan-50 text-cyan-800' : 'border-black/[.07]'}`}>{item.label}{template === item.id && <Check size={14}/>}</button>)}</div></aside>
        <section className="min-w-0 p-3 sm:p-5"><div className="mb-3 flex items-center justify-between rounded-xl border border-black/[.07] bg-white px-3 py-2 shadow-sm"><div className="min-w-0 truncate text-xs font-semibold">{discovery?.title || sourceUrl || 'Ihre neue Website'}</div><div className="flex items-center gap-1 rounded-lg bg-black/[.04] p-1"><button onClick={() => setDevice('desktop')} className={`rounded-md p-1.5 ${device === 'desktop' ? 'bg-white shadow' : ''}`}><Monitor size={14}/></button><button onClick={() => setDevice('tablet')} className={`rounded-md p-1.5 ${device === 'tablet' ? 'bg-white shadow' : ''}`}><Tablet size={14}/></button><button onClick={() => setDevice('mobile')} className={`rounded-md p-1.5 ${device === 'mobile' ? 'bg-white shadow' : ''}`}><Smartphone size={14}/></button></div></div><div className="flex min-h-[calc(100vh-10rem)] items-start justify-center overflow-auto rounded-2xl border border-black/[.08] bg-[#dfe4ea] p-3 sm:p-6"><div style={{ width: DEVICE_WIDTH[device] }} className="overflow-hidden rounded-xl bg-white shadow-2xl"><iframe title="Ihre neu gebaute Website" srcDoc={previewHtml} className="h-[760px] w-full border-0 bg-white" sandbox="allow-same-origin" /></div></div></section>
        <aside className="border-t border-black/[.07] bg-white p-4 lg:border-l lg:border-t-0 sm:p-5"><div className="flex items-center gap-2 text-sm font-bold"><Wand2 size={17} className="text-cyan-600"/> AI Website Editor</div><p className="mt-1 text-xs leading-5 text-black/45">Die Website ist bereits generiert. Sag der KI, was geändert werden soll.</p><textarea value={instruction} onChange={e => setInstruction(e.target.value)} placeholder="z. B. Hero hochwertiger, CTA stärker, mehr Vertrauen …" className="mt-4 min-h-28 w-full resize-none rounded-xl border border-black/[.08] p-3 text-xs outline-none"/><button onClick={() => { const text = instruction.trim(); if (text) { setInstruction(''); void build(text); } }} disabled={!instruction.trim() || busy} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#111827] px-3 py-2.5 text-xs font-bold text-white disabled:opacity-40"><Wand2 size={14}/> AI anwenden</button><div className="mt-5 text-[10px] font-bold uppercase tracking-[.16em] text-black/35">Schnellaktionen</div>{['Hero hochwertiger machen','Conversion verbessern','Mobile optimieren','SEO stärken'].map(action => <button key={action} onClick={() => void build(action)} disabled={busy} className="mt-2 flex w-full items-center justify-between rounded-lg border border-black/[.07] px-3 py-2.5 text-left text-xs text-black/60 hover:bg-black/[.03] disabled:opacity-40">{action}<ArrowRight size={13}/></button>)}<div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><div className="text-xs font-bold text-emerald-800">Governance Layer</div><div className="mt-1 text-[11px] leading-5 text-emerald-700">SEO · DSGVO · Accessibility · EU AI Act · Evidence</div></div><button onClick={() => void checkout()} disabled={!blueprint || busy} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-xs font-bold text-[#06111f] disabled:opacity-40">Website fertig umsetzen <ArrowRight size={14}/></button>{auditId && <div className="mt-3 text-[9px] text-black/30">Audit {auditId.slice(0, 12)}…</div>}{error && <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[11px] leading-5 text-rose-700">{error}</div>}</aside>
      </div>
      {busy && <div className="fixed inset-0 z-[60] grid place-items-center bg-[#07111f]/70 p-5 backdrop-blur-sm"><div className="w-full max-w-md rounded-2xl bg-white p-7 text-center shadow-2xl"><div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-cyan-50 text-cyan-600"><Loader2 className="animate-spin" size={22}/></div><h2 className="mt-4 text-lg font-bold">Ihre neue Website wird gebaut</h2><p className="mt-2 text-sm leading-6 text-black/50">RealSync analysiert die bestehende Website und erzeugt daraus gerade ein vollständiges SiteOS-Redesign.</p><div className="mt-5 flex items-center justify-center gap-2 text-[10px] text-black/35"><RefreshCw size={12} className="animate-spin"/> Analyse · Blueprint · Render</div></div></div>}
    </main>
  );
}
