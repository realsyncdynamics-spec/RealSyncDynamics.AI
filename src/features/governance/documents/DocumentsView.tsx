// DocumentsView — DSGVO-Dokumentengenerator
// Dokument-Management mit Generierungsfunktion, angebunden an die
// generate-document Edge Function und public.generated_documents (RLS).
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText,
  Plus,
  Search,
  Download,
  Eye,
  Edit,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Clock,
  XCircle,
  Loader2,
  X,
  ExternalLink,
} from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import {
  fetchTenantDocuments,
  generateDocument,
  openHtmlInNewTab,
  downloadHtml,
  buildDocFilename,
  isGeneratableDocType,
  DOC_TYPE_LABELS,
  DOC_TYPE_REFERENCES,
  GENERATABLE_DOC_TYPES,
  type GeneratableDocType,
  type DbGeneratedDocument,
} from './documentsApi';
import { listDpias, type DbDpia } from '../dpiasApi';
import type { DpiaStatus } from '../types';
import { AuthGate } from '../../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from '../withPerformanceMonitoring';

// ── Typen ──────────────────────────────────────────────────────────────────
type DocStatus = 'aktuell' | 'veraltet' | 'entwurf' | 'fehlend';

interface GovernanceDoc {
  id: string;
  title: string;
  subtitle: string;
  reference: string;
  status: DocStatus;
  updatedAt: string;
  version: string;
  owner: string;
  // Laufzeit-Daten aus generated_documents (sofern vorhanden)
  docType?: GeneratableDocType;
  auditId?: string | null;
  html?: string | null;
  methodologyVersion?: string;
  domain?: string;
}

