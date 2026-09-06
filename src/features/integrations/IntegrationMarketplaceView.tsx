import { useEffect, useState } from 'react';
import { getSupabase } from '../../lib/supabase';
import { useTenant } from '../../core/access/TenantProvider';

interface Integration {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon_url: string | null;
  auth_type: 'api_key' | 'oauth2' | 'webhook';
  enabled: boolean;
}

// Bewusst OHNE credentials-Feld: Zugangsdaten erreichen den Browser nie —
// die Spaltenrechte aus Migration 20260824110000 geben Clients nur noch
// Metadaten frei (Plan P0-1, Freigabe E8).
interface IntegrationConfig {
  id: string;
  integration_id: string;
  name: string;
  enabled: boolean;
}

export function IntegrationMarketplaceView() {
  const supabase = getSupabase();
  const { activeTenantId } = useTenant();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [configs, setConfigs] = useState<IntegrationConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [configForm, setConfigForm] = useState({
    name: '',
    credentials: {} as Record<string, string>,
  });

  useEffect(() => {
    fetchIntegrations();
    fetchConfigs();
  }, []);

  async function fetchIntegrations() {
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('enabled', true)
      .order('name');

    if (!error) {
      setIntegrations(data || []);
    }
  }

  async function fetchConfigs() {
    setLoading(true);
    // Explizite Spaltenliste statt '*': Die credentials-Spalten sind fuer
    // Clients gesperrt (Migration 20260824110000) — ein '*' wuerde am
    // Spaltenrecht scheitern. Sichtbar sind nur Metadaten.
    const { data, error } = await supabase
      .from('integration_configs')
      .select('id, integration_id, name, enabled, created_at')
      .eq('enabled', true)
      .order('created_at', { ascending: false });

    if (!error) {
      setConfigs(data || []);
    }
    setLoading(false);
  }

  async function saveConfig() {
    if (!selectedIntegration || !configForm.name.trim()) {
      alert('Bitte füllen Sie alle erforderlichen Felder aus');
      return;
    }
    if (!activeTenantId) {
      alert('Kein aktiver Workspace — bitte neu anmelden');
      return;
    }

    // Zugangsdaten gehen ausschliesslich an die Edge Function, die sie
    // AES-256-GCM-versiegelt ablegt — nie direkt in die Tabelle (Plan P0-1).
    const { data, error } = await supabase.functions.invoke('integration-credentials', {
      body: {
        op: 'configure',
        tenant_id: activeTenantId,
        integration_id: selectedIntegration.id,
        name: configForm.name,
        credentials: configForm.credentials,
      },
    });

    if (!error && data?.ok) {
      setConfigForm({ name: '', credentials: {} });
      setShowConfigForm(false);
      setSelectedIntegration(null);
      fetchConfigs();
    } else {
      alert('Fehler beim Speichern der Konfiguration — Zugangsdaten wurden nicht gespeichert');
    }
  }

  async function deleteConfig(configId: string) {
    if (!confirm('Wirklich löschen?')) return;
    if (!activeTenantId) return;

    // Ueber die Edge Function, damit neben enabled=false auch das
    // Credential-Siegel entfernt wird — keine schlummernden Zugangsdaten.
    const { data, error } = await supabase.functions.invoke('integration-credentials', {
      body: { op: 'remove', tenant_id: activeTenantId, config_id: configId },
    });

    if (!error && data?.ok) {
      fetchConfigs();
    }
  }

  function getCredentialFields(authType: string): string[] {
    const fields: Record<string, string[]> = {
      'api_key': ['Api Key', 'Workspace ID'],
      'oauth2': ['Access Token', 'Refresh Token'],
      'webhook': ['Webhook URL', 'Secret'],
    };
    return fields[authType] || [];
  }

  if (loading) return <div className="p-4">Lädt...</div>;

  return (
    <div className="min-h-screen bg-obsidian-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-titanium-950 mb-2">Integrationsmarktplatz</h1>
          <p className="text-obsidian-600">Verbinden Sie RealSync mit Ihren Lieblingstools und Diensten</p>
        </div>

        {/* Active Configurations */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-obsidian-900 mb-4">Aktive Integrationen ({configs.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {configs.map((config) => {
              const integration = integrations.find((i) => i.id === config.integration_id);
              return (
                <div key={config.id} className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-obsidian-900">{config.name}</h3>
                      <p className="text-xs text-obsidian-600 mt-1">{integration?.name}</p>
                    </div>
                    <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                  </div>
                  <button
                    onClick={() => deleteConfig(config.id)}
                    className="text-xs text-red-600 hover:text-red-800 font-medium"
                  >
                    Entfernen
                  </button>
                </div>
              );
            })}
            {configs.length === 0 && (
              <div className="col-span-full bg-obsidian-50 rounded-lg p-8 text-center">
                <p className="text-obsidian-600">Noch keine Integrationen konfiguriert</p>
              </div>
            )}
          </div>
        </div>

        {/* Available Integrations */}
        <div>
          <h2 className="text-xl font-bold text-obsidian-900 mb-4">Verfügbare Integrationen</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations.map((integration) => (
              <div key={integration.id} className="bg-white rounded-lg shadow overflow-hidden hover:shadow-md transition">
                <div className="p-6">
                  {integration.icon_url && (
                    <img
                      src={integration.icon_url}
                      alt={integration.name}
                      className="w-12 h-12 rounded mb-4"
                    />
                  )}
                  <h3 className="font-bold text-obsidian-900 mb-1">{integration.name}</h3>
                  <p className="text-sm text-obsidian-600 mb-4">{integration.description}</p>

                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono bg-obsidian-100 text-obsidian-700 px-2 py-1 rounded">
                      {integration.auth_type}
                    </span>
                    <span className="text-xs text-obsidian-600">
                      {configs.filter((c) => c.integration_id === integration.id).length} konfiguriert
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedIntegration(integration);
                      setShowConfigForm(true);
                      setConfigForm({
                        name: `${integration.name} Integration`,
                        credentials: {},
                      });
                    }}
                    className="w-full px-3 py-2 bg-cyan-600 text-white rounded text-sm font-medium hover:bg-cyan-700 transition"
                  >
                    Konfigurieren
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Configuration Modal */}
        {showConfigForm && selectedIntegration && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
              <h2 className="text-xl font-bold text-obsidian-900 mb-4">
                {selectedIntegration.name} konfigurieren
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-obsidian-700 mb-1">
                    Konfigurationsname
                  </label>
                  <input
                    type="text"
                    value={configForm.name}
                    onChange={(e) => setConfigForm({ ...configForm, name: e.target.value })}
                    placeholder="z.B. Produktion Slack"
                    className="w-full px-3 py-2 border border-obsidian-300 rounded font-medium text-obsidian-900"
                  />
                </div>

                {getCredentialFields(selectedIntegration.auth_type).map((field) => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-obsidian-700 mb-1">
                      {field}
                    </label>
                    <input
                      type={field.toLowerCase().includes('secret') || field.toLowerCase().includes('token') ? 'password' : 'text'}
                      value={configForm.credentials[field] || ''}
                      onChange={(e) => {
                        setConfigForm({
                          ...configForm,
                          credentials: {
                            ...configForm.credentials,
                            [field]: e.target.value,
                          },
                        });
                      }}
                      placeholder={field}
                      className="w-full px-3 py-2 border border-obsidian-300 rounded font-medium text-obsidian-900"
                    />
                  </div>
                ))}

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      setShowConfigForm(false);
                      setSelectedIntegration(null);
                    }}
                    className="flex-1 px-4 py-2 border border-obsidian-300 rounded font-medium text-obsidian-700 hover:bg-obsidian-50 transition"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={saveConfig}
                    className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded font-medium hover:bg-cyan-700 transition"
                  >
                    Speichern
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
