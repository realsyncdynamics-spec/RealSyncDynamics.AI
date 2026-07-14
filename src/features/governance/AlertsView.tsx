import { useEffect, useState, useCallback } from 'react';
import {
  AlertTriangle, Bell, CheckCircle2, Clock, Filter,
  Loader2, RefreshCw, ShieldAlert, XCircle,
} from 'lucide-react';
import { AuthGate } from '../kodee/connections/AuthGate';
import { useTenant } from '../../core/access/TenantProvider';
import { WorkspaceShell } from '../workspace/WorkspaceShell';
import { getSupabase } from '../../lib/supabase';
import { withPerformanceMonitoring } from './withPerformanceMonitoring';

type AlertSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
type AlertStatus   = 'open' | 'acknowledged' | 'resolved' | 'dismissed';
type AlertCategory =
  | 'compliance' | 'privacy' | 'security' | 'ai_governance'
  | 'data_breach' | 'policy' | 'scan' | 'evidence';

interface GovernanceAlert {
  id: string;
  tenant_id: string;
  source_id: string | null;
  risk_id: string | null;
  event_id: string | null;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  message: string;
  status: AlertStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
}

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  info:     'text-titanium-400 bg-titanium-900/30 border-titanium-800',
  low:      'text-sky-400 bg-sky-950/30 border-sky-900',
  medium:   'text-amber-400 bg-amber-950/30 border-amber-900',
  high:     'text-orange-400 bg-orange-950/30 border-orange-900',
  critical: 'text-rose-400 bg-rose-950/30 border-rose-900',
};

const SEVERITY_DOT: Record<AlertSeverity, string> = {
  info:     'bg-titanium-500',
  low:      'bg-sky-400',
  medium:   'bg-amber-400',
  high:     'bg-orange-400',
  critical: 'bg-rose-500',
};

const STATUS_LABELS: Record<AlertStatus, string> = {
  open:         'Offen',
  acknowledged: 'Bestätigt',
  resolved:     'Behoben',
  dismissed:    'Ignoriert',
};

const CATEGORY_LABELS: Record<AlertCategory, string> = {
  compliance:    'Compliance',
  privacy:       'Datenschutz',
  security:      'Sicherheit',
  ai_governance: 'KI-Governance',
  data_breach:   'Datenpanne',
  policy:        'Richtlinie',
  scan:          'Scan',
  evidence:      'Evidence',
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return 'Gerade eben';
  if (mins  < 60) return `vor ${mins} Min.`;
  if (hours < 24) return `vor ${hours} Std.`;
  return `vor ${days} Tag${days === 1 ? '' : 'en'}`;
}

function _AlertsView() {
  return (
    <AuthGate>
      {() => (
        <WorkspaceShell title="Alerts">
          <Inner />
        </WorkspaceShell>
      )}
    </AuthGate>
  );
}

export const AlertsView = withPerformanceMonitoring(
  _AlertsView,
  'AlertsView',
  { threshold: 500, maxRenders: 10 }
);

