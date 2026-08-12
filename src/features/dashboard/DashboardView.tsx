import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSupabase } from '../../lib/supabase';
import { useTenant } from '../../core/access/TenantProvider';
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
} from 'lucide-react';
import { WorkflowView } from './components/WorkflowView';

interface ComplianceScore {
  score_overall: number;
  score_gdpr?: number;
  score_nis2?: number;
  score_dsa?: number;
  score_ai_act?: number;
  trend_direction: 'improving' | 'stable' | 'declining';
  recorded_at: string;
}

interface RiskMetrics {
  critical_risks_count: number;
  high_risks_count: number;
  medium_risks_count: number;
  low_risks_count: number;
  open_incidents_count: number;
  overdue_remediations: number;
}

interface DashboardInsight {
  id: string;
  insight_type: string;
  title: string;
  severity: 'info' | 'warning' | 'critical';
  recommended_action?: string;
  created_at: string;
}

interface DashboardKPI {
  domains_active: number;
  policies_documented: number;
  vendors_managed: number;
  avg_incident_response_hours?: number;
  audit_coverage_percent?: number;
}

const actionCards = [
  { label: 'Website prüfen', hint: 'Vollständiger Audit', icon: Search, path: '/website-builder' },
  { label: 'Website bauen', hint: 'Neue Website erstellen', icon: Wand2, path: '/website-builder' },
  { label: 'Website verbessern', hint: 'SEO, DSGVO, Performance', icon: Activity, path: '/website-builder' },
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
  const [latestScore, setLatestScore] = useState<ComplianceScore | null>(null);
  const [risks, setRisks] = useState<RiskMetrics | null>(null);
  const [insights, setInsights] = useState<DashboardInsight[]>([]);
  const [kpis, setKpis] = useState<DashboardKPI | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'workflows'>('dashboard');
  const [command, setCommand] = useState('');

  useEffect(() => {
    if (!tenantId) return;

    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        const [scoreResult, riskResult, insightsResult, kpiResult] = await Promise.all([
          supabase.from('compliance_score_history').select('*').eq('tenant_id', tenantId).order('recorded_at', { ascending: false }).limit(1),
          supabase.from('risk_dashboard_summary').select('*').eq('tenant_id', tenantId).single(),
          supabase.from('dashboard_insights').select('*').eq('tenant_id', tenantId).eq('status', 'active').order('created_at', { ascending: false }).limit(5),
          supabase.from('dashboard_kpis').select('*').eq('tenant_id', tenantId).single(),
        ]);

        setLatestScore(scoreResult.data?.[0] ?? null);
        setRisks(riskResult.data ?? null);
        setInsights(insightsResult.data ?? []);
        setKpis(kpiResult.data ?? null);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 60000);
    return () => clearInterval(interval);
  }, [supabase, tenantId]);

  const totalRisks = useMemo(() => risks ? risks.critical_risks_count + risks.high_risks_count + risks.medium_risks_count + risks.low_risks_count : 0, [risks]);
  const compliance = Math.round(latestScore?.score_overall ?? kpis?.audit_coverage_percent ?? 0);
  const criticalRisks = risks?.critical_risks_count ?? 0;
  const aiSystems = kpis?.vendors_managed ?? 0;
  const websites = kpis?.domains_active ?? 0;
  const evidence = kpis?.policies_documented ?? 0;

  const runCommand = () => {
    const value = command.trim();
    if (!value) return;
    const lower = value.toLowerCase();
    if (lower.includes('website') || lower.includes('seo') || lower.includes('landingpage')) {
      navigate('/website-builder');
      return;
    }
    if (lower.includes('ai act') || lower.includes('ki-system') || lower.includes('ki system')) {
      navigate('/app/governance/ai-act-assessment');
      return;
    }
    if (lower.includes('risiko')) {
      navigate('/app/governance/gaps');
      return;
    }
    navigate('/app/governance/ai-register');
  };

  if (isLoading) {
    return <div className="min-h-[70vh] bg-white p-8"><div className="animate-pulse space-y-6"><div className="h-10 w-80 rounded bg-slate-100" /><div className="grid grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-slate-100" />)}</div><div className="h-64 rounded-3xl bg-slate-100" /></div></div>;
  }

  if (error) {
    return <div className="min-h-[70vh] bg-white p-8"><div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700"><h2 className="font-semibold">Dashboard konnte nicht geladen werden</h2><p className="mt-1 text-sm">{error}</p></div></div>;
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
          {[
            ['Websites', websites, '+3 diese Woche', Globe2, 'text-sky-600'],
            ['Risiken', totalRisks, criticalRisks ? `${criticalRisks} kritisch` : 'Keine kritischen', AlertTriangle, 'text-red-500'],
            ['Compliance', `${compliance}%`, 'Durchschnittlicher Score', ShieldCheck, 'text-emerald-600'],
            ['AI Systeme', aiSystems, 'Aktive Systeme', Bot, 'text-violet-600'],
            ['Evidence Items', evidence, 'Nachweise', FileCheck2, 'text-blue-600'],
            ['Offene Aufgaben', risks?.overdue_remediations ?? 0, 'Benötigen Aufmerksamkeit', Target, 'text-amber-600'],
          ].map(([label, value, sub, Icon, color]) => {
            const I = Icon as typeof Target;
            return <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">{label}</span><I size={18} className={String(color)} /></div><div className="mt-2 text-2xl font-bold tracking-tight">{String(value)}</div><div className="mt-1 text-[11px] text-slate-400">{String(sub)}</div></div>;
          })}
        </div>

        {activeTab === 'dashboard' ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
            <main className="min-w-0">
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-violet-500 text-white"><Sparkles size={20} /></div><div><h2 className="font-semibold">Governance AI Assistant <span className="ml-2 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">BETA</span></h2><p className="text-xs text-slate-400">Deine zentrale KI für Governance, Website und Compliance-Aufgaben.</p></div></div><button onClick={() => navigate('/app/governance/ai-register')} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium hover:bg-slate-50">AI Engine: Auto</button></div>
                <div className="rounded-3xl border-2 border-sky-300 bg-white p-3 shadow-[0_8px_35px_rgba(56,189,248,0.10)]"><textarea value={command} onChange={(e) => setCommand(e.target.value)} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') runCommand(); }} placeholder="Was möchtest du heute analysieren, bauen oder verbessern?" className="min-h-28 w-full resize-none border-0 bg-transparent px-2 py-2 text-base outline-none placeholder:text-slate-400" /><div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3"><div className="flex flex-wrap gap-2"><button className="rounded-xl border border-slate-200 p-2 text-slate-500"><Plus size={16} /></button><span className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">@ Kontext</span><span className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">Website</span><span className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">Datei</span></div><button onClick={runCommand} disabled={!command.trim()} className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40"><ArrowRight size={18} /></button></div></div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">{prompts.map((prompt) => <button key={prompt} onClick={() => setCommand(prompt)} className="rounded-2xl border border-slate-200 p-4 text-left text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:bg-sky-50/50">{prompt}</button>)}</div>
              </section>

              <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Letzte Aktivitäten</h2><p className="text-xs text-slate-400">Live aus Governance-, SiteOS- und Agent-Ereignissen.</p></div><button onClick={() => navigate('/app/overview')} className="text-xs font-semibold text-sky-700">Alle Aktivitäten <ArrowRight className="ml-1 inline" size={13} /></button></div><div className="divide-y divide-slate-100">{insights.length > 0 ? insights.map((item) => <button key={item.id} onClick={() => navigate('/app/governance/gaps')} className="flex w-full items-center gap-4 py-3 text-left hover:bg-slate-50"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.severity === 'critical' ? 'bg-red-50 text-red-600' : item.severity === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>{item.severity === 'critical' ? <XCircle size={17} /> : item.severity === 'warning' ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{item.title}</div><div className="text-xs text-slate-400">{item.insight_type}</div></div><ArrowRight size={15} className="text-slate-300" /></button>) : <div className="py-8 text-center text-sm text-slate-400">Noch keine aktiven Aktivitäten. Governance AI füllt den Feed mit echten Ereignissen, sobald Daten vorliegen.</div>}</div></section>
            </main>

            <aside className="space-y-4">
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h3 className="font-semibold">Aktueller Kontext</h3><LayoutDashboard size={16} className="text-slate-400" /></div><div className="mt-4 rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-400">Aktuelle Compliance</div><div className="mt-1 flex items-end justify-between"><span className="text-3xl font-bold">{compliance}%</span><span className="text-xs font-semibold text-emerald-600">{latestScore?.trend_direction === 'declining' ? 'sinkend' : 'stabil / steigend'}</span></div></div><div className="mt-4 space-y-3 text-sm"><div className="flex justify-between"><span className="text-slate-500">AI Act</span><span className="font-semibold">{latestScore?.score_ai_act ?? '—'}%</span></div><div className="flex justify-between"><span className="text-slate-500">DSGVO</span><span className="font-semibold">{latestScore?.score_gdpr ?? '—'}%</span></div><div className="flex justify-between"><span className="text-slate-500">NIS2</span><span className="font-semibold">{latestScore?.score_nis2 ?? '—'}%</span></div></div></section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-semibold">Schnellaktionen</h3><div className="mt-3 space-y-1">{[
                ['Neuen Scan starten', Search, '/website-builder'],
                ['Website in Comet öffnen', Globe2, '/app/websites'],
                ['Chatbot konfigurieren', MessageSquare, '/app/chatbot'],
                ['Telefonbot konfigurieren', Mic, '/app/phonebot'],
                ['Workflow starten', Workflow, '/app/workflows'],
              ].map(([label, Icon, path]) => { const I = Icon as typeof Search; return <button key={String(label)} onClick={() => navigate(String(path))} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm hover:bg-slate-50"><I size={16} className="text-slate-500" /><span className="flex-1">{label}</span><ArrowRight size={14} className="text-slate-300" /></button>; })}</div></section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-semibold">Governance Status</h3><div className="mt-4 space-y-3"><div className="flex items-center justify-between"><span className="text-sm text-slate-500">Risiken</span><span className="font-semibold text-slate-800">{totalRisks}</span></div><div className="flex items-center justify-between"><span className="text-sm text-slate-500">Critical</span><span className="font-semibold text-red-600">{criticalRisks}</span></div><div className="flex items-center justify-between"><span className="text-sm text-slate-500">Offene Remediations</span><span className="font-semibold text-amber-600">{risks?.overdue_remediations ?? 0}</span></div></div></section>
            </aside>
          </div>
        ) : <WorkflowView tenantId={tenantId!} />}

        <div className="mt-6 flex items-center justify-center gap-2"><button onClick={() => setActiveTab('dashboard')} className={`rounded-full px-4 py-2 text-xs font-semibold ${activeTab === 'dashboard' ? 'bg-sky-50 text-sky-700' : 'text-slate-400'}`}>Control Plane</button><button onClick={() => setActiveTab('workflows')} className={`rounded-full px-4 py-2 text-xs font-semibold ${activeTab === 'workflows' ? 'bg-sky-50 text-sky-700' : 'text-slate-400'}`}>Guided Workflows</button></div>
      </div>
    </div>
  );
}
