import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Users, Plus, Loader2, AlertTriangle, CheckCircle2,
  X, Copy, Check, Mail,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import {
  createInvite, listInvites, revokeInvite,
  type Invite, type Role,
} from './api';

export function InvitesView() {
  return <AuthGate>{() => <InvitesInner />}</AuthGate>;
}

function InvitesInner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = async () => {
    if (!activeTenantId) { setInvites([]); return; }
    setError(null);
    setInvites(null);
    const r = await listInvites(activeTenantId);
    if (!r.ok) setError(r.error?.message ?? 'Laden fehlgeschlagen');
    else       setInvites(r.invites);
  };

  useEffect(() => { void reload(); /* eslint-disable-next-line */ }, [activeTenantId]);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-sm">
              <Users className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Team-Einladungen</div>
              <div className="text-[11px] text-titanium-400 font-medium">Mitglieder über Token-Link einladen</div>
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-security-500 text-white text-sm font-semibold rounded-none hover:bg-security-600 disabled:opacity-50 transition-colors"
          >
            <Plus className="h-4 w-4" /> Neue Einladung
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
          <div className="text-titanium-500 text-sm">Wähle einen Tenant aus, um Einladungen zu verwalten.</div>
        ) : invites === null ? (
          <div className="flex items-center gap-2 text-titanium-500 text-sm py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade Einladungen…
          </div>
        ) : invites.length === 0 ? (
          <Empty onCreate={() => setCreating(true)} />
        ) : (
          <ul className="space-y-2">
            {invites.map((inv) => <InviteRow key={inv.id} inv={inv} onRevoked={reload} />)}
          </ul>
        )}
      </main>

      {creating && activeTenantId && (
        <CreateInviteModal
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
        <Mail className="h-6 w-6 text-titanium-600" />
      </div>
      <h2 className="font-display text-lg font-bold text-titanium-50 mb-1">Noch keine Einladungen</h2>
      <p className="text-sm text-titanium-400 mb-6">
        Lade jemanden mit einem Magic Link in deinen Tenant ein.
      </p>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-security-500 text-white text-sm font-semibold rounded-none hover:bg-security-600"
      >
        <Plus className="h-4 w-4" /> Erste Einladung erstellen
      </button>
    </div>
  );
}

function InviteRow({ inv, onRevoked }: { inv: Invite; onRevoked: () => void }) {
  const [busy, setBusy] = useState(false);

  const status = inv.accepted_at ? 'accepted'
               : inv.revoked_at  ? 'revoked'
               : new Date(inv.expires_at).getTime() < Date.now() ? 'expired'
               : 'pending';

  const badge = {
    accepted: 'bg-emerald-950/40 text-emerald-300 border-emerald-900',
    revoked:  'bg-obsidian-800 text-titanium-400 border-titanium-900',
    expired:  'bg-amber-950/40 text-amber-300 border-amber-800',
    pending:  'bg-security-900/30 text-security-300 border-security-800',
  }[status];

  return (
    <li className="bg-obsidian-900 border border-titanium-900 rounded-none p-3 flex items-center gap-3">
      <Mail className="h-4 w-4 text-titanium-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-titanium-50 truncate">{inv.email}</div>
        <div className="text-xs text-titanium-400">
          Rolle: <span className="font-mono">{inv.role}</span> · läuft ab am{' '}
          {new Date(inv.expires_at).toLocaleDateString('de-DE')}
        </div>
      </div>
      <span className={`px-2 py-0.5 rounded-none text-[10px] font-bold uppercase tracking-wider border ${badge}`}>
        {status}
      </span>
      {status === 'pending' && (
        <button
          onClick={async () => { setBusy(true); await revokeInvite(inv.id); onRevoked(); setBusy(false); }}
          disabled={busy}
          className="px-2 py-1 text-xs font-semibold text-titanium-300 bg-obsidian-800 hover:bg-titanium-900 rounded-none disabled:opacity-50"
        >
          {busy ? '…' : 'Widerrufen'}
        </button>
      )}
    </li>
  );
}

function CreateInviteModal({
  tenantId, onClose, onCreated,
}: { tenantId: string; onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('editor');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setBusy(true);
    const r = await createInvite(tenantId, email, role);
    setBusy(false);
    if (!r.ok) { setError(r.error?.message ?? 'Erstellen fehlgeschlagen'); return; }
    setToken(r.token ?? null);
  };

  const url = token ? `${window.location.origin}/tenant/invite/${token}` : '';

  return (
    <div className="fixed inset-0 bg-obsidian-950 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-obsidian-900 rounded-none shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b border-titanium-900">
          <h2 className="font-display font-bold text-titanium-50">
            {token ? 'Einladung erstellt' : 'Neue Einladung'}
          </h2>
          <button onClick={() => { setToken(null); onClose(); }} className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        {token ? (
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-2 text-sm text-emerald-300 bg-emerald-950/40 border border-emerald-900 rounded-none p-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              <span>
                Token erstellt. Schick diesen Link an <b>{email}</b> — er ist <b>nur einmal</b> einlösbar
                und nach Ablauf nicht erneut anzeigbar.
              </span>
            </div>
            <div className="flex items-center gap-2 bg-obsidian-950 border border-titanium-900 rounded-none p-2">
              <code className="flex-1 truncate text-xs font-mono text-titanium-200">{url}</code>
              <button
                onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                className="p-1.5 rounded-none hover:bg-titanium-900 text-titanium-400"
                aria-label="Kopieren"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <button
              onClick={() => { setToken(null); onCreated(); }}
              className="w-full py-2 bg-obsidian-950 text-white text-sm font-semibold rounded-none hover:bg-obsidian-800"
            >
              Fertig
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-5 space-y-4">
            <label className="block">
              <span className="block text-xs font-bold text-titanium-400 uppercase tracking-wider mb-1">E-Mail</span>
              <input
                type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-obsidian-950 border border-titanium-900 rounded-none outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                disabled={busy}
              />
            </label>
            <label className="block">
              <span className="block text-xs font-bold text-titanium-400 uppercase tracking-wider mb-1">Rolle</span>
              <select
                value={role} onChange={(e) => setRole(e.target.value as Role)}
                className="w-full px-3 py-2 text-sm bg-obsidian-950 border border-titanium-900 rounded-none outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                disabled={busy}
              >
                <option value="admin">admin</option>
                <option value="editor">editor</option>
                <option value="viewer_auditor">viewer_auditor</option>
              </select>
            </label>
            {error && (
              <div className="flex items-start gap-2 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-titanium-900/50">
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-titanium-300 hover:bg-obsidian-800 rounded-none" disabled={busy}>
                Abbrechen
              </button>
              <button type="submit" disabled={busy}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-security-500 text-white text-sm font-semibold rounded-none hover:bg-security-600 disabled:opacity-50">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Einladung erstellen
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
