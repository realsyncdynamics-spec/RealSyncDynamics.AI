import { useCallback, useEffect, useState } from 'react';
import { Wrench, ClipboardCopy, Check, Loader2, Plus, X } from 'lucide-react';
import {
  generateSnippet,
  listSnippets,
  markSnippetApplied,
  rejectSnippet,
  PATTERN_LABELS,
  PATTERN_REQUIRED_PARAMS,
  type RemediationPattern,
  type RemediationSnippet,
} from './remediationApi';

interface Props {
  tenantId: string;
  assetId: string;
}

const PATTERNS: RemediationPattern[] = [
  'csp_header_block',
  'consent_wrapper',
  'font_self_host',
  'tracker_dom_remove',
  'dsgvo_footer_block',
];

const STATUS_TONE: Record<string, string> = {
  suggested:   'border-amber-400/30 bg-amber-400/10 text-amber-300',
  reviewed:    'border-sky-400/30 bg-sky-400/10 text-sky-300',
  applied:     'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  rejected:    'border-rose-400/30 bg-rose-400/10 text-rose-300',
  superseded:  'border-silver-700/30 bg-obsidian-950/60 text-silver-500',
};

export function RemediationPanel({ tenantId, assetId }: Props) {
  const [snippets, setSnippets] = useState<RemediationSnippet[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [showGen, setShowGen]   = useState(false);

  const load = useCallback(() => {
    if (!tenantId) return;
    setLoading(true);
    listSnippets(tenantId, undefined, assetId).then((r) => {
      if (r.ok) {
        setSnippets(r.snippets ?? []);
        setError(null);
      } else {
        setError(r.error?.message ?? 'load failed');
      }
      setLoading(false);
    });
  }, [tenantId, assetId]);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="border border-titanium-900 bg-obsidian-900/60">
      <div className="flex items-center justify-between border-b border-titanium-900 px-4 py-3">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-titanium-100" />
          <h3 className="font-display font-semibold text-sm text-titanium-50">
            Fix-Empfehlungen
          </h3>
          <span className="font-mono text-[10px] text-titanium-500">
            {snippets.length} Snippet{snippets.length === 1 ? '' : 's'}
          </span>
        </div>
        <button
          onClick={() => setShowGen((v) => !v)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-titanium-100/30 hover:border-amber-400 text-titanium-200 hover:text-amber-300 text-xs font-medium transition-colors"
        >
          {showGen ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {showGen ? 'Abbrechen' : 'Generieren'}
        </button>
      </div>

      {showGen && <Generator tenantId={tenantId} assetId={assetId} onCreated={() => { setShowGen(false); load(); }} />}

      <div className="p-4">
        {loading && (
          <div className="flex items-center gap-2 text-xs text-titanium-400">
            <Loader2 className="h-3 w-3 animate-spin" /> Lade Snippets…
          </div>
        )}
        {error && (
          <div className="text-xs text-rose-300">Fehler: {error}</div>
        )}
        {!loading && !error && snippets.length === 0 && (
          <div className="text-xs text-titanium-500">
            Noch keine Snippets für dieses Asset. Über „Generieren" einen Fix-Vorschlag erstellen.
          </div>
        )}
        <ul className="space-y-3">
          {snippets.map((s) => (
            <SnippetCard key={s.id} snippet={s} onChange={load} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function Generator({
  tenantId,
  assetId,
  onCreated,
}: {
  tenantId: string;
  assetId: string;
  onCreated: () => void;
}) {
  const [pattern, setPattern] = useState<RemediationPattern>('csp_header_block');
  const [params, setParams]   = useState<Record<string, string>>({});
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState<string | null>(null);

  const required = PATTERN_REQUIRED_PARAMS[pattern];
  const canSubmit = required.every((p) => params[p]?.trim());

  const submit = async () => {
    setBusy(true);
    setErr(null);
    const r = await generateSnippet({ tenant_id: tenantId, asset_id: assetId, pattern, params });
    setBusy(false);
    if (r.ok) {
      setParams({});
      onCreated();
    } else {
      setErr(r.error?.message ?? 'generate failed');
    }
  };

  return (
    <div className="border-b border-titanium-900 bg-obsidian-950/60 p-4 space-y-3">
      <div>
        <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-titanium-500 mb-1.5 block">
          Pattern
        </label>
        <select
          value={pattern}
          onChange={(e) => { setPattern(e.target.value as RemediationPattern); setParams({}); }}
          className="w-full bg-obsidian-900 border border-titanium-900 text-titanium-100 text-sm px-2 py-1.5 rounded-none outline-none focus:border-amber-400"
        >
          {PATTERNS.map((p) => (
            <option key={p} value={p}>{PATTERN_LABELS[p]}</option>
          ))}
        </select>
      </div>
      {required.length > 0 ? (
        required.map((key) => (
          <div key={key}>
            <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-titanium-500 mb-1.5 block">
              {key}
            </label>
            <input
              value={params[key] ?? ''}
              onChange={(e) => setParams({ ...params, [key]: e.target.value })}
              placeholder={placeholderFor(key)}
              className="w-full bg-obsidian-900 border border-titanium-900 text-titanium-100 text-sm px-2 py-1.5 rounded-none outline-none focus:border-amber-400 font-mono"
            />
          </div>
        ))
      ) : (
        <p className="text-xs text-titanium-500">Keine Parameter erforderlich — Default-Werte werden verwendet.</p>
      )}
      {err && <div className="text-xs text-rose-300">Fehler: {err}</div>}
      <div className="flex justify-end">
        <button
          onClick={submit}
          disabled={!canSubmit || busy}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-400 text-black text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-amber-300 transition-colors"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wrench className="h-3 w-3" />}
          Snippet erzeugen
        </button>
      </div>
    </div>
  );
}

function SnippetCard({
  snippet,
  onChange,
}: {
  snippet: RemediationSnippet;
  onChange: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy]     = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet.snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard rejected */ }
  };

  const apply = async () => {
    setBusy(true);
    await markSnippetApplied(snippet.id);
    setBusy(false);
    onChange();
  };

  const reject = async () => {
    setBusy(true);
    await rejectSnippet(snippet.id);
    setBusy(false);
    onChange();
  };

  const tone = STATUS_TONE[snippet.status] ?? STATUS_TONE.suggested;

  return (
    <li className="border border-titanium-900 bg-obsidian-950/60">
      <header className="flex items-start justify-between gap-3 px-3 py-2.5 border-b border-titanium-900">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className={`text-[10px] font-mono uppercase tracking-[0.18em] border px-1.5 py-0.5 ${tone}`}>
              {snippet.status}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-titanium-500">
              {snippet.pattern} · {snippet.target_lang}
            </span>
          </div>
          <h4 className="font-display font-semibold text-sm text-titanium-50 leading-snug">{snippet.title}</h4>
        </div>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1 px-2 py-1 border border-titanium-900 hover:border-amber-400 text-titanium-300 hover:text-amber-300 text-[11px] transition-colors shrink-0"
          aria-label="Snippet kopieren"
        >
          {copied ? <Check className="h-3 w-3" /> : <ClipboardCopy className="h-3 w-3" />}
          {copied ? 'Kopiert' : 'Copy'}
        </button>
      </header>

      <div className="p-3 space-y-2.5">
        <p className="text-xs text-titanium-400 leading-relaxed">{snippet.rationale}</p>
        {snippet.applies_to && (
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-titanium-500">
            applies to: <span className="text-titanium-300">{snippet.applies_to}</span>
          </div>
        )}
        <pre className="bg-obsidian-950 border border-titanium-900 p-2.5 text-[11px] font-mono text-silver-200 overflow-x-auto leading-relaxed max-h-64">
          {snippet.snippet}
        </pre>
        {snippet.regulation_refs?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {snippet.regulation_refs.map((ref) => (
              <span key={ref} className="text-[10px] font-mono uppercase tracking-wider bg-titanium-900/60 text-titanium-300 border border-titanium-800 px-1.5 py-0.5">
                {ref}
              </span>
            ))}
          </div>
        )}
        {snippet.status === 'suggested' && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={apply}
              disabled={busy}
              className="px-2.5 py-1 bg-emerald-400/10 border border-emerald-400/30 text-emerald-300 hover:bg-emerald-400/20 text-[11px] font-medium transition-colors disabled:opacity-40"
            >
              Als angewendet markieren
            </button>
            <button
              onClick={reject}
              disabled={busy}
              className="px-2.5 py-1 border border-titanium-900 hover:border-rose-400 text-titanium-300 hover:text-rose-300 text-[11px] transition-colors disabled:opacity-40"
            >
              Ablehnen
            </button>
          </div>
        )}
        {snippet.status === 'applied' && snippet.applied_by && (
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-300">
            angewendet · {snippet.applied_by} · {snippet.applied_at && new Date(snippet.applied_at).toLocaleString('de-DE')}
          </div>
        )}
      </div>
    </li>
  );
}

function placeholderFor(key: string): string {
  switch (key) {
    case 'blocked_host':  return 'z. B. www.googletagmanager.com';
    case 'script_src':    return 'z. B. https://connect.facebook.net/en_US/fbevents.js';
    case 'tracker_host':  return 'z. B. www.google-analytics.com';
    case 'company_name':  return 'z. B. Beispiel GmbH';
    default:              return '';
  }
}
