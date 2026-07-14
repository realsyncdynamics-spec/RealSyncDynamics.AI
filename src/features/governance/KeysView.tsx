import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, KeyRound, Plus, Loader2, AlertTriangle, X,
  Copy, Check, ShieldAlert,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import {
  createIngestKey, listIngestKeys, revokeIngestKey,
  type IngestKey, type IngestKeySource,
} from './keysApi';
import { withPerformanceMonitoring } from './withPerformanceMonitoring';

/**
 * Authenticated key-management for the Governance Telemetry
 * Ingestion API (PR #135). Owner / admin only. Raw `rsd_gov_…`
 * tokens are shown EXACTLY ONCE at creation — server stores only
 * the sha256 hash + display prefix.
 */
function _KeysView() {
  return <AuthGate>{() => <KeysInner />}</AuthGate>;
}

export const KeysView = withPerformanceMonitoring(
  _KeysView,
  'KeysView',
  { threshold: 500, maxRenders: 10 }
);

const ALL_SOURCES: IngestKeySource[] = [
  'website_scanner', 'browser_extension', 'sdk', 'api',
  'github', 'ci_cd', 'manual', 'agent_runtime',
];

function KeysInner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [keys, setKeys] = useState<IngestKey[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = async () => {
    if (!activeTenantId) { setKeys([]); return; }
    setError(null);
    setKeys(null);
    const r = await listIngestKeys(activeTenantId);
    if (!r.ok) setError(r.error?.message ?? 'Laden fehlgeschlagen');
    else       setKeys(r.keys ?? []);
  };

  useEffect(() => { void reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeTenantId]);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-sm">
              <KeyRound className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Governance Ingest Keys</div>
              <div className="text-[11px] text-titanium-400 font-medium">API-Keys für /functions/v1/governance-ingest</div>
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-amber-400 disabled:opacity-50 transition-colors"
          >
            <Plus className="h-4 w-4" /> Neuer Key
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-4 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!activeTenantId ? (
          <div className="text-titanium-500 text-sm">Wähle einen Tenant aus, um Keys zu verwalten.</div>
        ) : keys === null ? (
          <div className="flex items-center gap-2 text-titanium-500 text-sm py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade Keys…
          </div>
        ) : keys.length === 0 ? (
          <Empty onCreate={() => setCreating(true)} />
        ) : (
          <ul className="space-y-2">
            {keys.map((k) => <KeyRow key={k.id} k={k} onRevoked={reload} />)}
          </ul>
        )}
      </main>

      {creating && activeTenantId && (
        <CreateKeyModal
          tenantId={activeTenantId}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); void reload(); }}
        />
      )}
    </div>
  );
}

function Empty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="text-center py-16">
      <div className="w-14 h-14 mx-auto rounded-none bg-obsidian-900 border border-titanium-900 flex items-center justify-center mb-4">
        <KeyRound className="h-6 w-6 text-titanium-600" />
      </div>
      <h2 className="font-display text-lg font-bold text-titanium-50 mb-1">Noch keine Keys</h2>
      <p className="text-sm text-titanium-400 mb-6">
        Erstelle einen Key, um Events aus Browser-Extension, SDK, CI/CD oder Agent-Runtime einzuspeisen.
      </p>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-amber-400"
      >
        <Plus className="h-4 w-4" /> Ersten Key erstellen
      </button>
    </div>
  );
}

function KeyRow({ k, onRevoked }: { k: IngestKey; onRevoked: () => void }) {
  const [busy, setBusy] = useState(false);

  const status = k.revoked_at ? 'revoked' : 'active';
  const badge = status === 'revoked'
    ? 'bg-obsidian-800 text-titanium-400 border-titanium-900'
    : 'bg-emerald-950/40 text-emerald-300 border-emerald-900';

  return (
    <li className="bg-obsidian-900 border border-titanium-900 rounded-none p-3 flex items-center gap-3">
      <KeyRound className="h-4 w-4 text-titanium-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-titanium-50 truncate">{k.name}</div>
        <div className="text-xs text-titanium-400 font-mono truncate">
          {k.key_prefix}… ·{' '}
          {k.allowed_sources.length > 0
            ? `sources: ${k.allowed_sources.join(', ')}`
            : 'sources: any'}
        </div>
        <div className="text-[11px] text-titanium-500 mt-0.5">
          {k.last_used_at
            ? `Zuletzt genutzt: ${new Date(k.last_used_at).toLocaleString('de-DE')}`
            : 'Noch nie genutzt'}{' '}
          · Rate-Limit {k.rate_limit_per_minute}/min
        </div>
      </div>
      <span className={`px-2 py-0.5 rounded-none text-[10px] font-bold uppercase tracking-wider border ${badge}`}>
        {status}
      </span>
      {status === 'active' && (
        <button
          onClick={async () => {
            if (!confirm(`Key "${k.name}" wirklich widerrufen? Diese Aktion ist nicht rückgängig.`)) return;
            setBusy(true);
            await revokeIngestKey(k.id);
            onRevoked();
            setBusy(false);
          }}
          disabled={busy}
          className="px-2 py-1 text-xs font-semibold text-titanium-300 bg-obsidian-800 hover:bg-titanium-900 rounded-none disabled:opacity-50"
        >
          {busy ? '…' : 'Widerrufen'}
        </button>
      )}
    </li>
  );
}

