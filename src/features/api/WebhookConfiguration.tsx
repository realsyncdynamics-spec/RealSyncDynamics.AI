/**
 * Webhook Configuration — Manage webhook endpoints for API notifications
 *
 * Allows users to:
 * - Add/edit/delete webhook endpoints
 * - Configure event types (quota warnings, rate limits, suspicious activity)
 * - Test webhook delivery
 * - View delivery history
 * - Monitor retry status
 */

import React, { useEffect, useState } from 'react';
import { Trash2, Plus, Settings, CheckCircle, AlertCircle } from 'lucide-react';
import { getSupabase } from '../../lib/supabase';
import { useTenant } from '../../core/access/TenantProvider';

interface WebhookEndpoint {
  id: string;
  url: string;
  description: string;
  events: string[];
  is_active: boolean;
  last_tested_at: string | null;
  created_at: string;
}

interface WebhookDelivery {
  id: string;
  event_type: string;
  status_code: number | null;
  delivered_at: string | null;
  error_message: string | null;
  created_at: string;
}

const EVENT_TYPES = [
  { value: 'quota_warning', label: 'Quota Warning (80%)', description: 'Sent when API usage reaches 80% of monthly quota' },
  { value: 'quota_exceeded', label: 'Quota Exceeded', description: 'Sent when API quota limit is reached' },
  { value: 'suspicious_activity', label: 'Suspicious Activity', description: 'Sent when unusual API patterns detected' },
];