function Inner() {
  const { activeTenantId } = useTenant();
  const [alerts, setAlerts]       = useState<GovernanceAlert[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [filterStatus, setFilterStatus]     = useState<AlertStatus | 'all'>('open');
  const [filterSeverity, setFilterSeverity] = useState<AlertSeverity | 'all'>('all');
  const [updating, setUpdating]   = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    if (!activeTenantId) return;
    setLoading(true); setError(null);
    try {
      const sb = getSupabase();
      let query = sb
        .from('governance_alerts')
        .select('*')
        .eq('tenant_id', activeTenantId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (filterStatus !== 'all')   query = query.eq('status', filterStatus);
      if (filterSeverity !== 'all') query = query.eq('severity', filterSeverity);

      const { data, error: err } = await query;
      if (err) throw err;
      setAlerts((data as GovernanceAlert[]) ?? []);
    } catch (e) {
      setError((e as Error)?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [activeTenantId, filterStatus, filterSeverity]);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  const updateStatus = async (alertId: string, newStatus: AlertStatus) => {
    setUpdating(alertId);
    try {
      const sb = getSupabase();
      const patch: Partial<GovernanceAlert> = { status: newStatus };
      if (newStatus === 'acknowledged') patch.acknowledged_at = new Date().toISOString();
      if (newStatus === 'resolved')     patch.resolved_at     = new Date().toISOString();
      await sb.from('governance_alerts').update(patch).eq('id', alertId);
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, ...patch } : a))
      );
    } finally {
      setUpdating(null);
    }
  };

  const openCount    = alerts.filter((a) => a.status === 'open').length;
  const criticalCount = alerts.filter(
    (a) => a.status === 'open' && (a.severity === 'critical' || a.severity === 'high')
  ).length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-2xl text-titanium-50 tracking-tight flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-400" />
            Governance Alerts
          </h2>
          <p className="text-sm text-titanium-400 mt-1">
            Laufzeit-Alerts aus Scans, Policy-Engine und Evidence-Prozessen.
          </p>
        </div>
        <button
          onClick={loadAlerts}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-titanium-400 hover:text-titanium-100 border border-titanium-800 hover:border-titanium-600 transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </button>
      </div>

      {/* Stat Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Offen',       value: openCount,    icon: Bell,       color: 'text-amber-400' },
          { label: 'Kritisch',    value: criticalCount, icon: ShieldAlert, color: 'text-rose-400' },
          { label: 'Gesamt (sichtbar)', value: alerts.length, icon: Filter, color: 'text-titanium-400' },
          { label: 'Behoben',     value: alerts.filter((a) => a.status === 'resolved').length, icon: CheckCircle2, color: 'text-emerald-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-obsidian-900 border border-titanium-900 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className={`h-3.5 w-3.5 ${color}`} />
              <span className="font-mono text-[9px] uppercase tracking-widest text-titanium-600">{label}</span>
            </div>
            <span className={`font-display text-2xl font-bold ${color}`}>{value}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="font-mono text-[9px] uppercase tracking-widest text-titanium-600 mr-1">Status:</span>
        {(['all', 'open', 'acknowledged', 'resolved', 'dismissed'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-2 py-0.5 text-xs font-mono transition-colors ${
              filterStatus === s
                ? 'bg-cyan-900/50 text-cyan-300 border border-cyan-800'
                : 'text-titanium-500 border border-titanium-800 hover:text-titanium-200 hover:border-titanium-600'
            }`}
          >
            {s === 'all' ? 'Alle' : STATUS_LABELS[s]}
          </button>
        ))}
        <span className="font-mono text-[9px] uppercase tracking-widest text-titanium-600 ml-4 mr-1">Severity:</span>
        {(['all', 'critical', 'high', 'medium', 'low', 'info'] as const).map((sv) => (
          <button
            key={sv}
            onClick={() => setFilterSeverity(sv)}
            className={`px-2 py-0.5 text-xs font-mono transition-colors ${
              filterSeverity === sv
                ? 'bg-cyan-900/50 text-cyan-300 border border-cyan-800'
                : 'text-titanium-500 border border-titanium-800 hover:text-titanium-200 hover:border-titanium-600'
            }`}
          >
            {sv === 'all' ? 'Alle' : sv.charAt(0).toUpperCase() + sv.slice(1)}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-rose-300 bg-rose-950/40 border border-rose-900 p-3">
          <XCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
        </div>
      ) : alerts.length === 0 ? (
        <EmptyState filterStatus={filterStatus} />
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              updating={updating === alert.id}
              onUpdateStatus={updateStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AlertCard({
  alert,
  updating,
  onUpdateStatus,
}: {
  alert: GovernanceAlert;
  updating: boolean;
  onUpdateStatus: (id: string, status: AlertStatus) => void;
}) {
  return (
    <div className={`border p-4 ${SEVERITY_COLORS[alert.severity]}`}>
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-1.5 mt-0.5 shrink-0">
          <div className={`h-2 w-2 rounded-full ${SEVERITY_DOT[alert.severity]}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-mono text-[9px] uppercase tracking-widest text-titanium-600">
              {CATEGORY_LABELS[alert.category]}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-titanium-700">·</span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-titanium-600">
              {alert.severity.toUpperCase()}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-titanium-700">·</span>
            <span className="font-mono text-[9px] text-titanium-600">
              {formatRelative(alert.created_at)}
            </span>
          </div>
          <p className="text-sm font-semibold text-titanium-100 leading-snug">{alert.title}</p>
          <p className="text-xs text-titanium-400 mt-0.5 leading-relaxed">{alert.message}</p>
        </div>

        {/* Status badge + actions */}
        <div className="shrink-0 flex flex-col items-end gap-2">
          <span className="font-mono text-[9px] uppercase tracking-wider text-titanium-600 border border-titanium-800 px-1.5 py-0.5">
            {STATUS_LABELS[alert.status]}
          </span>
          {alert.status === 'open' && (
            <div className="flex gap-1">
              <button
                onClick={() => onUpdateStatus(alert.id, 'acknowledged')}
                disabled={updating}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono text-amber-300 border border-amber-900 hover:bg-amber-950/50 transition-colors disabled:opacity-40"
              >
                {updating ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Clock className="h-2.5 w-2.5" />}
                Bestätigen
              </button>
              <button
                onClick={() => onUpdateStatus(alert.id, 'resolved')}
                disabled={updating}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono text-emerald-300 border border-emerald-900 hover:bg-emerald-950/50 transition-colors disabled:opacity-40"
              >
                <CheckCircle2 className="h-2.5 w-2.5" />
                Behoben
              </button>
            </div>
          )}
          {alert.status === 'acknowledged' && (
            <button
              onClick={() => onUpdateStatus(alert.id, 'resolved')}
              disabled={updating}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono text-emerald-300 border border-emerald-900 hover:bg-emerald-950/50 transition-colors disabled:opacity-40"
            >
              <CheckCircle2 className="h-2.5 w-2.5" />
              Behoben markieren
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ filterStatus }: { filterStatus: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-12 w-12 rounded-full bg-obsidian-800 flex items-center justify-center mb-4">
        <Bell className="h-5 w-5 text-titanium-600" />
      </div>
      <p className="text-titanium-300 font-semibold">Keine Alerts</p>
      <p className="text-sm text-titanium-600 mt-1 max-w-xs">
        {filterStatus === 'open'
          ? 'Alle offenen Alerts wurden bearbeitet. Das Governance OS überwacht kontinuierlich weiter.'
          : 'Keine Alerts für diesen Filter gefunden.'}
      </p>
    </div>
  );
}
