import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Users, Loader2, AlertTriangle, CheckCircle2, Plus, Calendar,
  BarChart3, FileCheck, MessageSquare, Clock, AlertCircle, Shield,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import { getAuthToken } from '../../lib/auth';
import { withPerformanceMonitoring } from './withPerformanceMonitoring';

interface Assessor {
  id: string;
  name: string;
  email: string;
  organization?: string;
  role: 'lead_auditor' | 'auditor' | 'observer';
  assigned_controls: number;
  assessment_status: 'not_started' | 'in_progress' | 'completed';
  completion_percentage: number;
}

interface AuditAssignment {
  id: string;
  auditor_id: string;
  control_id: string;
  control_code: string;
  scheduled_date?: string;
  assessment_status: 'not_started' | 'in_progress' | 'completed';
  findings: string;
  evidence_provided: boolean;
  severity_of_findings?: 'critical' | 'major' | 'minor' | 'none';
}

interface AuditEvent {
  id: string;
  date: string;
  type: 'scheduled' | 'assessment_completed' | 'finding_logged' | 'remediation_planned' | 'remediation_verified';
  description: string;
  auditor_name?: string;
  control_code?: string;
}

interface AuditEngagementState {
  status: 'planning' | 'scheduled' | 'in_progress' | 'completed' | 'suspended';
  audit_date?: string;
  planned_duration_days?: number;
  assessors: Assessor[];
  total_assignments: number;
  completed_assessments: number;
  findings_count: {
    critical: number;
    major: number;
    minor: number;
  };
  recent_events: AuditEvent[];
}

function _AuditorEngagementView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const AuditorEngagementView = withPerformanceMonitoring(
  _AuditorEngagementView,
  'AuditorEngagementView',
  { threshold: 500, maxRenders: 10 }
);

function Inner() {
  const { activeTenantId } = useTenant();
  const [engagement, setEngagement] = useState<AuditEngagementState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddAuditor, setShowAddAuditor] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'assessors' | 'assessments' | 'findings'>('overview');

  const loadData = async () => {
    if (!activeTenantId) return;
    setLoading(true);
    setError(null);

    try {
      const token = await getAuthToken();
      const response = await fetch(
        `/functions/v1/auditor-engagement?tenant_id=${activeTenantId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) throw new Error('Failed to load audit data');
      const data = await response.json();
      setEngagement(data);
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

  if (!engagement) {
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

  const statusColors = {
    planning: 'from-blue-900 to-cyan-900 border-blue-800',
    scheduled: 'from-yellow-900 to-orange-900 border-yellow-800',
    in_progress: 'from-purple-900 to-pink-900 border-purple-800',
    completed: 'from-green-900 to-emerald-900 border-green-800',
    suspended: 'from-red-900 to-orange-900 border-red-800',
  };

  const assessmentProgress = engagement.total_assignments > 0
    ? Math.round((engagement.completed_assessments / engagement.total_assignments) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/governance" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-sm">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Auditor Engagement</div>
              <div className="text-[11px] text-titanium-400 font-medium">Zertifizierungsprüfung verwalten</div>
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowAddAuditor(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-none bg-green-700 text-white hover:bg-green-600 font-medium"
        >
          <Plus className="h-3.5 w-3.5" /> Prüfer hinzufügen
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-6 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-6">
          {/* Status Card */}
          <div className={`bg-gradient-to-r ${statusColors[engagement.status]} border rounded-none p-6`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1 capitalize">Audit Status: {engagement.status}</h2>
                <p className="text-[12px] text-white/80">
                  {engagement.completed_assessments} von {engagement.total_assignments} Kontrollen bewertet
                </p>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold text-white">{assessmentProgress}%</div>
                <div className="text-[11px] text-white/80 mt-1">Fortschritt</div>
              </div>
            </div>
            <div className="w-full h-2 bg-black/30 rounded-none overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-400 to-emerald-400"
                style={{ width: `${assessmentProgress}%` }}
              />
            </div>

            {engagement.audit_date && (
              <div className="mt-4 flex items-center gap-2 text-sm text-white/90">
                <Calendar className="h-4 w-4" />
                Audit geplant für: {new Date(engagement.audit_date).toLocaleDateString('de-DE')}
              </div>
            )}
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricBox label="Prüfer" value={engagement.assessors.length} icon={Users} color="blue" />
            <MetricBox
              label="Zuweisungen"
              value={engagement.total_assignments}
              icon={FileCheck}
              color="yellow"
            />
            <MetricBox
              label="Kritische Befunde"
              value={engagement.findings_count.critical}
              icon={AlertCircle}
              color={engagement.findings_count.critical > 0 ? 'red' : 'green'}
            />
            <MetricBox
              label="Hauptbefunde"
              value={engagement.findings_count.major}
              icon={AlertTriangle}
              color="orange"
            />
          </div>

          {/* Tabs */}
          <div className="border-b border-titanium-900">
            <div className="flex gap-6">
              {(['overview', 'assessors', 'assessments', 'findings'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                    activeTab === tab
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-titanium-400 hover:text-titanium-300'
                  }`}
                >
                  {tab === 'overview' && 'Übersicht'}
                  {tab === 'assessors' && 'Prüfer'}
                  {tab === 'assessments' && 'Bewertungen'}
                  {tab === 'findings' && 'Befunde'}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div>
            {activeTab === 'overview' && <OverviewTab engagement={engagement} />}
            {activeTab === 'assessors' && <AssessorsTab assessors={engagement.assessors} />}
            {activeTab === 'assessments' && <AssessmentsTab engagement={engagement} />}
            {activeTab === 'findings' && <FindingsTab engagement={engagement} />}
          </div>
        </div>
      </main>

      {/* Add Auditor Modal */}
      {showAddAuditor && (
        <AddAuditorModal onClose={() => setShowAddAuditor(false)} tenantId={activeTenantId} />
      )}
    </div>
  );
}

