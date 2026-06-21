// DocumentsView — erzeugte DSGVO-Compliance-Dokumente des Arbeitsbereichs.
//
// Lädt die echten generated_documents des aktiven Tenants (RLS-geschützt).
// Frühere Version: 8 hartkodierte Dokumente mit fabrizierten Versionen/
// Status/Verantwortlichen und toten Buttons — entfernt (Audit-Befund: keine
// Fake-Daten). Anzeigen/Export arbeiten jetzt mit echtem html_content.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Search, Download, Eye, Loader2 } from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import {
  fetchTenantDocuments, fetchDocumentHtml,
  DOC_TYPE_LABEL, DOC_TYPE_REF, type DocType, type GeneratedDoc,
} from './documentsApi';

// ── Document Card ──────────────────────────────────────────────────────────
function DocumentCard({ doc }: { doc: GeneratedDoc }) {
  const [busy, setBusy] = useState<'view' | 'export' | null>(null);

  async function openHtml(mode: 'view' | 'export') {
    setBusy(mode);
    try {
      const html = await fetchDocumentHtml(doc.id);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      if (mode === 'view') {
        window.open(url, '_blank', 'noopener,noreferrer');
        // Blob nach kurzer Zeit freigeben (Tab hat dann geladen).
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = `${doc.doc_type}_${doc.domain}_${doc.created_at.slice(0, 10)}.html`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    } catch {
      /* Fehler bewusst still — Button wird wieder aktiv, User kann erneut. */
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="bg-obsidian-900 border border-titanium-900 hover:border-titanium-700 transition-colors">
      <div className="flex items-start gap-3 p-4 border-b border-titanium-900">
        <div className="h-9 w-9 shrink-0 flex items-center justify-center bg-obsidian-800 border border-titanium-800">
          <FileText className="h-4 w-4 text-titanium-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-titanium-100 leading-tight">
            {DOC_TYPE_LABEL[doc.doc_type] ?? doc.doc_type}
          </h3>
          <p className="font-mono text-[10px] text-titanium-500 mt-0.5">
            {DOC_TYPE_REF[doc.doc_type] ?? doc.doc_type.toUpperCase()}
          </p>
        </div>
        <span className="font-mono text-[10px] uppercase text-titanium-500 border border-titanium-800 px-2 py-0.5">
          {doc.doc_type}
        </span>
      </div>

      <div className="grid grid-cols-3 divide-x divide-titanium-900 border-b border-titanium-900">
        <div className="px-3 py-2 min-w-0">
          <div className="font-mono text-[10px] text-titanium-600 uppercase">Domain</div>
          <div className="font-mono text-xs text-titanium-200 mt-0.5 truncate">{doc.domain}</div>
        </div>
        <div className="px-3 py-2">
          <div className="font-mono text-[10px] text-titanium-600 uppercase">Erstellt</div>
          <div className="font-mono text-xs text-titanium-200 mt-0.5">
            {new Date(doc.created_at).toLocaleDateString('de-DE')}
          </div>
        </div>
        <div className="px-3 py-2">
          <div className="font-mono text-[10px] text-titanium-600 uppercase">Engine</div>
          <div className="font-mono text-xs text-titanium-200 mt-0.5">{doc.methodology_version}</div>
        </div>
      </div>

      <div className="flex items-center p-3 gap-2">
        <button
          onClick={() => openHtml('view')}
          disabled={busy !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono text-titanium-300 border border-titanium-800 hover:bg-obsidian-800 transition-colors disabled:opacity-40"
        >
          {busy === 'view' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
          Anzeigen
        </button>
        <button
          onClick={() => openHtml('export')}
          disabled={busy !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono text-titanium-300 border border-titanium-800 hover:bg-obsidian-800 transition-colors disabled:opacity-40"
        >
          {busy === 'export' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
          Export
        </button>
      </div>
    </div>
  );
}

// ── DocumentsView ──────────────────────────────────────────────────────────
type DocFilter = 'alle' | DocType;

export function DocumentsView() {
  const { activeTenantId } = useTenant();
  const [filter, setFilter] = useState<DocFilter>('alle');
  const [search, setSearch] = useState('');
  const [docs, setDocs] = useState<GeneratedDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeTenantId) { setDocs([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchTenantDocuments(activeTenantId)
      .then((d) => { if (!cancelled) setDocs(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeTenantId]);

  const counts = useMemo(() => {
    const by = (t: DocType) => docs.filter((d) => d.doc_type === t).length;
    return { alle: docs.length, dse: by('dse'), avv: by('avv'), vvt: by('vvt'), tom: by('tom') };
  }, [docs]);

  const filtered = useMemo(() => docs.filter((doc) => {
    const matchesFilter = filter === 'alle' || doc.doc_type === filter;
    const q = search.toLowerCase();
    const matchesSearch = !q
      || doc.domain.toLowerCase().includes(q)
      || (DOC_TYPE_LABEL[doc.doc_type] ?? '').toLowerCase().includes(q)
      || (doc.company ?? '').toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  }), [docs, filter, search]);

  return (
    <div className="flex flex-col h-full bg-obsidian-950 text-titanium-100">
      {/* Header */}
      <div className="border-b border-titanium-900 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-display font-semibold text-titanium-100 tracking-tight">
              Dokumente
            </h1>
            <p className="font-mono text-xs text-titanium-500 mt-0.5">
              Erzeugte Compliance-Dokumente dieses Arbeitsbereichs · DSE · AVV · VVT · TOM
            </p>
          </div>
          <Link
            to="/audit"
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-xs font-mono hover:bg-teal-500 transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            Aus Audit generieren
          </Link>
        </div>
      </div>

      {/* Aktionsleiste */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-titanium-900 shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-titanium-600" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Dokument oder Domain suchen …"
            className="w-full bg-obsidian-900 border border-titanium-800 pl-9 pr-3 py-1.5 text-xs font-mono text-titanium-100 placeholder-titanium-600 outline-none focus:border-teal-700 transition-colors"
          />
        </div>
        <div className="flex items-center gap-0">
          {(['alle', 'dse', 'avv', 'vvt', 'tom'] as const).map((f) => {
            const labels: Record<DocFilter, string> = {
              alle: `Alle (${counts.alle})`,
              dse: `DSE (${counts.dse})`,
              avv: `AVV (${counts.avv})`,
              vvt: `VVT (${counts.vvt})`,
              tom: `TOM (${counts.tom})`,
            };
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-mono border transition-colors ${
                  filter === f
                    ? 'bg-obsidian-800 border-titanium-700 text-titanium-100'
                    : 'border-transparent text-titanium-500 hover:text-titanium-300'
                }`}
              >
                {labels[f]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dokument-Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <p className="font-mono text-xs text-titanium-500">Wird geladen …</p>
        ) : error ? (
          <p className="font-mono text-xs text-red-300">{error}</p>
        ) : !activeTenantId ? (
          <p className="font-mono text-xs text-titanium-500">Kein aktiver Arbeitsbereich.</p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-10 w-10 text-titanium-700 mb-3" />
            <p className="text-sm text-titanium-500">
              {docs.length === 0 ? 'Noch keine Dokumente erzeugt' : 'Keine Dokumente gefunden'}
            </p>
            <p className="font-mono text-xs text-titanium-600 mt-1">
              {docs.length === 0
                ? 'Compliance-Dokumente entstehen aus einem Audit.'
                : 'Filter oder Suche anpassen.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filtered.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
