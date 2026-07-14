import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, Search, Loader2, AlertTriangle,
  ExternalLink, Info,
} from 'lucide-react';
import { AuthGate } from '../kodee/connections/AuthGate';
import { useTenant } from '../../core/access/TenantProvider';
import { getSupabase } from '../../lib/supabase';

type LegalFramework =
  | 'gdpr' | 'ai_act' | 'nis2' | 'dsa' | 'data_act'
  | 'eidas' | 'ttdsg' | 'c2pa' | 'other';

const FRAMEWORK_LABEL: Record<LegalFramework, string> = {
  gdpr:     'DSGVO',
  ai_act:   'EU AI Act',
  nis2:     'NIS-2',
  dsa:      'DSA',
  data_act: 'Data Act',
  eidas:    'eIDAS',
  ttdsg:    'TDDDG',
  c2pa:     'C2PA',
  other:    'Sonstige',
};

const FRAMEWORK_COLOR: Record<LegalFramework, string> = {
  gdpr:     'border-blue-500/40 bg-blue-500/10 text-blue-200',
  ai_act:   'border-purple-500/40 bg-purple-500/10 text-purple-200',
  nis2:     'border-amber-500/40 bg-amber-500/10 text-amber-200',
  dsa:      'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  data_act: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
  eidas:    'border-indigo-500/40 bg-indigo-500/10 text-indigo-200',
  ttdsg:    'border-orange-500/40 bg-orange-500/10 text-orange-200',
  c2pa:     'border-teal-500/40 bg-teal-500/10 text-teal-200',
  other:    'border-titanium-700 bg-obsidian-950 text-titanium-400',
};

interface RetrievalResult {
  heading:           string | null;
  chunk_text:        string;
  framework:         LegalFramework;
  jurisdiction:      string;
  title:             string;
  source_url:        string;
  citation_anchor:   string | null;
  source_identifier: string | null;
  published_at:      string | null;
  rank_score:        number;
  disclaimer:        string;
}

export function LegalRagView() {
  return <AuthGate>{() => <LegalRagInner />}</AuthGate>;
}

function LegalRagInner() {
  const { activeTenantId } = useTenant();
  const [query, setQuery] = useState('');
  const [framework, setFramework] = useState<LegalFramework | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<RetrievalResult[] | null>(null);
  const [searchMode, setSearchMode] = useState<'hybrid' | 'fts' | null>(null);
  const [disclaimer, setDisclaimer] = useState<string | null>(null);

  async function search() {
    const q = query.trim();
    if (!q || !activeTenantId) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setSearchMode(null);

    try {
      const sb = getSupabase();
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setError('Bitte erneut anmelden.'); return; }

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/legal-retrieve`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({
            tenant_id:  activeTenantId,
            query:      q,
            top_k:      8,
            framework:  framework || undefined,
          }),
        },
      );
      const body = await resp.json();
      if (!resp.ok || !body.ok) {
        setError(body.error?.message ?? `Fehler ${resp.status}`);
        return;
      }
      setResults(body.results as RetrievalResult[]);
      setSearchMode(body.search_mode);
      setDisclaimer(body.platform_disclaimer);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="flex h-14 items-center gap-3 border-b border-titanium-900 bg-obsidian-900 px-4">
        <Link to="/app" className="p-1.5 text-titanium-400 hover:bg-obsidian-800 hover:text-titanium-200">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-700">
            <BookOpen className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="font-display text-sm font-semibold tracking-tight text-titanium-50">
              Legal-RAG Wissensdatenbank
            </h1>
            <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
              DSGVO · AI Act · NIS-2 · DSA · C2PA
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 p-4 md:p-6">
        <div className="border border-titanium-800 bg-obsidian-900 p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 items-center gap-2 border border-titanium-800 bg-obsidian-950 px-3 py-2 focus-within:border-security-500">
              <Search className="h-4 w-4 shrink-0 text-titanium-500" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void search()}
                placeholder={'z. B. „Auftragsverarbeitungsvertrag“ oder „Hochrisiko-KI“'}
                className="flex-1 bg-transparent text-sm text-titanium-100 outline-none placeholder:text-titanium-600"
              />
            </div>
            <select
              value={framework}
              onChange={(e) => setFramework(e.target.value as LegalFramework | '')}
              className="border border-titanium-800 bg-obsidian-950 px-3 py-2 font-mono text-[11px] text-titanium-200 outline-none focus:border-security-500"
            >
              <option value="">Alle Gesetze</option>
              {(Object.entries(FRAMEWORK_LABEL) as [LegalFramework, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void search()}
              disabled={loading || !query.trim() || !activeTenantId}
              className="flex items-center justify-center gap-1.5 border border-security-500 bg-security-500 px-4 py-2 font-mono text-[11px] uppercase tracking-wide text-white hover:bg-security-600 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              Suchen
            </button>
          </div>
        </div>

        {!activeTenantId && (
          <p className="text-sm text-amber-300">Kein Workspace aktiv — bitte Workspace auswählen.</p>
        )}

        {error && (
          <div className="flex items-start gap-2 border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {results !== null && (
          <>
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                {results.length} Treffer
                {searchMode === 'hybrid' && ' · Hybrid-Suche (Vektor + Volltext)'}
                {searchMode === 'fts' && ' · Volltext-Suche'}
              </p>
            </div>

            {results.length === 0 ? (
              <p className="border border-titanium-800 bg-obsidian-900 p-6 text-center text-sm text-titanium-400">
                Keine Treffer. Probiere andere Suchbegriffe oder entferne den Filter.
              </p>
            ) : (
              <div className="space-y-3">
                {results.map((r, idx) => (
                  <ResultCard key={idx} result={r} />
                ))}
              </div>
            )}

            {disclaimer && (
              <div className="flex items-start gap-2 border border-titanium-800 bg-obsidian-900 p-3 text-xs text-titanium-400">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-titanium-500" />
                <span>{disclaimer}</span>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function ResultCard({ result }: { result: RetrievalResult }) {
  const fwCls = FRAMEWORK_COLOR[result.framework] ?? FRAMEWORK_COLOR.other;
  const citationUrl = result.citation_anchor
    ? `${result.source_url}${result.citation_anchor}`
    : result.source_url;

  return (
    <article className="border border-titanium-800 bg-obsidian-900">
      <header className="flex items-start justify-between gap-3 border-b border-titanium-800 p-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide ${fwCls}`}>
              {FRAMEWORK_LABEL[result.framework] ?? result.framework}
            </span>
            {result.heading && (
              <span className="font-mono text-[11px] font-semibold text-titanium-200">
                {result.heading}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate font-mono text-[10px] text-titanium-500">{result.title}</p>
        </div>
        <a
          href={citationUrl}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-titanium-500 hover:text-titanium-200"
          title="Originalquelle öffnen"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </header>
      <p className="p-3 text-sm leading-relaxed text-titanium-200">{result.chunk_text}</p>
      <footer className="flex items-center justify-between border-t border-titanium-800 px-3 py-2">
        <span className="font-mono text-[10px] text-titanium-500">
          {result.source_identifier ?? result.source_url}
          {result.published_at && ` · ${new Date(result.published_at).getFullYear()}`}
        </span>
        <span className="font-mono text-[10px] text-titanium-600 tabular-nums">
          Score {result.rank_score.toFixed(4)}
        </span>
      </footer>
    </article>
  );
}
