import React, { useState } from 'react';
import { Send, Check, AlertCircle, Copy, Eye } from 'lucide-react';
import { getSupabase } from '../../lib/supabase';
import { useTenant } from '../../core/access/TenantProvider';

interface WebhookEndpoint {
  id: string;
  url: string;
  description: string;
  events: string[];
  secret_key: string;
}

interface TestResult {
  status: 'idle' | 'loading' | 'success' | 'error';
  statusCode?: number;
  responseTime?: number;
  responseBody?: string;
  error?: string;
}

const EXAMPLE_PAYLOADS: Record<string, Record<string, any>> = {
  quota_warning: {
    event: 'quota_warning',
    tenant_id: 'tenant-example-123',
    timestamp: new Date().toISOString(),
    data: {
      api_calls: 8000,
      quota_limit: 10000,
      percentage: 80,
      alert_type: 'quota_warning',
      message: 'API quota usage has reached 80%'
    }
  },
  quota_exceeded: {
    event: 'quota_exceeded',
    tenant_id: 'tenant-example-123',
    timestamp: new Date().toISOString(),
    data: {
      api_calls: 10500,
      quota_limit: 10000,
      percentage: 105,
      alert_type: 'quota_exceeded',
      message: 'API quota limit has been exceeded'
    }
  },
  suspicious_activity: {
    event: 'suspicious_activity',
    tenant_id: 'tenant-example-123',
    timestamp: new Date().toISOString(),
    data: {
      alert_type: 'suspicious_activity',
      message: 'Unusual API activity detected',
      anomaly: 'High request rate from multiple IPs',
      request_count: 5000,
      time_window: '5 minutes'
    }
  }
};

