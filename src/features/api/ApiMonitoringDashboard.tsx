import React, { useEffect, useState } from 'react';
import { TrendingUp, AlertCircle, CheckCircle, Clock, Mail, Globe } from 'lucide-react';
import { getSupabase } from '../../lib/supabase';
import { useTenant } from '../../core/access/TenantProvider';

interface DeliveryStats {
  total_deliveries: number;
  successful_deliveries: number;
  failed_deliveries: number;
  avg_retry_attempts: number;
}

interface EmailStats {
  total_emails: number;
  sent_emails: number;
  failed_emails: number;
}

interface RecentEvent {
  id: string;
  type: 'webhook' | 'email';
  event_type: string;
  status: 'success' | 'failed' | 'pending';
  created_at: string;
  details?: string;
}

export function ApiMonitoringDashboard() {
  const { activeTenantId } = useTenant();
  const [webhookStats, setWebhookStats] = useState<DeliveryStats | null>(null);
  const [emailStats, setEmailStats] = useState<EmailStats | null>(null);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeTenantId) return;
    fetchDashboardData();
  }, [activeTenantId]);

  const fetchDashboardData = async () => {
    try {
      const sb = getSupabase();

      // Fetch webhook delivery statistics
      const { data: webhookData } = await sb
        .from('webhook_deliveries')
        .select('*')
        .eq('webhook_id', activeTenantId)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      // Fetch email notification statistics
      const { data: emailData } = await sb
        .from('email_notifications')
        .select('*')
        .eq('tenant_id', activeTenantId)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      // Calculate webhook stats
      if (webhookData && webhookData.length > 0) {
        const successful = webhookData.filter(d => d.delivered_at !== null).length;
        const failed = webhookData.filter(d => d.delivered_at === null && d.attempt_number >= 3).length;
        const avgRetries = webhookData.reduce((sum, d) => sum + (d.attempt_number || 1), 0) / webhookData.length;

        setWebhookStats({
          total_deliveries: webhookData.length,
          successful_deliveries: successful,
          failed_deliveries: failed,
          avg_retry_attempts: Math.round(avgRetries * 10) / 10,
        });
      }

      // Calculate email stats
      if (emailData && emailData.length > 0) {
        const sent = emailData.filter(e => e.sent_at !== null).length;
        const failed = emailData.filter(e => e.error_message !== null).length;

        setEmailStats({
          total_emails: emailData.length,
          sent_emails: sent,
          failed_emails: failed,
        });
      }

      // Fetch recent events (combined webhooks + emails)
      const webhookEvents: RecentEvent[] = (webhookData || []).slice(0, 10).map(d => ({
        id: d.id,
        type: 'webhook',
        event_type: d.event_type,
        status: d.delivered_at ? 'success' : d.attempt_number >= 3 ? 'failed' : 'pending',
        created_at: d.created_at,
        details: d.error_message,
      }));

      const emailEvents: RecentEvent[] = (emailData || []).slice(0, 10).map(e => ({
        id: e.id,
        type: 'email',
        event_type: e.event_type,
        status: e.sent_at ? 'success' : e.error_message ? 'failed' : 'pending',
        created_at: e.created_at,
        details: e.error_message,
      }));

      setRecentEvents([...webhookEvents, ...emailEvents].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ).slice(0, 15));

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch monitoring data');
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-titanium-400">Lade Monitoring-Daten...</div>;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-900 border border-red-700 rounded p-4">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Webhook Deliveries */}
        {webhookStats && (
          <div className="bg-obsidian-800 border border-titanium-700 rounded p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-titanium-50">Webhook-Lieferungen</h3>
              <Globe className="h-4 w-4 text-security-400" />
            </div>
            <p className="text-2xl font-bold text-titanium-50">{webhookStats.total_deliveries}</p>
            <div className="mt-2 space-y-1 text-xs">
              <p className="text-security-400">✓ {webhookStats.successful_deliveries} erfolgreich</p>
              <p className="text-red-400">✗ {webhookStats.failed_deliveries} fehlgeschlagen</p>
              <p className="text-titanium-400">⟳ Ø {webhookStats.avg_retry_attempts} Versuche</p>
            </div>
          </div>
        )}

        {/* Email Notifications */}
        {emailStats && (
          <div className="bg-obsidian-800 border border-titanium-700 rounded p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-titanium-50">E-Mail-Benachrichtigungen</h3>
              <Mail className="h-4 w-4 text-security-400" />
            </div>
            <p className="text-2xl font-bold text-titanium-50">{emailStats.total_emails}</p>
            <div className="mt-2 space-y-1 text-xs">
              <p className="text-security-400">✓ {emailStats.sent_emails} gesendet</p>
              <p className="text-red-400">✗ {emailStats.failed_emails} fehlgeschlagen</p>
              <p className="text-titanium-400">📧 {emailStats.sent_emails} / {emailStats.total_emails}</p>
            </div>
          </div>
        )}

        {/* Success Rate */}
        {webhookStats && (
          <div className="bg-obsidian-800 border border-titanium-700 rounded p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-titanium-50">Erfolgsquote</h3>
              <TrendingUp className="h-4 w-4 text-security-400" />
            </div>
            <p className="text-2xl font-bold text-security-400">
              {webhookStats.total_deliveries > 0
                ? Math.round((webhookStats.successful_deliveries / webhookStats.total_deliveries) * 100)
                : 0}%
            </p>
            <div className="mt-3 w-full bg-obsidian-900 rounded h-2 overflow-hidden">
              <div
                className="bg-security-500 h-full transition-all"
                style={{
                  width: webhookStats.total_deliveries > 0
                    ? `${(webhookStats.successful_deliveries / webhookStats.total_deliveries) * 100}%`
                    : '0%'
                }}
              />
            </div>
          </div>
        )}

        {/* System Health */}
        <div className="bg-obsidian-800 border border-titanium-700 rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-titanium-50">System-Status</h3>
            <CheckCircle className="h-4 w-4 text-security-400" />
          </div>
          <p className="text-sm text-security-400 font-bold">Betriebsbereit</p>
          <div className="mt-2 space-y-1 text-xs text-titanium-400">
            <p>✓ API aktiv</p>
            <p>✓ Webhooks läuft</p>
            <p>✓ E-Mail aktiv</p>
          </div>
        </div>
      </div>

      {/* Recent Events */}
      {recentEvents.length > 0 && (
        <div className="bg-obsidian-800 border border-titanium-700 rounded p-6">
          <h3 className="text-lg font-bold text-titanium-50 mb-4">Letzte Ereignisse (letzte 7 Tage)</h3>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {recentEvents.map(event => (
              <div key={event.id} className="bg-obsidian-900 border border-obsidian-700 rounded p-3 flex items-start gap-3">
                <div className="flex-shrink-0 pt-1">
                  {event.status === 'success' ? (
                    <CheckCircle className="h-4 w-4 text-security-400" />
                  ) : event.status === 'failed' ? (
                    <AlertCircle className="h-4 w-4 text-red-400" />
                  ) : (
                    <Clock className="h-4 w-4 text-yellow-500" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-titanium-300">
                      {event.type === 'webhook' ? '🔗 Webhook' : '📧 E-Mail'}
                    </span>
                    <span className="text-xs px-2 py-1 bg-security-900 text-security-300 rounded font-mono">
                      {event.event_type}
                    </span>
                    <span className={`text-xs font-bold ${
                      event.status === 'success' ? 'text-security-400' :
                      event.status === 'failed' ? 'text-red-400' :
                      'text-yellow-500'
                    }`}>
                      {event.status === 'success' ? 'Erfolg' : event.status === 'failed' ? 'Fehler' : 'Ausstehend'}
                    </span>
                  </div>
                  {event.details && (
                    <p className="text-xs text-red-300 font-mono">{event.details}</p>
                  )}
                  <p className="text-xs text-titanium-400 mt-1">
                    {new Date(event.created_at).toLocaleString('de-DE')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {recentEvents.length === 0 && !loading && (
        <div className="bg-obsidian-800 border border-titanium-700 rounded p-6 text-center">
          <p className="text-titanium-400 text-sm">Keine Ereignisse in den letzten 7 Tagen</p>
        </div>
      )}
    </div>
  );
}
