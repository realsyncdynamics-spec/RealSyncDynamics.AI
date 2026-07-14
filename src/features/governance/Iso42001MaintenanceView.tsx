import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, AlertTriangle, Calendar, TrendingUp, Filter, Search,
  Plus, Target, AlertCircle, BarChart3, ArrowRight, X, Clock, RefreshCw, Zap,
  ChevronDown, CheckSquare, AlertCircle as AlertIcon, RotateCcw,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import { getAuthToken } from '../../lib/auth';

interface ComplianceEvent {
  id: string;
  type: 'audit_scheduled' | 'audit_completed' | 'control_reviewed' | 'policy_updated' | 'training_required' | 'recertification_due';
  title: string;
  description: string;
  scheduled_date: string;
  completed_date?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed';
  assigned_to?: string;
  controls_affected: string[];
}

interface MaintenanceSchedule {
  id: string;
  audit_frequency_months: number;
  recertification_frequency_months: number;
  control_review_frequency_months: number;
  next_audit_date: string;
  next_recertification_date: string;
  last_audit_date?: string;
  last_recertification_date?: string;
  auto_schedule_enabled: boolean;
  notification_days_before: number;
}

interface ComplianceTrend {
  month: string;
  compliance_score: number;
  controls_reviewed: number;
  incidents: number;
  training_completion: number;
}

export function Iso42001MaintenanceView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