export function WebhookTester() {
  const { activeTenantId } = useTenant();
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [selectedWebhook, setSelectedWebhook] = useState<string | null>(null);
  const [eventType, setEventType] = useState<string>('quota_warning');
  const [testResult, setTestResult] = useState<TestResult>({ status: 'idle' });
  const [showPayload, setShowPayload] = useState(false);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    if (!activeTenantId) return;
    fetchWebhooks();
  }, [activeTenantId]);

  const fetchWebhooks = async () => {
    try {
      const sb = getSupabase();
      const { data } = await sb
        .from('webhook_endpoints')
        .select('*')
        .eq('tenant_id', activeTenantId);

      setWebhooks((data || []) as WebhookEndpoint[]);
      if (data && data.length > 0) {
        setSelectedWebhook(data[0].id);
      }
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  const generateSignature = async (payload: string, secret: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, data);
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  const handleTest = async () => {
    if (!selectedWebhook) return;

    const webhook = webhooks.find(w => w.id === selectedWebhook);
    if (!webhook) return;

    setTestResult({ status: 'loading' });

    try {
      const payload = EXAMPLE_PAYLOADS[eventType];
      const payloadString = JSON.stringify(payload);
      const signature = await generateSignature(payloadString, webhook.secret_key);

      const startTime = Date.now();
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `sha256=${signature}`,
          'X-Webhook-ID': webhook.id,
          'X-Event-Type': eventType,
          'X-Delivery-ID': crypto.getRandomValues(new Uint8Array(16)).join('')
        },
        body: payloadString
      });

      const responseTime = Date.now() - startTime;
      const responseBody = await response.text();

      setTestResult({
        status: response.ok ? 'success' : 'error',
        statusCode: response.status,
        responseTime,
        responseBody
      });
    } catch (err) {
      setTestResult({
        status: 'error',
        error: err instanceof Error ? err.message : 'Test failed'
      });
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-titanium-400">Lade Webhooks...</div>;
  }

  const currentPayload = EXAMPLE_PAYLOADS[eventType];
  const selectedWebhookData = webhooks.find(w => w.id === selectedWebhook);

  return (
    <div className="space-y-6">
      <div className="bg-obsidian-800 border border-titanium-700 rounded p-6">
        <h3 className="text-lg font-bold text-titanium-50 mb-4">Webhook-Tester</h3>

        <div className="space-y-4">
          {/* Webhook Selection */}
          <div>
            <label className="block text-sm text-titanium-300 mb-2">Webhook-Endpoint</label>
            <select
              value={selectedWebhook || ''}
              onChange={e => setSelectedWebhook(e.target.value)}
              className="w-full px-3 py-2 bg-obsidian-900 border border-titanium-600 rounded text-titanium-50 text-sm"
            >
              <option value="">-- Webhook auswählen --</option>
              {webhooks.map(w => (
                <option key={w.id} value={w.id}>
                  {w.description || w.url}
                </option>
              ))}
            </select>
          </div>

          {/* Event Type Selection */}
          <div>
            <label className="block text-sm text-titanium-300 mb-2">Ereignistyp</label>
            <select
              value={eventType}
              onChange={e => setEventType(e.target.value)}
              className="w-full px-3 py-2 bg-obsidian-900 border border-titanium-600 rounded text-titanium-50 text-sm"
            >
              <option value="quota_warning">Quota-Warnung (80%)</option>
              <option value="quota_exceeded">Kontingent überschritten</option>
              <option value="suspicious_activity">Verdächtige Aktivität</option>
            </select>
          </div>

          {/* Payload Preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-titanium-300">Anfrage-Payload</label>
              <button
                onClick={() => setShowPayload(!showPayload)}
                className="flex items-center gap-1 text-xs text-security-400 hover:text-security-300"
              >
                <Eye className="h-3 w-3" />
                {showPayload ? 'Verbergen' : 'Anzeigen'}
              </button>
            </div>
            {showPayload && (
              <pre className="bg-obsidian-900 p-3 rounded text-xs text-titanium-300 overflow-x-auto max-h-48 overflow-y-auto">
                {JSON.stringify(currentPayload, null, 2)}
              </pre>
            )}
          </div>

          {/* Test Button */}
          <button
            onClick={handleTest}
            disabled={!selectedWebhook || testResult.status === 'loading'}
            className="w-full px-4 py-2 bg-security-500 text-white font-bold hover:bg-security-600 disabled:opacity-50 rounded flex items-center justify-center gap-2"
          >
            <Send className="h-4 w-4" />
            {testResult.status === 'loading' ? 'Teste...' : 'Webhook testen'}
          </button>

          {/* Test Results */}
          {testResult.status !== 'idle' && (
            <div className={`p-4 rounded border ${
              testResult.status === 'success'
                ? 'bg-security-900 border-security-700'
                : testResult.status === 'error'
                ? 'bg-red-900 border-red-700'
                : 'bg-yellow-900 border-yellow-700'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {testResult.status === 'success' ? (
                  <>
                    <Check className="h-4 w-4 text-security-400" />
                    <span className="font-bold text-security-300">Test erfolgreich</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 text-red-400" />
                    <span className="font-bold text-red-300">Test fehlgeschlagen</span>
                  </>
                )}
              </div>

              {testResult.statusCode && (
                <p className="text-sm mb-2">
                  <span className="text-titanium-400">Status:</span>{' '}
                  <span className={testResult.statusCode >= 200 && testResult.statusCode < 300 ? 'text-security-300' : 'text-red-300'}>
                    HTTP {testResult.statusCode}
                  </span>
                </p>
              )}

              {testResult.responseTime && (
                <p className="text-sm mb-2">
                  <span className="text-titanium-400">Antwortzeit:</span>{' '}
                  <span className="text-titanium-50">{testResult.responseTime}ms</span>
                </p>
              )}

              {testResult.responseBody && (
                <div className="mt-2">
                  <p className="text-xs text-titanium-400 mb-1">Antwortkörper:</p>
                  <pre className="bg-obsidian-900 p-2 rounded text-xs text-titanium-300 overflow-x-auto max-h-32 overflow-y-auto">
                    {testResult.responseBody}
                  </pre>
                </div>
              )}

              {testResult.error && (
                <p className="text-sm text-red-300">{testResult.error}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Webhook Details */}
      {selectedWebhookData && (
        <div className="bg-obsidian-800 border border-titanium-700 rounded p-6">
          <h3 className="text-lg font-bold text-titanium-50 mb-4">Webhook-Details</h3>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-titanium-400 mb-1">URL</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-obsidian-900 rounded text-xs text-titanium-300 break-all">
                  {selectedWebhookData.url}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(selectedWebhookData.url)}
                  className="p-2 hover:bg-obsidian-700 rounded"
                  title="Kopieren"
                >
                  <Copy className="h-4 w-4 text-titanium-400" />
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs text-titanium-400 mb-1">Geheimnis (für Signaturverifikation)</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-obsidian-900 rounded text-xs text-titanium-300 font-mono break-all">
                  {selectedWebhookData.secret_key}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(selectedWebhookData.secret_key)}
                  className="p-2 hover:bg-obsidian-700 rounded"
                  title="Kopieren"
                >
                  <Copy className="h-4 w-4 text-titanium-400" />
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs text-titanium-400 mb-2">Abonnierte Ereignisse</p>
              <div className="flex flex-wrap gap-2">
                {selectedWebhookData.events.map(event => (
                  <span key={event} className="px-2 py-1 bg-security-900 text-security-300 rounded text-xs font-mono">
                    {event}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
