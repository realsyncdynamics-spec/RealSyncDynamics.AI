import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Clock, TrendingUp, Filter, Search,
  Plus, Target, AlertCircle, BarChart3, ArrowRight, X, Calendar, User, Zap,
  ChevronDown, Trash2, Edit2, CheckSquare, Square,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import { getAuthToken } from '../../lib/auth';

interface RemediationTask {
  id: string;
  gap_id: string;
  control_id: string;
  control_name: string;
  gap_description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'not_started' | 'in_progress' | 'blocked' | 'completed';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  assigned_to: string | null;
  assigned_to_name: string | null;
  start_date: string | null;
  due_date: string;
  completion_date: string | null;
  estimated_effort_hours: number;
  actual_effort_hours: number;
  progress_percent: number;
  dependencies: string[];
  blockers: string[];
  notes: string;
  created_at: string;
  updated_at: string;
}

interface RemediationFilter {
  status?: string;
  priority?: string;
  severity?: string;
  assigned_to?: string;
  search?: string;
}

export function Iso42001RemediationWorkflowView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

function Inner() {
  const { activeTenantId } = useTenant();
  const [tasks, setTasks] = useState<RemediationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RemediationFilter>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTask, setSelectedTask] = useState<RemediationTask | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadTasks = async () => {
    if (!activeTenantId) return;
    setLoading(true);
    setError(null);

    try {
      const token = await getAuthToken();
      const params = new URLSearchParams({
        tenant_id: activeTenantId,
        offset: '0',
        limit: '100',
      });

      if (filter.status) params.append('status', filter.status);
      if (filter.priority) params.append('priority', filter.priority);
      if (filter.severity) params.append('severity', filter.severity);
      if (filter.assigned_to) params.append('assigned_to', filter.assigned_to);

      const response = await fetch(
        `/functions/v1/remediation-workflow?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) throw new Error('Failed to load tasks');
      const data = await response.json();
      setTasks(data.tasks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTasks();
  }, [activeTenantId, filter]);

  const filteredTasks = tasks.filter((task) =>
    searchTerm === '' ||
    task.control_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.gap_description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.control_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: tasks.length,
    not_started: tasks.filter(t => t.status === 'not_started').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    blocked: tasks.filter(t => t.status === 'blocked').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    urgent: tasks.filter(t => t.priority === 'urgent').length,
    total_hours: tasks.reduce((sum, t) => sum + (t.estimated_effort_hours || 0), 0),
    avg_progress: tasks.length > 0 ? Math.round(tasks.reduce((sum, t) => sum + t.progress_percent, 0) / tasks.length) : 0,
  };

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
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-sm">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Remediation Workflow</div>
              <div className="text-[11px] text-titanium-400 font-medium">ISO 42001 Behebungsmaßnahmen</div>
            </div>
          </div>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-none transition">
          <Plus className="h-4 w-4" />
          Task erstellen
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
          {/* Metrics Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
              <div className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-2">Gesamt-Tasks</div>
              <div className="text-3xl font-bold text-titanium-50">{stats.total}</div>
              <div className="text-[11px] text-titanium-400 mt-2">zur Behebung erforderlich</div>
            </div>

            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
              <div className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-2">In Bearbeitung</div>
              <div className="text-3xl font-bold text-amber-400">{stats.in_progress}</div>
              <div className="text-[11px] text-titanium-400 mt-2">Dringend: {stats.urgent}</div>
            </div>

            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
              <div className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-2">Gesamtaufwand</div>
              <div className="text-3xl font-bold text-titanium-50">{stats.total_hours}</div>
              <div className="text-[11px] text-titanium-400 mt-2">geschätzte Stunden</div>
            </div>

            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
              <div className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-2">Durchschnittlicher Fortschritt</div>
              <div className="text-3xl font-bold text-green-400">{stats.avg_progress}%</div>
              <div className="h-2 bg-obsidian-800 rounded-none mt-2 overflow-hidden">
                <div className="h-full bg-green-400" style={{ width: `${stats.avg_progress}%` }} />
              </div>
            </div>
          </div>

          {/* Status Overview Bars */}
          <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
            <h3 className="font-semibold text-titanium-50 text-sm mb-4">Status-Verteilung</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[11px] text-titanium-400 mb-1">
                  <span>Nicht gestartet</span>
                  <span>{stats.not_started}/{stats.total}</span>
                </div>
                <div className="h-2 bg-obsidian-800 rounded-none overflow-hidden">
                  <div className="h-full bg-gray-500" style={{ width: `${(stats.not_started / stats.total) * 100}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-titanium-400 mb-1">
                  <span>In Bearbeitung</span>
                  <span>{stats.in_progress}/{stats.total}</span>
                </div>
                <div className="h-2 bg-obsidian-800 rounded-none overflow-hidden">
                  <div className="h-full bg-amber-500" style={{ width: `${(stats.in_progress / stats.total) * 100}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-titanium-400 mb-1">
                  <span>Blockiert</span>
                  <span>{stats.blocked}/{stats.total}</span>
                </div>
                <div className="h-2 bg-obsidian-800 rounded-none overflow-hidden">
                  <div className="h-full bg-red-600" style={{ width: `${(stats.blocked / stats.total) * 100}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-titanium-400 mb-1">
                  <span>Abgeschlossen</span>
                  <span>{stats.completed}/{stats.total}</span>
                </div>
                <div className="h-2 bg-obsidian-800 rounded-none overflow-hidden">
                  <div className="h-full bg-green-500" style={{ width: `${(stats.completed / stats.total) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Filter & Search */}
          <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-titanium-500" />
                <input
                  type="text"
                  placeholder="Nach Control, Gap oder ID suchen..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 placeholder-titanium-600 text-sm rounded-none focus:outline-none focus:border-blue-500"
                />
              </div>

              <select
                value={filter.status || ''}
                onChange={(e) => setFilter({ ...filter, status: e.target.value || undefined })}
                className="px-3 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-sm rounded-none focus:outline-none focus:border-blue-500"
              >
                <option value="">Alle Status</option>
                <option value="not_started">Nicht gestartet</option>
                <option value="in_progress">In Bearbeitung</option>
                <option value="blocked">Blockiert</option>
                <option value="completed">Abgeschlossen</option>
              </select>

              <select
                value={filter.priority || ''}
                onChange={(e) => setFilter({ ...filter, priority: e.target.value || undefined })}
                className="px-3 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-sm rounded-none focus:outline-none focus:border-blue-500"
              >
                <option value="">Alle Prioritäten</option>
                <option value="urgent">Dringend</option>
                <option value="high">Hoch</option>
                <option value="medium">Mittel</option>
                <option value="low">Niedrig</option>
              </select>
            </div>
          </div>

          {/* Tasks List */}
          <div>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <AlertCircle className="h-6 w-6 animate-spin text-titanium-500" />
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-8 text-center">
                <AlertCircle className="h-8 w-8 text-titanium-500 mx-auto mb-3" />
                <p className="text-titanium-400 text-sm">Keine Tasks gefunden</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    selected={selectedTask?.id === task.id}
                    onSelect={setSelectedTask}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {showCreateModal && (
        <CreateTaskModal
          onClose={() => setShowCreateModal(false)}
          onTaskCreated={() => {
            setShowCreateModal(false);
            void loadTasks();
          }}
        />
      )}
    </div>
  );
}

function TaskCard({ task, selected, onSelect }: { task: RemediationTask; selected: boolean; onSelect: (task: RemediationTask) => void }) {
  const priorityColor = {
    urgent: 'bg-red-950 border-red-800 text-red-300',
    high: 'bg-orange-950 border-orange-800 text-orange-300',
    medium: 'bg-yellow-950 border-yellow-800 text-yellow-300',
    low: 'bg-blue-950 border-blue-800 text-blue-300',
  };

  const statusIcon = {
    not_started: <Square className="h-4 w-4" />,
    in_progress: <AlertCircle className="h-4 w-4" />,
    blocked: <AlertTriangle className="h-4 w-4" />,
    completed: <CheckSquare className="h-4 w-4" />,
  };

  const statusColor = {
    not_started: 'text-gray-400',
    in_progress: 'text-amber-400',
    blocked: 'text-red-400',
    completed: 'text-green-400',
  };

  const daysRemaining = Math.ceil((new Date(task.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const isOverdue = daysRemaining < 0;

  return (
    <button
      onClick={() => onSelect(task)}
      className={`w-full text-left p-4 rounded-none border transition ${
        selected
          ? 'bg-obsidian-800 border-blue-600'
          : 'bg-obsidian-900 border-titanium-900 hover:border-titanium-700'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3 flex-1">
          <div className={`mt-1 ${statusColor[task.status]}`}>
            {statusIcon[task.status]}
          </div>
          <div className="flex-1">
            <div className="font-semibold text-titanium-50 text-sm mb-1">
              {task.control_id} — {task.control_name}
            </div>
            <div className="text-[11px] text-titanium-400 mb-2">
              {task.gap_description}
            </div>
          </div>
        </div>
        <span className={`text-[10px] px-2 py-1 border rounded-none font-semibold ${priorityColor[task.priority]}`}>
          {task.priority}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-[11px]">
        <div>
          <div className="text-titanium-500 uppercase font-semibold tracking-wide mb-1">Fortschritt</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-obsidian-800 rounded-none overflow-hidden">
              <div className="h-full bg-blue-500" style={{ width: `${task.progress_percent}%` }} />
            </div>
            <span className="text-titanium-100">{task.progress_percent}%</span>
          </div>
        </div>

        <div>
          <div className="text-titanium-500 uppercase font-semibold tracking-wide mb-1">Fälligkeitsdatum</div>
          <div className={isOverdue ? 'text-red-400' : 'text-titanium-100'}>
            {new Date(task.due_date).toLocaleDateString('de-DE')}
            {daysRemaining >= 0 && <div className="text-titanium-500">({daysRemaining} Tage)</div>}
            {isOverdue && <div className="text-red-400">ÜBERFÄLLIG</div>}
          </div>
        </div>

        <div>
          <div className="text-titanium-500 uppercase font-semibold tracking-wide mb-1">Bearbeiter</div>
          <div className="text-titanium-100">
            {task.assigned_to_name || 'Unzugewiesen'}
          </div>
        </div>

        <div>
          <div className="text-titanium-500 uppercase font-semibold tracking-wide mb-1">Aufwand</div>
          <div className="text-titanium-100">
            {task.actual_effort_hours}/{task.estimated_effort_hours}h
          </div>
        </div>
      </div>

      {task.blockers.length > 0 && (
        <div className="flex items-center gap-2 text-[11px] text-red-300">
          <AlertTriangle className="h-3 w-3" />
          <span>{task.blockers.length} Blocker</span>
        </div>
      )}
    </button>
  );
}

function TaskDetailPanel({ task, onClose }: { task: RemediationTask; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50">
      <div className="w-full md:w-96 bg-obsidian-900 border-t border-l border-titanium-900 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-obsidian-900 border-b border-titanium-900 px-4 py-3 flex items-center justify-between">
          <h3 className="font-semibold text-titanium-50">{task.control_id}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-obsidian-800 rounded-none">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <p className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-1">Control</p>
            <p className="text-sm text-titanium-100">{task.control_name}</p>
          </div>

          <div>
            <p className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-1">Gap-Beschreibung</p>
            <p className="text-sm text-titanium-100">{task.gap_description}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-1">Status</p>
              <p className="text-sm text-titanium-100 capitalize">{task.status.replace('_', ' ')}</p>
            </div>

            <div>
              <p className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-1">Priorität</p>
              <p className="text-sm text-titanium-100 capitalize">{task.priority}</p>
            </div>

            <div>
              <p className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-1">Fortschritt</p>
              <p className="text-sm text-titanium-100">{task.progress_percent}%</p>
            </div>

            <div>
              <p className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-1">Schweregrad</p>
              <p className="text-sm text-titanium-100 capitalize">{task.severity}</p>
            </div>
          </div>

          <div>
            <p className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-1">Fälligkeitsdatum</p>
            <p className="text-sm text-titanium-100">{new Date(task.due_date).toLocaleDateString('de-DE')}</p>
          </div>

          <div>
            <p className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-1">Bearbeiter</p>
            <div className="flex items-center gap-2 text-sm text-titanium-100">
              <User className="h-4 w-4" />
              {task.assigned_to_name || 'Unzugewiesen'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-1">Geschätzt</p>
              <p className="text-sm text-titanium-100">{task.estimated_effort_hours}h</p>
            </div>

            <div>
              <p className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-1">Tatsächlich</p>
              <p className="text-sm text-titanium-100">{task.actual_effort_hours}h</p>
            </div>
          </div>

          {task.dependencies.length > 0 && (
            <div>
              <p className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-2">Abhängigkeiten</p>
              <div className="space-y-1">
                {task.dependencies.map((dep) => (
                  <div key={dep} className="text-[11px] text-titanium-400 pl-3 border-l border-titanium-700">
                    {dep}
                  </div>
                ))}
              </div>
            </div>
          )}

          {task.blockers.length > 0 && (
            <div>
              <p className="text-[11px] text-red-400 uppercase font-semibold tracking-wide mb-2">Blocker</p>
              <div className="space-y-1">
                {task.blockers.map((blocker) => (
                  <div key={blocker} className="text-[11px] text-red-300 pl-3 border-l border-red-700">
                    {blocker}
                  </div>
                ))}
              </div>
            </div>
          )}

          {task.notes && (
            <div>
              <p className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-1">Notizen</p>
              <p className="text-[11px] text-titanium-400">{task.notes}</p>
            </div>
          )}

          <div className="border-t border-titanium-900 pt-4 flex gap-2">
            <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-none transition">
              <Edit2 className="h-4 w-4" />
              Bearbeiten
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-obsidian-800 border border-titanium-800 hover:bg-obsidian-700 text-titanium-200 text-sm font-semibold rounded-none transition">
              <Trash2 className="h-4 w-4" />
              Löschen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateTaskModal({ onClose, onTaskCreated }: { onClose: () => void; onTaskCreated: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-titanium-50 text-lg">Neue Behebungsaufgabe</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-obsidian-800 rounded-none">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide block mb-2">
              Control/Gap
            </label>
            <select className="w-full px-3 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-sm rounded-none focus:outline-none focus:border-blue-500">
              <option>Wählen Sie eine Lücke aus...</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide block mb-2">
              Priorität
            </label>
            <select className="w-full px-3 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-sm rounded-none focus:outline-none focus:border-blue-500">
              <option value="high">Hoch</option>
              <option value="medium">Mittel</option>
              <option value="low">Niedrig</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide block mb-2">
              Fälligkeitsdatum
            </label>
            <input
              type="date"
              className="w-full px-3 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-sm rounded-none focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide block mb-2">
              Bearbeiter
            </label>
            <select className="w-full px-3 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-sm rounded-none focus:outline-none focus:border-blue-500">
              <option value="">Unzugewiesen</option>
              <option>Benutzer 1</option>
              <option>Benutzer 2</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide block mb-2">
              Geschätzter Aufwand (Stunden)
            </label>
            <input
              type="number"
              min="1"
              className="w-full px-3 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-sm rounded-none focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide block mb-2">
              Notizen
            </label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-sm rounded-none focus:outline-none focus:border-blue-500"
              placeholder="Erforderliche Schritte, Abhängigkeiten, etc."
            />
          </div>

          <div className="flex gap-2 pt-4 border-t border-titanium-900">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-obsidian-800 border border-titanium-800 hover:bg-obsidian-700 text-titanium-200 text-sm font-semibold rounded-none transition"
            >
              Abbrechen
            </button>
            <button
              onClick={() => onTaskCreated()}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-none transition"
            >
              Erstellen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
