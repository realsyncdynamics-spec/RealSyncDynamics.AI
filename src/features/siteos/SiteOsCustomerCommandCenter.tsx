import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ExternalLink, Eye, Globe2, Loader2, Lock, RefreshCw, Rocket, ShieldCheck, Sparkles, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTenant } from '../../core/access/TenantProvider';
import { getSupabase } from '../../lib/supabase';
import { listScans, listSites, type ScanRow, type SiteOverviewRow } from './siteOsApi';
import { renderSite } from '../../../packages/siteos-core/src/render/renderer';
import type { SiteBlueprint } from '../../../packages/siteos-core/src/index';

type Grant = { plan_key: string; status: string };

const stages = [
  ['payment', 'Zahlung', 'Entitlement bestätigt'],
  ['analysis', 'Analyse', 'Evidence & Befunde'],
  ['design', 'Entwurf', 'AI Studio / Blueprint'],
  ['build', 'Build', 'SiteOS Renderer'],
  ['gate', 'Governance Gate', 'Freigabeprüfung'],
  ['publish', 'Publish', 'Nur freigegebene Version'],
] as const;

function statusClass(active: boolean, done: boolean) {
  if (done) return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (active) return 'border-cyan-200 bg-cyan-50 text-cyan-900';
  return 'border-slate-200 bg-white text-slate-500';
}

