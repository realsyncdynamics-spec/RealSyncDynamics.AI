import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Send, Plus, RefreshCw, Filter, AlertTriangle, Loader2, X,
  Mail, Linkedin, Phone, Calendar, FileText,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { AuthGate } from '../kodee/connections/AuthGate';
import { getSupabase } from '../../lib/supabase';

type Status = 'new' | 'contacted' | 'replied' | 'meeting' | 'deal' | 'lost';

interface OutreachContact {
  id: string;
  market_gap_id: string | null;
  ceo_brief_id: string | null;
  name: string | null;
  company: string | null;
  email: string | null;
  linkedin_url: string | null;
  phone: string | null;
  status: Status;
  notes: string | null;
  contacted_at: string | null;
  replied_at: string | null;
  next_followup_at: string | null;
  created_at: string;
}

const STATUSES: Status[] = ['new', 'contacted', 'replied', 'meeting', 'deal', 'lost'];

export function OutreachView() {
  return <AuthGate>{(session) => <Inner session={session} />}</AuthGate>;
}

function Inner({ session }: { session: Session }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<OutreachContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');
  const [editing, setEditing] = useState<OutreachContact | null>(null);
  const [creating, setCreating] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const prefillGapId = searchParams.get('gap_id');
  const prefillBriefId = searchParams.get('brief_id');

  useEffect(() => {
    const sb = getSupabase();
    (async () => {
      const { data: prof } = await sb.from('profiles')
        .select('is_super_admin').eq('id', session.user.id).maybeSingle();
      const isAdmin = !!prof?.is_super_admin;
      setAllowed(isAdmin);
      if (isAdmin) await loadRows();
      else setLoading(false);
    })();
    // If query-string carries gap_id/brief_id, open the create modal pre-filled
    if (prefillGapId || prefillBriefId) setCreating(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.user.id]);

  async function loadRows() {
    setLoading(true); setError(null);
    try {
      const sb = getSupabase();
      const { data, error } = await sb.from('outreach_contacts')
        .select('*').order('created_at', { ascending: false }).limit(500);
      if (error) throw error;
      setRows((data ?? []) as OutreachContact[]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(
    () => rows.filter((r) => statusFilter === 'all' || r.status === statusFilter),
    [rows, statusFilter]
  );

  async function quickStatus(id: string, next: Status) {
    setError(null);
    const sb = getSupabase();
    const patch: Partial<OutreachContact> = { status: next };
    if (next === 'contacted' && !rows.find((r) => r.id === id)?.contacted_at) {
      patch.contacted_at = new Date().toISOString();
    }
    if (next === 'replied' && !rows.find((r) => r.id === id)?.replied_at) {
      patch.replied_at = new Date().toISOString();
    }
    const { error } = await sb.from('outreach_contacts').update(patch).eq('id', id);
    if (error) setError(error.message);
    else await loadRows();
  }

  if (allowed === null) {
    return <div className="min-h-screen bg-obsidian-950 flex items-center justify-center text-titanium-500 text-sm">Lade…</div>;
  }
  if (!allowed) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-obsidian-900 border border-titanium-900 p-8 text-center rounded-none">
          <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-3" />
          <h1 className="font-display text-xl font-bold text-titanium-50 mb-2">Kein Zugriff</h1>
          <p className="text-sm text-titanium-400 mb-5">Super-Admin only.</p>
          <Link to="/dashboard" className="text-sm text-security-400 hover:underline">→ Zum Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/market-gaps" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-orange-500 to-rose-700 flex items-center justify-center">
            <Send className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Outreach</div>
            <div className="text-[11px] text-titanium-400 font-medium">CEO-Brief-Versand · Super-Admin</div>
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={loadRows}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-titanium-800 hover:border-security-500 text-titanium-300 hover:text-titanium-50 rounded-none"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Reload
          </button>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-security-500 hover:bg-security-600 text-white rounded-none"
          >
            <Plus className="h-3.5 w-3.5" /> Neuer Kontakt
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-2 text-xs text-titanium-400 mr-2">
            <Filter className="h-3.5 w-3.5" /> Status:
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as Status | 'all')}
            className="bg-obsidian-900 border border-titanium-900 px-2.5 py-1.5 text-xs rounded-none outline-none focus:border-security-500"
          >
            <option value="all">Alle ({rows.length})</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s} ({rows.filter((r) => r.status === s).length})
              </option>
            ))}
          </select>
          <span className="ml-auto text-xs text-titanium-500">{filtered.length} sichtbar</span>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-none p-3 mb-4">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-titanium-400 text-sm py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-titanium-500 text-sm">
            Keine Kontakte. Klick „Neuer Kontakt" oder starte Outreach aus einer Markt-Lücke.
          </div>
        ) : (
          <div className="overflow-x-auto border border-titanium-900">
            <table className="w-full text-sm">
              <thead className="bg-obsidian-900 text-[11px] uppercase tracking-wider text-titanium-400">
                <tr>
                  <Th>Kontakt</Th>
                  <Th>Firma</Th>
                  <Th>Channel</Th>
                  <Th>Status</Th>
                  <Th>Kontaktiert</Th>
                  <Th>Follow-up</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-titanium-900 bg-obsidian-950 hover:bg-obsidian-900">
                    <Td>
                      <div className="font-bold text-titanium-100">{r.name ?? '—'}</div>
                      <div className="text-xs text-titanium-500">
                        {r.email ? <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{r.email}</span> : null}
                      </div>
                    </Td>
                    <Td>
                      <div className="text-titanium-200">{r.company ?? '—'}</div>
                    </Td>
                    <Td>
                      <div className="flex gap-2 text-xs text-titanium-400">
                        {r.linkedin_url && <a href={r.linkedin_url} target="_blank" rel="noreferrer" className="hover:text-security-400 inline-flex items-center gap-1"><Linkedin className="h-3 w-3" /></a>}
                        {r.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{r.phone}</span>}
                      </div>
                    </Td>
                    <Td>
                      <select
                        value={r.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => quickStatus(r.id, e.target.value as Status)}
                        className="bg-obsidian-900 border border-titanium-800 px-2 py-1 text-xs rounded-none outline-none focus:border-security-500"
                      >
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </Td>
                    <Td><span className="text-xs text-titanium-400">{r.contacted_at ? new Date(r.contacted_at).toLocaleDateString('de-DE') : '—'}</span></Td>
                    <Td>
                      <span className={`text-xs ${r.next_followup_at && new Date(r.next_followup_at) < new Date() ? 'text-red-300 font-bold' : 'text-titanium-400'}`}>
                        {r.next_followup_at ? new Date(r.next_followup_at).toLocaleDateString('de-DE') : '—'}
                      </span>
                    </Td>
                    <Td className="text-right">
                      <button
                        onClick={() => setEditing(r)}
                        className="text-xs px-2 py-1 border border-titanium-800 hover:border-security-500 text-titanium-300 hover:text-titanium-50 rounded-none"
                      >
                        Edit
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {(editing || creating) && (
        <EditModal
          row={editing}
          prefillGapId={creating ? prefillGapId : null}
          prefillBriefId={creating ? prefillBriefId : null}
          onClose={() => {
            setEditing(null);
            setCreating(false);
            if (prefillGapId || prefillBriefId) setSearchParams({});
          }}
          onSaved={async () => {
            await loadRows();
            setEditing(null);
            setCreating(false);
            if (prefillGapId || prefillBriefId) setSearchParams({});
          }}
        />
      )}
    </div>
  );
}