function CreateKeyModal({
  tenantId, onClose, onCreated,
}: { tenantId: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [allowedSources, setAllowedSources] = useState<IngestKeySource[]>([]);
  const [rateLimit, setRateLimit] = useState(60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const toggleSource = (s: IngestKeySource) => {
    setAllowedSources((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setBusy(true);
    const r = await createIngestKey(tenantId, name.trim(), allowedSources, rateLimit);
    setBusy(false);
    if (!r.ok) { setError(r.error?.message ?? 'Erstellen fehlgeschlagen'); return; }
    setToken(r.token ?? null);
  };

  const copyToken = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div className="fixed inset-0 bg-obsidian-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-obsidian-900 border border-titanium-900 rounded-none shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b border-titanium-900">
          <h2 className="font-display font-bold text-titanium-50">
            {token ? 'Key erstellt' : 'Neuer Ingest-Key'}
          </h2>
          <button onClick={() => { setToken(null); onClose(); }} className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!token ? (
          <form onSubmit={submit} className="p-4 space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-titanium-400 mb-1.5">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z. B. Browser-Extension prod"
                required
                maxLength={120}
                className="w-full bg-obsidian-950 border border-titanium-900 text-titanium-100 text-sm rounded-none px-3 py-2 outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-titanium-400 mb-1.5">
                Erlaubte Quellen (leer = alle)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_SOURCES.map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => toggleSource(s)}
                    className={`px-2 py-1 text-[11px] font-mono rounded-none border transition-colors ${
                      allowedSources.includes(s)
                        ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                        : 'bg-obsidian-950 border-titanium-900 text-titanium-400 hover:border-titanium-700'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-titanium-400 mb-1.5">
                Rate-Limit (Requests / Minute)
              </label>
              <input
                type="number"
                min={1}
                max={10000}
                value={rateLimit}
                onChange={(e) => setRateLimit(Number(e.target.value))}
                className="w-full bg-obsidian-950 border border-titanium-900 text-titanium-100 text-sm rounded-none px-3 py-2 outline-none focus:border-amber-500"
              />
              <p className="mt-1 text-[11px] text-titanium-500">
                Hinweis: Limit wird derzeit nur gespeichert, nicht hart durchgesetzt (Enforcement folgt).
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-xs text-red-300 bg-red-950/50 border border-red-900 rounded-none p-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-sm font-semibold text-titanium-300 hover:bg-obsidian-800 rounded-none"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={busy || !name.trim()}
                className="px-4 py-1.5 bg-amber-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-amber-400 disabled:opacity-50"
              >
                {busy ? 'Erstelle…' : 'Key erstellen'}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-4 space-y-4">
            <div className="flex items-start gap-2.5 text-xs text-amber-200 bg-amber-950/50 border border-amber-800 rounded-none p-3">
              <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Einmalige Anzeige</div>
                <div className="text-amber-200/80 mt-0.5">
                  Speichere den Token jetzt sicher. Beim Schließen ist er weg — wir speichern nur den
                  sha256-Hash und können ihn nicht wieder anzeigen.
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-titanium-400 mb-1.5">
                Ingest-Token
              </label>
              <div className="flex items-stretch gap-2">
                <code className="flex-1 bg-obsidian-950 border border-titanium-900 text-amber-200 text-xs font-mono rounded-none px-3 py-2.5 break-all">
                  {token}
                </code>
                <button
                  type="button"
                  onClick={copyToken}
                  className="px-3 py-2 bg-obsidian-800 hover:bg-obsidian-700 text-titanium-200 rounded-none border border-titanium-900"
                  aria-label="Token kopieren"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-titanium-400 mb-1.5">
                Beispiel-Request
              </label>
              <pre className="bg-obsidian-950 border border-titanium-900 text-xs font-mono text-titanium-300 rounded-none p-3 overflow-x-auto">
{`curl -X POST https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/governance-ingest \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{"event":{"event_type":"test","event_source":"manual","title":"hello"}}'`}
              </pre>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                onClick={() => { setToken(null); onCreated(); }}
                className="px-4 py-1.5 bg-amber-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-amber-400"
              >
                Fertig
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
