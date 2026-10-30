import { useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import { KIND_LABEL, type KnowledgeHit, type KnowledgeKind } from './memory';

/** M7: Wissenssuche über Entscheidungen, Fragen und agent_memory (nur lesend). */
export function MemoryView() {
  const [query, setQuery] = useState('');
  const [kinds, setKinds] = useState<Record<KnowledgeKind, boolean>>({ decision: true, question: true, memory: true });
  const [hits, setHits] = useState<KnowledgeHit[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim()) return;
    if (!isSupabaseConfigured()) { setErr('Supabase nicht konfiguriert'); return; }
    setBusy(true); setErr(null);
    const selected = (Object.keys(kinds) as KnowledgeKind[]).filter((k) => kinds[k]);
    const { data, error } = await getSupabase().rpc('search_agent_knowledge', { p_query: query.trim(), p_kinds: selected, p_limit: 50, p_match_any: false });
    setBusy(false);
    if (error) { setErr(`Suche nicht verfügbar: ${error.message}`); setHits(null); return; }
    setHits((data ?? []) as KnowledgeHit[]);
  }

  return (
    <section aria-label="Gedächtnis" data-testid="memory-view">
      <h1 className="text-xl font-semibold">Gedächtnis &amp; Entscheidungsarchiv</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Durchsucht frühere Entscheidungen, Fragen und das Agenten-Gedächtnis dieses Mandanten. Treffer sind Hinweise, keine Freigaben.
      </p>
      <form onSubmit={(e) => void run(e)} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-1 flex-col text-xs text-zinc-400">
          Suchbegriff
          <input aria-label="Gedächtnis durchsuchen" value={query} onChange={(e) => setQuery(e.target.value)}
            className="mt-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100" />
        </label>
        {(Object.keys(KIND_LABEL) as KnowledgeKind[]).map((k) => (
          <label key={k} className="flex items-center gap-1 text-xs text-zinc-300">
            <input type="checkbox" checked={kinds[k]} onChange={(e) => setKinds((x) => ({ ...x, [k]: e.target.checked }))} />
            {KIND_LABEL[k]}
          </label>
        ))}
        <button type="submit" disabled={busy || !query.trim()} className="rounded border border-zinc-600 px-3 py-1 text-sm text-zinc-200 disabled:opacity-40">
          Suchen
        </button>
      </form>
      {err && <p role="status" className="mt-3 text-sm text-amber-200">{err}</p>}
      {hits && hits.length === 0 && <p data-testid="memory-empty" className="mt-3 text-sm text-zinc-400">Keine Treffer.</p>}
      {hits && hits.length > 0 && (
        <ul className="mt-3 space-y-2">
          {hits.map((h) => (
            <li key={`${h.kind}:${h.id}`} data-testid="memory-hit" className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-sm">
              <p className="text-xs text-zinc-500">{KIND_LABEL[h.kind]} · {h.status ?? 'Status UNBEKANNT'} · {h.agent ?? 'Agent UNBEKANNT'} · {new Date(h.created_at).toLocaleString('de-DE')}</p>
              <p className="mt-0.5 font-medium text-zinc-100">{h.title ?? '(ohne Titel)'}</p>
              {h.snippet && <p className="mt-0.5 text-xs text-zinc-400">{h.snippet}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
