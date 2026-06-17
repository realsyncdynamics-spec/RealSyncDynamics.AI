// DocumentsView — DSGVO-Dokumentengenerator
// Dokument-Management mit Generierungsfunktion
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  ExternalLink,
} from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
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
}

// ── Dokument-Definitionen ──────────────────────────────────────────────────
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
function DocumentCard({ doc }: { doc: GovernanceDoc }) {
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
          disabled={doc.status === 'fehlend'}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono text-titanium-300 border border-titanium-800 hover:bg-obsidian-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Eye className="h-3 w-3" />
          Anzeigen
        </button>
        <button
          disabled={doc.status === 'fehlend'}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono text-titanium-300 border border-titanium-800 hover:bg-obsidian-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Edit className="h-3 w-3" />
          Bearbeiten
        </button>
        <button
          disabled={doc.status === 'fehlend'}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono text-titanium-300 border border-titanium-800 hover:bg-obsidian-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download className="h-3 w-3" />
          Export
        </button>
        <button className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono text-teal-400 border border-teal-700 hover:bg-teal-700/20 transition-colors">
          <RefreshCw className="h-3 w-3" />
          {doc.status === 'fehlend' ? 'Generieren' : 'Neu generieren'}
        </button>
      </div>
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
export function DocumentsView() {
  const { activeTenantId } = useTenant();
  const [filter, setFilter] = useState<'alle' | DocStatus>('alle');
  const [search, setSearch] = useState('');
  const [liveDpias, setLiveDpias] = useState<DbDpia[]>([]);

  useEffect(() => {
    if (!activeTenantId) return;
    listDpias(activeTenantId).then((res) => {
      if (res.ok && res.dpias && res.dpias.length > 0) setLiveDpias(res.dpias);
    }).catch(() => {/* keep empty */});
  }, [activeTenantId]);

  const filtered = DOCUMENTS.filter((doc) => {
    const matchesFilter = filter === 'alle' || doc.status === filter;
    const matchesSearch =
      !search ||
      doc.title.toLowerCase().includes(search.toLowerCase()) ||
      doc.reference.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const counts = {
    alle: DOCUMENTS.length,
    aktuell: DOCUMENTS.filter((d) => d.status === 'aktuell').length,
    veraltet: DOCUMENTS.filter((d) => d.status === 'veraltet').length,
    fehlend: DOCUMENTS.filter((d) => d.status === 'fehlend').length,
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
          <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-xs font-mono hover:bg-teal-500 transition-colors">
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
            <DocumentCard key={doc.id} doc={doc} />
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
    </div>
  );
}