export function WebhookConfiguration() {
  const { activeTenantId } = useTenant();
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ url: '', description: '', events: [] as string[] });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeTenantId) return;
    fetchWebhooks();
  }, [activeTenantId]);

  const fetchWebhooks = async () => {
    try {
      const sb = getSupabase();

      const { data: webhooksData, error: webhooksErr } = await sb
        .from('webhook_endpoints')
        .select('*')
        .eq('tenant_id', activeTenantId)
        .order('created_at', { ascending: false });

      if (webhooksErr) throw webhooksErr;
      setWebhooks(webhooksData || []);

      // Fetch recent deliveries
      if (webhooksData && webhooksData.length > 0) {
        const webhookIds = webhooksData.map(w => w.id);
        const { data: deliveriesData } = await sb
          .from('webhook_deliveries')
          .select('*')
          .in('webhook_id', webhookIds)
          .order('created_at', { ascending: false })
          .limit(20);

        setDeliveries(deliveriesData || []);
      }

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch webhooks');
      setLoading(false);
    }
  };

  const handleAddWebhook = async () => {
    if (!formData.url || formData.events.length === 0) {
      setError('URL and at least one event type required');
      return;
    }

    try {
      const sb = getSupabase();
      const secretKey = crypto.getRandomValues(new Uint8Array(32));
      const secretKeyHex = Array.from(secretKey).map(b => b.toString(16).padStart(2, '0')).join('');

      const { error: insertErr } = await sb
        .from('webhook_endpoints')
        .insert({
          tenant_id: activeTenantId,
          url: formData.url,
          description: formData.description,
          events: formData.events,
          secret_key: secretKeyHex,
        });

      if (insertErr) throw insertErr;

      setFormData({ url: '', description: '', events: [] });
      setShowForm(false);
      fetchWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add webhook');
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!confirm('Delete this webhook? This cannot be undone.')) return;

    try {
      const sb = getSupabase();
      const { error: deleteErr } = await sb
        .from('webhook_endpoints')
        .delete()
        .eq('id', webhookId);

      if (deleteErr) throw deleteErr;
      fetchWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete webhook');
    }
  };

  const handleToggleEvent = (event: string) => {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event],
    }));
  };

  if (loading) {
    return <div className="text-center py-8 text-titanium-400">Lade Webhook-Konfiguration...</div>;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-900 border border-red-700 rounded p-4">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {/* Add Webhook Form */}
      {showForm && (
        <div className="bg-obsidian-800 border border-titanium-700 rounded p-6">
          <h3 className="text-lg font-bold text-titanium-50 mb-4">Neuen Webhook hinzufügen</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-titanium-300 mb-1">Webhook-URL</label>
              <input
                type="url"
                value={formData.url}
                onChange={e => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://api.example.com/webhooks/api-quota"
                className="w-full px-3 py-2 bg-obsidian-900 border border-titanium-600 rounded text-titanium-50 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm text-titanium-300 mb-1">Beschreibung (optional)</label>
              <input
                type="text"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="z.B. Quota-Benachrichtigungen für Monitoring"
                className="w-full px-3 py-2 bg-obsidian-900 border border-titanium-600 rounded text-titanium-50 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm text-titanium-300 mb-3">Ereignistypen</label>
              <div className="space-y-2">
                {EVENT_TYPES.map(evt => (
                  <label key={evt.value} className="flex items-start gap-3 cursor-pointer p-2 hover:bg-obsidian-700 rounded">
                    <input
                      type="checkbox"
                      checked={formData.events.includes(evt.value)}
                      onChange={() => handleToggleEvent(evt.value)}
                      className="mt-1"
                    />
                    <div>
                      <p className="text-sm font-medium text-titanium-50">{evt.label}</p>
                      <p className="text-xs text-titanium-400">{evt.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={handleAddWebhook}
                className="flex-1 px-4 py-2 bg-security-500 text-white font-bold hover:bg-security-600 rounded"
              >
                Webhook hinzufügen
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2 bg-obsidian-700 text-titanium-100 font-bold border border-titanium-700 rounded hover:bg-obsidian-600"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-security-500 text-white font-bold hover:bg-security-600 rounded"
        >
          <Plus className="h-4 w-4" />
          Neuen Webhook hinzufügen
        </button>
      )}

      {/* Webhooks List */}
      <div className="bg-obsidian-800 border border-titanium-700 rounded p-6">
        <h3 className="text-lg font-bold text-titanium-50 mb-4">Konfigurierte Webhooks</h3>

        {webhooks.length === 0 ? (
          <p className="text-titanium-400 text-sm">Noch keine Webhooks konfiguriert.</p>
        ) : (
          <div className="space-y-4">
            {webhooks.map(webhook => (
              <div key={webhook.id} className="bg-obsidian-900 border border-obsidian-700 rounded p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="font-mono text-sm text-titanium-300 break-all">{webhook.url}</p>
                    {webhook.description && (
                      <p className="text-xs text-titanium-400 mt-1">{webhook.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {webhook.is_active ? (
                      <CheckCircle className="h-5 w-5 text-security-400" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                    )}
                    <button
                      onClick={() => handleDeleteWebhook(webhook.id)}
                      className="p-1 text-red-400 hover:bg-red-900 rounded"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mt-3">
                  {webhook.events.map(event => (
                    <span key={event} className="inline-block px-2 py-1 bg-security-900 text-security-300 text-xs rounded font-mono">
                      {event}
                    </span>
                  ))}
                </div>

                {webhook.last_tested_at && (
                  <p className="text-xs text-titanium-400 mt-3">
                    Zuletzt getestet: {new Date(webhook.last_tested_at).toLocaleString('de-DE')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Deliveries */}
      {deliveries.length > 0 && (
        <div className="bg-obsidian-800 border border-titanium-700 rounded p-6">
          <h3 className="text-lg font-bold text-titanium-50 mb-4">Letzte Lieferungen</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-titanium-700">
                  <th className="text-left py-2 px-2 text-xs text-titanium-400">Event</th>
                  <th className="text-left py-2 px-2 text-xs text-titanium-400">Status</th>
                  <th className="text-left py-2 px-2 text-xs text-titanium-400">Uhrzeit</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map(delivery => (
                  <tr key={delivery.id} className="border-b border-obsidian-700 hover:bg-obsidian-700">
                    <td className="py-2 px-2 font-mono text-titanium-300">{delivery.event_type}</td>
                    <td className="py-2 px-2">
                      {delivery.delivered_at ? (
                        <span className="text-security-400 text-xs font-bold">✓ Gesendet</span>
                      ) : (
                        <span className="text-yellow-500 text-xs font-bold">⟳ Wiederholen</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-titanium-300">
                      {new Date(delivery.created_at).toLocaleString('de-DE')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