// ── Dokument-Definitionen (Fallback / Vorlagenkatalog) ──────────────────────
const DOCUMENTS: GovernanceDoc[] = [
  {
    id: 'dse',
    title: 'Datenschutzerklärung',
    subtitle: 'DSE',
    reference: 'Art. 13/14 DSGVO',
    status: 'aktuell',
    updatedAt: '14.06.2026',
    version: 'v3.2',
    owner: 'DSB',
    docType: 'dse',
  },
  {
    id: 'avv',
    title: 'Auftragsverarbeitungsvertrag',
    subtitle: 'AVV',
    reference: 'Art. 28 DSGVO',
    status: 'aktuell',
    updatedAt: '01.06.2026',
    version: 'v2.1',
    owner: 'Legal',
    docType: 'avv',
  },
  {
    id: 'vvt',
    title: 'Verarbeitungsverzeichnis',
    subtitle: 'VVT',
    reference: 'Art. 30 DSGVO',
    status: 'veraltet',
    updatedAt: '15.03.2026',
    version: 'v1.8',
    owner: 'DSB',
    docType: 'vvt',
  },
  {
    id: 'tom',
    title: 'Technische & Org. Maßnahmen',
    subtitle: 'TOM',
    reference: 'Art. 32 DSGVO',
    status: 'aktuell',
    updatedAt: '02.05.2026',
    version: 'v2.0',
    owner: 'IT-Security',
    docType: 'tom',
  },
  {
    id: 'impressum',
    title: 'Impressum',
    subtitle: 'IMP',
    reference: 'TMG §5',
    status: 'aktuell',
    updatedAt: '10.01.2026',
    version: 'v1.0',
    owner: 'GF',
  },
  {
    id: 'dsfa',
    title: 'Datenschutz-Folgenabschätzung',
    subtitle: 'DSFA',
    reference: 'Art. 35 DSGVO',
    status: 'entwurf',
    updatedAt: '12.06.2026',
    version: 'v0.6',
    owner: 'DSB',
  },
  {
    id: 'ai-act',
    title: 'EU AI Act Konformitätserklärung',
    subtitle: 'KE',
    reference: 'EU AI Act Art. 47',
    status: 'fehlend',
    updatedAt: '—',
    version: '—',
    owner: '—',
  },
  {
    id: 'consent',
    title: 'Einwilligungsdokumentation',
    subtitle: 'ED',
    reference: 'Art. 7 DSGVO',
    status: 'veraltet',
    updatedAt: '20.02.2026',
    version: 'v1.3',
    owner: 'Marketing',
  },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Überlagert den Vorlagenkatalog mit echten generierten Dokumenten des
 * Mandanten. Pro doc_type wird das neueste Dokument verwendet.
 */
function mergeDocuments(base: GovernanceDoc[], rows: DbGeneratedDocument[]): GovernanceDoc[] {
  const latestByType = new Map<string, DbGeneratedDocument>();
  for (const row of rows) {
    if (!latestByType.has(row.doc_type)) latestByType.set(row.doc_type, row);
  }
  return base.map((doc) => {
    const row = doc.docType ? latestByType.get(doc.docType) : undefined;
    if (!row) return doc;
    return {
      ...doc,
      status: 'aktuell' as DocStatus,
      updatedAt: formatDate(row.created_at),
      version: `v${row.methodology_version}`,
      html: row.html_content,
      auditId: row.audit_id,
      methodologyVersion: row.methodology_version,
      domain: row.domain,
    };
  });
}

// ── Status Badge ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: DocStatus }) {
  const configs: Record<DocStatus, { icon: React.ReactNode; label: string; classes: string }> = {
    aktuell: {
      icon: <CheckCircle className="h-3 w-3" />,
      label: 'Aktuell',
      classes: 'bg-teal-600/20 border-teal-600/40 text-teal-400',
    },
    veraltet: {
      icon: <AlertTriangle className="h-3 w-3" />,
      label: 'Veraltet',
      classes: 'bg-amber-600/20 border-amber-600/40 text-amber-400',
    },
    entwurf: {
      icon: <Clock className="h-3 w-3" />,
      label: 'Entwurf',
      classes: 'bg-blue-600/20 border-blue-600/40 text-blue-400',
    },
    fehlend: {
      icon: <XCircle className="h-3 w-3" />,
      label: 'Fehlend',
      classes: 'bg-red-600/20 border-red-600/40 text-red-400',
    },
  };
  const { icon, label, classes } = configs[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 border font-mono text-[10px] ${classes}`}>
      {icon}
      {label}
    </span>
  );
}

// ── Document Card ──────────────────────────────────────────────────────────
interface CardHandlers {
  onView: (doc: GovernanceDoc) => void;
  onEdit: (doc: GovernanceDoc) => void;
  onExport: (doc: GovernanceDoc) => void;
  onGenerate: (doc: GovernanceDoc) => void;
  busyId: string | null;
}

function DocumentCard({ doc, handlers }: { doc: GovernanceDoc; handlers: CardHandlers }) {
  const generatable = doc.docType && isGeneratableDocType(doc.docType);
  const hasHtml = Boolean(doc.html);
  const busy = handlers.busyId === doc.id;
  return (
    <div className="bg-obsidian-900 border border-titanium-900 hover:border-titanium-700 transition-colors">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 border-b border-titanium-900">
        <div className="h-9 w-9 shrink-0 flex items-center justify-center bg-obsidian-800 border border-titanium-800">
          <FileText className="h-4 w-4 text-titanium-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-titanium-100 leading-tight">{doc.title}</h3>
              <p className="font-mono text-[10px] text-titanium-500 mt-0.5">{doc.reference}</p>
            </div>
            <StatusBadge status={doc.status} />
          </div>
        </div>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-3 divide-x divide-titanium-900 border-b border-titanium-900">
        <div className="px-3 py-2">
          <div className="font-mono text-[10px] text-titanium-600 uppercase">Version</div>
          <div className="font-mono text-xs text-titanium-200 mt-0.5">{doc.version}</div>
        </div>
        <div className="px-3 py-2">
          <div className="font-mono text-[10px] text-titanium-600 uppercase">Aktualisiert</div>
          <div className="font-mono text-xs text-titanium-200 mt-0.5">{doc.updatedAt}</div>
        </div>
        <div className="px-3 py-2">
          <div className="font-mono text-[10px] text-titanium-600 uppercase">Verantwortlich</div>
          <div className="font-mono text-xs text-titanium-200 mt-0.5">{doc.owner}</div>
        </div>
      </div>

      {/* Aktionen */}
      <div className="flex items-center p-3 gap-2">
        <button
          onClick={() => handlers.onView(doc)}
          disabled={doc.status === 'fehlend' || !hasHtml}
          title={!hasHtml ? 'Noch kein generiertes Dokument vorhanden' : 'Dokument anzeigen'}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono text-titanium-300 border border-titanium-800 hover:bg-obsidian-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Eye className="h-3 w-3" />
          Anzeigen
        </button>
        <button
          onClick={() => handlers.onEdit(doc)}
          disabled={doc.status === 'fehlend' || !hasHtml}
          title={!hasHtml ? 'Noch kein generiertes Dokument vorhanden' : 'Dokument bearbeiten'}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono text-titanium-300 border border-titanium-800 hover:bg-obsidian-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Edit className="h-3 w-3" />
          Bearbeiten
        </button>
        <button
          onClick={() => handlers.onExport(doc)}
          disabled={doc.status === 'fehlend' || !hasHtml}
          title={!hasHtml ? 'Noch kein generiertes Dokument vorhanden' : 'Als HTML exportieren'}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono text-titanium-300 border border-titanium-800 hover:bg-obsidian-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download className="h-3 w-3" />
          Export
        </button>
        <button
          onClick={() => handlers.onGenerate(doc)}
          disabled={busy || !generatable}
          title={!generatable ? 'Dieser Dokumenttyp wird (noch) nicht automatisch generiert' : ''}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono text-teal-400 border border-teal-700 hover:bg-teal-700/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          {doc.status === 'fehlend' || !hasHtml ? 'Generieren' : 'Neu generieren'}
        </button>
      </div>
    </div>
  );
}

// ── Toast ──────────────────────────────────────────────────────────────────
function Toast({ message, tone }: { message: string; tone: 'ok' | 'error' }) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 border font-mono text-xs shadow-lg ${
        tone === 'error'
          ? 'bg-red-950 border-red-800 text-red-200'
          : 'bg-obsidian-800 border-teal-700 text-teal-300'
      }`}
    >
      {tone === 'error' ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
      {message}
    </div>
  );
}

