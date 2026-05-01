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
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="h-14 border-b border-slate-200/60 bg-white flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-700">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-sm">
              <Users className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-slate-900">Team-Einladungen</div>
              <div className="text-[11px] text-slate-500 font-medium">Mitglieder über Token-Link einladen</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tenants.length > 1 && (
            <select
              value={activeTenantId ?? ''}
              onChange={(e) => setActiveTenant(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg px-2 py-1.5 outline-none cursor-pointer font-medium hover:bg-slate-100 max-w-[200px]"
            >
              {tenants.map((t) => (
                <option key={t.tenantId} value={t.tenantId}>{t.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => setCreating(true)}
            disabled={!activeTenantId}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <Plus className="h-4 w-4" /> Neue Einladung
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-4 flex items-start gap-2.5 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!activeTenantId ? (
          <div className="text-slate-400 text-sm">Wähle einen Tenant aus, um Einladungen zu verwalten.</div>
        ) : invites === null ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm py-12 justify-center">
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
      <div className="w-14 h-14 mx-auto rounded-2xl bg-white border border-slate-200 flex items-center justify-center mb-4">
        <Mail className="h-6 w-6 text-slate-300" />
      </div>
      <h2 className="font-display text-lg font-bold text-slate-900 mb-1">Noch keine Einladungen</h2>
      <p className="text-sm text-slate-500 mb-6">
        Lade jemanden mit einem Magic Link in deinen Tenant ein.
      </p>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700"
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
    accepted: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    revoked:  'bg-slate-100 text-slate-500 border-slate-200',
    expired:  'bg-amber-50 text-amber-700 border-amber-100',
    pending:  'bg-blue-50 text-blue-700 border-blue-100',
  }[status];

  return (
    <li className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3">
      <Mail className="h-4 w-4 text-slate-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-slate-900 truncate">{inv.email}</div>
        <div className="text-xs text-slate-500">
          Rolle: <span className="font-mono">{inv.role}</span> · läuft ab am{' '}
          {new Date(inv.expires_at).toLocaleDateString('de-DE')}
        </div>
      </div>
      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${badge}`}>
        {status}
      </span>
      {status === 'pending' && (
        <button
          onClick={async () => { setBusy(true); await revokeInvite(inv.id); onRevoked(); setBusy(false); }}
          disabled={busy}
          className="px-2 py-1 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md disabled:opacity-50"
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
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="font-display font-bold text-slate-900">
            {token ? 'Einladung erstellt' : 'Neue Einladung'}
          </h2>
          <button onClick={() => { setToken(null); onClose(); }} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400">
            <X className="h-4 w-4" />
          </button>
        </div>

        {token ? (
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              <span>
                Token erstellt. Schick diesen Link an <b>{email}</b> — er ist <b>nur einmal</b> einlösbar
                und nach Ablauf nicht erneut anzeigbar.
              </span>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2">
              <code className="flex-1 truncate text-xs font-mono text-slate-700">{url}</code>
              <button
                onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                className="p-1.5 rounded-md hover:bg-slate-200 text-slate-500"
                aria-label="Kopieren"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <button
              onClick={() => { setToken(null); onCreated(); }}
              className="w-full py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800"
            >
              Fertig
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-5 space-y-4">
            <label className="block">
              <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">E-Mail</span>
              <input
                type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                disabled={busy}
              />
            </label>
            <label className="block">
              <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Rolle</span>
              <select
                value={role} onChange={(e) => setRole(e.target.value as Role)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                disabled={busy}
              >
                <option value="admin">admin</option>
                <option value="editor">editor</option>
                <option value="viewer_auditor">viewer_auditor</option>
              </select>
            </label>
            {error && (
              <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg p-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg" disabled={busy}>
                Abbrechen
              </button>
              <button type="submit" disabled={busy}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50">
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
