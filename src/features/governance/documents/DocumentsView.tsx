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

// ── DocumentsView ──────────────────────────────────────────────────────────
function _DocumentsView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const DocumentsView = withPerformanceMonitoring(
  _DocumentsView,
  'DocumentsView',
  { threshold: 500, maxRenders: 10 }
);

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
