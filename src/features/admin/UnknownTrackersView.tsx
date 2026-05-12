import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, AlertTriangle, Loader2, CheckCircle2, XCircle,
  ExternalLink,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { AuthGate } from '../kodee/connections/AuthGate';
import { getSupabase } from '../../lib/supabase';

/**
 * /admin/unknown-trackers — Review-Pipeline für 3rd-party Scripts die der
 * cookie-scan auf Customer-Domains findet aber noch nicht in der
 * tracker-registry.json klassifiziert sind.
 *
 * Workflow:
 *   1. cookie-scan → public.report_unknown_tracker(host, url, domain)
 *   2. Compliance-Lead reviewt hier wöchentlich (sortiert nach occurrence)
 *   3. Promote → manueller Eintrag in tracker-registry.json + reviewed=true
 *      mit registry_id (oder dismissed=true wenn no risk / CDN-Whitelist)
 */

interface UnknownTracker {
  id: string;
  script_host: string;
  sample_url: string;
  first_seen_on: string;
  occurrence_count: number;
  customer_domains: string[];
  suspected_category: string | null;
  suspected_risk: string | null;
  notes: string | null;
  reviewed: boolean;
  registry_id: string | null;
  dismissed: boolean;
  first_seen_at: string;
  last_seen_at: string;
}

type Filter = 'unreviewed' | 'reviewed' | 'dismissed' | 'all';

export function UnknownTrackersView() {
  return <AuthGate>{(session) => <Inner session={session} />}</AuthGate>;
}

