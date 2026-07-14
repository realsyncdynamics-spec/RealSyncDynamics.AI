import { useEffect, useState } from 'react';
import { getSupabase } from '../../lib/supabase';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  allowed_ips: string[];
  rate_limit_requests: number;
  rate_limit_period_seconds: number;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

export function ApiKeysView() {
  const supabase = getSupabase();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyForm, setNewKeyForm] = useState({
    name: '',
    scopes: [] as string[],
    expiresInDays: 90,
  });
  const [createdKey, setCreatedKey] = useState<{ prefix: string; fullKey: string } | null>(null);

  const availableScopes = [
    { value: 'gaps:read', label: 'Gaps (Read)' },
    { value: 'gaps:write', label: 'Gaps (Write)' },
    { value: 'reports:read', label: 'Reports (Read)' },
    { value: 'agents:read', label: 'Agents (Read)' },
    { value: 'governance:read', label: 'Governance (Read)' },
    { value: 'governance:write', label: 'Governance (Write)' },
  ];

  useEffect(() => {
    fetchKeys();
  }, []);

  async function fetchKeys() {
    setLoading(true);
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) {
      setKeys(data || []);
    }
    setLoading(false);
  }

  async function createApiKey() {
    if (!newKeyForm.name.trim()) {
      alert('Bitte geben Sie einen Namen ein');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('create_api_key', {
        p_name: newKeyForm.name,
        p_scopes: newKeyForm.scopes,
        p_expires_in_days: newKeyForm.expiresInDays || null,
      });

      if (error) throw error;

      if (data && data[0]) {
        setCreatedKey({
          prefix: data[0].key_prefix,
          fullKey: data[0].full_key,
        });
        setNewKeyForm({ name: '', scopes: [], expiresInDays: 90 });
        fetchKeys();
        setShowCreateForm(false);
      }
    } catch (err) {
      console.error('Error creating API key:', err);
      alert('Fehler beim Erstellen des API-Schlüssels');
    }
  }

  async function revokeKey(keyId: string) {
    if (!confirm('Sind Sie sicher, dass Sie diesen Schlüssel widerrufen möchten?')) {
      return;
    }

    const { error } = await supabase
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', keyId);

    if (!error) {
      fetchKeys();
    }
  }

  if (loading) return <div className="p-4">Lädt...</div>;

  return (
    <div className="min-h-screen bg-obsidian-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-titanium-950">API-Schlüssel</h1>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 bg-cyan-600 text-white rounded font-medium hover:bg-cyan-700 transition"
          >
            {showCreateForm ? 'Abbrechen' : 'Neuer Schlüssel'}
          </button>
        </div>

        {createdKey && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-2">Schlüssel erstellt!</h3>
            <p className="text-sm text-green-800 mb-2">Speichern Sie diesen Schlüssel sicher. Sie können ihn später nicht mehr sehen:</p>
            <code className="bg-obsidian-900 text-cyan-400 p-3 rounded block text-sm font-mono break-all mb-2">
              {createdKey.fullKey}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(createdKey.fullKey);
                alert('Schlüssel kopiert!');
              }}
              className="text-sm text-green-700 hover:text-green-900 font-medium"
            >
              Kopieren
            </button>
          </div>
        )}

        {showCreateForm && !createdKey && (
          <div className="mb-6 bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-obsidian-900 mb-4">Neuen API-Schlüssel erstellen</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-obsidian-700 mb-1">Name</label>
                <input
                  type="text"
                  value={newKeyForm.name}
                  onChange={(e) => setNewKeyForm({ ...newKeyForm, name: e.target.value })}
                  placeholder="z.B. Zapier Integration"
                  className="w-full px-3 py-2 border border-obsidian-300 rounded font-medium text-obsidian-900 placeholder-obsidian-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-obsidian-700 mb-2">Berechtigungen</label>
                <div className="space-y-2">
                  {availableScopes.map((scope) => (
                    <label key={scope.value} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={newKeyForm.scopes.includes(scope.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewKeyForm({
                              ...newKeyForm,
                              scopes: [...newKeyForm.scopes, scope.value],
                            });
                          } else {
                            setNewKeyForm({
                              ...newKeyForm,
                              scopes: newKeyForm.scopes.filter((s) => s !== scope.value),
                            });
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm text-obsidian-700">{scope.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-obsidian-700 mb-1">Verfällt in (Tage)</label>
                <input
                  type="number"
                  value={newKeyForm.expiresInDays}
                  onChange={(e) => setNewKeyForm({ ...newKeyForm, expiresInDays: parseInt(e.target.value) || 90 })}
                  min="1"
                  max="365"
                  className="w-full px-3 py-2 border border-obsidian-300 rounded font-medium text-obsidian-900"
                />
              </div>

              <button
                onClick={createApiKey}
                className="w-full px-4 py-2 bg-cyan-600 text-white rounded font-medium hover:bg-cyan-700 transition"
              >
                Schlüssel erstellen
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-4">
          {keys.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-obsidian-600">Keine API-Schlüssel vorhanden</p>
            </div>
          ) : (
            keys.map((key) => (
              <div key={key.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-obsidian-900">{key.name}</h3>
                    <p className="text-sm text-obsidian-600 font-mono mt-1">{key.key_prefix}...</p>
                  </div>
                  <div className="flex gap-2">
                    {key.revoked_at ? (
                      <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                        Widerrufen
                      </span>
                    ) : key.expires_at && new Date(key.expires_at) < new Date() ? (
                      <span className="px-3 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded">
                        Abgelaufen
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                        Aktiv
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <div>
                    <p className="text-obsidian-600">Berechtigungen</p>
                    <p className="text-obsidian-900 font-mono text-xs mt-1">
                      {key.scopes.join(', ') || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-obsidian-600">Rate Limit</p>
                    <p className="text-obsidian-900 font-mono text-xs mt-1">
                      {key.rate_limit_requests}/h
                    </p>
                  </div>
                  <div>
                    <p className="text-obsidian-600">Erstellt</p>
                    <p className="text-obsidian-900 font-mono text-xs mt-1">
                      {new Date(key.created_at).toLocaleDateString('de-DE')}
                    </p>
                  </div>
                  <div>
                    <p className="text-obsidian-600">Zuletzt verwendet</p>
                    <p className="text-obsidian-900 font-mono text-xs mt-1">
                      {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString('de-DE') : '-'}
                    </p>
                  </div>
                </div>

                {!key.revoked_at && (
                  <button
                    onClick={() => revokeKey(key.id)}
                    className="text-sm text-red-600 hover:text-red-800 font-medium"
                  >
                    Widerrufen
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
