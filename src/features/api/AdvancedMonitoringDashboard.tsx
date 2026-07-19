import React, { useEffect, useState } from 'react';
import { TrendingUp, AlertCircle, CheckCircle, Clock, Download, Filter, Calendar } from 'lucide-react';
import { getSupabase } from '../../lib/supabase';
import { useTenant } from '../../core/access/TenantProvider';

type EventType = 'webhook' | 'email' | 'all';
type EventStatus = 'success' | 'failed' | 'pending' | 'all';

interface FilterState {
  eventType: EventType;
  status: EventStatus;
  dateRange: 'today' | '7days' | '30days' | 'all';
}

interface MonitoringEvent {
  id: string;
  type: 'webhook' | 'email';
  event_type: string;
  status: EventStatus;
  created_at: string;
  details: string | null;
}

interface MonitoringStats {
  total: number;
  success: number;
  failed: number;
  pending: number;
  successRate: number;
}

export function AdvancedMonitoringDashboard() {
  const { activeTenantId } = useTenant();
  const [filters, setFilters] = useState<FilterState>({
    eventType: 'all',
    status: 'all',
    dateRange: '7days',
  });
  const [events, setEvents] = useState<MonitoringEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<MonitoringStats | null>(null);

  useEffect(() => {
    if (!activeTenantId) return;
    fetchFilteredEvents();
  }, [activeTenantId, filters]);

  const fetchFilteredEvents = async () => {
    try {
      const sb = getSupabase();
      const now = new Date();
      let dateThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      switch (filters.dateRange) {
        case 'today':
          dateThreshold = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case '30days':
          dateThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'all':
          dateThreshold = new Date(0);
          break;
      }

      // Fetch webhook events
      let webhookEvents: MonitoringEvent[] = [];
      if (filters.eventType === 'webhook' || filters.eventType === 'all') {
        const { data } = await sb
          .from('webhook_deliveries')
          .select('*')
          .gte('created_at', dateThreshold.toISOString())
          .order('created_at', { ascending: false });

        webhookEvents = (data || []).map(d => ({
          id: d.id,
          type: 'webhook',
          event_type: d.event_type,
          status: d.delivered_at ? 'success' : d.attempt_number >= 3 ? 'failed' : 'pending',
          created_at: d.created_at,
          details: d.error_message,
        }));
      }

      // Fetch email events
      let emailEvents: MonitoringEvent[] = [];
      if (filters.eventType === 'email' || filters.eventType === 'all') {
        const { data } = await sb
          .from('email_notifications')
          .select('*')
          .eq('tenant_id', activeTenantId)
          .gte('created_at', dateThreshold.toISOString())
          .order('created_at', { ascending: false });

        emailEvents = (data || []).map(e => ({
          id: e.id,
          type: 'email',
          event_type: e.event_type,
          status: e.sent_at ? 'success' : e.error_message ? 'failed' : 'pending',
          created_at: e.created_at,
          details: e.error_message,
        }));
      }

      // Combine and filter
      let combined = [...webhookEvents, ...emailEvents].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Apply status filter
      if (filters.status !== 'all') {
        combined = combined.filter(e => e.status === filters.status);
      }

      setEvents(combined.slice(0, 100));

      // Calculate stats
      const successCount = combined.filter(e => e.status === 'success').length;
      const failedCount = combined.filter(e => e.status === 'failed').length;
      const pendingCount = combined.filter(e => e.status === 'pending').length;

      setStats({
        total: combined.length,
        success: successCount,
        failed: failedCount,
        pending: pendingCount,
        successRate: combined.length > 0 ? Math.round((successCount / combined.length) * 100) : 0,
      });

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
      setLoading(false);
    }
  };

  const exportEvents = () => {
    const csv = [
      ['Typ', 'Ereignis', 'Status', 'Zeitstempel', 'Details'].join(','),
      ...events.map(e =>
        [
          e.type,
          e.event_type,
          e.status,
          new Date(e.created_at).toLocaleString('de-DE'),
          e.details || '',
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `events-${new Date().toISOString()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="text-center py-8 text-titanium-400">Lade erweiterte Monitoring-Daten...</div>;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-900 border border-red-700 rounded p-4">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-obsidian-800 border border-titanium-700 rounded p-4">
            <p className="text-xs text-titanium-400 mb-2">Gesamt-Ereignisse</p>
            <p className="text-2xl font-bold text-titanium-50">{stats.total}</p>
          </div>
          <div className="bg-obsidian-800 border border-titanium-700 rounded p-4">
            <p className="text-xs text-titanium-400 mb-2">Erfolgreich</p>
            <p className="text-2xl font-bold text-security-400">{stats.success}</p>
          </div>
          <div className="bg-obsidian-800 border border-titanium-700 rounded p-4">
            <p className="text-xs text-titanium-400 mb-2">Fehlgeschlagen</p>
            <p className="text-2xl font-bold text-red-400">{stats.failed}</p>
          </div>
          <div className="bg-obsidian-800 border border-titanium-700 rounded p-4">
            <p className="text-xs text-titanium-400 mb-2">Erfolgsquote</p>
            <p className="text-2xl font-bold text-security-400">{stats.successRate}%</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-obsidian-800 border border-titanium-700 rounded p-4">
        <h3 className="text-sm font-bold text-titanium-50 mb-3 flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filter & Export
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          {/* Event Type Filter */}
          <div>
            <label className="text-xs text-titanium-400 block mb-1">Ereignistyp</label>
            <select
              value={filters.eventType}
              onChange={e => setFilters({ ...filters, eventType: e.target.value as EventType })}
              className="w-full px-2 py-1 bg-obsidian-900 border border-titanium-600 rounded text-titanium-50 text-sm"
            >
              <option value="all">Alle</option>
              <option value="webhook">Webhooks</option>
              <option value="email">E-Mails</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="text-xs text-titanium-400 block mb-1">Status</label>
            <select
              value={filters.status}
              onChange={e => setFilters({ ...filters, status: e.target.value as EventStatus })}
              className="w-full px-2 py-1 bg-obsidian-900 border border-titanium-600 rounded text-titanium-50 text-sm"
            >
              <option value="all">Alle</option>
              <option value="success">Erfolgreich</option>
              <option value="failed">Fehler</option>
              <option value="pending">Ausstehend</option>
            </select>
          </div>

          {/* Date Range Filter */}
          <div>
            <label className="text-xs text-titanium-400 block mb-1">Zeitraum</label>
            <select
              value={filters.dateRange}
              onChange={e => setFilters({ ...filters, dateRange: e.target.value as any })}
              className="w-full px-2 py-1 bg-obsidian-900 border border-titanium-600 rounded text-titanium-50 text-sm"
            >
              <option value="today">Heute</option>
              <option value="7days">Letzte 7 Tage</option>
              <option value="30days">Letzte 30 Tage</option>
              <option value="all">Alle</option>
            </select>
          </div>

          {/* Export Button */}
          <div className="flex items-end">
            <button
              onClick={exportEvents}
              className="w-full px-3 py-1 bg-security-500 text-white font-bold hover:bg-security-600 rounded text-sm flex items-center justify-center gap-2"
            >
              <Download className="h-4 w-4" />
              CSV Export
            </button>
          </div>
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-obsidian-800 border border-titanium-700 rounded p-6">
        <h3 className="text-lg font-bold text-titanium-50 mb-4">Gefilterte Ereignisse</h3>

        {events.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-titanium-700">
                  <th className="text-left py-2 px-2 text-xs text-titanium-400">Typ</th>
                  <th className="text-left py-2 px-2 text-xs text-titanium-400">Ereignis</th>
                  <th className="text-left py-2 px-2 text-xs text-titanium-400">Status</th>
                  <th className="text-left py-2 px-2 text-xs text-titanium-400">Zeitstempel</th>
                  <th className="text-left py-2 px-2 text-xs text-titanium-400">Details</th>
                </tr>
              </thead>
              <tbody>
                {events.map(event => (
                  <tr key={event.id} className="border-b border-obsidian-700 hover:bg-obsidian-700">
                    <td className="py-2 px-2">
                      <span className="text-xs font-mono text-titanium-300">
                        {event.type === 'webhook' ? '🔗' : '📧'}
                      </span>
                    </td>
                    <td className="py-2 px-2 font-mono text-titanium-300 text-xs">{event.event_type}</td>
                    <td className="py-2 px-2">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        event.status === 'success'
                          ? 'bg-security-900 text-security-400'
                          : event.status === 'failed'
                          ? 'bg-red-900 text-red-400'
                          : 'bg-yellow-900 text-yellow-400'
                      }`}>
                        {event.status === 'success' ? '✓' : event.status === 'failed' ? '✗' : '◌'} {
                          event.status === 'success' ? 'Erfolg' :
                          event.status === 'failed' ? 'Fehler' :
                          'Ausstehend'
                        }
                      </span>
                    </td>
                    <td className="py-2 px-2 text-titanium-400 text-xs">
                      {new Date(event.created_at).toLocaleString('de-DE')}
                    </td>
                    <td className="py-2 px-2 text-red-300 text-xs font-mono max-w-xs truncate">
                      {event.details || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-titanium-400 text-sm text-center py-8">
            Keine Ereignisse mit den aktuellen Filtern gefunden
          </p>
        )}
      </div>
    </div>
  );
}