// ── DSFA Status Badge ──────────────────────────────────────────────────────
const DPIA_STATUS_MAP: Record<DpiaStatus, { label: string; docStatus: DocStatus }> = {
  draft:     { label: 'Entwurf',      docStatus: 'entwurf' },
  in_review: { label: 'In Prüfung',   docStatus: 'entwurf' },
  approved:  { label: 'Genehmigt',    docStatus: 'aktuell' },
  rejected:  { label: 'Abgelehnt',    docStatus: 'fehlend' },
};

function DsfaCard({ dpia }: { dpia: DbDpia }) {
  const cfg = DPIA_STATUS_MAP[dpia.status] ?? { label: dpia.status, docStatus: 'entwurf' as DocStatus };
  return (
    <div className="bg-obsidian-900 border border-titanium-900 hover:border-titanium-700 transition-colors">
      <div className="flex items-start gap-3 p-4 border-b border-titanium-900">
        <div className="h-9 w-9 shrink-0 flex items-center justify-center bg-obsidian-800 border border-titanium-800">
          <FileText className="h-4 w-4 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-titanium-100 leading-tight">{dpia.title}</h3>
              <p className="font-mono text-[10px] text-titanium-500 mt-0.5">Art. 35 DSGVO · DSFA</p>
            </div>
            <StatusBadge status={cfg.docStatus} />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-titanium-900 border-b border-titanium-900">
        <div className="px-3 py-2">
          <div className="font-mono text-[10px] text-titanium-600 uppercase">Status</div>
          <div className="font-mono text-xs text-titanium-200 mt-0.5">{cfg.label}</div>
        </div>
        <div className="px-3 py-2">
          <div className="font-mono text-[10px] text-titanium-600 uppercase">Erstellt</div>
          <div className="font-mono text-xs text-titanium-200 mt-0.5">
            {new Date(dpia.created_at).toLocaleDateString('de-DE')}
          </div>
        </div>
        <div className="px-3 py-2">
          <div className="font-mono text-[10px] text-titanium-600 uppercase">DPO konsultiert</div>
          <div className="font-mono text-xs text-titanium-200 mt-0.5">{dpia.dpo_consulted ? 'Ja' : 'Nein'}</div>
        </div>
      </div>
      <div className="flex items-center p-3 gap-2">
        <Link
          to="/app/dpia"
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono text-titanium-300 border border-titanium-800 hover:bg-obsidian-800 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          DSFA öffnen
        </Link>
        <span className="font-mono text-[10px] text-titanium-600 ml-auto">
          {dpia.asset ? dpia.asset.name : '–'}
        </span>
      </div>
    </div>
  );
}

function Inner() {
  return <div className="p-4 text-titanium-300">Implementation pending</div>;
}

