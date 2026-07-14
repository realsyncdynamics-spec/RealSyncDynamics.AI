import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Copy, TestTube, CheckCircle2, AlertCircle,
  Zap, Clock, Eye, Edit2, ChevronDown, Download,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from './withPerformanceMonitoring';

interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  signingSecret: string;
  createdAt: string;
  lastDeliveryAt?: string;
  failureCount: number;
  retryPolicy: 'exponential' | 'linear' | 'once';
  customHeaders?: Record<string, string>;
}

interface WebhookDelivery {
  id: string;
  endpointId: string;
  eventType: string;
  status: 'success' | 'failed' | 'retrying' | 'pending';
  statusCode?: number;
  requestBody: string;
  responseBody?: string;
  sentAt: string;
  retryCount: number;
  nextRetryAt?: string;
}

function _IntegrationsView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const IntegrationsView = withPerformanceMonitoring(
  _IntegrationsView,
  'IntegrationsView',
  { threshold: 500, maxRenders: 10 }
);

function Inner() {
  const { activeTenantId } = useTenant();
  const [view, setView] = useState<'endpoints' | 'deliveries' | 'create'>('endpoints');
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([
    {
      id: 'wh-001',
      name: 'SIEM Integration',
      url: 'https://siem.company.com/governance/webhook',
      events: ['gap_identified', 'compliance_score_updated', 'alert_created'],
      active: true,
      signingSecret: 'sk_test_51H2o4K0000000000000',
      createdAt: '2026-07-01T10:00:00Z',
      lastDeliveryAt: '2026-07-05T14:32:00Z',
      failureCount: 0,
      retryPolicy: 'exponential',
    },
  ]);

  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([
    {
      id: 'del-001',
      endpointId: 'wh-001',
      eventType: 'compliance_score_updated',
      status: 'success',
      statusCode: 200,
      requestBody: '{"tenant_id": "...", "score": 78}',
      sentAt: '2026-07-05T14:32:00Z',
      retryCount: 0,
    },
  ]);

  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);
  const [newEndpoint, setNewEndpoint] = useState<Partial<WebhookEndpoint>>({
    name: '',
    url: '',
    events: [],
    active: true,
    retryPolicy: 'exponential',
  });

  const eventOptions = [
    { id: 'gap_identified', label: 'Gap Identified', icon: AlertCircle },
    { id: 'gap_closed', label: 'Gap Closed', icon: CheckCircle2 },
    { id: 'compliance_score_updated', label: 'Compliance Score Updated', icon: Zap },
    { id: 'evidence_added', label: 'Evidence Added', icon: Download },
    { id: 'alert_created', label: 'Alert Created', icon: AlertCircle },
    { id: 'remediation_milestone_passed', label: 'Milestone Passed', icon: CheckCircle2 },
  ];

  const handleCreateEndpoint = () => {
    if (newEndpoint.name && newEndpoint.url && newEndpoint.events && newEndpoint.events.length > 0) {
      const endpoint: WebhookEndpoint = {
        id: `wh-${Date.now()}`,
        name: newEndpoint.name,
        url: newEndpoint.url,
        events: newEndpoint.events,
        active: newEndpoint.active ?? true,
        signingSecret: `sk_test_${Math.random().toString(36).substr(2, 20)}`,
        createdAt: new Date().toISOString(),
        failureCount: 0,
        retryPolicy: newEndpoint.retryPolicy || 'exponential',
      };
      setEndpoints([...endpoints, endpoint]);
      setNewEndpoint({ name: '', url: '', events: [], active: true, retryPolicy: 'exponential' });
      setView('endpoints');
    }
  };

  const handleTestWebhook = (endpointId: string) => {
    // Simulate webhook test
    console.log('Testing webhook:', endpointId);
    alert('Test payload sent! Check your endpoint logs.');
  };

  const handleDeleteEndpoint = (endpointId: string) => {
    setEndpoints(endpoints.filter((e) => e.id !== endpointId));
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'success':
        return 'bg-green-900 text-green-200';
      case 'failed':
        return 'bg-red-900 text-red-200';
      case 'retrying':
        return 'bg-amber-900 text-amber-200';
      case 'pending':
        return 'bg-blue-900 text-blue-200';
      default:
        return 'bg-obsidian-800 text-titanium-400';
    }
  };

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4 justify-between">
        <div className="flex items-center gap-3">
          <Link to="/app/governance/api-keys" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="font-display font-bold text-sm text-titanium-50">Integrations</div>
            <div className="text-[11px] text-titanium-400">Webhook management & external integrations</div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* View Tabs */}
        <div className="flex gap-3 border-b border-titanium-900 pb-4">
          <button
            onClick={() => setView('endpoints')}
            className={`px-4 py-2 font-semibold text-xs rounded-none transition-colors ${
              view === 'endpoints'
                ? 'bg-cyan-600 text-white'
                : 'text-titanium-400 hover:text-titanium-200'
            }`}
          >
            Webhook Endpoints
          </button>
          <button
            onClick={() => setView('deliveries')}
            className={`px-4 py-2 font-semibold text-xs rounded-none transition-colors ${
              view === 'deliveries'
                ? 'bg-cyan-600 text-white'
                : 'text-titanium-400 hover:text-titanium-200'
            }`}
          >
            Delivery Logs
          </button>
          <button
            onClick={() => setView('create')}
            className={`px-4 py-2 font-semibold text-xs rounded-none transition-colors ml-auto flex items-center gap-2 ${
              view === 'create'
                ? 'bg-emerald-600 text-white'
                : 'bg-obsidian-800 text-titanium-300 hover:bg-obsidian-700'
            }`}
          >
            <Plus className="h-3 w-3" />
            New Endpoint
          </button>
        </div>

        {/* Endpoints View */}
        {view === 'endpoints' && (
          <div className="space-y-4">
            {endpoints.length === 0 ? (
              <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-8 text-center">
                <AlertCircle className="h-8 w-8 text-titanium-600 mx-auto mb-3" />
                <p className="text-titanium-400 mb-4">No webhook endpoints configured</p>
                <button
                  onClick={() => setView('create')}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-none inline-flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Create First Endpoint
                </button>
              </div>
            ) : (
              endpoints.map((endpoint) => (
                <div key={endpoint.id} className="bg-obsidian-900 border border-titanium-900 rounded-none">
                  <button
                    onClick={() => setExpandedEndpoint(expandedEndpoint === endpoint.id ? null : endpoint.id)}
                    className="w-full px-4 py-3 flex items-start justify-between hover:bg-obsidian-800/50 transition-colors"
                  >
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-3 mb-1">
                        <div className={`w-2 h-2 rounded-full ${endpoint.active ? 'bg-green-500' : 'bg-red-500'}`} />
                        <h3 className="font-semibold text-titanium-50">{endpoint.name}</h3>
                        <span className="text-[10px] font-mono text-titanium-500 bg-obsidian-800 px-2 py-1">
                          {endpoint.id}
                        </span>
                      </div>
                      <p className="text-xs text-titanium-400 mb-2">
                        {endpoint.url}
                      </p>
                      <div className="flex items-center gap-4 text-[11px]">
                        <span className="text-titanium-500">
                          {endpoint.events.length} event{endpoint.events.length !== 1 ? 's' : ''}
                        </span>
                        {endpoint.lastDeliveryAt && (
                          <span className="text-titanium-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Last: {new Date(endpoint.lastDeliveryAt).toLocaleString()}
                          </span>
                        )}
                        {endpoint.failureCount > 0 && (
                          <span className="text-red-400">
                            {endpoint.failureCount} failures
                          </span>
                        )}
                      </div>
                    </div>

                    <ChevronDown
                      className={`h-4 w-4 text-titanium-500 mt-0.5 transition-transform shrink-0 ${
                        expandedEndpoint === endpoint.id ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {expandedEndpoint === endpoint.id && (
                    <div className="px-4 py-4 bg-obsidian-950/50 border-t border-titanium-800 space-y-4">
                      <div>
                        <h4 className="text-xs font-semibold text-titanium-300 mb-2">Subscribed Events</h4>
                        <div className="flex flex-wrap gap-2">
                          {endpoint.events.map((event) => (
                            <span key={event} className="bg-cyan-900/30 border border-cyan-700 text-cyan-300 text-[11px] px-2.5 py-1 rounded-none">
                              {event}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold text-titanium-300 mb-2 flex items-center gap-2">
                          <Eye className="h-3 w-3" />
                          Signing Secret
                        </h4>
                        <div className="bg-obsidian-800 border border-titanium-800 rounded-none p-2 flex items-center gap-2">
                          <code className="text-[10px] text-titanium-400 font-mono flex-1 truncate">
                            {endpoint.signingSecret}
                          </code>
                          <button className="p-1 hover:bg-obsidian-700 rounded-none text-titanium-500">
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleTestWebhook(endpoint.id)}
                          className="px-3 py-2 bg-blue-900/30 border border-blue-700 hover:bg-blue-900/50 text-blue-300 text-xs font-semibold rounded-none transition-colors flex items-center gap-2"
                        >
                          <TestTube className="h-3 w-3" />
                          Test Delivery
                        </button>
                        <button className="px-3 py-2 border border-titanium-700 hover:border-titanium-600 text-titanium-300 text-xs font-semibold rounded-none transition-colors flex items-center gap-2">
                          <Edit2 className="h-3 w-3" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteEndpoint(endpoint.id)}
                          className="ml-auto px-3 py-2 border border-red-700/50 hover:border-red-600 text-red-400 text-xs font-semibold rounded-none transition-colors flex items-center gap-2"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Deliveries View */}
        {view === 'deliveries' && (
          <div className="space-y-3">
            {deliveries.length === 0 ? (
              <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-8 text-center">
                <Clock className="h-8 w-8 text-titanium-600 mx-auto mb-3" />
                <p className="text-titanium-400">No deliveries yet</p>
              </div>
            ) : (
              deliveries.map((delivery) => (
                <div key={delivery.id} className={`border rounded-none p-4 ${getStatusColor(delivery.status)}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm mb-1">{delivery.eventType}</h4>
                      <p className="text-[10px] opacity-75">
                        {new Date(delivery.sentAt).toLocaleString()} • Retry {delivery.retryCount}
                      </p>
                    </div>
                    <span className="text-[10px] font-semibold uppercase px-2 py-1 bg-black/20 rounded-none">
                      {delivery.status} {delivery.statusCode && `(${delivery.statusCode})`}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Create Endpoint View */}
        {view === 'create' && (
          <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-6">
            <h2 className="font-semibold text-titanium-50 mb-4 flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Webhook Endpoint
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-titanium-300 mb-2">Endpoint Name</label>
                <input
                  type="text"
                  value={newEndpoint.name || ''}
                  onChange={(e) => setNewEndpoint((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-sm rounded-none focus:outline-none focus:border-cyan-600"
                  placeholder="e.g., SIEM Integration"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-titanium-300 mb-2">Webhook URL</label>
                <input
                  type="url"
                  value={newEndpoint.url || ''}
                  onChange={(e) => setNewEndpoint((prev) => ({ ...prev, url: e.target.value }))}
                  className="w-full px-3 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-sm rounded-none focus:outline-none focus:border-cyan-600"
                  placeholder="https://your-endpoint.com/webhook"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-titanium-300 mb-2">Subscribe to Events</label>
                <div className="grid grid-cols-2 gap-3">
                  {eventOptions.map((event) => (
                    <label key={event.id} className="flex items-center gap-2 p-2 bg-obsidian-800 border border-titanium-800 rounded-none cursor-pointer hover:border-titanium-700">
                      <input
                        type="checkbox"
                        checked={(newEndpoint.events || []).includes(event.id)}
                        onChange={(e) => {
                          setNewEndpoint((prev) => ({
                            ...prev,
                            events: e.target.checked
                              ? [...(prev.events || []), event.id]
                              : (prev.events || []).filter((e) => e !== event.id),
                          }));
                        }}
                        className="w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs text-titanium-300">{event.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-titanium-300 mb-2">Retry Policy</label>
                <select
                  value={newEndpoint.retryPolicy || 'exponential'}
                  onChange={(e) => setNewEndpoint((prev) => ({ ...prev, retryPolicy: e.target.value as any }))}
                  className="w-full px-3 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-sm rounded-none focus:outline-none focus:border-cyan-600"
                >
                  <option value="exponential">Exponential Backoff (Recommended)</option>
                  <option value="linear">Linear Retry</option>
                  <option value="once">Single Attempt</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setView('endpoints')}
                  className="px-4 py-2 border border-titanium-700 hover:border-titanium-600 text-titanium-200 font-semibold rounded-none transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateEndpoint}
                  className="ml-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-none transition-colors flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Create Endpoint
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
