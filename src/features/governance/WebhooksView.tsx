import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Webhook, Plus, Loader2, AlertTriangle,
  X, Copy, Check, ShieldAlert,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import {
  createWebhook, listWebhooks, toggleWebhook, revokeWebhook,
  type IngestWebhook,
} from './webhooksApi';
import type { GovernanceRiskLevel } from './types';

/**
 * Authenticated, owner/admin-only Webhook management for outbound
 * governance events. Mirrors the KeysView pattern: list + create
 * (with one-time secret reveal) + toggle + revoke. The matched
 * webhooks are fired by governance-ingest (v3+) after every
 * successful event insert that crosses min_risk_level threshold.
 */
export function WebhooksView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

const RISK_LEVELS: GovernanceRiskLevel[] = ['info', 'low', 'medium', 'high', 'critical'];

function Inner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [webhooks, setWebhooks] = useState<IngestWebhook[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = async () => {
    if (!activeTenantId) { setWebhooks([]); return; }
    setError(null);
    setWebhooks(null);
    const r = await listWebhooks(activeTenantId);
    if (!r.ok) setError(r.error?.message ?? 'Laden fehlgeschlagen');
    else       setWebhooks(r.webhooks ?? []);
  };

  useEffect(() => { void reload(); /* eslint-disable-next-line */ }, [activeTenantId]);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/governance" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
              <Webhook className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Governance Webhooks</div>
              <div className="text-[11px] text-titanium-400 font-medium">Outbound HMAC-signed event delivery</div>
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
            <Plus className="h-4 w-4" /> Neuer Webhook
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
          <div className="text-titanium-500 text-sm">Wähle einen Tenant aus.</div>
        ) : webhooks === null ? (
          <div className="flex items-center gap-2 text-titanium-500 text-sm py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade Webhooks…
          </div>
        ) : webhooks.length === 0 ? (
          <Empty onCreate={() => setCreating(true)} />
        ) : (
          <ul className="space-y-2">
            {webhooks.map((w) => <Row key={w.id} w={w} onChange={reload} />)}
          </ul>
        )}
      </main>

      {creating && activeTenantId && (
        <CreateModal
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
        <Webhook className="h-6 w-6 text-titanium-600" />
      </div>
      <h2 className="font-display text-lg font-bold text-titanium-50 mb-1">Noch keine Webhooks</h2>
      <p className="text-sm text-titanium-400 mb-6">
        Erstelle einen Webhook, damit Slack, Teams oder Dein eigener Endpoint bei High-Risk-Events
        gepingt werden.
      </p>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-amber-400"
      >
        <Plus className="h-4 w-4" /> Ersten Webhook erstellen
      </button>
    </div>
  );
}

