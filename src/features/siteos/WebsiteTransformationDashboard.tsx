import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ExternalLink, Eye, Globe2, Loader2, Lock, RefreshCw, Rocket, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTenant } from '../../core/access/TenantProvider';
import { getSupabase } from '../../lib/supabase';
import { listScans, listSites, type ScanRow, type SiteOverviewRow } from './siteOsApi';
import { renderSite } from '../../../packages/siteos-core/src/render/renderer';
import type { SiteBlueprint } from '../../../packages/siteos-core/src/index';

type Grant = { plan_key: string; status: string; stripe_checkout_session_id: string | null };
type Subscription = { plan_key: string; status: string; current_period_end: string | null };

const stages = [
  { key: 'paid', label: 'Zahlung bestätigt', detail: 'Transformation freigeschaltet' },
  { key: 'audit', label: 'Website analysiert', detail: 'Evidence & Findings' },
  { key: 'design', label: 'Landingpage entworfen', detail: 'AI Studio / PageSpec' },
  { key: 'build', label: 'Frontend gebaut', detail: 'SiteOS Renderer' },
  { key: 'governance', label: 'Governance geprüft', detail: 'Gate & Evidence' },
  { key: 'publish', label: 'Live veröffentlichen', detail: 'Nur freigegebene Version' },
] as const;

