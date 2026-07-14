import React, { useEffect, useState } from 'react';
import { RotateCw, AlertCircle, CheckCircle, Clock, Eye, Trash2 } from 'lucide-react';
import { getSupabase } from '../../lib/supabase';
import { useTenant } from '../../core/access/TenantProvider';

interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  event_data: Record<string, any>;
  status_code: number | null;
  response_body: string | null;
  error_message: string | null;
  attempt_number: number;
  next_retry_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

export function WebhookRetryManagement() {
  const { activeTenantId } = useTenant();
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDelivery, setSelectedDelivery] = useState<WebhookDelivery | null>(null);
  const [retryLoading, setRetryLoading] = useState(false);

  useEffect(() => {
    if (!activeTenantId) return;
    fetchDeliveries();
  }, [activeTenantId]);

  const fetchDeliveries = async () => {
    try {
      const sb = getSupabase();
      const { data } = await sb
        .from('webhook_deliveries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      setDeliveries((data || []) as WebhookDelivery[]);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch deliveries');
      setLoading(false);
    }
  };

  const handleManualRetry = async (deliveryId: string) => {
    try {
      setRetryLoading(true);
      const sb = getSupabase();

      // Update delivery to reset attempt for retry
      await sb
        .from('webhook_deliveries')
        .update({
          next_retry_at: new Date().toISOString(),
          attempt_number: 1
        })
        .eq('id', deliveryId);

      // Refresh deliveries
      await fetchDeliveries();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setRetryLoading(false);
    }
  };

  const handleDeleteDelivery = async (deliveryId: string) => {
    if (!confirm('Delete this delivery record?')) return;

    try {
      const sb = getSupabase();
      await sb.from('webhook_deliveries').delete().eq('id', deliveryId);
      await fetchDeliveries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const getDeliveryStatus = (delivery: WebhookDelivery) => {
    if (delivery.delivered_at) return 'success';
    if (delivery.attempt_number >= 3) return 'failed';
    return 'pending';
  };

  const getStatusColor = (status: string) => {
    if (status === 'success') return 'text-security-400 bg-security-900';
    if (status === 'failed') return 'text-red-400 bg-red-900';
    return 'text-yellow-400 bg-yellow-900';
  };

  if (loading) {
    return <div className="text-center py-8 text-titanium-400">Lade Webhook-Zustellungen...</div>;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-900 border border-red-700 rounded p-4">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-obsidian-800 border border-titanium-700 rounded p-4">
          <p className="text-xs text-titanium-400 mb-2">Gesamt-Zustellungen</p>
          <p className="text-2xl font-bold text-titanium-50">{deliveries.length}</p>
        </div>
        <div className="bg-obsidian-800 border border-titanium-700 rounded p-4">
          <p className="text-xs text-titanium-400 mb-2">Erfolgreich</p>
          <p className="text-2xl font-bold text-security-400">
            {deliveries.filter(d => d.delivered_at).length}
          </p>
        </div>
        <div className="bg-obsidian-800 border border-titanium-700 rounded p-4">
          <p className="text-xs text-titanium-400 mb-2">Ausstehend/Fehler</p>
          <p className="text-2xl font-bold text-red-400">
            {deliveries.filter(d => !d.delivered_at).length}
          </p>
        </div>
      </div>

      {/* Deliveries Table */}
      <div className="bg-obsidian-800 border border-titanium-700 rounded p-6">
        <h3 className="text-lg font-bold text-titanium-50 mb-4">Webhook-Zustellungshistorie</h3>

        {deliveries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-titanium-700">
                  <th className="text-left py-2 px-2 text-xs text-titanium-400">Ereignis</th>
                  <th className="text-left py-2 px-2 text-xs text-titanium-400">Status</th>
                  <th className="text-left py-2 px-2 text-xs text-titanium-400">Versuche</th>
                  <th className="text-left py-2 px-2 text-xs text-titanium-400">Zeitstempel</th>
                  <th className="text-left py-2 px-2 text-xs text-titanium-400">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map(delivery => {
                  const status = getDeliveryStatus(delivery);
                  return (
                    <tr key={delivery.id} className="border-b border-obsidian-700 hover:bg-obsidian-700">
                      <td className="py-2 px-2 font-mono text-titanium-300 text-xs">
                        {delivery.event_type}
                      </td>
                      <td className="py-2 px-2">
                        <span className={`text-xs font-bold px-2 py-1 rounded flex items-center gap-1 w-fit ${getStatusColor(status)}`}>
                          {status === 'success' ? <CheckCircle className="h-3 w-3" /> :
                           status === 'failed' ? <AlertCircle className="h-3 w-3" /> :
                           <Clock className="h-3 w-3" />}
                          {status === 'success' ? 'Erfolg' : status === 'failed' ? 'Fehler' : 'Ausstehend'}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-titanium-300">
                        {delivery.attempt_number}/3
                      </td>
                      <td className="py-2 px-2 text-titanium-400 text-xs">
                        {new Date(delivery.created_at).toLocaleString('de-DE')}
                      </td>
                      <td className="py-2 px-2 flex gap-2">
                        <button
                          onClick={() => setSelectedDelivery(delivery)}
                          className="p-1 text-titanium-400 hover:text-security-400 hover:bg-security-900 rounded"
                          title="Details anzeigen"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {!delivery.delivered_at && delivery.attempt_number < 3 && (
                          <button
                            onClick={() => handleManualRetry(delivery.id)}
                            disabled={retryLoading}
                            className="p-1 text-titanium-400 hover:text-security-400 hover:bg-security-900 rounded disabled:opacity-50"
                            title="Erneut versuchen"
                          >
                            <RotateCw className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteDelivery(delivery.id)}
                          className="p-1 text-titanium-400 hover:text-red-400 hover:bg-red-900 rounded"
                          title="Löschen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-titanium-400 text-sm text-center py-8">
            Keine Webhook-Zustellungen gefunden
          </p>
        )}
      </div>

      {/* Delivery Details Modal */}
      {selectedDelivery && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-obsidian-900 border border-titanium-700 rounded p-6 max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-titanium-50">Zustellungsdetails</h3>
              <button
                onClick={() => setSelectedDelivery(null)}
                className="text-titanium-400 hover:text-titanium-50"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-titanium-400 mb-1">Ereignistyp</p>
                <p className="font-mono text-sm text-titanium-50">{selectedDelivery.event_type}</p>
              </div>

              <div>
                <p className="text-xs text-titanium-400 mb-1">Status-Code</p>
                <p className="font-mono text-sm text-titanium-50">
                  {selectedDelivery.status_code || 'Nicht erhalten'}
                </p>
              </div>

              {selectedDelivery.error_message && (
                <div>
                  <p className="text-xs text-titanium-400 mb-1">Fehlermeldung</p>
                  <p className="font-mono text-sm text-red-300 bg-red-900 bg-opacity-20 p-2 rounded break-words">
                    {selectedDelivery.error_message}
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs text-titanium-400 mb-1">Anfrage-Daten</p>
                <pre className="bg-obsidian-800 p-2 rounded text-xs text-titanium-300 overflow-x-auto">
                  {JSON.stringify(selectedDelivery.event_data, null, 2)}
                </pre>
              </div>

              {selectedDelivery.response_body && (
                <div>
                  <p className="text-xs text-titanium-400 mb-1">Antwortkörper</p>
                  <pre className="bg-obsidian-800 p-2 rounded text-xs text-titanium-300 overflow-x-auto">
                    {selectedDelivery.response_body}
                  </pre>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                {!selectedDelivery.delivered_at && selectedDelivery.attempt_number < 3 && (
                  <button
                    onClick={() => {
                      handleManualRetry(selectedDelivery.id);
                      setSelectedDelivery(null);
                    }}
                    className="flex-1 px-4 py-2 bg-security-500 text-white font-bold hover:bg-security-600 rounded flex items-center justify-center gap-2"
                  >
                    <RotateCw className="h-4 w-4" />
                    Erneut versuchen
                  </button>
                )}
                <button
                  onClick={() => setSelectedDelivery(null)}
                  className="flex-1 px-4 py-2 bg-obsidian-700 text-titanium-100 font-bold border border-titanium-700 rounded hover:bg-obsidian-600"
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