export function SiteOsCustomerCommandCenter() {
  const { activeTenantId } = useTenant();
  const [grant, setGrant] = useState<Grant | null>(null);
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
      const [{ data: grantRow, error: grantError }, siteRows, scanRows] = await Promise.all([
        sb.from('entitlement_grants').select('plan_key,status').eq('tenant_id', activeTenantId).eq('plan_key', 'governance_launch').eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle(),
        listSites(activeTenantId),
        listScans(activeTenantId, 8),
      ]);
      if (grantError) throw new Error(`Entitlement konnte nicht geladen werden: ${grantError.message}`);
      setGrant(grantRow);
      setSites(siteRows);
      setScans(scanRows);
      const latestSite = siteRows[0];
      if (latestSite?.slug) {
        const { data, error: blueprintError } = await sb.from('siteos_blueprints').select('blueprint').eq('tenant_id', activeTenantId).eq('slug', latestSite.slug).order('version', { ascending: false }).limit(1).maybeSingle();
        if (blueprintError) throw new Error(`Landingpage konnte nicht geladen werden: ${blueprintError.message}`);
        setBlueprint((data?.blueprint as SiteBlueprint | null) ?? null);
      } else {
        setBlueprint(null);
      }
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Dashboard konnte nicht geladen werden.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTenantId]);

  useEffect(() => { void reload(); }, [reload]);

  const site = sites[0];
  const scan = scans[0];
  const findings = scan?.findings ?? [];
  const domain = useMemo(() => {
    const raw = scan?.url;
    if (!raw) return site?.name || 'Ihre Website';
    try { return new URL(raw).hostname; } catch { return raw; }
  }, [scan, site]);
  const previewHtml = useMemo(() => {
    if (!blueprint) return '';
    return renderSite(blueprint, { baseUrl: scan?.url ?? undefined }).find((page) => page.path === '/')?.html ?? '';
  }, [blueprint, scan]);
  const gatePassed = site?.status === 'approved' || site?.status === 'deployed';
  const currentStage = gatePassed ? 5 : site ? 3 : blueprint ? 2 : scan ? 1 : 0;
  const criticalFindings = findings.filter((finding) => ['critical', 'high'].includes(String(finding.severity).toLowerCase()));

  if (loading) return <div className="min-h-screen bg-[#f7f9fc] flex items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-cyan-500" /></div>;
  if (!grant) return <div className="min-h-screen bg-[#f7f9fc] flex items-center justify-center px-6"><div className="max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl"><Lock className="mx-auto h-8 w-8 text-amber-500" /><h1 className="mt-4 text-xl font-semibold">Transformation noch nicht freigeschaltet</h1><p className="mt-2 text-sm leading-6 text-slate-500">Der Zugang wird ausschließlich über das serverseitige Entitlement geöffnet.</p><Link to="/" className="mt-6 inline-flex rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white">Zur Website</Link></div></div>;

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500 text-white"><Sparkles size={18} /></div><div><div className="font-semibold tracking-tight">RealSyncDynamics.AI</div><div className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">Customer Command Center</div></div></div>
          <div className="flex items-center gap-2"><span className="hidden rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:inline-flex"><span className="mr-2 h-2 w-2 self-center rounded-full bg-emerald-500" /> Transformation aktiv</span><button onClick={() => void reload()} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="Aktualisieren"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /></button><Link to="/app" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50">Control Plane</Link></div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-5 py-7 lg:px-8 lg:py-9">
        {error && <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}

        {/* 1. HERO — actual landing page, not a governance dashboard */}
        <section className="grid gap-7 lg:grid-cols-[.78fr_1.22fr] lg:items-stretch">
          <div className="flex flex-col justify-center rounded-3xl border border-slate-200 bg-white p-7 shadow-sm lg:p-9">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-600">Ihre Website-Transformation</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{domain}<br /><span className="text-cyan-600">wird zur neuen Landingpage.</span></h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">Die neue Präsentationsschicht steht im Mittelpunkt. Ihre bestehende Infrastruktur bleibt erhalten und wird erst nach Governance-Prüfung veröffentlicht.</p>
            <div className="mt-6 flex flex-wrap gap-3"><a href="#preview" className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 hover:bg-slate-800"><Eye size={15} /> Landingpage ansehen</a><Link to="/app/siteos" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Im Builder bearbeiten <ExternalLink size={14} /></Link></div>
            <div className="mt-6 grid grid-cols-3 gap-2 text-xs"><Metric label="Health" value={site?.health} /><Metric label="Compliance" value={site?.compliance} /><Metric label="Risiko" value={site?.risk} inverse /></div>
          </div>
          <div id="preview" className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-cyan-600">Website Preview</p><h2 className="mt-1 font-semibold">Neue Landingpage</h2></div><span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">SiteOS v{site?.version ?? '—'}</span></div>
            {previewHtml ? <><div className="flex items-center gap-1 border-b border-slate-100 bg-slate-50 px-3 py-2"><span className="h-2 w-2 rounded-full bg-slate-300" /><span className="h-2 w-2 rounded-full bg-slate-300" /><span className="h-2 w-2 rounded-full bg-slate-300" /><div className="ml-2 flex-1 rounded bg-white px-3 py-1 text-[10px] text-slate-400">{domain}</div></div><iframe title="Generierte Landingpage" srcDoc={previewHtml} className="h-[560px] w-full bg-white" sandbox="allow-same-origin" /></> : <div className="flex min-h-[560px] items-center justify-center bg-slate-50 text-center"><div><Globe2 className="mx-auto h-9 w-9 text-cyan-500" /><p className="mt-4 font-semibold">Landingpage wird vorbereitet</p><p className="mt-2 max-w-sm text-xs leading-5 text-slate-500">Sobald der SiteOS-Blueprint vorliegt, erscheint hier die echte Preview.</p></div></div>}
          </div>
        </section>

        {/* 2. PIPELINE */}
        <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:p-7"><SectionTitle eyebrow="Transformation Pipeline" title="Ein klarer Weg bis live" /><div className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">{stages.map(([key, label, detail], index) => { const done = index < currentStage; const active = index === currentStage; return <div key={key} className={`rounded-2xl border p-3 ${statusClass(active, done)}`}><div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-bold">{done ? <Check size={14} /> : index + 1}</div><p className="mt-3 text-xs font-semibold">{label}</p><p className="mt-1 text-[10px] leading-4 opacity-70">{detail}</p></div>; })}</div></section>

        {/* 3. PREVIEW / VARIANTS */}
        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><SectionTitle eyebrow="Preview" title="Varianten ohne Infrastrukturwechsel" /><p className="mt-1 text-sm text-slate-500">Design und Content können wechseln. Backend, API, Auth und Daten bleiben geschützt.</p><div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">{['Executive', 'Modern', 'Authority', 'Minimal'].map((variant, index) => <button key={variant} className={`rounded-2xl border p-4 text-left transition ${index === 1 ? 'border-cyan-300 bg-cyan-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}><span className="text-xs font-semibold">{variant}</span><span className="mt-1 block text-[10px] text-slate-500">Evidence bleibt gebunden</span></button>)}</div></section>
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><SectionTitle eyebrow="Projekt" title={domain} /><div className="mt-4 space-y-3 text-xs"><Row label="Version" value={site ? `v${site.version}` : '—'} /><Row label="Status" value={site?.status ?? 'Vorbereitung'} /><Row label="Blueprint" value={blueprint ? 'vorhanden' : 'wartet'} /><Row label="Letzte Prüfung" value={scan ? new Date(scan.observed_at).toLocaleDateString('de-DE') : '—'} /></div></section>
        </section>

        {/* 4. FINDINGS */}
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><SectionTitle eyebrow="Befunde" title="Was die Transformation verbessert" /><div className="mt-5 grid gap-3 md:grid-cols-3"><FindingCard title="Hohe Priorität" count={criticalFindings.length} detail="Blockierende oder relevante Risiken" /><FindingCard title="Alle Befunde" count={findings.length} detail="Evidence-basierte Beobachtungen" /><FindingCard title="Transformation" count={blueprint ? 1 : 0} detail="Aktueller SiteOS-Blueprint" /></div></section>

        {/* 5. GATE */}
        <section id="gate" className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:p-7"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div><SectionTitle eyebrow="Governance Gate" title={gatePassed ? 'Freigabe erreicht' : 'Noch nicht veröffentlichbar'} /><p className="mt-1 max-w-2xl text-sm text-slate-500">Publish wird erst angeboten, wenn der serverseitige Governance-Status die Version freigibt und die Backend-Preservation-Anforderung erfüllt ist.</p></div><div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold ${gatePassed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}><ShieldCheck size={14} /> {gatePassed ? 'Gate passed' : 'Gate pending'}</div></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><GateItem label="Evidence gebunden" passed={Boolean(scan)} /><GateItem label="Governance Status" passed={gatePassed} /><GateItem label="backend_preservation = preserve_all" passed={false} /></div></section>

        {/* 6. PUBLISH */}
        <section className="mt-6 rounded-3xl bg-slate-950 p-6 text-white shadow-xl lg:p-7"><div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-cyan-300">Publish</p><h2 className="mt-2 text-2xl font-semibold">Bereit für den nächsten Schritt?</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Der Publish-Button bleibt bewusst gesperrt, solange nicht alle serverseitigen Gate-Bedingungen nachgewiesen sind.</p></div><div className="flex flex-wrap gap-2"><Link to="/app/siteos" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950">Im Builder weiterarbeiten <ArrowRight size={15} /></Link><button disabled={!gatePassed} className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white/50"><Rocket size={15} /> Veröffentlichen</button></div></div></section>
      </div>
    </main>
  );
}

function Metric({ label, value, inverse = false }: { label: string; value: number | null | undefined; inverse?: boolean }) {
  const display = value == null ? '—' : `${Math.round(value)}%`;
  return <div className="rounded-xl bg-slate-50 p-3"><div className="text-[10px] text-slate-500">{label}</div><div className={`mt-1 font-semibold ${inverse && typeof value === 'number' && value > 30 ? 'text-amber-600' : 'text-slate-900'}`}>{display}</div></div>;
}
function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) { return <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-cyan-600">{eyebrow}</p><h2 className="mt-1 text-xl font-semibold tracking-tight">{title}</h2></div>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2"><span className="text-slate-500">{label}</span><span className="font-medium text-slate-800">{value}</span></div>; }
function FindingCard({ title, count, detail }: { title: string; count: number; detail: string }) { return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><div className="text-3xl font-semibold">{count}</div><div className="mt-2 text-sm font-semibold">{title}</div><div className="mt-1 text-xs text-slate-500">{detail}</div></div>; }
function GateItem({ label, passed }: { label: string; passed: boolean }) { return <div className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4"><span className={`flex h-7 w-7 items-center justify-center rounded-full ${passed ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>{passed ? <Check size={14} /> : <Lock size={13} />}</span><span className="text-xs font-medium">{label}</span></div>; }
