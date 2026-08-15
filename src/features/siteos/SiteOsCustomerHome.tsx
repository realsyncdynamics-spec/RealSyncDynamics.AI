import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ExternalLink, Eye, Globe2, Loader2, Lock, RefreshCw, Rocket, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTenant } from '../../core/access/TenantProvider';
import { getSupabase } from '../../lib/supabase';
import { listScans, listSites, type ScanRow, type SiteOverviewRow } from './siteOsApi';
import { renderSite } from '../../../packages/siteos-core/src/render/renderer';
import type { SiteBlueprint } from '../../../packages/siteos-core/src/index';

const stages = [
  ['Transformation aktiv', 'Entitlement bestätigt'],
  ['Website analysiert', 'Evidence & Findings'],
  ['Landingpage entworfen', 'SiteOS Blueprint'],
  ['Frontend gebaut', 'Renderer'],
  ['Governance Gate', 'Evidence + Preservation'],
  ['Publish', 'Nur freigegebene Version'],
] as const;

export function SiteOsCustomerHome() {
  const { activeTenantId } = useTenant();
  const [granted, setGranted] = useState(false);
  const [sites, setSites] = useState<SiteOverviewRow[]>([]);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [blueprint, setBlueprint] = useState<SiteBlueprint | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!activeTenantId) return;
    setRefreshing(true);
    try {
      const sb = getSupabase();
      const [{ data: grant, error: grantError }, siteRows, scanRows] = await Promise.all([
        sb.from('entitlement_grants').select('status').eq('tenant_id', activeTenantId).eq('plan_key', 'governance_launch').eq('status', 'active').limit(1).maybeSingle(),
        listSites(activeTenantId),
        listScans(activeTenantId, 8),
      ]);
      if (grantError) throw new Error(grantError.message);
      setGranted(Boolean(grant));
      setSites(siteRows);
      setScans(scanRows);
      const latest = siteRows[0];
      if (latest?.slug) {
        const { data, error: blueprintError } = await sb.from('siteos_blueprints').select('blueprint').eq('tenant_id', activeTenantId).eq('slug', latest.slug).order('version', { ascending: false }).limit(1).maybeSingle();
        if (blueprintError) throw new Error(blueprintError.message);
        setBlueprint((data?.blueprint as SiteBlueprint | null) ?? null);
      } else setBlueprint(null);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Customer Home konnte nicht geladen werden.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTenantId]);

  useEffect(() => { void reload(); }, [reload]);

  const site = sites[0];
  const scan = scans[0];
  const domain = useMemo(() => {
    if (!scan?.url) return site?.slug || 'Ihre Website';
    try { return new URL(scan.url).hostname; } catch { return scan.url; }
  }, [scan, site]);
  const preview = useMemo(() => blueprint ? renderSite(blueprint, { baseUrl: scan?.url ?? undefined }).find((page) => page.path === '/')?.html ?? '' : '', [blueprint, scan]);
  const gatePassed = site?.status === 'approved' || site?.status === 'deployed';
  const stage = gatePassed ? 5 : site ? 4 : blueprint ? 3 : scan ? 2 : 1;

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#f7f9fc]"><Loader2 className="h-7 w-7 animate-spin text-cyan-500" /></div>;
  if (!granted) return <div className="flex min-h-screen items-center justify-center bg-[#f7f9fc] px-6"><div className="max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl"><Lock className="mx-auto h-8 w-8 text-amber-500" /><h1 className="mt-4 text-xl font-semibold">Transformation noch nicht freigeschaltet</h1><p className="mt-2 text-sm leading-6 text-slate-500">Zugriff entsteht ausschließlich durch das serverseitig bestätigte Entitlement.</p><Link to="/" className="mt-6 inline-flex rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white">Zur Website</Link></div></div>;

  return <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 py-4 lg:px-8"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500 text-white"><Sparkles size={18} /></div><div><div className="font-semibold">RealSyncDynamics.AI</div><div className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">Customer Transformation</div></div></div><div className="flex items-center gap-2"><span className="hidden rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:inline-flex">● Transformation aktiv</span><button onClick={() => void reload()} className="rounded-xl border border-slate-200 p-2 text-slate-500" aria-label="Aktualisieren"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /></button><Link to="/app" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold">Control Plane</Link></div></div></header>

    <div className="mx-auto max-w-[1440px] px-5 py-7 lg:px-8 lg:py-9">
      {error && <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}

      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm"><div className="grid lg:grid-cols-[.68fr_1.32fr]"><div className="flex flex-col justify-center p-7 sm:p-10 lg:p-12"><p className="text-[10px] font-bold uppercase tracking-[.22em] text-cyan-600">Ihre Website-Transformation</p><h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{domain}</h1><p className="mt-3 text-xl font-medium text-slate-600">Ihre neue Website – direkt vor Ihnen.</p><p className="mt-4 max-w-xl text-sm leading-6 text-slate-500">Die Landingpage ist das Produkt. Governance, Evidence und Preservation sichern nur ab, dass sie sicher veröffentlicht werden kann.</p><div className="mt-6 flex flex-wrap gap-3"><a href="#preview" className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"><Eye size={15} /> Landingpage ansehen</a><a href="#gate" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700"><ShieldCheck size={15} /> Gate prüfen</a></div><div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500"><span>✓ Backend erhalten</span><span>✓ Evidence gebunden</span><span>✓ SiteOS</span></div></div><div className="bg-slate-950 p-4 sm:p-6 lg:p-7">{preview ? <div className="overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 px-3 py-2"><span className="h-2 w-2 rounded-full bg-slate-300" /><span className="h-2 w-2 rounded-full bg-slate-300" /><span className="h-2 w-2 rounded-full bg-slate-300" /><span className="ml-2 flex-1 rounded bg-white px-3 py-1 text-[10px] text-slate-400">{domain}</span></div><iframe title="Neue Landingpage" srcDoc={preview} className="h-[480px] w-full" sandbox="allow-same-origin" /></div> : <div className="flex min-h-[480px] items-center justify-center rounded-2xl border border-white/10 bg-white/[.04] text-center text-white"><div><Globe2 className="mx-auto h-9 w-9 text-cyan-300" /><p className="mt-4 font-semibold">Landingpage wird vorbereitet</p><p className="mt-2 max-w-sm text-xs text-slate-400">Der Blueprint ist noch nicht verfügbar. Aktualisieren Sie später.</p></div></div>}</div></div></section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-cyan-600">Transformation Pipeline</p><h2 className="mt-1 text-xl font-semibold">Vom Entwurf bis zur Veröffentlichung</h2><div className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">{stages.map(([label, detail], index) => { const done = index < stage; const active = index === stage; return <div key={label} className={`rounded-2xl border p-3 ${done ? 'border-emerald-200 bg-emerald-50/60' : active ? 'border-cyan-200 bg-cyan-50' : 'border-slate-100 bg-slate-50'}`}><div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${done ? 'bg-emerald-500 text-white' : active ? 'bg-cyan-500 text-white' : 'bg-white text-slate-400'}`}>{done ? <Check size={14} /> : index + 1}</div><p className="mt-3 text-xs font-semibold">{label}</p><p className="mt-1 text-[10px] text-slate-500">{detail}</p></div>; })}</div></section>

      <section id="preview" className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]"><section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-5"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-cyan-600">Website Preview</p><h2 className="mt-1 text-2xl font-semibold">Die aktuelle Landingpage</h2></div><span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">Version {site?.version ?? '—'}</span></div><div className="p-5 sm:p-6">{preview ? <div className="overflow-hidden rounded-2xl border border-slate-200"><iframe title="SiteOS Preview" srcDoc={preview} className="h-[680px] w-full" sandbox="allow-same-origin" /></div> : <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center"><div><Globe2 className="mx-auto h-8 w-8 text-cyan-500" /><p className="mt-4 font-semibold">Noch keine Preview</p></div></div>}<div className="mt-4 flex flex-wrap gap-2"><Link to="/app/siteos" className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white"><ExternalLink size={13} /> Im Builder öffnen</Link><button onClick={() => void reload()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700"><RefreshCw size={13} /> Aktualisieren</button></div></div></section>
        <aside className="space-y-6"><section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-cyan-600">Befunde</p><h3 className="mt-1 font-semibold">Was wurde verbessert?</h3>{scan ? <div className="mt-4 space-y-2"><div className="flex justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs"><span>Findings</span><strong>{scan.finding_count}</strong></div><div className="flex justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs"><span>Max. Severity</span><strong>{scan.severity_max ?? '—'}</strong></div></div> : <p className="mt-3 text-xs text-slate-500">Noch keine Analyseergebnisse.</p>}</section><section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-cyan-600">Projekt</p><h3 className="mt-1 font-semibold">{domain}</h3><p className="mt-2 text-xs text-slate-500">Version {site?.version ?? '—'} · Status {site?.status ?? 'in Vorbereitung'}</p></section></aside></section>

      <section id="gate" className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-cyan-600">Governance Gate</p><h2 className="mt-1 text-2xl font-semibold">Sicher veröffentlichen</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Der Client behauptet keine Freigabe. Publish bleibt an das serverseitige Gate und die Preservation-Prüfung gebunden.</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${gatePassed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{gatePassed ? 'Gate bestanden' : 'Gate offen'}</span></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold">Entitlement</p><p className="mt-1 text-xs text-emerald-700">Aktiv</p></div><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold">Evidence</p><p className="mt-1 text-xs text-slate-600">{scan ? 'Vorhanden' : 'Ausstehend'}</p></div><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold">Backend Preservation</p><p className="mt-1 text-xs text-slate-600">Serverseitig zu bestätigen</p></div></div></section>

      <section className="mt-6 rounded-3xl bg-slate-950 p-6 text-white shadow-xl"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-cyan-300">Publish</p><h2 className="mt-1 text-2xl font-semibold">Diese Version live bringen</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Der CTA ist nur aktiv, wenn die serverseitige Freigabe vorliegt. Keine UI kann das Gate umgehen.</p></div><button disabled={!gatePassed} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"><Rocket size={16} /> {gatePassed ? 'Publish vorbereiten' : 'Publish gesperrt'}</button></div></section>
    </div>
  </main>;
}