function OverviewTab({ engagement }: { engagement: AuditEngagementState }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Timeline */}
      <div className="lg:col-span-2 bg-obsidian-900 border border-titanium-900 rounded-none p-4">
        <h3 className="font-semibold text-titanium-50 mb-4 text-[12px] uppercase tracking-wide flex items-center gap-2">
          <Clock className="h-4 w-4" /> Audit-Zeitleiste
        </h3>

        <div className="space-y-2">
          {engagement.recent_events.map((event, idx) => (
            <div key={event.id} className="flex gap-3 pb-3 border-b border-titanium-900/50 last:border-0">
              <div className="flex flex-col items-center">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                {idx < engagement.recent_events.length - 1 && (
                  <div className="w-0.5 h-6 bg-titanium-900/50" />
                )}
              </div>
              <div className="flex-1">
                <div className="text-[11px] text-titanium-400">
                  {new Date(event.date).toLocaleDateString('de-DE')}
                </div>
                <div className="text-[12px] text-titanium-300">{event.description}</div>
                {event.auditor_name && (
                  <div className="text-[10px] text-titanium-500 mt-1">von {event.auditor_name}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Status Summary */}
      <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
        <h3 className="font-semibold text-titanium-50 mb-4 text-[12px] uppercase tracking-wide">Zusammenfassung</h3>

        <div className="space-y-3">
          <div>
            <div className="text-[11px] text-titanium-400 mb-1">Geplante Dauer</div>
            <div className="text-[13px] font-bold text-titanium-100">
              {engagement.planned_duration_days} Tage
            </div>
          </div>

          <div className="pt-3 border-t border-titanium-900">
            <div className="text-[11px] text-titanium-400 mb-1">Gesamtbefunde</div>
            <div className="text-[11px] space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-red-400">Kritisch:</span>
                <span className="font-bold">{engagement.findings_count.critical}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-orange-400">Hauptbefund:</span>
                <span className="font-bold">{engagement.findings_count.major}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-yellow-400">Nebenaspekt:</span>
                <span className="font-bold">{engagement.findings_count.minor}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssessorsTab({ assessors }: { assessors: Assessor[] }) {
  return (
    <div className="space-y-3">
      {assessors.map((assessor) => (
        <div key={assessor.id} className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h4 className="font-semibold text-titanium-50">{assessor.name}</h4>
              <p className="text-[11px] text-titanium-400">{assessor.email}</p>
              {assessor.organization && (
                <p className="text-[11px] text-titanium-500 mt-0.5">{assessor.organization}</p>
              )}
            </div>
            <div className="text-right">
              <div className="px-2 py-1 bg-blue-950 border border-blue-800 text-blue-300 text-[10px] rounded-none font-semibold capitalize">
                {assessor.role.replace('_', ' ')}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div>
              <span className="text-titanium-400">Zugeordnete Kontrollen</span>
              <div className="text-[13px] font-bold text-titanium-100 mt-1">{assessor.assigned_controls}</div>
            </div>
            <div>
              <span className="text-titanium-400">Status</span>
              <div className="text-[13px] font-bold text-titanium-100 mt-1">{assessor.completion_percentage}%</div>
            </div>
            <div>
              <span className="text-titanium-400">Bewertung</span>
              <div className={`text-[11px] font-bold mt-1 ${
                assessor.assessment_status === 'completed' ? 'text-green-400' :
                assessor.assessment_status === 'in_progress' ? 'text-yellow-400' :
                'text-titanium-400'
              }`}>
                {assessor.assessment_status.replace('_', ' ')}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AssessmentsTab({ engagement }: { engagement: AuditEngagementState }) {
  return (
    <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
      <div className="text-[12px] text-titanium-400">
        {engagement.total_assignments} Bewertungen insgesamt
      </div>
      <div className="mt-4 space-y-2">
        {engagement.assessors.map((assessor) => (
          <div key={assessor.id} className="flex items-center justify-between text-[11px] p-2 bg-obsidian-800 rounded-none">
            <span className="text-titanium-300">{assessor.name}</span>
            <div className="flex items-center gap-2">
              <div className="text-titanium-500">{assessor.assigned_controls} Kontrollen</div>
              <div className="w-20 h-1.5 bg-obsidian-700 rounded-none overflow-hidden">
                <div
                  className="h-full bg-green-500"
                  style={{ width: `${assessor.completion_percentage}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FindingsTab({ engagement }: { engagement: AuditEngagementState }) {
  return (
    <div className="space-y-4">
      {[
        { severity: 'critical', count: engagement.findings_count.critical, color: 'red', label: 'Kritische Befunde' },
        { severity: 'major', count: engagement.findings_count.major, color: 'orange', label: 'Hauptbefunde' },
        { severity: 'minor', count: engagement.findings_count.minor, color: 'yellow', label: 'Nebenaspekte' },
      ].map(({ severity, count, color, label }) => (
        <div key={severity} className={`bg-obsidian-900 border border-${color}-900 rounded-none p-4`}>
          <div className="flex items-center justify-between">
            <h4 className={`font-semibold text-${color}-300`}>{label}</h4>
            <div className={`text-2xl font-bold text-${color}-400`}>{count}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MetricBox({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: typeof Users;
  color: 'blue' | 'yellow' | 'red' | 'orange' | 'green';
}) {
  const colorMap = {
    blue: 'from-blue-900 to-cyan-900 border-blue-800',
    yellow: 'from-yellow-900 to-orange-900 border-yellow-800',
    red: 'from-red-900 to-orange-900 border-red-800',
    orange: 'from-orange-900 to-red-900 border-orange-800',
    green: 'from-green-900 to-emerald-900 border-green-800',
  };

  return (
    <div className={`bg-gradient-to-br ${colorMap[color]} border rounded-none p-4`}>
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-white" />
        <div>
          <div className="text-[11px] text-white/80 uppercase font-semibold">{label}</div>
          <div className="text-3xl font-bold text-white mt-1">{value}</div>
        </div>
      </div>
    </div>
  );
}

function AddAuditorModal({ onClose, tenantId }: { onClose: () => void; tenantId: string }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    organization: '',
    role: 'auditor' as const,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const token = await getAuthToken();
      const response = await fetch(`/functions/v1/add-auditor`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          ...formData,
        }),
      });

      if (!response.ok) throw new Error('Failed to add auditor');
      onClose();
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-obsidian-900 border border-titanium-800 rounded-none p-6 w-full max-w-md">
        <h2 className="font-bold text-titanium-50 mb-4">Auditor hinzufügen</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-semibold text-titanium-300 uppercase tracking-wide block mb-1.5">
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-obsidian-800 border border-titanium-800 text-titanium-200 text-sm rounded-none px-3 py-2 outline-none"
              required
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-titanium-300 uppercase tracking-wide block mb-1.5">
              E-Mail
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-obsidian-800 border border-titanium-800 text-titanium-200 text-sm rounded-none px-3 py-2 outline-none"
              required
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-titanium-300 uppercase tracking-wide block mb-1.5">
              Organisation (optional)
            </label>
            <input
              type="text"
              value={formData.organization}
              onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
              className="w-full bg-obsidian-800 border border-titanium-800 text-titanium-200 text-sm rounded-none px-3 py-2 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-titanium-300 uppercase tracking-wide block mb-1.5">
              Rolle
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
              className="w-full bg-obsidian-800 border border-titanium-800 text-titanium-200 text-sm rounded-none px-3 py-2 outline-none"
            >
              <option value="lead_auditor">Leitender Auditor</option>
              <option value="auditor">Auditor</option>
              <option value="observer">Beobachter</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-titanium-700 text-titanium-300 rounded-none hover:bg-obsidian-800 font-medium text-sm"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-green-700 text-white rounded-none hover:bg-green-600 disabled:opacity-50 font-medium text-sm"
            >
              {saving ? 'Speichert…' : 'Hinzufügen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
