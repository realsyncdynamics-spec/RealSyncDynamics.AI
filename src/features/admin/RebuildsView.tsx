import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, AlertTriangle, Loader2, CheckCircle2, Clock, XCircle,
  PlayCircle, ExternalLink, ChevronRight, ChevronDown,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { AuthGate } from '../kodee/connections/AuthGate';
import { getSupabase } from '../../lib/supabase';

/**
 * /admin/rebuilds — Live-Tracking laufender DSGVO-Website-Rebuilds.
 *
 * Liest website_rebuilds + website_rebuild_steps via RLS (super_admin_read).
 * Resume-Button POSTet { rebuild_id } an die rebuild-website Edge-Function —
 * die führt den Workflow ab dem letzten erfolgreichen Step weiter.
 */

interface Rebuild {
  id: string;
  tenant_id: string | null;
  audit_id: string | null;
  source_url: string;
  source_domain: string;
  customer_email: string;
  company: string | null;
  tier: string;
  status: string;
  current_step: string | null;
  completed_steps: string[];
  preview_url: string | null;
  bundle_path: string | null;
  error_code: string | null;
  error_detail: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface RebuildStep {
  id: string;
  rebuild_id: string;
  step_name: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  summary: string | null;
  metadata: Record<string, unknown>;
  error_detail: string | null;
  created_at: string;
}

type StatusFilter = 'all' | 'queued' | 'running' | 'preview_ready' | 'failed';

export function RebuildsView() {
  return <AuthGate>{(session) => <Inner session={session} />}</AuthGate>;
}

function Inner({ session }: { session: Session }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Rebuild[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [steps, setSteps] = useState<Record<string, RebuildStep[]>>({});
  const [resumeBusy, setResumeBusy] = useState<string | null>(null);

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
      const { data, error: qerr } = await sb.from('website_rebuilds')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (qerr) throw qerr;
      setRows((data ?? []) as Rebuild[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }

  async function loadSteps(rebuildId: string) {
    const sb = getSupabase();
    const { data, error: qerr } = await sb.from('website_rebuild_steps')
      .select('*')
      .eq('rebuild_id', rebuildId)
      .order('created_at', { ascending: true });
    if (qerr) {
      setError(qerr.message);
      return;
    }
    setSteps((s) => ({ ...s, [rebuildId]: (data ?? []) as RebuildStep[] }));
  }

  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      if (!steps[id]) void loadSteps(id);
    }
  }

  async function resume(rebuildId: string) {
    setResumeBusy(rebuildId);
    setError(null);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL fehlt');
      const sb = getSupabase();
      const { data: { session: s } } = await sb.auth.getSession();
      if (!s) throw new Error('Nicht eingeloggt');

      const r = await fetch(`${supabaseUrl}/functions/v1/rebuild-website`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${s.access_token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ rebuild_id: rebuildId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message ?? `Resume fehlgeschlagen (${r.status})`);
      await load();
      await loadSteps(rebuildId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Resume fehlgeschlagen');
    } finally {
      setResumeBusy(null);
    }
  }

  const filtered = rows.filter((r) => filter === 'all' ? true : r.status === filter);

  const counts = {
    all: rows.length,
    queued: rows.filter((r) => r.status === 'queued').length,
    running: rows.filter((r) => r.status === 'running').length,
    preview_ready: rows.filter((r) => r.status === 'preview_ready').length,
    failed: rows.filter((r) => r.status === 'failed').length,
  };

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="font-display font-bold text-sm tracking-tight text-titanium-50">
          Admin · Website-Rebuilds
        </div>
        <button
          onClick={() => void load()}
          className="ml-auto p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200"
          title="Neu laden"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <main className="px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-6xl mx-auto">
          {allowed === false && (
            <div className="p-6 bg-obsidian-900 border border-amber-700 rounded-none flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-display font-bold text-titanium-50 mb-1">Kein Zugriff</div>
                <p className="text-sm text-titanium-300">Diese Seite ist nur für Super-Admins.</p>
              </div>
            </div>
          )}

          {allowed && (
            <>
              <div className="flex flex-wrap gap-2 mb-5">
                <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label="Alle" count={counts.all} />
                <FilterChip active={filter === 'queued'} onClick={() => setFilter('queued')} label="Queued" count={counts.queued} />
                <FilterChip active={filter === 'running'} onClick={() => setFilter('running')} label="Läuft" count={counts.running} accent="ai-cyan" />
                <FilterChip active={filter === 'preview_ready'} onClick={() => setFilter('preview_ready')} label="Preview bereit" count={counts.preview_ready} accent="emerald" />
                <FilterChip active={filter === 'failed'} onClick={() => setFilter('failed')} label="Failed" count={counts.failed} accent="red" />
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-950/40 border border-red-800 text-red-300 text-sm">
                  {error}
                </div>
              )}

              {loading && (
                <div className="text-titanium-400 text-sm flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Lade…
                </div>
              )}

              {!loading && filtered.length === 0 && (
                <div className="p-8 bg-obsidian-900 border border-titanium-900 text-center text-titanium-400 text-sm">
                  Keine Rebuilds in dieser Kategorie.
                </div>
              )}

              <div className="space-y-2">
                {filtered.map((r) => (
                  <RebuildCard
                    key={r.id}
                    rebuild={r}
                    expanded={expandedId === r.id}
                    steps={steps[r.id]}
                    onToggle={() => toggleExpand(r.id)}
                    onResume={() => void resume(r.id)}
                    resumeBusy={resumeBusy === r.id}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function FilterChip({ active, onClick, label, count, accent }: {
  active: boolean; onClick: () => void; label: string; count: number;
  accent?: 'ai-cyan' | 'emerald' | 'red';
}) {
  const accentClass = accent === 'ai-cyan' ? 'border-ai-cyan-700 text-ai-cyan-300'
    : accent === 'emerald' ? 'border-emerald-700 text-emerald-300'
    : accent === 'red' ? 'border-red-700 text-red-300'
    : 'border-titanium-700 text-titanium-300';
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider border rounded-none transition-colors ${
        active
          ? `bg-obsidian-800 ${accentClass} border-current`
          : 'bg-obsidian-900 border-titanium-900 text-titanium-500 hover:border-titanium-700 hover:text-titanium-300'
      }`}
    >
      {label} <span className="ml-1 text-titanium-500">({count})</span>
    </button>
  );
}

function RebuildCard({ rebuild, expanded, steps, onToggle, onResume, resumeBusy }: {
  rebuild: Rebuild;
  expanded: boolean;
  steps: RebuildStep[] | undefined;
  onToggle: () => void;
  onResume: () => void;
  resumeBusy: boolean;
}) {
  const created = new Date(rebuild.created_at).toLocaleString('de-DE');
  const canResume = rebuild.status === 'failed' || rebuild.status === 'queued';

  return (
    <div className="bg-obsidian-900 border border-titanium-900">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center gap-3 text-left hover:bg-obsidian-800/50 transition-colors"
      >
        {expanded ? <ChevronDown className="h-4 w-4 text-titanium-500 shrink-0" /> : <ChevronRight className="h-4 w-4 text-titanium-500 shrink-0" />}
        <StatusBadge status={rebuild.status} />
        <div className="flex-1 min-w-0">
          <div className="font-mono text-sm text-titanium-100 truncate">{rebuild.source_domain}</div>
          <div className="text-xs text-titanium-500 truncate">{rebuild.customer_email} · {created}</div>
        </div>
        <span className="text-[10px] uppercase font-mono tracking-wider text-titanium-500 px-2 py-1 border border-titanium-900 hidden sm:inline">
          {rebuild.tier}
        </span>
        {rebuild.preview_url && (
          <a
            href={rebuild.preview_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-emerald-400 hover:text-emerald-300 p-1.5"
            title="Preview öffnen"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </button>

      {expanded && (
        <div className="border-t border-titanium-900 p-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <KV label="Source" value={rebuild.source_url} mono />
            <KV label="Tier" value={rebuild.tier} />
            <KV label="Audit" value={rebuild.audit_id ?? '—'} mono />
            <KV label="Tenant" value={rebuild.tenant_id ?? '—'} mono />
            <KV label="Started" value={rebuild.started_at ? new Date(rebuild.started_at).toLocaleString('de-DE') : '—'} />
            <KV label="Completed" value={rebuild.completed_at ? new Date(rebuild.completed_at).toLocaleString('de-DE') : '—'} />
          </div>

          {rebuild.error_code && (
            <div className="p-3 bg-red-950/40 border border-red-800 text-xs">
              <div className="font-mono text-red-300 font-bold mb-1">{rebuild.error_code}</div>
              <div className="text-red-400 break-all">{rebuild.error_detail}</div>
            </div>
          )}

          <div>
            <div className="text-xs uppercase font-mono tracking-wider text-titanium-500 mb-2">Step-Timeline</div>
            {!steps && <div className="text-xs text-titanium-500 flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> lade Steps…</div>}
            {steps && steps.length === 0 && <div className="text-xs text-titanium-500">Noch keine Steps geloggt.</div>}
            {steps && steps.length > 0 && (
              <ol className="space-y-1.5">
                {steps.map((s) => (
                  <li key={s.id} className="flex items-start gap-2 text-xs">
                    <StepIcon status={s.status} />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-titanium-200">
                        {s.step_name}
                        {s.duration_ms !== null && (
                          <span className="ml-2 text-titanium-500">({s.duration_ms}ms)</span>
                        )}
                      </div>
                      {s.summary && <div className="text-titanium-500">{s.summary}</div>}
                      {s.error_detail && <div className="text-red-400 break-all">{s.error_detail}</div>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {canResume && (
            <div className="pt-3 border-t border-titanium-900">
              <button
                onClick={onResume}
                disabled={resumeBusy}
                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-none bg-brass-500 hover:bg-brass-400 text-obsidian-950 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {resumeBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlayCircle className="h-3 w-3" />}
                {resumeBusy ? 'Resume läuft…' : (rebuild.status === 'failed' ? 'Resume nach Failure' : 'Manuell starten')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    queued:        { label: 'Queued',  cls: 'border-titanium-700 text-titanium-300' },
    running:       { label: 'Läuft',   cls: 'border-ai-cyan-700 text-ai-cyan-300 bg-ai-cyan-950/30' },
    preview_ready: { label: 'Bereit',  cls: 'border-emerald-700 text-emerald-300 bg-emerald-950/30' },
    live:          { label: 'Live',    cls: 'border-emerald-600 text-emerald-200 bg-emerald-900/40' },
    failed:        { label: 'Failed',  cls: 'border-red-700 text-red-300 bg-red-950/30' },
    cancelled:     { label: 'Abgebr.', cls: 'border-titanium-700 text-titanium-500' },
  };
  const m = map[status] ?? { label: status, cls: 'border-titanium-700 text-titanium-300' };
  return (
    <span className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border rounded-none shrink-0 ${m.cls}`}>
      {m.label}
    </span>
  );
}

function StepIcon({ status }: { status: string }) {
  if (status === 'success') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />;
  if (status === 'failed') return <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />;
  if (status === 'running') return <Loader2 className="h-3.5 w-3.5 text-ai-cyan-400 shrink-0 mt-0.5 animate-spin" />;
  if (status === 'skipped') return <ChevronRight className="h-3.5 w-3.5 text-titanium-500 shrink-0 mt-0.5" />;
  return <Clock className="h-3.5 w-3.5 text-titanium-500 shrink-0 mt-0.5" />;
}

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-mono text-titanium-500">{label}</div>
      <div className={`text-titanium-200 break-all ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}
