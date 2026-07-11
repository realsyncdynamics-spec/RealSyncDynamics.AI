import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Brain, Loader2, AlertTriangle, CheckCircle2, Clock, TrendingUp,
  BarChart3, Target, AlertCircle, Calendar, Users, FileCheck, Zap,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import { getAuthToken } from '../../lib/auth';

interface CertificationReadiness {
  overall_score: number; // 0-100
  total_controls: number;
  implemented_controls: number;
  in_progress_controls: number;
  planned_controls: number;
  not_started_controls: number;
  average_maturity: number; // 0-5

  categories: CategoryReadiness[];
  timeline: {
    estimated_weeks: number;
    critical_path: string[];
    auditor_contact_required: boolean;
  };
  action_items: ActionItem[];
  risks: RiskItem[];
  resources: ResourceAllocation;
}

interface CategoryReadiness {
  name: string; // e.g. "AI Management System", "Risk Management"
  completion_percentage: number;
  controls_completed: number;
  controls_total: number;
  critical_issues: number;
  status: 'at_risk' | 'on_track' | 'ahead';
}

interface ActionItem {
  id: string;
  title: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'blocked' | 'completed';
  due_date?: string;
  assigned_to?: string;
  effort_hours: number;
  control_ids: string[];
}

interface RiskItem {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  likelihood: number; // 0-1
  impact: number; // 0-1
  mitigation_plan?: string;
}

interface ResourceAllocation {
  total_hours_required: number;
  hours_completed: number;
  current_team_size: number;
  recommended_team_size: number;
  weeks_until_ready: number;
}

export function CertificationReadinessDashboard() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

