import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Loader2, AlertTriangle, Copy, Trash2, Eye, EyeOff,
  Key, CheckCircle2, Clock, Shield,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from './withPerformanceMonitoring';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string; // First 8 chars visible
  key_hash: string;
  permissions: string[];
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
}

function _GovernanceApiKeysView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const GovernanceApiKeysView = withPerformanceMonitoring(
  _GovernanceApiKeysView,
  'GovernanceApiKeysView',
  { threshold: 500, maxRenders: 10 }
);

function Inner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showFullKey, setShowFullKey] = useState<string | null>(null);

  const reload = async () => {
    if (!activeTenantId) return;
    setError(null);
    setKeys(null);

    try {
      const response = await fetch(
        `/functions/v1/governance-resources?tenant_id=${activeTenantId}&resource_type=api_keys`,
        { headers: { Authorization: `Bearer ${(await import('../../lib/auth')).getAuthToken()}` } }
      );
      if (!response.ok) throw new Error('Failed to load');
      const data = await response.json();
      setKeys(data.keys || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    }
  };

  useEffect(() => { void reload(); }, [activeTenantId]);

  const activeKeys = keys?.filter(k => k.is_active).length || 0;
  const expiredKeys = keys?.filter(k => k.expires_at && new Date(k.expires_at) < new Date()).length || 0;

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/governance" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-sm">
              <Key className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">API-Keys</div>
              <div className="text-[11px] text-titanium-400 font-medium">Governance API Zugriff & Authentifizierung</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tenants.length > 1 && (
            <select
              value={activeTenantId ?? ''}
              onChange={(e) => setActiveTenant(e.target.value)}
              className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer font-medium hover:bg-obsidian-800 max-w-[200px]"
            >
              {tenants.map((t) => (
                <option key={t.tenantId} value={t.tenantId}>{t.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => setCreating(true)}
            disabled={!activeTenantId}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-blue-400 disabled:opacity-50 transition-colors"
          >
            <Plus className="h-4 w-4" /> Neuer Key
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-4 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {expiredKeys > 0 && (
          <div className="mb-4 flex items-start gap-3 text-sm bg-amber-950/50 border border-amber-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-400" />
            <div>
              <div className="font-semibold text-amber-300">{expiredKeys} API-Key(s) abgelaufen!</div>
              <div className="text-amber-200 text-xs mt-1">Bitte regenerieren Sie diese Keys oder aktivieren Sie neue.</div>
            </div>
          </div>
        )}

        {!activeTenantId ? (
          <div className="text-titanium-500 text-sm">Tenant wählen.</div>
        ) : keys === null ? (
          <div className="flex items-center gap-2 text-titanium-500 text-sm py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Laden…
          </div>
        ) : (
          <div className="space-y-6">
            {/* Info Section */}
            <div className="bg-obsidian-900 border border-blue-900/30 rounded-none p-4">
              <h3 className="font-semibold text-titanium-50 mb-2 flex items-center gap-2">
                <Shield className="h-4 w-4" /> Governance API Keys
              </h3>
              <p className="text-[12px] text-titanium-300 mb-3">
                API Keys ermöglichen programmatischen Zugriff auf die Governance OS APIs (Workflows, Gaps, Evidence, Reports).
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[12px]">
                <div className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-green-300">Sichere Authentifizierung</div>
                    <div className="text-titanium-400">Bearer Token via HTTPS</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Clock className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-blue-300">Ablauf-Management</div>
                    <div className="text-titanium-400">Optional expirating keys</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Shield className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-purple-300">Granulare Permissions</div>
                    <div className="text-titanium-400">Scoped to specific frameworks</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-obsidian-900 border border-green-900 rounded-none p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <span className="text-[12px] text-green-300 font-semibold">AKTIV</span>
                </div>
                <div className="text-3xl font-bold text-green-400">{activeKeys}</div>
                <p className="text-[11px] text-titanium-400 mt-1">Gültige Keys</p>
              </div>

              <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Key className="h-4 w-4 text-titanium-400" />
                  <span className="text-[12px] text-titanium-300 font-semibold">GESAMT</span>
                </div>
                <div className="text-3xl font-bold text-titanium-300">{keys?.length || 0}</div>
                <p className="text-[11px] text-titanium-400 mt-1">API-Keys vorhanden</p>
              </div>

              <div className="bg-obsidian-900 border border-blue-900 rounded-none p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-blue-400" />
                  <span className="text-[12px] text-blue-300 font-semibold">QUOTA</span>
                </div>
                <div className="text-3xl font-bold text-blue-400">Unbegrenzt</div>
                <p className="text-[11px] text-titanium-400 mt-1">Je nach Tier</p>
              </div>
            </div>

            {/* API Keys List */}
            {keys.length === 0 ? (
              <div className="text-center py-20 bg-obsidian-900 border border-titanium-900 rounded-none">
                <Key className="h-12 w-12 text-titanium-600 mx-auto mb-3" />
                <h3 className="font-semibold text-titanium-50 mb-1">Keine API-Keys</h3>
                <p className="text-titanium-400 text-sm mb-4">Erstellen Sie einen API-Key, um programmatisch auf die Governance APIs zuzugreifen.</p>
                <button
                  onClick={() => setCreating(true)}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-500 hover:bg-blue-400 text-obsidian-950 text-sm font-semibold rounded-none transition-colors"
                >
                  <Plus className="h-4 w-4" /> Ersten Key erstellen
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {keys.map((key) => (
                  <ApiKeyCard
                    key={key.id}
                    apiKey={key}
                    isRevealed={showFullKey === key.id}
                    onToggleReveal={() => setShowFullKey(showFullKey === key.id ? null : key.id)}
                    onReload={reload}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {creating && activeTenantId && (
          <CreateApiKeyModal
            tenantId={activeTenantId}
            onClose={() => setCreating(false)}
            onCreated={() => { setCreating(false); void reload(); }}
          />
        )}
      </main>
    </div>
  );
}

function ApiKeyCard({
  apiKey,
  isRevealed,
  onToggleReveal,
  onReload,
}: {
  apiKey: ApiKey;
  isRevealed: boolean;
  onToggleReveal: () => void;
  onReload: () => void;
}) {
  const isExpired = apiKey.expires_at && new Date(apiKey.expires_at) < new Date();
  const daysUntilExpiry = apiKey.expires_at
    ? Math.ceil((new Date(apiKey.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const displayKey = isRevealed ? `${apiKey.key_prefix}••••••••` : `${apiKey.key_prefix}••••••••`;

  return (
    <div className={`${apiKey.is_active ? 'bg-obsidian-900' : 'bg-slate-950'} border ${apiKey.is_active ? 'border-titanium-900' : 'border-slate-800'} rounded-none p-4`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-titanium-50">{apiKey.name}</h4>
          <p className="text-[11px] text-titanium-400 mt-1 font-mono">{displayKey}</p>
        </div>
        <div className="flex items-center gap-2">
          {!apiKey.is_active && (
            <span className="text-[11px] font-semibold px-2 py-1 rounded-none bg-slate-600 text-white">
              Deaktiviert
            </span>
          )}
          {isExpired && (
            <span className="text-[11px] font-semibold px-2 py-1 rounded-none bg-red-600 text-white">
              Abgelaufen
            </span>
          )}
          {apiKey.is_active && !isExpired && daysUntilExpiry !== null && daysUntilExpiry <= 7 && (
            <span className="text-[11px] font-semibold px-2 py-1 rounded-none bg-amber-600 text-white">
              Läuft bald ab
            </span>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-[11px]">
        <div className="bg-obsidian-950 border border-titanium-900 rounded-none p-2">
          <div className="text-titanium-400 mb-1">Erstellt</div>
          <div className="text-titanium-200 font-mono text-[10px]">
            {new Date(apiKey.created_at).toLocaleDateString('de-DE')}
          </div>
        </div>
        <div className="bg-obsidian-950 border border-titanium-900 rounded-none p-2">
          <div className="text-titanium-400 mb-1">Zuletzt benutzt</div>
          <div className="text-titanium-200 font-mono text-[10px]">
            {apiKey.last_used_at ? new Date(apiKey.last_used_at).toLocaleDateString('de-DE') : '—'}
          </div>
        </div>
        <div className="bg-obsidian-950 border border-titanium-900 rounded-none p-2">
          <div className="text-titanium-400 mb-1">Ablauf</div>
          <div className={`font-mono text-[10px] ${isExpired || (daysUntilExpiry !== null && daysUntilExpiry <= 7) ? 'text-red-300' : 'text-titanium-200'}`}>
            {apiKey.expires_at ? new Date(apiKey.expires_at).toLocaleDateString('de-DE') : 'Unbegrenzt'}
          </div>
        </div>
        <div className="bg-obsidian-950 border border-titanium-900 rounded-none p-2">
          <div className="text-titanium-400 mb-1">Permissions</div>
          <div className="text-titanium-200 font-mono text-[10px]">{apiKey.permissions.length} Scope(s)</div>
        </div>
      </div>

      {/* Permissions */}
      {apiKey.permissions.length > 0 && (
        <div className="mb-3">
          <div className="text-[11px] text-titanium-400 mb-1 font-semibold">Permissions:</div>
          <div className="flex flex-wrap gap-1">
            {apiKey.permissions.map((perm) => (
              <span key={perm} className="bg-obsidian-950 border border-blue-800 text-blue-300 text-[10px] px-2 py-0.5 rounded-none">
                {perm}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleReveal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 border border-titanium-700 hover:border-titanium-500 text-titanium-200 hover:text-titanium-100 text-[12px] font-medium rounded-none transition-colors"
        >
          {isRevealed ? (
            <>
              <EyeOff className="h-3 w-3" /> Verbergen
            </>
          ) : (
            <>
              <Eye className="h-3 w-3" /> Anzeigen
            </>
          )}
        </button>

        <button
          className="flex items-center gap-1.5 px-2.5 py-1.5 border border-titanium-700 hover:border-blue-500 text-titanium-200 hover:text-blue-300 text-[12px] font-medium rounded-none transition-colors"
          title="Key kopieren"
        >
          <Copy className="h-3 w-3" />
        </button>

        <button
          className="flex items-center gap-1.5 px-2.5 py-1.5 border border-titanium-700 hover:border-red-500 text-titanium-200 hover:text-red-300 text-[12px] font-medium rounded-none transition-colors ml-auto"
          onClick={() => {
            if (confirm('Diesen API-Key wirklich löschen?')) void onReload();
          }}
        >
          <Trash2 className="h-3 w-3" /> Löschen
        </button>
      </div>
    </div>
  );
}

function CreateApiKeyModal({
  tenantId,
  onClose,
  onCreated,
}: {
  tenantId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState<string[]>(['governance:read']);
  const [expiresIn, setExpiresIn] = useState<string>('90days');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/functions/v1/governance-resources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await import('../../lib/auth')).getAuthToken()}`,
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          action: 'create_api_key',
          data: { name, permissions, expiresIn },
        }),
      });

      if (!response.ok) throw new Error('Creation failed');
      onCreated();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  };

  const permissionOptions = [
    { value: 'governance:read', label: 'Governance Lesezugriff' },
    { value: 'governance:write', label: 'Governance Schreibzugriff' },
    { value: 'evidence:read', label: 'Evidence Vault Lesezugriff' },
    { value: 'gaps:read', label: 'Gap Analysis Lesezugriff' },
    { value: 'reports:read', label: 'Reports Lesezugriff' },
    { value: 'reports:write', label: 'Reports Schreibzugriff' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-6 max-w-md w-full mx-4 space-y-4">
        <h2 className="font-display font-bold text-titanium-50">Neuer API-Key</h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Key Name (z.B. CI/CD Integration)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full bg-obsidian-950 border border-titanium-900 text-titanium-200 text-sm rounded-none px-3 py-2 outline-none placeholder:text-titanium-600"
          />

          <div>
            <label className="text-[12px] text-titanium-300 font-semibold block mb-2">Permissions</label>
            <div className="space-y-2">
              {permissionOptions.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    value={opt.value}
                    checked={permissions.includes(opt.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setPermissions([...permissions, opt.value]);
                      } else {
                        setPermissions(permissions.filter(p => p !== opt.value));
                      }
                    }}
                    className="w-4 h-4 rounded-none"
                  />
                  <span className="text-[12px] text-titanium-300">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] text-titanium-300 font-semibold block mb-2">Ablauf</label>
            <select
              value={expiresIn}
              onChange={(e) => setExpiresIn(e.target.value)}
              className="w-full bg-obsidian-950 border border-titanium-900 text-titanium-200 text-sm rounded-none px-3 py-2 outline-none"
            >
              <option value="never">Nie (unbegrenzt)</option>
              <option value="30days">30 Tage</option>
              <option value="90days">90 Tage</option>
              <option value="1year">1 Jahr</option>
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading || !name}
              className="flex-1 px-4 py-2 bg-blue-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-blue-400 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Erstellen
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-titanium-700 text-titanium-200 text-sm font-semibold rounded-none hover:border-titanium-500 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