function Inner() {
  const { activeTenantId } = useTenant();
  const [events, setEvents] = useState<ComplianceEvent[]>([]);
  const [schedule, setSchedule] = useState<MaintenanceSchedule | null>(null);
  const [trends, setTrends] = useState<ComplianceTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<{ type?: string; status?: string }>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const loadData = async () => {
    if (!activeTenantId) return;
    setLoading(true);
    setError(null);

    try {
      const token = await getAuthToken();
      const response = await fetch(
        `/functions/v1/maintenance-schedule?tenant_id=${activeTenantId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) throw new Error('Failed to load data');
      const data = await response.json();

      setEvents(data.events || []);
      setSchedule(data.schedule || null);
      setTrends(data.trends || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [activeTenantId]);

  const filteredEvents = events.filter((event) => {
    const matchesSearch = searchTerm === '' ||
      event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = !filter.type || event.type === filter.type;
    const matchesStatus = !filter.status || event.status === filter.status;

    return matchesSearch && matchesType && matchesStatus;
  });

  const stats = {
    pending: events.filter(e => e.status === 'pending').length,
    in_progress: events.filter(e => e.status === 'in_progress').length,
    completed: events.filter(e => e.status === 'completed').length,
    critical: events.filter(e => e.severity === 'critical').length,
  };

  const nextAudit = schedule ? new Date(schedule.next_audit_date) : null;
  const nextRecert = schedule ? new Date(schedule.next_recertification_date) : null;
  const daysUntilAudit = nextAudit ? Math.ceil((nextAudit.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const daysUntilRecert = nextRecert ? Math.ceil((nextRecert.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  if (!activeTenantId) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex items-center justify-center">
        <div className="text-titanium-500 text-sm">Tenant wählen.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <div className="flex items-center gap-3 flex-1">
          <Link to="/app/governance/iso42001-hub" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-sm">
              <RotateCcw className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Post-Certification Maintenance</div>
              <div className="text-[11px] text-titanium-400 font-medium">Kontinuierliche Compliance & Überwachung</div>
            </div>
          </div>
        </div>
        <button onClick={() => setShowScheduleModal(true)} className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-none transition">
          <Calendar className="h-4 w-4" />
          Zeitplan verwalten
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
          {/* Compliance Schedule Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
              <div className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-2">Nächste Audit</div>
              {schedule ? (
                <>
                  <div className="text-2xl font-bold text-blue-400 mb-1">
                    {nextAudit?.toLocaleDateString('de-DE')}
                  </div>
                  <div className={`text-[11px] ${daysUntilAudit && daysUntilAudit < 30 ? 'text-red-400' : 'text-titanium-400'}`}>
                    {daysUntilAudit} Tage verbleibend
                  </div>
                </>
              ) : (
                <div className="text-[11px] text-titanium-500">Nicht geplant</div>
              )}
            </div>

            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
              <div className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-2">Nächste Rezertifizierung</div>
              {schedule ? (
                <>
                  <div className="text-2xl font-bold text-emerald-400 mb-1">
                    {nextRecert?.toLocaleDateString('de-DE')}
                  </div>
                  <div className={`text-[11px] ${daysUntilRecert && daysUntilRecert < 60 ? 'text-red-400' : 'text-titanium-400'}`}>
                    {daysUntilRecert} Tage verbleibend
                  </div>
                </>
              ) : (
                <div className="text-[11px] text-titanium-500">Nicht geplant</div>
              )}
            </div>

            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
              <div className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-2">Kritische Events</div>
              <div className="text-2xl font-bold text-red-400 mb-1">{stats.critical}</div>
              <div className="text-[11px] text-titanium-400">
                {stats.pending} ausstehend
              </div>
            </div>
          </div>

          {/* Event Status Overview */}
          <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
            <h3 className="font-semibold text-titanium-50 text-sm mb-4">Event-Übersicht</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[11px] text-titanium-400 mb-1">
                  <span>Ausstehend</span>
                  <span>{stats.pending}/{events.length}</span>
                </div>
                <div className="h-2 bg-obsidian-800 rounded-none overflow-hidden">
                  <div className="h-full bg-yellow-500" style={{ width: `${(stats.pending / events.length) * 100}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-titanium-400 mb-1">
                  <span>In Bearbeitung</span>
                  <span>{stats.in_progress}/{events.length}</span>
                </div>
                <div className="h-2 bg-obsidian-800 rounded-none overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: `${(stats.in_progress / events.length) * 100}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-titanium-400 mb-1">
                  <span>Abgeschlossen</span>
                  <span>{stats.completed}/{events.length}</span>
                </div>
                <div className="h-2 bg-obsidian-800 rounded-none overflow-hidden">
                  <div className="h-full bg-green-500" style={{ width: `${(stats.completed / events.length) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Compliance Trend Chart (simplified text view) */}
          {trends.length > 0 && (
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
              <h3 className="font-semibold text-titanium-50 text-sm mb-4">Compliance-Trend (letzte 12 Monate)</h3>
              <div className="space-y-2">
                {trends.map((trend) => (
                  <div key={trend.month} className="flex items-center justify-between text-[11px]">
                    <span className="text-titanium-400 w-20">{trend.month}</span>
                    <div className="flex-1 mx-3">
                      <div className="h-1.5 bg-obsidian-800 rounded-none overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${trend.compliance_score}%` }} />
                      </div>
                    </div>
                    <span className="text-emerald-400 font-semibold w-10">{trend.compliance_score}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-titanium-500" />
                <input
                  type="text"
                  placeholder="Nach Event oder Titel suchen..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 placeholder-titanium-600 text-sm rounded-none focus:outline-none focus:border-blue-500"
                />
              </div>

              <select
                value={filter.type || ''}
                onChange={(e) => setFilter({ ...filter, type: e.target.value || undefined })}
                className="px-3 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-sm rounded-none focus:outline-none focus:border-blue-500"
              >
                <option value="">Alle Typen</option>
                <option value="audit_scheduled">Audit geplant</option>
                <option value="audit_completed">Audit abgeschlossen</option>
                <option value="control_reviewed">Control überprüft</option>
                <option value="policy_updated">Richtlinie aktualisiert</option>
                <option value="training_required">Training erforderlich</option>
                <option value="recertification_due">Rezertifizierung fällig</option>
              </select>

              <select
                value={filter.status || ''}
                onChange={(e) => setFilter({ ...filter, status: e.target.value || undefined })}
                className="px-3 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-sm rounded-none focus:outline-none focus:border-blue-500"
              >
                <option value="">Alle Status</option>
                <option value="pending">Ausstehend</option>
                <option value="in_progress">In Bearbeitung</option>
                <option value="completed">Abgeschlossen</option>
              </select>
            </div>
          </div>

          {/* Events List */}
          <div>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <AlertIcon className="h-6 w-6 animate-spin text-titanium-500" />
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-8 text-center">
                <AlertIcon className="h-8 w-8 text-titanium-500 mx-auto mb-3" />
                <p className="text-titanium-400 text-sm">Keine Events gefunden</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {showScheduleModal && (
        <ScheduleModal
          schedule={schedule}
          onClose={() => setScheduleModal(false)}
          onScheduleUpdated={() => {
            setShowScheduleModal(false);
            void loadData();
          }}
        />
      )}
    </div>
  );
}

function EventCard({ event }: { event: ComplianceEvent }) {
  const typeLabel = {
    audit_scheduled: 'Audit geplant',
    audit_completed: 'Audit abgeschlossen',
    control_reviewed: 'Control überprüft',
    policy_updated: 'Richtlinie aktualisiert',
    training_required: 'Training erforderlich',
    recertification_due: 'Rezertifizierung fällig',
  };

  const severityColor = {
    critical: 'text-red-400',
    high: 'text-orange-400',
    medium: 'text-yellow-400',
    low: 'text-blue-400',
  };

  const statusIcon = {
    pending: <AlertCircle className="h-4 w-4" />,
    in_progress: <Clock className="h-4 w-4" />,
    completed: <CheckSquare className="h-4 w-4" />,
  };

  const statusColor = {
    pending: 'text-gray-400',
    in_progress: 'text-blue-400',
    completed: 'text-green-400',
  };

  return (
    <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4 hover:border-titanium-700 transition">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-semibold text-titanium-50 text-sm mb-1">
            {typeLabel[event.type]}
          </div>
          <div className="text-[11px] text-titanium-400">
            {event.title}
          </div>
        </div>
        <div className={`${severityColor[event.severity]} mt-0.5`}>
          {statusIcon[event.status]}
        </div>
      </div>

      <div className="text-[11px] text-titanium-400 mb-3">
        {event.description}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] mb-3">
        <div>
          <span className="text-titanium-500">Geplant:</span>
          <div className="text-titanium-100">{new Date(event.scheduled_date).toLocaleDateString('de-DE')}</div>
        </div>

        {event.completed_date && (
          <div>
            <span className="text-titanium-500">Abgeschlossen:</span>
            <div className="text-titanium-100">{new Date(event.completed_date).toLocaleDateString('de-DE')}</div>
          </div>
        )}

        <div>
          <span className="text-titanium-500">Status:</span>
          <div className={`capitalize ${statusColor[event.status]}`}>{event.status.replace('_', ' ')}</div>
        </div>

        <div>
          <span className="text-titanium-500">Schweregrad:</span>
          <div className={`capitalize ${severityColor[event.severity]}`}>{event.severity}</div>
        </div>
      </div>

      {event.controls_affected.length > 0 && (
        <div className="text-[11px]">
          <span className="text-titanium-500">Betroffene Controls:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {event.controls_affected.map((control) => (
              <span key={control} className="px-2 py-1 bg-obsidian-800 border border-titanium-800 text-titanium-300 rounded-none font-mono text-[10px]">
                {control}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ScheduleModal({ schedule, onClose, onScheduleUpdated }: { schedule: MaintenanceSchedule | null; onClose: () => void; onScheduleUpdated: () => void }) {
  const [auditFreq, setAuditFreq] = useState(schedule?.audit_frequency_months || 12);
  const [recertFreq, setRecertFreq] = useState(schedule?.recertification_frequency_months || 24);
  const [reviewFreq, setReviewFreq] = useState(schedule?.control_review_frequency_months || 6);
  const [autoSchedule, setAutoSchedule] = useState(schedule?.auto_schedule_enabled || true);
  const [notifyDays, setNotifyDays] = useState(schedule?.notification_days_before || 30);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-titanium-50 text-lg">Wartungszeitplan konfigurieren</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-obsidian-800 rounded-none">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide block mb-2">
              Audit-Häufigkeit (Monate)
            </label>
            <input
              type="number"
              min="1"
              max="60"
              value={auditFreq}
              onChange={(e) => setAuditFreq(parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-sm rounded-none focus:outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-titanium-500 mt-1">Nächste Audit in {auditFreq} Monat{auditFreq !== 1 ? 'en' : ''}</p>
          </div>

          <div>
            <label className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide block mb-2">
              Rezertifizierung (Monate)
            </label>
            <input
              type="number"
              min="1"
              max="60"
              value={recertFreq}
              onChange={(e) => setRecertFreq(parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-sm rounded-none focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide block mb-2">
              Control-Überprüfung (Monate)
            </label>
            <input
              type="number"
              min="1"
              max="60"
              value={reviewFreq}
              onChange={(e) => setReviewFreq(parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-sm rounded-none focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide block mb-2">
              Benachrichtigungstage vor Event
            </label>
            <input
              type="number"
              min="1"
              max="180"
              value={notifyDays}
              onChange={(e) => setNotifyDays(parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-sm rounded-none focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-3 p-3 bg-obsidian-800 border border-titanium-800 rounded-none">
            <input
              type="checkbox"
              checked={autoSchedule}
              onChange={(e) => setAutoSchedule(e.target.checked)}
              className="w-4 h-4"
            />
            <label className="text-[11px] text-titanium-100 cursor-pointer">
              Automatische Planung aktivieren
            </label>
          </div>

          <div className="flex gap-2 pt-4 border-t border-titanium-900">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-obsidian-800 border border-titanium-800 hover:bg-obsidian-700 text-titanium-200 text-sm font-semibold rounded-none transition"
            >
              Abbrechen
            </button>
            <button
              onClick={() => onScheduleUpdated()}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-none transition"
            >
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