// ── DocumentsView ──────────────────────────────────────────────────────────
export function DocumentsView() {
  const { activeTenantId } = useTenant();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'alle' | DocStatus>('alle');
  const [search, setSearch] = useState('');
  const [docs, setDocs] = useState<GovernanceDoc[]>(DOCUMENTS);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'error' } | null>(null);
  const [viewer, setViewer] = useState<GovernanceDoc | null>(null);
  const [editor, setEditor] = useState<{ doc: GovernanceDoc; html: string } | null>(null);
  const [picker, setPicker] = useState(false);
  const [liveDpias, setLiveDpias] = useState<DbDpia[]>([]);

  useEffect(() => {
    if (!activeTenantId) return;
    listDpias(activeTenantId).then((res) => {
      if (res.ok && res.dpias && res.dpias.length > 0) setLiveDpias(res.dpias);
    }).catch(() => {/* keep empty */});
  }, [activeTenantId]);

  function showToast(msg: string, tone: 'ok' | 'error' = 'ok') {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3500);
  }

  async function reload() {
    if (!activeTenantId) return;
    try {
      const rows = await fetchTenantDocuments(activeTenantId);
      setDocs(mergeDocuments(DOCUMENTS, rows));
    } catch {
      /* keine Daten / nicht konfiguriert → Vorlagenkatalog beibehalten */
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenantId]);

  // Letzte bekannte audit_id (für Neu-Generierung), aus echten Dokumenten.
  const fallbackAuditId = useMemo(
    () => docs.find((d) => d.auditId)?.auditId ?? null,
    [docs],
  );

  async function runGeneration(docType: GeneratableDocType, auditId: string | null, busyKey: string) {
    if (!activeTenantId) {
      showToast('Kein aktiver Mandant — bitte anmelden.', 'error');
      return;
    }
    if (!auditId) {
      showToast('Kein Audit als Grundlage gefunden — bitte zuerst einen Audit starten.', 'error');
      navigate('/audit');
      return;
    }
    setBusyId(busyKey);
    try {
      const res = await generateDocument({ audit_id: auditId, doc_type: docType, tenant_id: activeTenantId });
      if (!res.ok) {
        showToast(res.error?.message ?? 'Generierung fehlgeschlagen.', 'error');
        return;
      }
      if (res.html_content) openHtmlInNewTab(res.html_content);
      showToast(`${DOC_TYPE_LABELS[docType]} generiert.`);
      await reload();
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  const handlers: CardHandlers = {
    busyId,
    onView: (doc) => {
      if (doc.html) setViewer(doc);
    },
    onEdit: (doc) => {
      if (doc.html) setEditor({ doc, html: doc.html });
    },
    onExport: (doc) => {
      if (!doc.html) return;
      downloadHtml(doc.html, buildDocFilename(doc.docType ?? doc.id, doc.domain ?? doc.title, doc.methodologyVersion));
      showToast('Export gestartet.');
    },
    onGenerate: (doc) => {
      if (!doc.docType || !isGeneratableDocType(doc.docType)) return;
      void runGeneration(doc.docType, doc.auditId ?? fallbackAuditId, doc.id);
    },
  };

  const filtered = docs.filter((doc) => {
    const matchesFilter = filter === 'alle' || doc.status === filter;
    const matchesSearch =
      !search ||
      doc.title.toLowerCase().includes(search.toLowerCase()) ||
      doc.reference.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const counts = {
    alle: docs.length,
    aktuell: docs.filter((d) => d.status === 'aktuell').length,
    veraltet: docs.filter((d) => d.status === 'veraltet').length,
    fehlend: docs.filter((d) => d.status === 'fehlend').length,
  };

  return (
    <div className="flex flex-col h-full bg-obsidian-950 text-titanium-100">
      {/* Header */}
      <div className="border-b border-titanium-900 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-display font-semibold text-titanium-100 tracking-tight">
              Dokumente
            </h1>
            <p className="font-mono text-xs text-titanium-500 mt-0.5">
              DSGVO-Dokumentengenerator · DSE · AVV · TOM · VVT · DSFA
            </p>
          </div>
          <button
            onClick={() => setPicker(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-xs font-mono hover:bg-teal-500 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Dokument generieren
          </button>
        </div>
      </div>

      {/* Aktionsleiste */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-titanium-900 shrink-0">
        {/* Suche */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-titanium-600" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Dokument suchen …"
            className="w-full bg-obsidian-900 border border-titanium-800 pl-9 pr-3 py-1.5 text-xs font-mono text-titanium-100 placeholder-titanium-600 outline-none focus:border-teal-700 transition-colors"
          />
        </div>
        {/* Filter */}
        <div className="flex items-center gap-0">
          {(['alle', 'aktuell', 'veraltet', 'fehlend'] as const).map((f) => {
            const labels: Record<string, string> = {
              alle: `Alle (${counts.alle})`,
              aktuell: `Aktuell (${counts.aktuell})`,
              veraltet: `Veraltet (${counts.veraltet})`,
              fehlend: `Fehlend (${counts.fehlend})`,
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
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filtered.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} handlers={handlers} />
          ))}
        </div>

        {/* Live DSFA-Einträge */}
        {liveDpias.length > 0 && (
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-titanium-600 mb-3">
              DSFA-Einträge (Live · {liveDpias.length})
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {liveDpias.map((dpia) => (
                <DsfaCard key={dpia.id} dpia={dpia} />
              ))}
            </div>
          </div>
        )}

        {filtered.length === 0 && liveDpias.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-10 w-10 text-titanium-700 mb-3" />
            <p className="text-sm text-titanium-500">Keine Dokumente gefunden</p>
            <p className="font-mono text-xs text-titanium-600 mt-1">Filter anpassen oder neues Dokument generieren</p>
          </div>
        )}
      </div>

      {/* Viewer-Modal */}
      {viewer?.html && (
        <Modal title={viewer.title} onClose={() => setViewer(null)}>
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => openHtmlInNewTab(viewer.html as string)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono text-titanium-300 border border-titanium-800 hover:bg-obsidian-800"
            >
              <Eye className="h-3 w-3" /> In neuem Tab öffnen
            </button>
            <button
              onClick={() =>
                downloadHtml(
                  viewer.html as string,
                  buildDocFilename(viewer.docType ?? viewer.id, viewer.domain ?? viewer.title, viewer.methodologyVersion),
                )
              }
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono text-titanium-300 border border-titanium-800 hover:bg-obsidian-800"
            >
              <Download className="h-3 w-3" /> Export
            </button>
          </div>
          <iframe
            title={viewer.title}
            srcDoc={viewer.html}
            className="w-full h-[60vh] bg-white border border-titanium-800"
          />
        </Modal>
      )}

      {/* Editor-Modal (clientseitig, Download des bearbeiteten HTML) */}
      {editor && (
        <Modal title={`${editor.doc.title} bearbeiten`} onClose={() => setEditor(null)}>
          <p className="font-mono text-[11px] text-titanium-500 mb-2">
            Bearbeitung erfolgt clientseitig. Speichern lädt das angepasste HTML herunter — für eine
            versionierte Neufassung „Neu generieren" verwenden.
          </p>
          <textarea
            value={editor.html}
            onChange={(e) => setEditor({ ...editor, html: e.target.value })}
            spellCheck={false}
            className="w-full h-[55vh] bg-obsidian-950 border border-titanium-800 p-3 font-mono text-[11px] text-titanium-200 outline-none focus:border-teal-700"
          />
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={() => setEditor(null)}
              className="px-3 py-1.5 text-[11px] font-mono text-titanium-400 border border-titanium-800 hover:bg-obsidian-800"
            >
              Abbrechen
            </button>
            <button
              onClick={() => {
                downloadHtml(
                  editor.html,
                  buildDocFilename(editor.doc.docType ?? editor.doc.id, editor.doc.domain ?? editor.doc.title, editor.doc.methodologyVersion),
                );
                showToast('Bearbeitetes Dokument gespeichert.');
                setEditor(null);
              }}
              className="px-3 py-1.5 text-[11px] font-mono text-teal-300 border border-teal-700 hover:bg-teal-700/20"
            >
              Als Datei speichern
            </button>
          </div>
        </Modal>
      )}

      {/* Generieren-Picker */}
      {picker && (
        <Modal title="Dokument generieren" onClose={() => setPicker(false)}>
          <p className="font-mono text-[11px] text-titanium-500 mb-3">
            Wählen Sie den Dokumenttyp. Die Generierung nutzt den letzten Audit-Befund als Grundlage.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {GENERATABLE_DOC_TYPES.map((dt) => (
              <button
                key={dt}
                disabled={busyId === `picker:${dt}`}
                onClick={() => void runGeneration(dt, fallbackAuditId, `picker:${dt}`)}
                className="flex items-center gap-2 p-3 text-left border border-titanium-800 hover:border-teal-700 hover:bg-teal-700/10 transition-colors disabled:opacity-40"
              >
                {busyId === `picker:${dt}` ? (
                  <Loader2 className="h-4 w-4 animate-spin text-teal-400" />
                ) : (
                  <FileText className="h-4 w-4 text-titanium-400" />
                )}
                <span>
                  <span className="block text-xs text-titanium-100">{DOC_TYPE_LABELS[dt]}</span>
                  <span className="block font-mono text-[10px] text-titanium-500">{DOC_TYPE_REFERENCES[dt]}</span>
                </span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast.msg} tone={toast.tone} />}
    </div>
  );
}

// ── Generisches Modal ───────────────────────────────────────────────────────
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl bg-obsidian-900 border border-titanium-800 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-titanium-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-titanium-100">{title}</h2>
          <button onClick={onClose} className="text-titanium-500 hover:text-titanium-200">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