function EditModal({
  row, prefillGapId, prefillBriefId, onClose, onSaved,
}: {
  row: OutreachContact | null;
  prefillGapId: string | null;
  prefillBriefId: string | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<Partial<OutreachContact>>(
    row ?? {
      market_gap_id: prefillGapId,
      ceo_brief_id: prefillBriefId,
      status: 'new',
    }
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const sb = getSupabase();
      const payload = {
        market_gap_id: form.market_gap_id || null,
        ceo_brief_id: form.ceo_brief_id || null,
        name: form.name?.trim() || null,
        company: form.company?.trim() || null,
        email: form.email?.trim() || null,
        linkedin_url: form.linkedin_url?.trim() || null,
        phone: form.phone?.trim() || null,
        status: form.status ?? 'new',
        notes: form.notes?.trim() || null,
        contacted_at: form.contacted_at || null,
        replied_at: form.replied_at || null,
        next_followup_at: form.next_followup_at || null,
      };
      if (row) {
        const { error } = await sb.from('outreach_contacts').update(payload).eq('id', row.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from('outreach_contacts').insert(payload);
        if (error) throw error;
      }
      await onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!row) return;
    if (!window.confirm('Kontakt wirklich löschen?')) return;
    setBusy(true); setErr(null);
    try {
      const sb = getSupabase();
      const { error } = await sb.from('outreach_contacts').delete().eq('id', row.id);
      if (error) throw error;
      await onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function update<K extends keyof OutreachContact>(key: K, value: OutreachContact[K] | null) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="fixed inset-0 bg-obsidian-950/80 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <form
        onSubmit={save}
        className="bg-obsidian-900 border border-titanium-800 max-w-2xl w-full my-8 rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-titanium-900 px-6 py-4">
          <h2 className="font-display text-lg font-bold text-titanium-50">
            {row ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 grid grid-cols-2 gap-4">
          <Field label="Name">
            <input value={form.name ?? ''} onChange={(e) => update('name', e.target.value)}
              className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2 text-sm rounded-none focus:border-security-500 outline-none" />
          </Field>
          <Field label="Firma">
            <input value={form.company ?? ''} onChange={(e) => update('company', e.target.value)}
              className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2 text-sm rounded-none focus:border-security-500 outline-none" />
          </Field>
          <Field label="E-Mail">
            <input type="email" value={form.email ?? ''} onChange={(e) => update('email', e.target.value)}
              className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2 text-sm rounded-none focus:border-security-500 outline-none" />
          </Field>
          <Field label="LinkedIn URL">
            <input type="url" value={form.linkedin_url ?? ''} onChange={(e) => update('linkedin_url', e.target.value)}
              placeholder="https://linkedin.com/in/…"
              className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2 text-sm rounded-none focus:border-security-500 outline-none" />
          </Field>
          <Field label="Telefon">
            <input value={form.phone ?? ''} onChange={(e) => update('phone', e.target.value)}
              className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2 text-sm rounded-none focus:border-security-500 outline-none" />
          </Field>
          <Field label="Status">
            <select value={form.status ?? 'new'} onChange={(e) => update('status', e.target.value as Status)}
              className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2 text-sm rounded-none focus:border-security-500 outline-none">
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Kontaktiert am">
            <input type="datetime-local" value={form.contacted_at?.slice(0, 16) ?? ''}
              onChange={(e) => update('contacted_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
              className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2 text-sm rounded-none focus:border-security-500 outline-none" />
          </Field>
          <Field label="Follow-up am">
            <input type="datetime-local" value={form.next_followup_at?.slice(0, 16) ?? ''}
              onChange={(e) => update('next_followup_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
              className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2 text-sm rounded-none focus:border-security-500 outline-none" />
          </Field>
          <div className="col-span-2">
            <Field label="Notizen">
              <textarea value={form.notes ?? ''} onChange={(e) => update('notes', e.target.value)} rows={4}
                className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2 text-sm rounded-none focus:border-security-500 outline-none resize-y" />
            </Field>
          </div>
          {(form.market_gap_id || form.ceo_brief_id) && (
            <div className="col-span-2 text-xs text-titanium-500 flex flex-wrap gap-3">
              {form.market_gap_id && (
                <span className="inline-flex items-center gap-1">
                  <FileText className="h-3 w-3" /> gap_id: <code className="text-titanium-400">{form.market_gap_id.slice(0, 8)}…</code>
                </span>
              )}
              {form.ceo_brief_id && (
                <span className="inline-flex items-center gap-1">
                  <FileText className="h-3 w-3" /> brief_id: <code className="text-titanium-400">{form.ceo_brief_id.slice(0, 8)}…</code>
                </span>
              )}
            </div>
          )}
        </div>

        {err && (
          <div className="mx-6 mb-3 flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" /><span>{err}</span>
          </div>
        )}

        <div className="flex justify-between gap-2 border-t border-titanium-900 px-6 py-4 bg-obsidian-950">
          <div>
            {row && (
              <button type="button" disabled={busy} onClick={remove}
                className="px-3 py-1.5 text-xs font-bold border border-titanium-800 hover:border-red-500 text-titanium-400 hover:text-red-300 disabled:opacity-40 rounded-none">
                Löschen
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={onClose}
              className="px-3 py-1.5 text-xs font-bold border border-titanium-800 text-titanium-300 disabled:opacity-40 rounded-none">
              Abbrechen
            </button>
            <button type="submit" disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-security-500 hover:bg-security-600 disabled:opacity-40 text-white rounded-none">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Calendar className="h-3.5 w-3.5" />}
              Speichern
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold text-titanium-400 uppercase tracking-wider mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <th className={`text-left px-3 py-2 font-bold ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}