function Inner({ session }: { session: Session }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<UnknownTracker[]>([]);
  const [filter, setFilter] = useState<Filter>('unreviewed');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    void (async () => {
      const { data: prof } = await sb.from('profiles')
        .select('is_super_admin').eq('id', session.user.id).maybeSingle();
      const isAdmin = !!prof?.is_super_admin;
      setAllowed(isAdmin);
      if (isAdmin) await load();
      else setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.user.id]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const sb = getSupabase();
      const { data, error: qerr } = await sb.from('unknown_trackers')
        .select('*')
        .order('occurrence_count', { ascending: false })
        .limit(200);
      if (qerr) throw qerr;
      setRows((data ?? []) as UnknownTracker[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }

  async function markPromoted(id: string, registryId: string) {
    setBusyId(id);
    try {
      const sb = getSupabase();
      await sb.from('unknown_trackers').update({
        reviewed: true,
        reviewed_by: session.user.id,
        reviewed_at: new Date().toISOString(),
        registry_id: registryId,
      }).eq('id', id);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function markDismissed(id: string, note: string) {
    setBusyId(id);
    try {
      const sb = getSupabase();
      await sb.from('unknown_trackers').update({
        dismissed: true,
        reviewed: true,
        reviewed_by: session.user.id,
        reviewed_at: new Date().toISOString(),
        notes: note,
      }).eq('id', id);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const filtered = rows.filter((r) => {
    if (filter === 'unreviewed') return !r.reviewed && !r.dismissed;
    if (filter === 'reviewed')   return r.reviewed && !r.dismissed;
    if (filter === 'dismissed')  return r.dismissed;
    return true;
  });

  const counts = {
    unreviewed: rows.filter((r) => !r.reviewed && !r.dismissed).length,
    reviewed:   rows.filter((r) => r.reviewed && !r.dismissed).length,
    dismissed:  rows.filter((r) => r.dismissed).length,
    all:        rows.length,
  };

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="font-display font-bold text-sm tracking-tight text-titanium-50">
          Admin · Unknown Trackers (Auto-Discovery)
        </div>
        <button onClick={() => void load()} className="ml-auto p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <main className="px-4 sm:px-6 py-6">
        <div className="max-w-6xl mx-auto">
          {allowed === false && (
            <div className="p-6 bg-obsidian-900 border border-amber-700">
              <AlertTriangle className="h-5 w-5 text-amber-400 inline mr-2" />
              Nur für Super-Admins.
            </div>
          )}

          {allowed && (
            <>
              <div className="flex flex-wrap gap-2 mb-5">
                <Chip active={filter === 'unreviewed'} onClick={() => setFilter('unreviewed')} label="Unreviewed" count={counts.unreviewed} accent="amber" />
                <Chip active={filter === 'reviewed'} onClick={() => setFilter('reviewed')} label="Promoted" count={counts.reviewed} accent="emerald" />
                <Chip active={filter === 'dismissed'} onClick={() => setFilter('dismissed')} label="Dismissed" count={counts.dismissed} />
                <Chip active={filter === 'all'} onClick={() => setFilter('all')} label="Alle" count={counts.all} />
              </div>

              <p className="text-xs text-titanium-500 mb-4 leading-relaxed">
                Listet 3rd-party-Scripts die der cookie-scan auf Customer-Domains findet aber NOCH NICHT in der
                <code className="text-titanium-300 mx-1">tracker-registry.json</code> klassifiziert sind.
                Workflow: Eintrag prüfen → entweder per Hand zur Registry hinzufügen + "Promoted" markieren,
                oder als CDN/no-risk dismissen.
              </p>

              {error && <div className="mb-4 p-3 bg-red-950/40 border border-red-800 text-red-300 text-sm">{error}</div>}

              {loading && <div className="text-titanium-400 text-sm flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Lade…</div>}

              {!loading && filtered.length === 0 && (
                <div className="p-8 bg-obsidian-900 border border-titanium-900 text-center text-titanium-400 text-sm">
                  Keine Einträge in dieser Kategorie.
                </div>
              )}

              <div className="space-y-2">
                {filtered.map((r) => (
                  <div key={r.id} className="p-4 bg-obsidian-900 border border-titanium-900">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm text-titanium-100 break-all">{r.script_host}</div>
                        <a href={r.sample_url} target="_blank" rel="noopener noreferrer" className="text-xs text-ai-cyan-400 break-all hover:underline inline-flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" /> {r.sample_url}
                        </a>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-xs">
                        <span className="font-mono text-titanium-500">×{r.occurrence_count}</span>
                        {r.reviewed && !r.dismissed && (
                          <span className="text-emerald-400 inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Promoted</span>
                        )}
                        {r.dismissed && (
                          <span className="text-titanium-500 inline-flex items-center gap-1"><XCircle className="h-3.5 w-3.5" /> Dismissed</span>
                        )}
                      </div>
                    </div>

                    <div className="text-xs text-titanium-500 mb-2">
                      Erstmals: {new Date(r.first_seen_at).toLocaleDateString('de-DE')} · Letzte: {new Date(r.last_seen_at).toLocaleDateString('de-DE')} · {r.customer_domains.length} Customer-Domain{r.customer_domains.length === 1 ? '' : 's'}
                    </div>

                    {r.customer_domains.length > 0 && (
                      <details className="text-xs text-titanium-400 mb-2">
                        <summary className="cursor-pointer hover:text-titanium-200">Customer-Domains anzeigen</summary>
                        <ul className="mt-1 pl-4 font-mono">
                          {r.customer_domains.slice(0, 20).map((d) => <li key={d}>{d}</li>)}
                          {r.customer_domains.length > 20 && <li className="text-titanium-500">…{r.customer_domains.length - 20} weitere</li>}
                        </ul>
                      </details>
                    )}

                    {r.notes && <div className="text-xs text-titanium-300 italic mb-2">{r.notes}</div>}

                    {!r.reviewed && !r.dismissed && (
                      <div className="flex gap-2 mt-3">
                        <button
                          disabled={busyId === r.id}
                          onClick={() => {
                            const id = window.prompt(`Registry-ID für "${r.script_host}"?\n(z.B. "google_analytics" — füge zuerst in tracker-registry.json hinzu)`);
                            if (id) void markPromoted(r.id, id);
                          }}
                          className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
                        >
                          ✓ Promoted to Registry
                        </button>
                        <button
                          disabled={busyId === r.id}
                          onClick={() => {
                            const note = window.prompt(`Warum dismissed? (z.B. "CDN, no tracking" oder "first-party CDN-Asset")`);
                            if (note) void markDismissed(r.id, note);
                          }}
                          className="px-3 py-1.5 text-xs font-bold border border-titanium-700 hover:border-titanium-500 text-titanium-300 disabled:opacity-50"
                        >
                          ✗ Dismiss (no risk)
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Chip({ active, onClick, label, count, accent }: {
  active: boolean; onClick: () => void; label: string; count: number;
  accent?: 'amber' | 'emerald';
}) {
  const accentClass = accent === 'amber' ? 'border-amber-700 text-amber-300'
    : accent === 'emerald' ? 'border-emerald-700 text-emerald-300'
    : 'border-titanium-700 text-titanium-300';
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider border transition-colors ${
        active ? `bg-obsidian-800 ${accentClass} border-current` : 'bg-obsidian-900 border-titanium-900 text-titanium-500 hover:border-titanium-700'
      }`}
    >
      {label} <span className="ml-1 text-titanium-500">({count})</span>
    </button>
  );
}
