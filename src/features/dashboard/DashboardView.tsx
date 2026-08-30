import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  FileCheck2,
  Globe2,
  LayoutDashboard,
  MessageSquare,
  Mic,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Wand2,
  Workflow,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { getSupabase } from '../../lib/supabase';
import { useTenant } from '../../core/access/TenantProvider';
import {
  EMPTY_TENANT_STATUS,
  formatMetric,
  loadTenantStatus,
  type TenantStatus,
} from '../../lib/status/statusAdapter';
import { WorkflowView } from './components/WorkflowView';

interface DashboardInsight {
  id: string;
  insight_type: string;
  title: string;
  severity: 'info' | 'warning' | 'critical';
  recommended_action?: string;
  created_at: string;
}


interface ActionCard {
  label: string;
  hint: string;
  icon: LucideIcon;
  path: string;
}

interface KpiCard {
  label: string;
  value: string | number;
  sub: string;
  icon: LucideIcon;
  color: string;
}

const actionCards: ActionCard[] = [
  { label: 'Website prüfen', hint: 'Vollständiger Audit', icon: Search, path: '/unified-entry/scan' },
  { label: 'Website bauen', hint: 'Neue Website erstellen', icon: Wand2, path: '/unified-entry/scan' },
  { label: 'Website verbessern', hint: 'SEO, DSGVO, Performance', icon: Activity, path: '/unified-entry/scan' },
  { label: 'AI Act Check', hint: 'KI-System prüfen', icon: ShieldCheck, path: '/app/governance/ai-act-assessment' },
  { label: 'Risikoanalyse', hint: 'Risiken identifizieren', icon: AlertTriangle, path: '/app/governance/gaps' },
  { label: 'Bericht erstellen', hint: 'Compliance Report', icon: FileCheck2, path: '/app/governance/report-builder' },
];

const prompts = [
  'Prüfe meine Website auf SEO und DSGVO Probleme.',
  'Baue mir eine neue Website für mein Unternehmen mit Booking.',
  'Welche AI Act Pflichten betreffen mein KI-System?',
  'Optimiere meine Landingpage für bessere Conversion.',
];

