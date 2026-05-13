import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Key, Plus, Trash2, AlertTriangle, Loader2, Copy, Check, ExternalLink,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { AuthGate } from '../kodee/connections/AuthGate';
import { getSupabase } from '../../lib/supabase';
import { useTenant } from '../../core/access/TenantProvider';

interface ApiKey {
  id: string;
  tenant_id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export function ApiKeysSettings() {
  return <AuthGate>{(session) => <Inner session={session} />}</AuthGate>;
}

function Inner({ session: _session }: { session: Session }) {
  const { activeTenantId } = useTenant();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [revealedKey, setRevealedKey] = useState<{ id: string; raw: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (activeTenantId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenantId]);

  async function load() {
    if (!activeTenantId) return;
    setLoading(true); setError(null);
    try {
      const sb = getSupabase();
      const { data, error: err } = await sb.from('api_keys')
        .select('*').eq('tenant_id', activeTenantId)
        .is('revoked_at', null)
        .order('created_at', { ascending: false });
      if (err) throw err;
      setKeys((data ?? []) as ApiKey[]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function createKey() {
    if (!activeTenantId || !newKeyName.trim()) return;
    setCreating(true); setError(null);
    try {
      // Generate cryptographically random key client-side (32 bytes → base64url)
      const buf = crypto.getRandomValues(new Uint8Array(32));
      const raw = 'rsd_' + btoa(String.fromCharCode(...buf))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const prefix = raw.slice(0, 12); // "rsd_xxxxxxxx"
      const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
      const hash = Array.from(new Uint8Array(hashBuf))
        .map((b) => b.toString(16).padStart(2, '0')).join('');

      const sb = getSupabase();
      const { data, error: err } = await sb.from('api_keys').insert({
        tenant_id: activeTenantId,
        name: newKeyName.trim(),
        key_hash: hash,
        key_prefix: prefix,
      }).select('id').single();
      if (err) throw err;

      setRevealedKey({ id: data!.id, raw });
      setNewKeyName('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(id: string) {
    if (!confirm('Diesen API-Key wirklich widerrufen? Anwendungen, die ihn nutzen, brechen sofort.')) return;
    try {
      const sb = getSupabase();
      const { error: err } = await sb.from('api_keys')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', id);
      if (err) throw err;
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function copyKey() {
    if (!revealedKey) return;
    navigator.clipboard?.writeText(revealedKey.raw).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/settings" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center">
            <Key className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-sm tracking-tight text-titanium-50">API-Keys</div>
            <div className="text-[11px] text-titanium-400 font-medium">Programmatic Access · Tenant-scoped</div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {error && (
          <div className="flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />{error}
          </div>
        )}

        {revealedKey && (
          <div className="bg-emerald-950/40 border border-emerald-700 rounded-none p-5">
            <div className="font-display font-bold text-emerald-200 text-sm mb-2">
              ✓ Neuer API-Key — JETZT kopieren!
            </div>
            <p className="text-xs text-emerald-100/80 mb-3">
              Aus Sicherheitsgründen wird der Key nur dieses eine Mal angezeigt.
              Speichere ihn sofort in einem Password-Manager oder direkt in deiner Anwendung.
            </p>
            <div className="flex items-center gap-2 mb-3">
              <code className="flex-1 px-3 py-2 bg-obsidian-950 border border-emerald-900 text-emerald-200 text-xs font-mono break-all">
                {revealedKey.raw}
              </code>
              <button onClick={copyKey}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-none">
                {copied ? <><Check className="h-3.5 w-3.5" /> kopiert</> : <><Copy className="h-3.5 w-3.5" /> kopieren</>}
              </button>
            </div>
            <button onClick={() => setRevealedKey(null)}
              className="text-xs text-emerald-300 hover:text-emerald-200 underline">
              Verstanden, weiterarbeiten →
            </button>
          </div>
        )}

        <section>
          <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3">Neuen Key erstellen</h2>
          <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value.slice(0, 64))}
                placeholder="z.B. CI-Pipeline-Audit oder n8n-Workflow"
                className="flex-1 bg-obsidian-950 border border-titanium-900 px-3 py-2 text-sm rounded-none outline-none focus:border-security-500"
                disabled={creating || !activeTenantId}
              />
              <button onClick={createKey} disabled={creating || !newKeyName.trim() || !activeTenantId}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-security-500 hover:bg-security-600 disabled:opacity-40 text-white text-sm font-bold rounded-none">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Erstellen
              </button>
            </div>
            <p className="text-[11px] text-titanium-500 mt-2">
              Format: <code className="font-mono">rsd_…</code> · 32 Bytes Random · sha256 server-side. Nur Owner/Admin dürfen Keys erstellen.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3">
            Aktive Keys ({keys.length})
          </h2>
          {loading
            ? (
              <div className="flex items-center justify-center gap-3 py-12 text-titanium-400">
                <Loader2 className="h-5 w-5 animate-spin" /> Lade …
              </div>
            )
            : keys.length === 0
            ? (
              <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-8 text-center text-sm text-titanium-500">
                Noch keine API-Keys. Erstelle oben deinen ersten.
              </div>
            )
            : (
              <div className="bg-obsidian-900 border border-titanium-900 rounded-none divide-y divide-titanium-900">
                {keys.map((k) => (
                  <div key={k.id} className="flex items-start justify-between gap-3 p-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-bold text-titanium-100 text-sm">{k.name}</div>
                      <div className="text-[11px] text-titanium-500 font-mono mt-0.5">
                        {k.key_prefix}…
                      </div>
                      <div className="text-[11px] text-titanium-500 mt-1">
                        Erstellt {new Date(k.created_at).toLocaleDateString('de-DE')}
                        {k.last_used_at
                          ? <> · Zuletzt genutzt {new Date(k.last_used_at).toLocaleDateString('de-DE')}</>
                          : <> · <span className="text-amber-400">Nie genutzt</span></>}
                      </div>
                    </div>
                    <button onClick={() => revokeKey(k.id)}
                      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-red-400 hover:text-red-300 hover:bg-red-950/30 text-[11px] font-semibold rounded-none">
                      <Trash2 className="h-3.5 w-3.5" /> Widerrufen
                    </button>
                  </div>
                ))}
              </div>
            )}
        </section>

        <section>
          <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3">Verwendung</h2>
          <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4 text-xs space-y-3">
            <p className="text-titanium-300 leading-relaxed">
              API-Keys ermöglichen programmatische Audit-Aufrufe — z. B. aus deiner CI-Pipeline,
              n8n-Workflow oder einem Custom-Backend.
            </p>
            <div className="bg-obsidian-950 p-3 font-mono text-[11px] overflow-x-auto">
              <div className="text-titanium-500 mb-1"># Audit programmatisch ausführen (Curl-Beispiel)</div>
              <div className="text-emerald-300">curl -X POST https://RealSyncDynamicsAI.de/api/audit \</div>
              <div className="text-emerald-300 pl-4">-H "x-api-key: rsd_..." \</div>
              <div className="text-emerald-300 pl-4">-H "Content-Type: application/json" \</div>
              <div className="text-emerald-300 pl-4">-d {`'{"url":"https://example.de"}'`}</div>
            </div>
            <p className="text-titanium-500">
              <strong className="text-titanium-300">Quotas pro Plan:</strong>{' '}
              Starter 100/Monat · Growth 1.000/Monat · Agency 10.000/Monat.
              Bei Quota-Überschreitung HTTP 429.
            </p>
            <p className="text-titanium-500">
              <strong className="text-titanium-300">Sicherheit:</strong>{' '}
              Server speichert nur sha256(key). Wir können verlorene Keys nicht wiederherstellen —
              widerrufe alte und erstelle neue.
            </p>
          </div>
        </section>

        <div className="flex flex-wrap gap-2 text-xs">
          <Link to="/settings" className="px-3 py-1.5 bg-obsidian-900 border border-titanium-700 hover:border-security-500 text-titanium-200 rounded-none">← Settings</Link>
          <Link to="/legal/avv" className="px-3 py-1.5 bg-obsidian-900 border border-titanium-700 hover:border-security-500 text-titanium-200 rounded-none inline-flex items-center gap-1">
            AVV-Template <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </main>
    </div>
  );
}
