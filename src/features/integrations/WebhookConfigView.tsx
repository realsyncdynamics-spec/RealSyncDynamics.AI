import { useEffect, useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';

interface WebhookSubscription {
  id: string;
  name: string;
  endpoint_url: string;
  events: string[];
  active: boolean;
  max_retries: number;
  retry_delay_seconds: number;
  filter_criteria: Record<string, unknown>;
  created_at: string;
}

interface WebhookDelivery {
  id: string;
  event_type: string;
  status: 'pending' | 'sent' | 'failed' | 'exhausted';
  http_status_code: number | null;
  attempt: number;
  sent_at: string | null;
}

export function WebhookConfigView() {
  const supabase = useSupabaseClient();
  const [subscriptions, setSubscriptions] = useState<WebhookSubscription[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newForm, setNewForm] = useState({
    name: '',
    endpoint_url: '',
    events: [] as string[],
    max_retries: 3,
  });

  const availableEvents = [
    'gap.created',
    'gap.updated',
    'gap.resolved',
    'report.generated',
    'task.created',
    'task.completed',
    'agent.executed',
  ];

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  useEffect(() => {
    if (selectedId) {
      fetchDeliveries(selectedId);
    }
  }, [selectedId]);

  async function fetchSubscriptions() {
    setLoading(true);
    const { data, error } = await supabase
      .from('webhook_subscriptions')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) {
      setSubscriptions(data || []);
      if ((data || []).length > 0 && !selectedId) {
        setSelectedId(data![0].id);
      }
    }
    setLoading(false);
  }

  async function fetchDeliveries(subscriptionId: string) {
    const { data, error } = await supabase
      .from('webhook_deliveries')
      .select('*')
      .eq('subscription_id', subscriptionId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error) {
      setDeliveries(data || []);
    }
  }

  async function createSubscription() {
    if (!newForm.name.trim() || !newForm.endpoint_url.trim() || newForm.events.length === 0) {
      alert('Bitte füllen Sie alle erforderlichen Felder aus');
      return;
    }

    const { error } = await supabase.from('webhook_subscriptions').insert({
      name: newForm.name,
      endpoint_url: newForm.endpoint_url,
      events: newForm.events,
      secret: crypto.getRandomValues(new Uint8Array(32)).join(''),
      max_retries: newForm.max_retries,
      active: true,
    });

    if (!error) {
      setNewForm({ name: '', endpoint_url: '', events: [], max_retries: 3 });
      setShowCreateForm(false);
      fetchSubscriptions();
    }
  }

  async function toggleSubscription(sub: WebhookSubscription) {
    const { error } = await supabase
      .from('webhook_subscriptions')
      .update({ active: !sub.active })
      .eq('id', sub.id);

    if (!error) {
      fetchSubscriptions();
    }
  }

  async function deleteSubscription(subId: string) {
    if (!confirm('Wirklich löschen?')) return;

    const { error } = await supabase
      .from('webhook_subscriptions')
      .delete()
      .eq('id', subId);

    if (!error) {
      setSelectedId(null);
      fetchSubscriptions();
    }
  }

  const selected = subscriptions.find((s) => s.id === selectedId);

  if (loading) return <div className="p-4">Lädt...</div>;

  return (
    <div className="min-h-screen bg-obsidian-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-titanium-950">Webhooks</h1>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 bg-cyan-600 text-white rounded font-medium hover:bg-cyan-700 transition"
          >
            {showCreateForm ? 'Abbrechen' : 'Neuer Webhook'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Subscriptions List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b border-obsidian-200">
                <h2 className="font-semibold text-obsidian-900">Abos ({subscriptions.length})</h2>
              </div>
              <div className="divide-y divide-obsidian-100">
                {subscriptions.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => setSelectedId(sub.id)}
                    className={`w-full p-4 text-left hover:bg-obsidian-50 transition ${
                      selectedId === sub.id ? 'bg-obsidian-100 border-l-4 border-cyan-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-obsidian-900">{sub.name}</h3>
                        <p className="text-xs text-obsidian-600 font-mono mt-1 truncate">{sub.endpoint_url}</p>
                      </div>
                      <div className={`ml-2 w-2 h-2 rounded-full mt-1 flex-shrink-0 ${
                        sub.active ? 'bg-green-500' : 'bg-obsidian-300'
                      }`} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Details & Form */}
          <div className="lg:col-span-2">
            {showCreateForm ? (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-obsidian-900 mb-4">Neuer Webhook</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-obsidian-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={newForm.name}
                      onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                      placeholder="z.B. Slack Notifications"
                      className="w-full px-3 py-2 border border-obsidian-300 rounded font-medium text-obsidian-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-obsidian-700 mb-1">Endpoint URL</label>
                    <input
                      type="url"
                      value={newForm.endpoint_url}
                      onChange={(e) => setNewForm({ ...newForm, endpoint_url: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-3 py-2 border border-obsidian-300 rounded font-medium text-obsidian-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-obsidian-700 mb-2">Ereignisse</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {availableEvents.map((event) => (
                        <label key={event} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={newForm.events.includes(event)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewForm({
                                  ...newForm,
                                  events: [...newForm.events, event],
                                });
                              } else {
                                setNewForm({
                                  ...newForm,
                                  events: newForm.events.filter((e) => e !== event),
                                });
                              }
                            }}
                            className="mr-2"
                          />
                          <span className="text-sm text-obsidian-700 font-mono">{event}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-obsidian-700 mb-1">Max. Wiederholungen</label>
                    <input
                      type="number"
                      value={newForm.max_retries}
                      onChange={(e) => setNewForm({ ...newForm, max_retries: parseInt(e.target.value) })}
                      min="1"
                      max="10"
                      className="w-full px-3 py-2 border border-obsidian-300 rounded font-medium text-obsidian-900"
                    />
                  </div>

                  <button
                    onClick={createSubscription}
                    className="w-full px-4 py-2 bg-cyan-600 text-white rounded font-medium hover:bg-cyan-700 transition"
                  >
                    Erstellen
                  </button>
                </div>
              </div>
            ) : selected ? (
              <>
                {/* Details Card */}
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-obsidian-900">{selected.name}</h2>
                      <p className="text-obsidian-600 mt-1 font-mono">{selected.endpoint_url}</p>
                    </div>
                    <button
                      onClick={() => toggleSubscription(selected)}
                      className={`px-4 py-2 rounded font-medium transition ${
                        selected.active
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {selected.active ? 'Deaktivieren' : 'Aktivieren'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <div>
                      <p className="text-sm text-obsidian-600">Ereignisse</p>
                      <p className="font-mono text-xs text-obsidian-900 mt-1">{selected.events.join(', ')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-obsidian-600">Max. Wiederholungen</p>
                      <p className="font-medium text-obsidian-900 mt-1">{selected.max_retries}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => deleteSubscription(selected.id)}
                    className="mt-4 text-sm text-red-600 hover:text-red-800 font-medium"
                  >
                    Löschen
                  </button>
                </div>

                {/* Deliveries */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="p-4 border-b border-obsidian-200">
                    <h3 className="font-semibold text-obsidian-900">Letzte Zustellungen</h3>
                  </div>
                  <div className="divide-y divide-obsidian-100">
                    {deliveries.length === 0 ? (
                      <div className="p-4 text-obsidian-600 text-sm">Keine Zustellungen</div>
                    ) : (
                      deliveries.map((delivery) => (
                        <div key={delivery.id} className="p-4 hover:bg-obsidian-50 transition">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${
                                delivery.status === 'sent' ? 'bg-green-500'
                                  : delivery.status === 'failed' ? 'bg-red-500'
                                  : 'bg-yellow-500'
                              }`} />
                              <span className="font-medium text-obsidian-900">{delivery.event_type}</span>
                            </div>
                            <span className="text-xs font-mono text-obsidian-600">
                              {delivery.status} (Attempt {delivery.attempt})
                            </span>
                          </div>
                          {delivery.http_status_code && (
                            <p className="text-xs text-obsidian-600">HTTP {delivery.http_status_code}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <p className="text-obsidian-600">Wählen Sie ein Webhook-Abonnement</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