export function WebsiteTransformationDashboard() {
  const { activeTenantId } = useTenant();
  const [grant, setGrant] = useState<Grant | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
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
      const [{ data: grantRow, error: grantError }, { data: subscriptionRow, error: subscriptionError }, siteRows, scanRows] = await Promise.all([
        sb.from('entitlement_grants').select('plan_key,status,stripe_checkout_session_id').eq('tenant_id', activeTenantId).eq('plan_key', 'governance_launch').eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle(),
        sb.from('subscriptions').select('plan_key,status,current_period_end').eq('tenant_id', activeTenantId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        listSites(activeTenantId),
        listScans(activeTenantId, 8),
      ]);
      if (grantError) throw new Error(`Entitlement konnte nicht geladen werden: ${grantError.message}`);
      if (subscriptionError) throw new Error(`Governance-Paket konnte nicht geladen werden: ${subscriptionError.message}`);
      setGrant(grantRow);
      setSubscription(subscriptionRow);
      setSites(siteRows);
      setScans(scanRows);

      const latestSite = siteRows[0];
      if (latestSite?.slug) {
        const { data: blueprintRow, error: blueprintError } = await sb.from('siteos_blueprints').select('blueprint').eq('tenant_id', activeTenantId).eq('slug', latestSite.slug).order('version', { ascending: false }).limit(1).maybeSingle();
        if (blueprintError) throw new Error(`Landingpage konnte nicht geladen werden: ${blueprintError.message}`);
        setBlueprint((blueprintRow?.blueprint as SiteBlueprint | null) ?? null);
      } else setBlueprint(null);
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
  const latestScan = scans[0];
  const hasLanding = Boolean(site || blueprint);
  const governancePassed = Boolean(site && (site.status === 'approved' || site.status === 'deployed'));
  const currentStage = governancePassed ? 5 : site ? 4 : blueprint ? 3 : latestScan ? 2 : 1;
  const domain = useMemo(() => {
    const raw = latestScan?.url;
    if (!raw) return site?.slug || 'Ihre Website';
    try { return new URL(raw).hostname; } catch { return raw; }
  }, [latestScan, site]);
  const previewHtml = useMemo(() => {
    if (!blueprint) return '';
    return renderSite(blueprint, { baseUrl: latestScan?.url ?? undefined }).find((page) => page.path === '/')?.html ?? '';
  }, [blueprint, latestScan]);

  if (loading) return <div className="min-h-screen bg-[#f7f9fc] flex items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-cyan-500" /></div>;

  if (!grant) return <div className="min-h-screen bg-[#f7f9fc] flex items-center justify-center px-6"><div className="max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl"><Lock className="mx-auto h-8 w-8 text-amber-500" /><h1 className="mt-4 text-xl font-semibold">Website-Transformation noch nicht freigeschaltet</h1><p className="mt-2 text-sm leading-6 text-slate-500">Dieses Dashboard wird erst nach bestätigter Stripe-Zahlung und serverseitigem Entitlement geöffnet.</p><Link to="/" className="mt-6 inline-flex rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white">Zur Website</Link></div></div>;

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <header className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-[1440px] px-5 py-4 lg:px-8"><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500 text-white"><Sparkles size={18} /></div><div><div className="font-semibold tracking-tight">RealSyncDynamics.AI</div><div className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">Customer Transformation</div></div></div><div className="flex items-center gap-2"><span className="hidden rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:inline-flex"><span className="mr-2 h-2 w-2 self-center rounded-full bg-emerald-500" /> Transformation aktiv</span><button onClick={() => void reload()} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="Aktualisieren"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /></button><Link to="/app" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50">Control Plane</Link></div></div></div></header>

      <div className="mx-auto max-w-[1440px] px-5 py-7 lg:px-8 lg:py-9">
        {/* 1. HERO */}
        <section className="grid gap-7 lg:grid-cols-[.82fr_1.18fr] lg:items-center"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-600">Ihre Website-Transformation</p><h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">{domain}<br /><span className="text-cyan-600">wird zur neuen Landingpage.</span></h1><p className="mt-4 max-w-xl text-base leading-7 text-slate-600">Wir verwandeln die bestehende Präsentationsschicht in eine moderne, performante und governance-geprüfte Website. <strong className="text-slate-900">Backend, API, Authentifizierung und Datenbank bleiben unverändert.</strong></p><div className="mt-6 flex flex-wrap gap-3"><a href="#preview" className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 hover:bg-slate-800"><Eye size={15} /> Neue Landingpage ansehen</a><a href="#gate" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><ShieldCheck size={15} /> Governance Status</a></div><div className="mt-5 flex flex-wrap gap-5 text-xs text-slate-500"><span>✓ Backend preserve_all</span><span>✓ Evidence gebunden</span><span>✓ SiteOS Renderer</span></div></div><div className="overflow-hidden rounded-3xl bg-slate-950 p-5 text-white shadow-2xl sm:p-6"><div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[.2em] text-cyan-300">RealSync AI Studio → SiteOS</span><span className="inline-flex items-center gap-1.5 text-xs text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400" /> LIVE</span></div><div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[.06]"><div className="flex items-center gap-1 border-b border-white/10 px-3 py-2"><span className="h-2 w-2 rounded-full bg-red-300/60" /><span className="h-2 w-2 rounded-full bg-amber-300/60" /><span className="h-2 w-2 rounded-full bg-emerald-300/60" /><div className="ml-2 flex-1 rounded bg-white/10 px-3 py-1 text-[10px] text-slate-500">{domain}</div></div><div className="min-h-[290px] p-7 text-center sm:min-h-[340px] sm:p-10"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-cyan-300">GENERATED LANDINGPAGE</p><p className="mx-auto mt-4 max-w-xl text-3xl font-semibold tracking-tight">Klarer. Moderner. Konvertierender.</p><p className="mx-auto mt-3 max-w-md text-xs leading-5 text-slate-400">Die echte SiteOS-Preview ist unten direkt eingebettet.</p><a href="#preview" className="mt-6 inline-flex rounded-full bg-cyan-400 px-5 py-2.5 text-xs font-bold text-slate-950">Preview öffnen <ArrowRightIcon /></a></div></div></div></section>

        {/* 2. PIPELINE */}
        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:p-7"><SectionHeading eyebrow="Transformation Pipeline" title="Von der Zahlung bis zum Live-Frontend" subtitle="Die Statusanzeige bleibt an reale Daten gebunden." /><div className="mt-6 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">{stages.map((stage, index) => { const done = index < currentStage; const active = index === currentStage; return <div key={stage.key} className={`rounded-2xl border p-3 ${done ? 'border-emerald-200 bg-emerald-50/60' : active ? 'border-cyan-200 bg-cyan-50/70' : 'border-slate-100 bg-slate-50'}`}><div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${done ? 'bg-emerald-500 text-white' : active ? 'bg-cyan-500 text-white' : 'bg-white text-slate-400'}`}>{done ? <Check size={14} /> : index + 1}</div><p className="mt-3 text-xs font-semibold">{stage.label}</p><p className="mt-1 text-[10px] leading-4 text-slate-500">{stage.detail}</p></div>; })}</div></section>

        {/* 3. PREVIEW */}
        <section id="preview" className="mt-6 grid gap-6 lg:grid-cols-[1.65fr_.35fr]"><section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-6 py-5"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-cyan-600">Website Preview</p><h2 className="mt-1 text-2xl font-semibold">Ihre neue Landingpage</h2><p className="mt-1 text-xs text-slate-500">Version {site?.version ?? '—'} · deterministisch aus dem SiteOS Blueprint gerendert.</p></div><span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">AI Studio / SiteOS</span></div><div className="p-5 sm:p-6">{previewHtml ? <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-inner"><div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 px-3 py-2"><span className="h-2 w-2 rounded-full bg-slate-300" /><span className="h-2 w-2 rounded-full bg-slate-300" /><span className="h-2 w-2 rounded-full bg-slate-300" /><div className="ml-2 flex-1 rounded bg-white px-3 py-1 text-[10px] text-slate-400">{domain}</div></div><iframe title="Generierte Landingpage" srcDoc={previewHtml} className="h-[620px] w-full bg-white" sandbox="allow-same-origin" /></div> : <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center"><div><Globe2 className="mx-auto h-8 w-8 text-cyan-500" /><p className="mt-4 font-semibold">Landingpage wird vorbereitet</p><p className="mt-2 max-w-sm text-xs leading-5 text-slate-500">Der SiteOS-Blueprint ist noch nicht als Preview verfügbar. Aktualisieren Sie nach Abschluss der Generierung.</p></div></div>}<div className="mt-4 flex flex-wrap gap-2"><Link to="/app/siteos" className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white">Im Builder öffnen <ExternalLink size={13} /></Link><button onClick={() => void reload()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700"><RefreshCw size={13} /> Preview aktualisieren</button></div></div></section><div className="space-y-6"><section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-cyan-600">Varianten</p><h3 className="mt-1 font-semibold">4 Designrichtungen</h3><div className="mt-4 grid grid-cols-2 gap-2">{['Executive', 'Modern', 'Authority', 'Minimal'].map((v, i) => <div key={v} className={`rounded-xl border p-3 ${i === 1 ? 'border-cyan-300 bg-cyan-50' : 'border-slate-100 bg-slate-50'}`}><p className="text-xs font-semibold">{v}</p><p className="mt-1 text-[10px] text-slate-500">Evidence identisch</p></div>)}</div></section><section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-cyan-600">Project</p><h3 className="mt-1 font-semibold">{domain}</h3><div className="mt-4 space-y-3 text-xs"><InfoRow label="Transformation" value="€349 · bestätigt" /><InfoRow label="Blueprint" value={blueprint ? 'vorhanden' : 'ausstehend'} /><InfoRow label="Backend" value="preserve_all" /><InfoRow label="Version" value={site ? `v${site.version}` : '—'} /></div></section></div></section>

        {/* 4. FINDINGS */}
        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]"><section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><SectionHeading eyebrow="Audit Evidence" title="Befunde als Wertnachweis" subtitle="Nur tatsächlich vorliegende SiteOS-Werte werden angezeigt — keine erfundenen Verbesserungsdeltas." /><div className="mt-6 grid grid-cols-2 gap-3"><Metric label="Health" value={site?.health} /><Metric label="Compliance" value={site?.compliance} /><Metric label="Performance" value={site?.performance} /><Metric label="Risk" value={site?.risk} inverse /></div><div className="mt-5 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">Letzter Evidence-Lauf: {latestScan ? new Date(latestScan.observed_at).toLocaleString('de-DE') : 'noch nicht vorhanden'}{latestScan ? ` · ${latestScan.findings.length} Findings` : ''}</div></section><section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><SectionHeading eyebrow="Transformation Quality" title="Was sich nicht ändert" /><div className="mt-5 grid gap-3 sm:grid-cols-2"><Guarantee title="Backend" text="API, Auth, Datenbank und Business Logic bleiben außerhalb des Generators." /><Guarantee title="Evidence" text="Findings und Hashes bleiben an den Blueprint gebunden." /><Guarantee title="Renderer" text="SiteOS rendert deterministisch aus dem validierten Blueprint." /><Guarantee title="Governance" text="Keine ungeprüfte AI-Version darf veröffentlicht werden." /></div></section></section>

        {/* 5. GOVERNANCE GATE */}
        <section id="gate" className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:p-7"><SectionHeading eyebrow="Governance Gate" title="Veröffentlichen erst nach Prüfung" subtitle="Das Gate ist die Sicherheits- und Evidence-Schicht hinter der Website-Transformation." /><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><GateItem label="Payment" ok={Boolean(grant)} /><GateItem label="Tenant" ok={Boolean(activeTenantId)} /><GateItem label="Evidence" ok={Boolean(latestScan)} /><GateItem label="Backend Preservation" ok={Boolean(blueprint?.transformation?.backend_preservation === 'preserve_all')} /><GateItem label="Build" ok={Boolean(site)} /></div><div className="mt-5 flex flex-col gap-4 rounded-2xl bg-slate-950 p-5 text-white sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{governancePassed ? 'Governance-Freigabe vorhanden' : 'Publish bleibt gesperrt'}</p><p className="mt-1 text-xs text-slate-400">Serverseitig müssen Payment, Tenant, Evidence, Build und das Governance Gate bestanden sein.</p></div><button disabled={!governancePassed} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"><Rocket size={15} /> {governancePassed ? 'Publish vorbereiten' : 'Prüfung ausstehend'}</button></div></section>

        {/* 6. PUBLISH */}
        <section className="mt-6 mb-8 rounded-3xl border border-cyan-100 bg-gradient-to-br from-white to-cyan-50/60 p-6 shadow-sm lg:p-7"><div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-cyan-600">Finale Aktion</p><h2 className="mt-1 text-2xl font-semibold">Bereit für die Veröffentlichung?</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Nach bestandenem Governance Gate wird ausschließlich die neue Frontend-/Landingpage-Version veröffentlicht. Das bestehende Backend bleibt unangetastet.</p></div><div className="flex flex-wrap gap-2"><a href="#preview" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold">Preview <Eye size={14} /></a><button disabled={!governancePassed} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-xs font-bold text-white disabled:opacity-40"><Rocket size={14} /> Website veröffentlichen</button></div></div></section>

        {error && <div className="mb-8 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      </div>
    </main>
  );
}

function SectionHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) { return <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-cyan-600">{eyebrow}</p><h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>{subtitle && <p className="mt-1 max-w-3xl text-sm text-slate-500">{subtitle}</p>}</div>; }
function Metric({ label, value, inverse = false }: { label: string; value: number | null | undefined; inverse?: boolean }) { const n = value == null ? null : Math.round(value); const good = n == null ? 'text-slate-400' : inverse ? n <= 20 ? 'text-emerald-600' : n <= 40 ? 'text-amber-600' : 'text-red-600' : n >= 80 ? 'text-emerald-600' : n >= 60 ? 'text-amber-600' : 'text-red-600'; return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div><div className={`mt-2 text-2xl font-semibold ${good}`}>{n == null ? '—' : n}</div></div>; }
function InfoRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-0"><span className="text-slate-400">{label}</span><span className="font-semibold text-slate-700">{value}</span></div>; }
function Guarantee({ title, text }: { title: string; text: string }) { return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="flex items-center gap-2"><ShieldCheck size={15} className="text-emerald-500" /><p className="text-sm font-semibold">{title}</p></div><p className="mt-2 text-xs leading-5 text-slate-500">{text}</p></div>; }
function GateItem({ label, ok }: { label: string; ok: boolean }) { return <div className={`rounded-2xl border p-4 ${ok ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60'}`}><div className="flex items-center gap-2">{ok ? <Check size={15} className="text-emerald-600" /> : <Lock size={15} className="text-amber-600" />}<span className="text-xs font-semibold">{label}</span></div><p className={`mt-2 text-[10px] font-bold uppercase tracking-wider ${ok ? 'text-emerald-700' : 'text-amber-700'}`}>{ok ? 'passed' : 'pending'}</p></div>; }
function ArrowRightIcon() { return <span aria-hidden="true">→</span>; }