function Inner() {
  const { activeTenantId } = useTenant();
  const [readiness, setReadiness] = useState<CertificationReadiness | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!activeTenantId) return;
    setLoading(true);
    setError(null);

    try {
      const token = await getAuthToken();
      const response = await fetch(
        `/functions/v1/certification-readiness?tenant_id=${activeTenantId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) throw new Error('Failed to load readiness data');
      const data = await response.json();
      setReadiness(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [activeTenantId]);

  if (!activeTenantId) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex items-center justify-center">
        <div className="text-titanium-500 text-sm">Tenant wählen.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex items-center justify-center">
        <div className="flex items-center gap-2 text-titanium-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Laden…
        </div>
      </div>
    );
  }

  if (!readiness) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-100">
        <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
          <Link to="/app/governance" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-8">
          {error && (
            <div className="flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </main>
      </div>
    );
  }

  const readinessColor = readiness.overall_score >= 80 ? 'green' : readiness.overall_score >= 60 ? 'yellow' : 'red';
  const readinessColorMap = {
    green: 'from-green-900 to-emerald-900 border-green-800',
    yellow: 'from-yellow-900 to-orange-900 border-yellow-800',
    red: 'from-red-900 to-orange-900 border-red-800',
  };

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/governance" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-sm">
              <Target className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">ISO 42001 Readiness</div>
              <div className="text-[11px] text-titanium-400 font-medium">Zertifizierungsvorbereitung</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-6 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-6">
          {/* Overall Score Card */}
          <div className={`bg-gradient-to-r ${readinessColorMap[readinessColor]} border rounded-none p-8`}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">Gesamtbereitschaft</h2>
                <p className="text-[12px] text-white/80">
                  {readiness.implemented_controls} von {readiness.total_controls} Kontrollen implementiert
                </p>
              </div>
              <div className="text-right">
                <div className="text-6xl font-bold text-white">{readiness.overall_score}%</div>
                <div className="text-[11px] text-white/80 mt-1">Completion</div>
              </div>
            </div>
            <div className="w-full h-2 bg-black/30 rounded-none overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${
                  readinessColor === 'green' ? 'from-emerald-400 to-green-400' :
                  readinessColor === 'yellow' ? 'from-yellow-400 to-orange-400' :
                  'from-red-400 to-orange-400'
                }`}
                style={{ width: `${readiness.overall_score}%` }}
              />
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              icon={CheckCircle2}
              label="Implementiert"
              value={readiness.implemented_controls}
              total={readiness.total_controls}
              color="green"
            />
            <MetricCard
              icon={Clock}
              label="In Bearbeitung"
              value={readiness.in_progress_controls}
              total={readiness.total_controls}
              color="blue"
            />
            <MetricCard
              icon={AlertCircle}
              label="Geplant"
              value={readiness.planned_controls}
              total={readiness.total_controls}
              color="yellow"
            />
            <MetricCard
              icon={TrendingUp}
              label="Durchschn. Reifegrad"
              value={readiness.average_maturity}
              total={5}
              color="purple"
              format="maturity"
            />
          </div>

          {/* Timeline & Critical Path */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Timeline */}
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
              <h3 className="font-semibold text-titanium-50 mb-3 flex items-center gap-2 text-[12px] uppercase tracking-wide">
                <Calendar className="h-4 w-4" /> Timeline zur Zertifizierung
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-titanium-400">Geschätzte Wochen</span>
                  <span className="text-[13px] font-bold text-titanium-100">{readiness.timeline.estimated_weeks}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-titanium-400">Auditor-Kontakt erforderlich</span>
                  <span className="text-[11px]">
                    {readiness.timeline.auditor_contact_required ? (
                      <span className="px-2 py-1 bg-blue-950 border border-blue-800 text-blue-300 rounded-none font-semibold">Ja</span>
                    ) : (
                      <span className="px-2 py-1 bg-green-950 border border-green-800 text-green-300 rounded-none font-semibold">Nein</span>
                    )}
                  </span>
                </div>

                {readiness.timeline.critical_path.length > 0 && (
                  <div className="mt-4 p-2 bg-obsidian-800 border border-titanium-900 rounded-none">
                    <div className="text-[11px] text-titanium-400 font-semibold mb-2">Kritischer Pfad:</div>
                    <ul className="space-y-1">
                      {readiness.timeline.critical_path.map((item, idx) => (
                        <li key={idx} className="text-[10px] text-titanium-300 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Resource Allocation */}
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
              <h3 className="font-semibold text-titanium-50 mb-3 flex items-center gap-2 text-[12px] uppercase tracking-wide">
                <Users className="h-4 w-4" /> Ressourcenbedarf
              </h3>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-titanium-400">Stunden investiert</span>
                    <span className="text-[11px] font-semibold text-titanium-300">
                      {readiness.resources.hours_completed} / {readiness.resources.total_hours_required}
                    </span>
                  </div>
                  <div className="h-1.5 bg-obsidian-800 rounded-none overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{
                        width: `${Math.round(
                          (readiness.resources.hours_completed / readiness.resources.total_hours_required) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-titanium-400">Aktuelle Team-Größe</span>
                  <span className="text-titanium-300 font-semibold">{readiness.resources.current_team_size}</span>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-titanium-400">Empfohlen für Zeitplan</span>
                  <span className={`font-semibold ${
                    readiness.resources.current_team_size >= readiness.resources.recommended_team_size
                      ? 'text-green-400' : 'text-yellow-400'
                  }`}>
                    {readiness.resources.recommended_team_size}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] border-t border-titanium-900 pt-2 mt-2">
                  <span className="text-titanium-400">Wochen bis Fertigstellung</span>
                  <span className="text-titanium-300 font-semibold">{readiness.resources.weeks_until_ready}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Category Progress */}
          <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
            <h3 className="font-semibold text-titanium-50 mb-4 flex items-center gap-2 text-[12px] uppercase tracking-wide">
              <BarChart3 className="h-4 w-4" /> Kontrollkategorien
            </h3>

            <div className="space-y-3">
              {readiness.categories.map((category, idx) => {
                const statusColors = {
                  at_risk: 'border-red-900 bg-red-950',
                  on_track: 'border-yellow-900 bg-yellow-950',
                  ahead: 'border-green-900 bg-green-950',
                };

                return (
                  <div key={idx} className={`border rounded-none p-3 ${statusColors[category.status]}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="text-[11px] font-semibold text-titanium-50">{category.name}</h4>
                        <p className="text-[10px] text-titanium-400">
                          {category.controls_completed} / {category.controls_total} Kontrollen
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-[13px] font-bold">{category.completion_percentage}%</div>
                        {category.critical_issues > 0 && (
                          <div className="text-[10px] text-red-400 mt-0.5">{category.critical_issues} kritisch</div>
                        )}
                      </div>
                    </div>
                    <div className="h-1.5 bg-black/30 rounded-none overflow-hidden">
                      <div
                        className={`h-full ${
                          category.status === 'ahead' ? 'bg-green-500' :
                          category.status === 'on_track' ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${category.completion_percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Items */}
          {readiness.action_items.length > 0 && (
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
              <h3 className="font-semibold text-titanium-50 mb-4 flex items-center gap-2 text-[12px] uppercase tracking-wide">
                <Zap className="h-4 w-4" /> Aktionselemente
              </h3>

              <div className="space-y-2">
                {readiness.action_items.slice(0, 5).map((item) => {
                  const priorityColors = {
                    critical: 'border-red-900 bg-red-950 text-red-300',
                    high: 'border-orange-900 bg-orange-950 text-orange-300',
                    medium: 'border-yellow-900 bg-yellow-950 text-yellow-300',
                    low: 'border-blue-900 bg-blue-950 text-blue-300',
                  };

                  const statusIcons = {
                    open: '○',
                    in_progress: '◐',
                    blocked: '✕',
                    completed: '✓',
                  };

                  return (
                    <div key={item.id} className={`border rounded-none p-2 flex items-start gap-2 ${priorityColors[item.priority]}`}>
                      <span className="text-[12px] font-bold shrink-0 mt-0.5">{statusIcons[item.status]}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-semibold">{item.title}</div>
                        <div className="text-[10px] opacity-80">{item.effort_hours}h • {item.control_ids.length} Kontrollen</div>
                        {item.due_date && (
                          <div className="text-[10px] opacity-70 mt-0.5">
                            Fällig: {new Date(item.due_date).toLocaleDateString('de-DE')}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {readiness.action_items.length > 5 && (
                <Link
                  to="/app/governance/iso42001/action-items"
                  className="inline-block text-[11px] font-semibold text-blue-400 hover:text-blue-300 mt-3"
                >
                  Alle {readiness.action_items.length} Elemente ansehen →
                </Link>
              )}
            </div>
          )}

          {/* Risks */}
          {readiness.risks.length > 0 && (
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
              <h3 className="font-semibold text-titanium-50 mb-4 flex items-center gap-2 text-[12px] uppercase tracking-wide">
                <AlertTriangle className="h-4 w-4" /> Identifizierte Risiken
              </h3>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {readiness.risks.slice(0, 4).map((risk) => {
                  const severityColors = {
                    critical: 'border-red-900 bg-red-950 text-red-300',
                    high: 'border-orange-900 bg-orange-950 text-orange-300',
                    medium: 'border-yellow-900 bg-yellow-950 text-yellow-300',
                    low: 'border-blue-900 bg-blue-950 text-blue-300',
                  };

                  const riskScore = risk.likelihood * risk.impact;

                  return (
                    <div key={risk.id} className={`border rounded-none p-2 ${severityColors[risk.severity]}`}>
                      <div className="text-[11px] font-semibold mb-1">{risk.title}</div>
                      <div className="text-[10px] opacity-80">
                        Risiko-Score: {(riskScore * 100).toFixed(0)}%
                      </div>
                      {risk.mitigation_plan && (
                        <div className="text-[10px] opacity-70 mt-1 italic">
                          Maßnahme: {risk.mitigation_plan.substring(0, 40)}…
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  total,
  color,
  format = 'fraction',
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: number;
  total: number;
  color: 'green' | 'blue' | 'yellow' | 'purple';
  format?: 'fraction' | 'maturity';
}) {
  const colorMap = {
    green: 'from-green-900 to-emerald-900 border-green-800',
    blue: 'from-blue-900 to-cyan-900 border-blue-800',
    yellow: 'from-yellow-900 to-orange-900 border-yellow-800',
    purple: 'from-purple-900 to-pink-900 border-purple-800',
  };

  const percentage = format === 'maturity' ? Math.round((value / total) * 100) : Math.round((value / total) * 100);

  return (
    <div className={`bg-gradient-to-br ${colorMap[color]} border rounded-none p-4`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Icon className="h-4 w-4 text-white" />
            <span className="text-[10px] text-white/80 uppercase font-semibold tracking-wide">{label}</span>
          </div>
          <div className="text-3xl font-bold text-white">
            {format === 'maturity' ? value.toFixed(1) : value}
          </div>
          <div className="text-[10px] text-white/70 mt-1">
            {format === 'maturity' ? `von ${total}` : `von ${total}`}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-white">{percentage}%</div>
        </div>
      </div>
    </div>
  );
}
