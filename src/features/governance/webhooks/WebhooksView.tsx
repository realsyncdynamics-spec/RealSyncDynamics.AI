import React, { useState } from 'react';
import {
  Plus, Trash2, AlertTriangle, CheckCircle2, Clock, Edit2, X, Link2, Copy, RefreshCw,
} from 'lucide-react';
import { useWebhooks, WEBHOOK_EVENTS, type WebhookEndpoint } from './useWebhooks';
import { withPerformanceMonitoring } from '../withPerformanceMonitoring';

function _WebhooksView() {
  const { endpoints, deliveries, loading, error, createEndpoint, updateEndpoint, deleteEndpoint, retryDelivery, refetchDeliveries } = useWebhooks();

  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    url: string;
    description: string;
    events: string[];
    isActive: boolean;
  }>({
    url: '',
    description: '',
    events: [],
    isActive: true,
  });

  const handleToggleEvent = (event: string) => {
    setFormData({
      ...formData,
      events: formData.events.includes(event)
        ? formData.events.filter((e) => e !== event)
        : [...formData.events, event],
    });
  };

  const handleCreateOrUpdate = async () => {
    if (!formData.url.trim()) {
      setFormError('Webhook URL is required');
      return;
    }

    if (formData.events.length === 0) {
      setFormError('At least one event must be selected');
      return;
    }

    try {
      setFormError(null);

      if (editingId) {
        const success = await updateEndpoint(editingId, formData);
        if (!success) {
          setFormError('Failed to update webhook');
          return;
        }
      } else {
        const result = await createEndpoint(formData);
        if (!result) {
          setFormError('Failed to create webhook');
          return;
        }
      }

      resetForm();
      setShowNewForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) {
      return;
    }

    try {
      const success = await deleteEndpoint(id);
      if (!success) {
        setFormError('Failed to delete webhook');
      } else if (selectedEndpointId === id) {
        setSelectedEndpointId(null);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to delete webhook');
    }
  };

  const editEndpoint = (endpoint: WebhookEndpoint) => {
    setFormData({
      url: endpoint.url,
      description: endpoint.description,
      events: endpoint.events,
      isActive: endpoint.isActive,
    });
    setEditingId(endpoint.id);
    setShowNewForm(true);
  };

  const resetForm = () => {
    setFormData({
      url: '',
      description: '',
      events: [],
      isActive: true,
    });
    setEditingId(null);
    setFormError(null);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(label);
    setTimeout(() => setCopySuccess(null), 2000);
  };

  const selectedEndpoint = endpoints.find((e) => e.id === selectedEndpointId);
  const selectedDeliveries = selectedEndpointId
    ? deliveries.filter((d) => d.webhookId === selectedEndpointId)
    : [];

  const getEventColor = (event: string) => {
    if (event.includes('framework')) return 'blue';
    if (event.includes('control')) return 'emerald';
    if (event.includes('audit') || event.includes('compliance')) return 'amber';
    if (event.includes('team')) return 'purple';
    if (event.includes('subscription')) return 'pink';
    return 'titanium';
  };

  return (
    <div className="min-h-screen bg-obsidian-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-titanium-50 mb-2 flex items-center gap-2">
              <Link2 className="w-8 h-8" />
              Webhooks
            </h1>
            <p className="text-titanium-400">
              Receive real-time notifications for compliance events and integrate with external systems.
            </p>
          </div>

          <button
            onClick={() => {
              resetForm();
              setShowNewForm(!showNewForm);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-ai-cyan-500 hover:bg-ai-cyan-600 text-obsidian-950 font-semibold rounded-none transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Webhook
          </button>
        </div>

        {/* New/Edit Form */}
        {showNewForm && (
          <div className="bg-obsidian-900 border border-titanium-800 p-6 rounded-none space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-titanium-50">
                {editingId ? 'Edit Webhook' : 'Create New Webhook'}
              </h2>
              <button
                onClick={() => {
                  setShowNewForm(false);
                  resetForm();
                }}
                className="p-2 text-titanium-400 hover:text-titanium-50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="flex items-start gap-2 p-3 bg-rose-950/30 border border-rose-500/30 rounded-none">
                <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                <p className="text-sm text-rose-300">{formError}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-titanium-300 mb-2">
                Webhook URL *
              </label>
              <input
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://example.com/webhooks/compliance"
                className="w-full px-3 py-2 bg-obsidian-950 border border-titanium-700 rounded-none text-titanium-50 placeholder-titanium-500 focus:border-ai-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-titanium-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the purpose of this webhook..."
                rows={3}
                className="w-full px-3 py-2 bg-obsidian-950 border border-titanium-700 rounded-none text-titanium-50 placeholder-titanium-500 focus:border-ai-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-titanium-300 mb-3">
                Events to Subscribe *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {WEBHOOK_EVENTS.map((event) => (
                  <label key={event} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-obsidian-950 rounded-none transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.events.includes(event)}
                      onChange={() => handleToggleEvent(event)}
                      className="w-4 h-4 rounded-none border border-titanium-700 bg-obsidian-950 text-ai-cyan-500 cursor-pointer"
                    />
                    <span className="text-sm text-titanium-300">{event}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 rounded-none border border-titanium-700 bg-obsidian-950 text-ai-cyan-500 cursor-pointer"
              />
              <label htmlFor="isActive" className="text-sm text-titanium-300 cursor-pointer">
                Active
              </label>
            </div>

            <div className="flex gap-3 pt-4 border-t border-titanium-800">
              <button
                onClick={handleCreateOrUpdate}
                className="flex-1 px-4 py-2.5 bg-ai-cyan-500 hover:bg-ai-cyan-600 text-obsidian-950 font-semibold rounded-none transition-colors"
              >
                {editingId ? 'Update Webhook' : 'Create Webhook'}
              </button>
              <button
                onClick={() => {
                  setShowNewForm(false);
                  resetForm();
                }}
                className="flex-1 px-4 py-2.5 border border-titanium-700 text-titanium-300 hover:text-titanium-50 rounded-none transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Endpoints List */}
          <div className="bg-obsidian-900 border border-titanium-800 rounded-none p-6">
            <h2 className="text-lg font-semibold text-titanium-50 mb-4">
              Endpoints ({endpoints.length})
            </h2>

            {loading ? (
              <p className="text-titanium-400 text-center py-8">Loading webhooks...</p>
            ) : error ? (
              <div className="flex items-start gap-2 p-4 bg-rose-950/30 border border-rose-500/30 rounded-none">
                <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                <p className="text-sm text-rose-300">{error}</p>
              </div>
            ) : endpoints.length === 0 ? (
              <p className="text-titanium-400 text-center py-8">
                No webhooks yet. Create one to get started.
              </p>
            ) : (
              <div className="space-y-2">
                {endpoints.map((endpoint) => (
                  <div
                    key={endpoint.id}
                    onClick={() => {
                      setSelectedEndpointId(endpoint.id);
                      refetchDeliveries(endpoint.id);
                    }}
                    className={`flex items-start justify-between p-4 rounded-none border cursor-pointer transition-colors ${
                      selectedEndpointId === endpoint.id
                        ? 'bg-obsidian-950 border-ai-cyan-500'
                        : 'bg-obsidian-950 border-titanium-800 hover:border-titanium-700'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            endpoint.isActive ? 'bg-emerald-500' : 'bg-titanium-600'
                          } shrink-0`}
                        />
                        <p className="font-semibold text-sm text-titanium-50 truncate">
                          {endpoint.description || endpoint.url}
                        </p>
                      </div>

                      <p className="text-xs text-titanium-500 truncate font-mono mb-2">
                        {endpoint.url}
                      </p>

                      <div className="flex flex-wrap gap-1">
                        {endpoint.events.map((event) => (
                          <span
                            key={event}
                            className={`text-xs px-2 py-0.5 rounded-none bg-${getEventColor(
                              event
                            )}-500/10 text-${getEventColor(event)}-400`}
                          >
                            {event}
                          </span>
                        ))}
                      </div>

                      {endpoint.lastTriggeredAt && (
                        <p className="text-xs text-titanium-600 mt-2 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Last trigger: {endpoint.lastTriggeredAt.toLocaleDateString('de-DE')}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-1 shrink-0 ml-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          editEndpoint(endpoint);
                        }}
                        className="p-2 text-titanium-400 hover:text-titanium-50 hover:bg-titanium-800 rounded-none transition-colors"
                        title="Edit endpoint"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(endpoint.id);
                        }}
                        className="p-2 text-titanium-400 hover:text-rose-400 hover:bg-rose-950/20 rounded-none transition-colors"
                        title="Delete endpoint"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Delivery Log */}
          <div className="bg-obsidian-900 border border-titanium-800 rounded-none p-6">
            {selectedEndpoint ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-titanium-50">
                    Delivery Log
                  </h2>
                  <button
                    onClick={() => refetchDeliveries(selectedEndpointId!)}
                    className="p-2 text-titanium-400 hover:text-titanium-50 hover:bg-titanium-800 rounded-none transition-colors"
                    title="Refresh deliveries"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                {selectedDeliveries.length === 0 ? (
                  <p className="text-titanium-400 text-center py-8">
                    No delivery attempts yet.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {selectedDeliveries.map((delivery) => (
                      <div
                        key={delivery.id}
                        className="flex items-start gap-3 p-3 bg-obsidian-950 border border-titanium-800 rounded-none hover:border-titanium-700 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-none flex items-center justify-center shrink-0 bg-titanium-900">
                          {delivery.deliveredAt ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : delivery.nextRetryAt ? (
                            <Clock className="w-4 h-4 text-amber-400" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-rose-400" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-sm text-titanium-50">
                              {delivery.event}
                            </p>
                            <span className={`text-xs px-2 py-0.5 rounded-none ${
                              delivery.deliveredAt
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : delivery.nextRetryAt
                                ? 'bg-amber-500/10 text-amber-400'
                                : 'bg-rose-500/10 text-rose-400'
                            }`}>
                              {delivery.deliveredAt
                                ? 'Delivered'
                                : delivery.nextRetryAt
                                ? `Retry ${delivery.attempt}`
                                : 'Failed'}
                            </span>
                          </div>

                          <p className="text-xs text-titanium-500 mb-1">
                            {delivery.createdAt.toLocaleDateString('de-DE', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>

                          {delivery.responseStatus && (
                            <p className="text-xs text-titanium-600">
                              Response: {delivery.responseStatus}
                            </p>
                          )}
                        </div>

                        {!delivery.deliveredAt && !delivery.nextRetryAt && (
                          <button
                            onClick={() => retryDelivery(delivery.id)}
                            className="p-2 text-titanium-400 hover:text-titanium-50 hover:bg-titanium-800 rounded-none transition-colors shrink-0"
                            title="Retry delivery"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <Link2 className="w-8 h-8 text-titanium-600 mx-auto mb-3" />
                <p className="text-titanium-400">
                  Select an endpoint to view delivery log
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Secret Management */}
        {selectedEndpoint && (
          <div className="bg-obsidian-900 border border-titanium-800 rounded-none p-6">
            <h3 className="text-lg font-semibold text-titanium-50 mb-4">Webhook Secret</h3>
            <p className="text-xs text-titanium-500 mb-3">
              Use this secret to verify webhook signatures in your application.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-obsidian-950 border border-titanium-700 rounded-none text-titanium-50 text-xs font-mono truncate">
                {selectedEndpoint.secret}
              </code>
              <button
                onClick={() => copyToClipboard(selectedEndpoint.secret, 'Secret copied')}
                className="px-3 py-2 bg-titanium-800 hover:bg-titanium-700 text-titanium-50 rounded-none transition-colors"
                title="Copy secret"
              >
                {copySuccess === 'Secret copied' ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const WebhooksView = withPerformanceMonitoring(
  _WebhooksView,
  'WebhooksView',
  { threshold: 500, maxRenders: 10 }
);