function Row({ w, onChange }: { w: IngestWebhook; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const isRevoked = !!w.revoked_at;

  const status =
    isRevoked       ? 'revoked'
    : !w.enabled    ? 'paused'
    : w.last_status && w.last_status >= 200 && w.last_status < 300 ? 'ok'
    : w.last_status ? 'fail'
    : 'idle';

  const badgeCls = {
    revoked: 'bg-obsidian-800 text-titanium-400 border-titanium-900',
    paused:  'bg-obsidian-800 text-titanium-400 border-titanium-900',
    ok:      'bg-emerald-950/40 text-emerald-300 border-emerald-900',
    fail:    'bg-red-950/40 text-red-300 border-red-900',
    idle:    'bg-amber-950/40 text-amber-300 border-amber-900',
  }[status];

  return (
    <li className="bg-obsidian-900 border border-titanium-900 rounded-none p-3">
      <div className="flex items-center gap-3">
        <Webhook className="h-4 w-4 text-titanium-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-titanium-50 truncate">{w.name}</div>
          <div className="text-xs text-titanium-400 font-mono truncate">{w.target_url}</div>
          <div className="text-[11px] text-titanium-500 mt-0.5">
            Min: <span className="font-mono uppercase tracking-wider">{w.min_risk_level}</span>
            {' · '}
            Secret: <span className="font-mono">{w.secret_prefix}…</span>
            {w.last_called_at && (
              <> · Last: {new Date(w.last_called_at).toLocaleString('de-DE')}{' '}
                {w.last_status !== null && <span className="font-mono">[{w.last_status}]</span>}</>
            )}
          </div>
          {w.last_error && (
            <div className="text-[11px] text-red-300 mt-1 truncate">⚠ {w.last_error}</div>
          )}
        </div>
        <span className={`px-2 py-0.5 rounded-none text-[10px] font-bold uppercase tracking-wider border ${badgeCls}`}>
          {status}
        </span>
        {!isRevoked && (
          <>
            <button
              onClick={async () => { setBusy(true); await toggleWebhook(w.id, !w.enabled); setBusy(false); onChange(); }}
              disabled={busy}
              className="px-2 py-1 text-xs font-semibold text-titanium-300 bg-obsidian-800 hover:bg-titanium-900 rounded-none disabled:opacity-50"
            >
              {w.enabled ? 'Pausieren' : 'Aktivieren'}
            </button>
            <button
              onClick={async () => {
                if (!confirm(`Webhook "${w.name}" widerrufen? Nicht rückgängig.`)) return;
                setBusy(true);
                await revokeWebhook(w.id);
                setBusy(false);
                onChange();
              }}
              disabled={busy}
              className="px-2 py-1 text-xs font-semibold text-red-300 bg-red-950/40 hover:bg-red-900/40 border border-red-900 rounded-none disabled:opacity-50"
            >
              Widerrufen
            </button>
          </>
        )}
      </div>
    </li>
  );
}

function CreateModal({
  tenantId, onClose, onCreated,
}: { tenantId: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [minRiskLevel, setMinRiskLevel] = useState<GovernanceRiskLevel>('high');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setBusy(true);
    const r = await createWebhook(tenantId, name.trim(), targetUrl.trim(), minRiskLevel);
    setBusy(false);
    if (!r.ok) { setError(r.error?.message ?? 'Erstellen fehlgeschlagen'); return; }
    setSecret(r.secret ?? null);
  };

  const copySecret = async () => {
    if (!secret) return;
    try { await navigator.clipboard.writeText(secret); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };

  return (
    <div className="fixed inset-0 bg-obsidian-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-obsidian-900 border border-titanium-900 rounded-none shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b border-titanium-900">
          <h2 className="font-display font-bold text-titanium-50">
            {secret ? 'Webhook erstellt' : 'Neuer Webhook'}
          </h2>
          <button onClick={() => { setSecret(null); onClose(); }} className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!secret ? (
          <form onSubmit={submit} className="p-4 space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-titanium-400 mb-1.5">Name</label>
              <input
                type="text" required maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z. B. Slack #compliance-alerts"
                className="w-full bg-obsidian-950 border border-titanium-900 text-titanium-100 text-sm rounded-none px-3 py-2 outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-titanium-400 mb-1.5">
                Target URL (https)
              </label>
              <input
                type="url" required maxLength={500}
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/…"
                className="w-full bg-obsidian-950 border border-titanium-900 text-titanium-100 text-sm rounded-none px-3 py-2 outline-none focus:border-amber-500 font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-titanium-400 mb-1.5">
                Mindest-Risk-Level
              </label>
              <select
                value={minRiskLevel}
                onChange={(e) => setMinRiskLevel(e.target.value as GovernanceRiskLevel)}
                className="w-full bg-obsidian-950 border border-titanium-900 text-titanium-100 text-sm rounded-none px-3 py-2 outline-none focus:border-amber-500"
              >
                {RISK_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <p className="mt-1 text-[11px] text-titanium-500">
                Nur Events mit risk_level ≥ {minRiskLevel} werden zugestellt.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-xs text-red-300 bg-red-950/50 border border-red-900 rounded-none p-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm font-semibold text-titanium-300 hover:bg-obsidian-800 rounded-none">
                Abbrechen
              </button>
              <button type="submit" disabled={busy || !name.trim() || !targetUrl.trim()} className="px-4 py-1.5 bg-amber-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-amber-400 disabled:opacity-50">
                {busy ? 'Erstelle…' : 'Webhook erstellen'}
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
                  Hinterlege das Secret jetzt sicher. Damit verifizierst Du die HMAC-SHA256-Signatur
                  in jedem Webhook-Request (<code>X-RSD-Signature</code>-Header).
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-titanium-400 mb-1.5">
                HMAC Secret
              </label>
              <div className="flex items-stretch gap-2">
                <code className="flex-1 bg-obsidian-950 border border-titanium-900 text-amber-200 text-xs font-mono rounded-none px-3 py-2.5 break-all">
                  {secret}
                </code>
                <button
                  type="button"
                  onClick={copySecret}
                  className="px-3 py-2 bg-obsidian-800 hover:bg-obsidian-700 text-titanium-200 rounded-none border border-titanium-900"
                  aria-label="Secret kopieren"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-titanium-400 mb-1.5">
                Signatur-Verifikation (Node)
              </label>
              <pre className="bg-obsidian-950 border border-titanium-900 text-xs font-mono text-titanium-300 rounded-none p-3 overflow-x-auto leading-relaxed">
{`import crypto from 'node:crypto';

const expected = crypto
  .createHmac('sha256', SECRET)
  .update(rawBody)
  .digest('hex');
const received = req.headers['x-rsd-signature'].replace('sha256=', '');
if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received))) {
  return res.status(401).end();
}`}
              </pre>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button onClick={() => { setSecret(null); onCreated(); }} className="px-4 py-1.5 bg-amber-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-amber-400">
                Fertig
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