export function DashboardView() {
  const supabase = getSupabase();
  const { activeTenantId: tenantId } = useTenant();
  const navigate = useNavigate();
  const [status, setStatus] = useState<TenantStatus>(EMPTY_TENANT_STATUS);
  const [insights, setInsights] = useState<DashboardInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'workflows'>('dashboard');
  const [command, setCommand] = useState('');

  useEffect(() => {
    if (!tenantId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        // Kennzahlen ausschließlich über den Status Adapter — er unterscheidet
        // „nicht belegbar" (null → „—") von „gemessene Null".
        const [tenantStatus, insightsResult] = await Promise.all([
          loadTenantStatus(supabase, tenantId),
          supabase.from('dashboard_insights').select('*').eq('tenant_id', tenantId).eq('status', 'active').order('created_at', { ascending: false }).limit(5),
        ]);

        if (cancelled) return;
        setStatus(tenantStatus);
        setInsights(insightsResult.data ?? []);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Dashboard konnte nicht geladen werden');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void fetchDashboardData();
    const interval = window.setInterval(() => void fetchDashboardData(), 60000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [supabase, tenantId]);

  const criticalRisks = status.criticalRisks;

  const runCommand = () => {
    const value = command.trim().toLowerCase();
    if (!value) return;
    if (value.includes('website') || value.includes('seo') || value.includes('landingpage')) {
      navigate('/unified-entry/scan');
    } else if (value.includes('ai act') || value.includes('ki-system') || value.includes('ki system')) {
      navigate('/app/governance/ai-act-assessment');
    } else if (value.includes('risiko')) {
      navigate('/app/governance/gaps');
    } else {
      navigate('/app/governance/ai-register');
    }
  };

  // Jede Kachel nennt ihre Quelle im Untertitel. Nicht belegbare Werte zeigen
  // „—" statt einer Null, die wie ein Messwert aussieht.
  const kpiCards: KpiCard[] = [
    { label: 'Websites', value: formatMetric(status.websites), sub: 'Registrierte Domains', icon: Globe2, color: 'text-sky-600' },
    { label: 'Risiken', value: formatMetric(status.totalRisks), sub: criticalRisks ? `${criticalRisks} kritisch` : 'Keine kritischen', icon: AlertTriangle, color: 'text-red-500' },
    { label: 'Compliance', value: formatMetric(status.compliancePercent, '%'), sub: 'Letzter Score', icon: ShieldCheck, color: 'text-emerald-600' },
    { label: 'AI Systeme', value: formatMetric(status.aiSystems), sub: 'Registrierte KI-Systeme', icon: Bot, color: 'text-violet-600' },
    { label: 'Evidence Items', value: formatMetric(status.evidenceItems), sub: 'Nachweise im Vault', icon: FileCheck2, color: 'text-blue-600' },
    { label: 'Offene Aufgaben', value: formatMetric(status.openRemediations), sub: 'Benötigen Aufmerksamkeit', icon: Target, color: 'text-amber-600' },
  ];

  if (isLoading) {
    return (
      <div className="min-h-[70vh] bg-white p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-10 w-80 rounded bg-slate-100" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-24 rounded-2xl bg-slate-100" />)}
          </div>
          <div className="h-64 rounded-3xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[70vh] bg-white p-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          <h2 className="font-semibold">Dashboard konnte nicht geladen werden</h2>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#f7f9fc] text-slate-900">
      <div className="mx-auto max-w-[1500px] px-5 py-6 lg:px-7">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700"><Sparkles size={13} /> AI Control Plane</div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Willkommen zurück 👋</h1>
            <p className="mt-1 text-sm text-slate-500">Governance AI ist bereit. Stelle eine Frage oder starte einen Workflow.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-100 bg-white px-4 py-2 text-sm shadow-sm"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Alle Systeme <span className="font-semibold text-emerald-600">Operational</span></div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {actionCards.map(({ label, hint, icon: Icon, path }) => (
            <button key={label} onClick={() => navigate(path)} className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600"><Icon size={18} /></div>
              <div className="flex items-center justify-between text-sm font-semibold">{label}<ArrowRight size={14} className="opacity-0 transition group-hover:opacity-100" /></div>
              <div className="mt-1 text-[11px] text-slate-400">{hint}</div>
            </button>
          ))}
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {kpiCards.map(({ label, value, sub, icon: Icon, color }) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">{label}</span><Icon size={18} className={color} /></div>
              <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
              <div className="mt-1 text-[11px] text-slate-400">{sub}</div>
            </div>
          ))}
        </div>

        {activeTab === 'dashboard' ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
            <main className="min-w-0">
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-violet-500 text-white"><Sparkles size={20} /></div><div><h2 className="font-semibold">Governance AI Assistant <span className="ml-2 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">BETA</span></h2><p className="text-xs text-slate-400">Deine zentrale KI für Governance, Website und Compliance-Aufgaben.</p></div></div>
                  <button onClick={() => navigate('/app/governance/ai-register')} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium hover:bg-slate-50">AI Engine: Auto</button>
                </div>
                <div className="rounded-3xl border-2 border-sky-300 bg-white p-3 shadow-[0_8px_35px_rgba(56,189,248,0.10)]">
                  <textarea value={command} onChange={(event) => setCommand(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') runCommand(); }} placeholder="Was möchtest du heute analysieren, bauen oder verbessern?" className="min-h-28 w-full resize-none border-0 bg-transparent px-2 py-2 text-base outline-none placeholder:text-slate-400" />
                  <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3"><div className="flex flex-wrap gap-2"><button type="button" className="rounded-xl border border-slate-200 p-2 text-slate-500"><Plus size={16} /></button><span className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">@ Kontext</span><span className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">Website</span><span className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">Datei</span></div><button type="button" onClick={runCommand} disabled={!command.trim()} className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40"><ArrowRight size={18} /></button></div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">{prompts.map((prompt) => <button type="button" key={prompt} onClick={() => setCommand(prompt)} className="rounded-2xl border border-slate-200 p-4 text-left text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:bg-sky-50/50">{prompt}</button>)}</div>
              </section>

              <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Letzte Aktivitäten</h2><p className="text-xs text-slate-400">Live aus Governance-, SiteOS- und Agent-Ereignissen.</p></div><button type="button" onClick={() => navigate('/app/overview')} className="text-xs font-semibold text-sky-700">Alle Aktivitäten <ArrowRight className="ml-1 inline" size={13} /></button></div>
                <div className="divide-y divide-slate-100">{insights.length > 0 ? insights.map((item) => <button type="button" key={item.id} onClick={() => navigate('/app/governance/gaps')} className="flex w-full items-center gap-4 py-3 text-left hover:bg-slate-50"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.severity === 'critical' ? 'bg-red-50 text-red-600' : item.severity === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>{item.severity === 'critical' ? <XCircle size={17} /> : item.severity === 'warning' ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{item.title}</div><div className="text-xs text-slate-400">{item.insight_type}</div></div><ArrowRight size={15} className="text-slate-300" /></button>) : <div className="py-8 text-center text-sm text-slate-400">Noch keine aktiven Aktivitäten. Governance AI füllt den Feed mit echten Ereignissen, sobald Daten vorliegen.</div>}</div>
              </section>
            </main>

            <aside className="space-y-4">
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h3 className="font-semibold">Aktueller Kontext</h3><LayoutDashboard size={16} className="text-slate-400" /></div><div className="mt-4 rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-400">Aktuelle Compliance</div><div className="mt-1 flex items-end justify-between"><span className="text-3xl font-bold">{formatMetric(status.compliancePercent, '%')}</span><span className="text-xs font-semibold text-emerald-600">{status.scoreDetail ? (status.scoreDetail.trend_direction === 'declining' ? 'sinkend' : 'stabil / steigend') : 'kein Verlauf'}</span></div></div><div className="mt-4 space-y-3 text-sm"><div className="flex justify-between"><span className="text-slate-500">AI Act</span><span className="font-semibold">{formatMetric(status.scoreDetail?.score_ai_act ?? null, '%')}</span></div><div className="flex justify-between"><span className="text-slate-500">DSGVO</span><span className="font-semibold">{formatMetric(status.scoreDetail?.score_gdpr ?? null, '%')}</span></div><div className="flex justify-between"><span className="text-slate-500">NIS2</span><span className="font-semibold">{formatMetric(status.scoreDetail?.score_nis2 ?? null, '%')}</span></div></div></section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-semibold">Schnellaktionen</h3><div className="mt-3 space-y-1">{[
                { label: 'Neuen Scan starten', icon: Search, path: '/unified-entry/scan' },
                { label: 'Website in Comet öffnen', icon: Globe2, path: '/app/websites' },
                { label: 'Chatbot konfigurieren', icon: MessageSquare, path: '/app/bots' },
                { label: 'Telefonbot konfigurieren', icon: Mic, path: '/app/agents/susi' },
                { label: 'Workflow starten', icon: Workflow, path: '/app/workflows' },
              ].map(({ label, icon: Icon, path }) => <button type="button" key={label} onClick={() => navigate(path)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm hover:bg-slate-50"><Icon size={16} className="text-slate-500" /><span className="flex-1">{label}</span><ArrowRight size={14} className="text-slate-300" /></button>)}</div></section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-semibold">Governance Status</h3><div className="mt-4 space-y-3"><div className="flex items-center justify-between"><span className="text-sm text-slate-500">Risiken</span><span className="font-semibold text-slate-800">{formatMetric(status.totalRisks)}</span></div><div className="flex items-center justify-between"><span className="text-sm text-slate-500">Critical</span><span className="font-semibold text-red-600">{formatMetric(status.criticalRisks)}</span></div><div className="flex items-center justify-between"><span className="text-sm text-slate-500">Offene Remediations</span><span className="font-semibold text-amber-600">{formatMetric(status.openRemediations)}</span></div></div></section>
            </aside>
          </div>
        ) : <WorkflowView tenantId={tenantId!} />}

        <div className="mt-6 flex items-center justify-center gap-2"><button type="button" onClick={() => setActiveTab('dashboard')} className={`rounded-full px-4 py-2 text-xs font-semibold ${activeTab === 'dashboard' ? 'bg-sky-50 text-sky-700' : 'text-slate-400'}`}>Control Plane</button><button type="button" onClick={() => setActiveTab('workflows')} className={`rounded-full px-4 py-2 text-xs font-semibold ${activeTab === 'workflows' ? 'bg-sky-50 text-sky-700' : 'text-slate-400'}`}>Guided Workflows</button></div>
      </div>
    </div>
  );
}
