import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ExternalLink, Eye, Loader2, Lock, RefreshCw, Rocket, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTenant } from '../../core/access/TenantProvider';
import { getSupabase } from '../../lib/supabase';
import { listScans, listSites, type ScanRow, type SiteOverviewRow } from './siteOsApi';

type Grant = { plan_key: string; status: string; stripe_checkout_session_id: string | null };

const stages = [
  { key: 'paid', label: 'Zahlung bestätigt' },
  { key: 'audit', label: 'Website analysiert' },
  { key: 'design', label: 'Landingpage entworfen' },
  { key: 'build', label: 'Frontend gebaut' },
  { key: 'governance', label: 'Governance geprüft' },
  { key: 'publish', label: 'Live veröffentlichen' },
] as const;

export function WebsiteTransformationDashboard() {
  const { activeTenantId } = useTenant();
  const [grant, setGrant] = useState<Grant | null>(null);
  const [sites, setSites] = useState<SiteOverviewRow[]>([]);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!activeTenantId) return;
    setRefreshing(true);
    try {
      const sb = getSupabase();
      const [{ data: grantRow, error: grantError }, siteRows, scanRows] = await Promise.all([
        sb.from('entitlement_grants')
          .select('plan_key,status,stripe_checkout_session_id')
          .eq('tenant_id', activeTenantId)
          .eq('plan_key', 'governance_launch')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        listSites(activeTenantId),
        listScans(activeTenantId, 8),
      ]);
      if (grantError) throw new Error(`Entitlement konnte nicht geladen werden: ${grantError.message}`);
      setGrant(grantRow);
      setSites(siteRows);
      setScans(scanRows);
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
  const hasLanding = Boolean(site);
  const governancePassed = Boolean(site && site.status !== 'blocked' && (site.compliance ?? 0) >= 80);
  const currentStage = governancePassed ? 5 : hasLanding ? 4 : latestScan ? 2 : 1;
  const domain = useMemo(() => {
    const raw = latestScan?.url;
    if (!raw) return site?.slug || 'Ihre Website';
    try { return new URL(raw).hostname; } catch { return raw; }
  }, [latestScan, site]);

  if (loading) {
    return <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-cyan-400" /></div>;
  }

  if (!grant) {
    return <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6"><div className="max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center"><Lock className="mx-auto h-8 w-8 text-amber-400" /><h1 className="mt-4 text-xl font-semibold">Website-Transformation noch nicht freigeschaltet</h1><p className="mt-2 text-sm text-slate-400">Dieses Projekt-Dashboard wird erst nach bestätigter Stripe-Zahlung und serverseitigem Entitlement geöffnet.</p><Link to="/" className="mt-6 inline-flex rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950">Zur Website</Link></div></div>;
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500 text-white"><Sparkles size={18} /></div><div><div className="font-semibold tracking-tight">RealSyncDynamics.AI</div><div className="text-[10px] font-semibold uppercase tracking-[.18em] text-slate-400">Website Transformation</div></div></div>
          <div className="flex items-center gap-3"><span className="hidden rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:inline-flex"><span className="mr-2 h-2 w-2 self-center rounded-full bg-emerald-500" />Transformation freigeschaltet</span><button onClick={() => void reload()} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="Aktualisieren"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /></button><Link to="/app" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">Governance Control Plane</Link></div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-cyan-600">Ihr Projekt</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{domain}</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">Ihre neue Landingpage wird auf Basis der bestehenden Website erzeugt. Backend, API, Authentifizierung und Datenbank bleiben unverändert.</p></div><div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Paket</div><div className="mt-1 font-semibold">Governance Launch · €349</div><div className="mt-1 text-xs text-emerald-600">Stripe bestätigt</div></div></div>

        <section className="mb-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Transformation</h2><p className="mt-1 text-xs text-slate-500">Von der Analyse bis zum sicheren Frontend-Launch.</p></div><span className="text-xs font-semibold text-slate-500">Schritt {currentStage + 1} / {stages.length}</span></div></div>
          <div className="grid gap-2 p-5 sm:grid-cols-3 lg:grid-cols-6">{stages.map((stage, index) => { const done = index < currentStage; const active = index === currentStage; return <div key={stage.key} className={`rounded-2xl border p-3 ${done ? 'border-emerald-200 bg-emerald-50' : active ? 'border-cyan-200 bg-cyan-50' : 'border-slate-100 bg-slate-50'}`}><div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${done ? 'bg-emerald-500 text-white' : active ? 'bg-cyan-500 text-white' : 'bg-white text-slate-400'}`}>{done ? <Check size={14} /> : index + 1}</div><div className="mt-3 text-xs font-semibold">{stage.label}</div></div>; })}</div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Eye size={16} className="text-cyan-500" /><h2 className="font-semibold">Neue Landingpage</h2></div><p className="mt-1 text-xs text-slate-500">Die neue Oberfläche ersetzt ausschließlich die Präsentationsschicht.</p></div><span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">AI Studio</span></div>
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"><div className="flex h-8 items-center gap-1 border-b border-slate-200 bg-white px-3"><span className="h-2 w-2 rounded-full bg-slate-300" /><span className="h-2 w-2 rounded-full bg-slate-300" /><span className="h-2 w-2 rounded-full bg-slate-300" /><div className="ml-3 h-4 flex-1 rounded bg-slate-100" /></div><div className="min-h-[330px] bg-gradient-to-br from-slate-950 via-slate-800 to-cyan-950 p-8 text-white"><div className="max-w-xl pt-8"><div className="text-xs font-semibold uppercase tracking-[.2em] text-cyan-300">Generated experience</div><h3 className="mt-4 text-4xl font-semibold leading-tight">Ihre Website. Neu gedacht.</h3><p className="mt-4 max-w-lg text-sm leading-6 text-slate-300">Eine moderne, conversion-orientierte Landingpage aus den Beweisen Ihrer bestehenden Website.</p><button className="mt-7 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900">Vorschau öffnen</button></div></div></div>
            <div className="mt-4 flex flex-wrap gap-3"><Link to="/app/siteos" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">Im Builder öffnen <ExternalLink size={14} /></Link><span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs text-slate-500"><ShieldCheck size={14} className="text-emerald-500" /> Backend bleibt unverändert</span></div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-semibold">Audit-Basis</h2><div className="mt-5 grid grid-cols-2 gap-3"><Metric label="Health" value={site?.health} /><Metric label="Compliance" value={site?.compliance} /><Metric label="Performance" value={site?.performance} /><Metric label="Risiko" value={site?.risk} /></div><div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">{latestScan ? `Letzter Scan: ${new Date(latestScan.observed_at).toLocaleString('de-DE')}` : 'Analyse wird vorbereitet.'}</div></section>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-semibold">Governance Gate</h2><div className="mt-4 flex items-start gap-3"><div className={`mt-0.5 rounded-full p-1 ${governancePassed ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>{governancePassed ? <Check size={14} /> : <Lock size={14} />}</div><div><p className="text-sm font-semibold">{governancePassed ? 'Freigabe möglich' : 'Prüfung erforderlich'}</p><p className="mt-1 text-xs leading-5 text-slate-500">Veröffentlichung wird erst nach bestandenem Governance-Gate freigegeben.</p></div></div><button disabled={!governancePassed} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"><Rocket size={15} /> {governancePassed ? 'Landingpage veröffentlichen' : 'Noch nicht veröffentlichbar'}</button></section>
          </aside>
        </div>

        {error && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <div className="mt-8 flex flex-wrap gap-3 text-xs text-slate-500"><span>✓ DSGVO / Datenschutz</span><span>✓ SEO</span><span>✓ Accessibility</span><span>✓ EU AI Act</span><span>✓ Evidence</span></div>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number | null | undefined }) {
  return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div><div className="mt-2 text-2xl font-semibold">{value == null ? '—' : Math.round(value)}</div></div>;
}
