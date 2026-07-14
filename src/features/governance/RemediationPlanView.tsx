import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Loader2, AlertTriangle, CheckCircle2, Calendar, Users, Zap,
  TrendingUp, Filter, ChevronRight, Target, Clock, AlertCircle,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from './withPerformanceMonitoring';

interface RemediationPlan {
  id: string;
  gap_id: string;
  control_name: string;
  objective: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'overdue' | 'blocked';
  priority: 'critical' | 'high' | 'medium' | 'low';
  owner: string;
  start_date: string | null;
  target_date: string;
  completion_date: string | null;
  milestones: Milestone[];
  estimated_effort_hours: number;
  estimated_cost: number | null;
  progress_percent: number;
  dependencies: string[];
  blockers?: string;
}

interface Milestone {
  id: string;
  title: string;
  due_date: string;
  completed: boolean;
  owner?: string;
}

function _RemediationPlanView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const RemediationPlanView = withPerformanceMonitoring(
  _RemediationPlanView,
  'RemediationPlanView',
  { threshold: 500, maxRenders: 10 }
);

function Inner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [plans, setPlans] = useState<RemediationPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');

  const reload = async () => {
    if (!activeTenantId) return;
    setError(null);
    setPlans(null);

    try {
      const response = await fetch(
        `/functions/v1/governance-resources?tenant_id=${activeTenantId}&resource_type=remediation_plans`,
        { headers: { Authorization: `Bearer ${(await import('../../lib/auth')).getAuthToken()}` } }
      );
      if (!response.ok) throw new Error('Failed to load');
      const data = await response.json();
      setPlans(data.plans || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    }
  };

  useEffect(() => { void reload(); }, [activeTenantId]);

  const filtered = plans?.filter(p =>
    (filterStatus === 'all' || p.status === filterStatus) &&
    (filterPriority === 'all' || p.priority === filterPriority)
  ) || [];

  const criticalCount = plans?.filter(p => p.priority === 'critical').length || 0;
  const overdueCount = plans?.filter(p => p.status === 'overdue').length || 0;
  const completedCount = plans?.filter(p => p.status === 'completed').length || 0;
  const totalPlans = plans?.length || 0;
  const overallProgress = totalPlans > 0
    ? Math.round(plans!.reduce((sum, p) => sum + p.progress_percent, 0) / totalPlans)
    : 0;

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/governance" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
              <Target className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Behebungsplan</div>
              <div className="text-[11px] text-titanium-400 font-medium">Remediation & Milestone Tracking</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tenants.length > 1 && (
            <select
              value={activeTenantId ?? ''}
              onChange={(e) => setActiveTenant(e.target.value)}
              className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer font-medium hover:bg-obsidian-800 max-w-[200px]"
            >
              {tenants.map((t) => (
                <option key={t.tenantId} value={t.tenantId}>{t.name}</option>
              ))}
            </select>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-4 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {overdueCount > 0 && (
          <div className="mb-4 flex items-start gap-3 text-sm bg-red-950/50 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-red-400" />
            <div>
              <div className="font-semibold text-red-300">{overdueCount} überfällige Pläne!</div>
              <div className="text-red-200 text-xs mt-1">Sofortige Nachverfolgung erforderlich.</div>
            </div>
          </div>
        )}

        {!activeTenantId ? (
          <div className="text-titanium-500 text-sm">Tenant wählen.</div>
        ) : plans === null ? (
          <div className="flex items-center gap-2 text-titanium-500 text-sm py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Laden…
          </div>
        ) : (
          <div className="space-y-6">
            {/* Progress Overview */}
            <div className="bg-gradient-to-r from-emerald-900 to-teal-900 border border-emerald-800 rounded-none p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white mb-1">Gesamtfortschritt Behebung</h3>
                  <p className="text-[12px] text-emerald-200">{completedCount} von {totalPlans} Plänen abgeschlossen</p>
                </div>
                <div className="text-right">
                  <div className="text-5xl font-bold text-white">{overallProgress}%</div>
                  <div className="text-[11px] text-emerald-200 mt-1">Durchschnittlicher Fortschritt</div>
                </div>
              </div>
              <div className="mt-4 h-2 bg-emerald-950 rounded-none overflow-hidden">
                <div className="h-full bg-gradient-to-r from-teal-400 to-emerald-400" style={{ width: `${overallProgress}%` }} />
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-obsidian-900 border border-red-900 rounded-none p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-red-400" />
                  <span className="text-[12px] text-red-300 font-semibold">KRITISCH</span>
                </div>
                <div className="text-3xl font-bold text-red-400">{criticalCount}</div>
                <p className="text-[11px] text-titanium-400 mt-1">Hohe Priorität</p>
              </div>

              <div className="bg-obsidian-900 border border-orange-900 rounded-none p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-orange-400" />
                  <span className="text-[12px] text-orange-300 font-semibold">ÜBERFÄLLIG</span>
                </div>
                <div className="text-3xl font-bold text-orange-400">{overdueCount}</div>
                <p className="text-[11px] text-titanium-400 mt-1">Brauchen Aufmerksamkeit</p>
              </div>

              <div className="bg-obsidian-900 border border-green-900 rounded-none p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <span className="text-[12px] text-green-300 font-semibold">ABGESCHLOSSEN</span>
                </div>
                <div className="text-3xl font-bold text-green-400">{completedCount}</div>
                <p className="text-[11px] text-titanium-400 mt-1">Pläne fertig</p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-[12px]">
                <Filter className="h-4 w-4 text-titanium-400" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-obsidian-900 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer font-medium"
                >
                  <option value="all">Status: Alle</option>
                  <option value="not_started">Nicht gestartet</option>
                  <option value="in_progress">In Arbeit</option>
                  <option value="completed">Abgeschlossen</option>
                  <option value="overdue">Überfällig</option>
                  <option value="blocked">Blockiert</option>
                </select>
              </div>
              <div className="flex items-center gap-2 text-[12px]">
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="bg-obsidian-900 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer font-medium"
                >
                  <option value="all">Priorität: Alle</option>
                  <option value="critical">Kritisch</option>
                  <option value="high">Hoch</option>
                  <option value="medium">Mittel</option>
                  <option value="low">Niedrig</option>
                </select>
              </div>
            </div>

            {/* Plans List */}
            {filtered.length === 0 ? (
              <div className="text-center py-20 bg-obsidian-900 border border-titanium-900 rounded-none">
                <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-3" />
                <h3 className="font-semibold text-titanium-50 mb-1">Keine Pläne gefunden</h3>
                <p className="text-titanium-400 text-sm">Alle Behebungspläne mit den gewählten Filtern wurden abgeschlossen.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.sort((a, b) => {
                  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
                  const statusOrder = { overdue: 0, in_progress: 1, not_started: 2, blocked: 3, completed: 4 };
                  const priorityDiff = (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4);
                  return priorityDiff !== 0 ? priorityDiff : (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5);
                }).map((plan) => (
                  <RemediationPlanCard key={plan.id} plan={plan} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function RemediationPlanCard({ plan }: { plan: RemediationPlan }) {
  const statusConfig = {
    not_started: { bg: 'bg-slate-950', border: 'border-slate-800', text: 'text-slate-300', label: '◯ Nicht gestartet' },
    in_progress: { bg: 'bg-blue-950', border: 'border-blue-900', text: 'text-blue-300', label: '⧖ In Arbeit' },
    completed: { bg: 'bg-green-950', border: 'border-green-900', text: 'text-green-300', label: '✓ Abgeschlossen' },
    overdue: { bg: 'bg-red-950', border: 'border-red-900', text: 'text-red-300', label: '✗ Überfällig' },
    blocked: { bg: 'bg-orange-950', border: 'border-orange-900', text: 'text-orange-300', label: '⊘ Blockiert' },
  }[plan.status];

  const priorityColors = {
    critical: 'bg-red-600 text-white',
    high: 'bg-orange-600 text-white',
    medium: 'bg-yellow-600 text-white',
    low: 'bg-blue-600 text-white',
  }[plan.priority];

  const completedMilestones = plan.milestones.filter(m => m.completed).length;

  const isOverdue = plan.target_date && new Date(plan.target_date) < new Date() && plan.status !== 'completed';

  return (
    <div className={`${statusConfig.bg} border ${statusConfig.border} rounded-none p-4`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-titanium-50">{plan.control_name}</h4>
          <p className="text-[12px] text-titanium-400 mt-1 line-clamp-2">{plan.objective}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-semibold px-2 py-1 rounded-none ${priorityColors}`}>
            {plan.priority.toUpperCase()}
          </span>
          <span className={`text-[11px] font-semibold px-2 py-1 rounded-none whitespace-nowrap ${statusConfig.text}`}>
            {statusConfig.label}
          </span>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 text-[11px]">
        <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-2">
          <div className="text-titanium-400 mb-1">Inhaber</div>
          <div className="text-titanium-200 font-mono text-[10px] flex items-center gap-1">
            <Users className="h-3 w-3" /> {plan.owner}
          </div>
        </div>
        <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-2">
          <div className="text-titanium-400 mb-1">Zieltermin</div>
          <div className={`font-mono text-[10px] ${isOverdue ? 'text-red-300' : 'text-titanium-200'}`}>
            {new Date(plan.target_date).toLocaleDateString('de-DE')}
            {isOverdue && ' ⚠️'}
          </div>
        </div>
        <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-2">
          <div className="text-titanium-400 mb-1">Geschätzter Aufwand</div>
          <div className="text-titanium-200 font-mono text-[10px]">{plan.estimated_effort_hours}h</div>
        </div>
        <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-2">
          <div className="text-titanium-400 mb-1">Milestones</div>
          <div className="text-titanium-200 font-semibold text-[10px]">{completedMilestones}/{plan.milestones.length}</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-titanium-400">Fortschritt</span>
          <span className="text-[11px] font-semibold text-titanium-200">{plan.progress_percent}%</span>
        </div>
        <div className="h-1.5 bg-obsidian-800 rounded-none overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-teal-400 to-emerald-400"
            style={{ width: `${plan.progress_percent}%` }}
          />
        </div>
      </div>

      {/* Blockers or Dependencies */}
      {plan.blockers && (
        <div className="mb-3 p-2 bg-obsidian-900 border border-red-800 rounded-none text-[11px] text-red-300">
          <div className="font-semibold flex items-center gap-1 mb-1">
            <AlertCircle className="h-3 w-3" /> Blocker
          </div>
          {plan.blockers}
        </div>
      )}

      {plan.dependencies.length > 0 && (
        <div className="mb-3 text-[11px]">
          <div className="text-titanium-400 mb-1">Abhängigkeiten:</div>
          <div className="flex flex-wrap gap-1">
            {plan.dependencies.map((dep) => (
              <span key={dep} className="bg-obsidian-900 border border-titanium-700 text-titanium-300 px-2 py-0.5 rounded-none text-[10px]">
                {dep}
              </span>
            ))}
          </div>
        </div>
      )}

      <Link
        to={`/app/remediation/${plan.id}`}
        className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-blue-400 hover:text-blue-300 hover:underline"
      >
        Details & Milestones <ChevronRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
