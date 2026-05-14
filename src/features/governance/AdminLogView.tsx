import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ScrollText, AlertTriangle, Loader2, User } from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import { getSupabase } from '../../lib/supabase';

interface AdminLogRow {
  id: string;
  tenant_id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

/**
 * /governance/admin-log — chronological tenant-scoped audit log.
 * Reads governance_admin_log via Supabase + tenant-RLS. Entries
 * are written by the governance-* Edge Functions on every
 * owner/admin write.
 */
export function AdminLogView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

function Inner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [rows, setRows] = useState<AdminLogRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    if (!activeTenantId) { setRows([]); return; }
    setError(null); setRows(null);
    const sb = getSupabase();
    const { data, error: err } = await sb
      .from('governance_admin_log')
      .select('*')
      .eq('tenant_id', activeTenantId)
      .order('created_at', { ascending: false })
      .limit(500);
    if (err) { setError(err.message); return; }
    setRows((data ?? []) as AdminLogRow[]);
  };

  useEffect(() => { void reload(); /* eslint-disable-next-line */ }, [activeTenantId]);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/governance/admin" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center shadow-sm">
              <ScrollText className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Admin Audit Log</div>
              <div className="text-[11px] text-titanium-400 font-medium">Wer hat wann was im Governance-Stack geändert</div>
            </div>
          </div>
        </div>
        {tenants.length > 1 && (
          <select
            value={activeTenantId ?? ''}
            onChange={(e) => setActiveTenant(e.target.value)}
            className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer font-medium hover:bg-obsidian-800 max-w-[200px]"
          >
            {tenants.map((t) => <option key={t.tenantId} value={t.tenantId}>{t.name}</option>)}
          </select>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {error && (
          <div className="mb-4 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!activeTenantId ? (
          <div className="text-titanium-500 text-sm">Wähle einen Tenant aus.</div>
        ) : rows === null ? (
          <div className="flex items-center gap-2 text-titanium-500 text-sm py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade Log…
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16">
            <ScrollText className="h-8 w-8 mx-auto text-titanium-600 mb-3" />
            <p className="text-sm text-titanium-400">
              Noch keine Admin-Aktionen im Tenant geloggt.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => <Row key={r.id} row={r} />)}
          </ul>
        )}
      </main>
    </div>
  );
}

function Row({ row }: { row: AdminLogRow }) {
  const target = targetLink(row);
  return (
    <li className="border border-titanium-900 bg-obsidian-900/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[12px] font-mono uppercase tracking-wider text-titanium-300">
            <span className="font-bold text-titanium-50">{row.action}</span>
            <span className="text-titanium-500">·</span>
            <span>{row.target_type}</span>
          </div>
          <div className="text-[11px] text-titanium-400 mt-1 flex items-center gap-1.5">
            <User className="h-3 w-3" />
            <span className="font-mono">{row.actor_email ?? row.actor_user_id ?? 'unknown'}</span>
            <span className="text-titanium-600">·</span>
            <span>{new Date(row.created_at).toLocaleString('de-DE')}</span>
          </div>
          {row.target_id && (
            <div className="text-[11px] font-mono text-titanium-500 mt-0.5">
              target_id: {target ? <Link to={target} className="text-amber-300 hover:text-amber-200">{row.target_id}</Link> : row.target_id}
            </div>
          )}
        </div>
      </div>
      {Object.keys(row.payload ?? {}).length > 0 && (
        <pre className="mt-2 bg-obsidian-950 border border-titanium-900 text-[11px] font-mono text-titanium-300 p-2 overflow-x-auto">
{JSON.stringify(row.payload, null, 2)}
        </pre>
      )}
    </li>
  );
}

function targetLink(row: AdminLogRow): string | null {
  if (!row.target_id) return null;
  switch (row.target_type) {
    case 'governance_asset':    return `/governance/assets/${row.target_id}`;
    case 'governance_approval': {
      const evid = (row.payload as Record<string, unknown>)?.event_id;
      return typeof evid === 'string' ? `/governance/events/${evid}` : null;
    }
    default: return null;
  }
}
