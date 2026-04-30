import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Server, Plus, Trash2, Globe, KeyRound, Loader2,
  AlertTriangle, CheckCircle2, X,
} from 'lucide-react';
import { AuthGate } from './AuthGate';
import {
  listConnections, createConnection, deleteConnection,
  type VpsConnection, type CreateConnectionInput,
} from './api';

export function ConnectionsView() {
  return <AuthGate>{() => <ConnectionsInner />}</AuthGate>;
}

function ConnectionsInner() {
  const [items, setItems] = useState<VpsConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try { setItems(await listConnections()); }
    catch (e: any) { setError(e?.message ?? 'Laden fehlgeschlagen'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="h-14 border-b border-slate-200/60 bg-white flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link
            to="/kodee"
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-700"
            aria-label="Zurück zu Kodee"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
              <Server className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-slate-900">VPS-Verbindungen</div>
              <div className="text-[11px] text-slate-500 font-medium">Hosts, die Kodee verwalten darf</div>
            </div>
          </div>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Plus className="h-4 w-4" /> Neue Verbindung
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-4 flex items-start gap-2.5 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade Verbindungen…
          </div>
        ) : items.length === 0 ? (
          <EmptyState onCreate={() => setCreating(true)} />
        ) : (
          <ul className="space-y-3">
            {items.map((c) => <ConnectionRow key={c.id} conn={c} onDeleted={load} />)}
          </ul>
        )}
      </main>

      {creating && (
        <CreateModal
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); void load(); }}
        />
      )}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="text-center py-16">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-white border border-slate-200 flex items-center justify-center mb-4">
        <Server className="h-6 w-6 text-slate-300" />
      </div>
      <h2 className="font-display text-lg font-bold text-slate-900 mb-1">Noch keine VPS-Verbindung</h2>
      <p className="text-sm text-slate-500 mb-6">
        Lege eine Verbindung an, damit Kodee Server-Aktionen für dich ausführen kann.
      </p>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700"
      >
        <Plus className="h-4 w-4" /> Erste Verbindung anlegen
      </button>
    </div>
  );
}

function ConnectionRow({ conn, onDeleted }: { conn: VpsConnection; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const remove = async () => {
    setBusy(true);
    try { await deleteConnection(conn.id); onDeleted(); }
    finally { setBusy(false); }
  };

  return (
    <li className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
        <Globe className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-slate-900 truncate">{conn.label}</div>
        <div className="text-xs text-slate-500 truncate font-mono">
          {conn.username}@{conn.host}:{conn.port}
        </div>
        {conn.last_used_at && (
          <div className="text-[11px] text-slate-400 mt-0.5">
            Zuletzt benutzt: {new Date(conn.last_used_at).toLocaleString()}
          </div>
        )}
      </div>
      {confirm ? (
        <div className="flex items-center gap-2">
          <button
            onClick={remove}
            disabled={busy}
            className="px-2.5 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50"
          >
            {busy ? 'Lösche…' : 'Wirklich löschen'}
          </button>
          <button
            onClick={() => setConfirm(false)}
            className="px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md"
          >
            Abbrechen
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirm(true)}
          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
          aria-label="Löschen"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<CreateConnectionInput>({
    label: '', host: '', port: 22, username: '', private_key: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await createConnection(form);
      onCreated();
    } catch (e: any) {
      setError(e?.message ?? 'Anlegen fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="font-display font-bold text-slate-900">Neue VPS-Verbindung</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <Field label="Label" hint={'z. B. „Production VPS"'}>
            <input
              required
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className={inputCls}
              disabled={busy}
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field label="Host" hint="FQDN oder IP">
                <input
                  required
                  value={form.host}
                  onChange={(e) => setForm({ ...form, host: e.target.value })}
                  placeholder="vps.example.com"
                  className={inputCls}
                  disabled={busy}
                />
              </Field>
            </div>
            <Field label="Port">
              <input
                type="number"
                min={1}
                max={65535}
                value={form.port ?? 22}
                onChange={(e) => setForm({ ...form, port: parseInt(e.target.value, 10) })}
                className={inputCls}
                disabled={busy}
              />
            </Field>
          </div>
          <Field label="SSH User" hint='Linux-User, z. B. „ubuntu" oder „deploy"'>
            <input
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className={inputCls}
              disabled={busy}
            />
          </Field>
          <Field label="Privater SSH-Key" hint="OpenSSH-Format. Wird verschlüsselt gespeichert.">
            <textarea
              required
              value={form.private_key}
              onChange={(e) => setForm({ ...form, private_key: e.target.value })}
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;…"
              rows={6}
              className={`${inputCls} font-mono text-xs`}
              disabled={busy}
            />
          </Field>
          <Field
            label="Host-Key Fingerprint (optional)"
            hint='SHA256 — Pinning verhindert MITM. Auf dem VPS: ssh-keyscan -t ed25519 host | ssh-keygen -lf -'
          >
            <input
              value={form.known_host_fingerprint ?? ''}
              onChange={(e) => setForm({ ...form, known_host_fingerprint: e.target.value || undefined })}
              placeholder="SHA256:…"
              className={`${inputCls} font-mono text-xs`}
              disabled={busy}
            />
          </Field>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg p-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              disabled={busy}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Verbindung anlegen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls =
  'w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 disabled:opacity-50';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{label}</span>
        {hint && <span className="text-[11px] text-slate-400 font-normal">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

// silence unused
void KeyRound;
