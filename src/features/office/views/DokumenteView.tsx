// DokumenteView — governance-fähige Dokumentenablage (Office OS).
// Im Gegensatz zum DSGVO-Dokumentengenerator (/app/documents) ist dies die
// allgemeine Arbeitsumgebung für Dokumente mit Versionierung und Prüfpfad.
import { useMemo, useState } from 'react';
import {
  FileText, Plus, Search, Eye, Download, GitBranch, Clock, User,
} from 'lucide-react';
import {
  OfficeViewHeader, OfficeAuditNote, OfficeContent, OfficeMetricRow,
  OfficeStatusChip, OfficeEmptyState, type OfficeStatus,
} from '../OfficePrimitives';

interface OfficeDocument {
  id: string;
  title: string;
  category: string;
  status: OfficeStatus;
  version: string;
  owner: string;
  updatedAt: string;
  classification: 'öffentlich' | 'intern' | 'vertraulich';
}

const DOCUMENTS: OfficeDocument[] = [
  { id: 'd1', title: 'Informationssicherheits-Leitlinie', category: 'Sicherheit', status: 'freigegeben', version: 'v4.1', owner: 'CISO', updatedAt: '12.06.2026', classification: 'intern' },
  { id: 'd2', title: 'Onboarding-Handbuch Creator', category: 'Operations', status: 'freigegeben', version: 'v2.3', owner: 'People Ops', updatedAt: '09.06.2026', classification: 'intern' },
  { id: 'd3', title: 'Incident-Response-Plan', category: 'Sicherheit', status: 'pruefung', version: 'v3.0-rc', owner: 'CISO', updatedAt: '15.06.2026', classification: 'vertraulich' },
  { id: 'd4', title: 'KI-Nutzungsrichtlinie Mitarbeitende', category: 'Governance', status: 'entwurf', version: 'v0.7', owner: 'Legal', updatedAt: '16.06.2026', classification: 'intern' },
  { id: 'd5', title: 'Pressemappe RealSyncDynamics', category: 'Marketing', status: 'freigegeben', version: 'v1.5', owner: 'Comms', updatedAt: '01.06.2026', classification: 'öffentlich' },
  { id: 'd6', title: 'Notfall-Kontaktliste Betrieb', category: 'Operations', status: 'abgelaufen', version: 'v1.2', owner: 'Ops Lead', updatedAt: '04.02.2026', classification: 'vertraulich' },
];

const CATEGORIES = ['Alle', 'Sicherheit', 'Operations', 'Governance', 'Marketing'] as const;

export function DokumenteView() {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('Alle');
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () =>
      DOCUMENTS.filter((d) => {
        const matchesCat = category === 'Alle' || d.category === category;
        const matchesSearch =
          !search ||
          d.title.toLowerCase().includes(search.toLowerCase()) ||
          d.owner.toLowerCase().includes(search.toLowerCase());
        return matchesCat && matchesSearch;
      }),
    [category, search],
  );

  return (
    <>
      <OfficeViewHeader
        icon={FileText}
        title="Dokumente"
        subtitle="Governance-fähige Dokumentenablage · Versionierung · Prüfpfad"
        actionLabel="Neues Dokument"
        actionIcon={Plus}
      />
      <OfficeAuditNote>
        Jede Version wird mit Hash und Zeitstempel in der Evidence-Chain verankert (Mock).
      </OfficeAuditNote>

      <div className="flex items-center gap-3 px-6 py-3 border-b border-titanium-900 shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-titanium-600" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Dokument oder Eigentümer suchen …"
            className="w-full bg-obsidian-900 border border-titanium-800 pl-9 pr-3 py-1.5 text-xs font-mono text-titanium-100 placeholder-titanium-600 outline-none focus:border-teal-700 transition-colors"
          />
        </div>
        <div className="flex items-center gap-0">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-1.5 text-xs font-mono border transition-colors ${
                category === c
                  ? 'bg-obsidian-800 border-titanium-700 text-titanium-100'
                  : 'border-transparent text-titanium-500 hover:text-titanium-300'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <OfficeContent>
        <OfficeMetricRow
          metrics={[
            { label: 'Dokumente', value: DOCUMENTS.length },
            { label: 'Freigegeben', value: DOCUMENTS.filter((d) => d.status === 'freigegeben').length },
            { label: 'In Prüfung', value: DOCUMENTS.filter((d) => d.status === 'pruefung').length },
            { label: 'Abgelaufen', value: DOCUMENTS.filter((d) => d.status === 'abgelaufen').length },
          ]}
        />

        {filtered.length === 0 ? (
          <OfficeEmptyState
            icon={FileText}
            title="Keine Dokumente gefunden"
            description="Filter anpassen oder ein neues Dokument anlegen."
          />
        ) : (
          <div className="border border-titanium-900 divide-y divide-titanium-900">
            {filtered.map((doc) => (
              <div key={doc.id} className="flex items-center gap-4 px-4 py-3 hover:bg-obsidian-900 transition-colors group">
                <div className="h-8 w-8 shrink-0 flex items-center justify-center bg-obsidian-800 border border-titanium-800">
                  <FileText className="h-4 w-4 text-titanium-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-titanium-100 truncate">{doc.title}</span>
                    <span className="font-mono text-[9px] uppercase tracking-wide text-titanium-600 border border-titanium-800 px-1.5 py-0.5">
                      {doc.classification}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 font-mono text-[10px] text-titanium-600">
                    <span className="flex items-center gap-1"><GitBranch className="h-3 w-3" />{doc.version}</span>
                    <span className="flex items-center gap-1"><User className="h-3 w-3" />{doc.owner}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{doc.updatedAt}</span>
                    <span className="text-titanium-700">·</span>
                    <span>{doc.category}</span>
                  </div>
                </div>
                <OfficeStatusChip status={doc.status} />
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button title="Anzeigen" className="p-1.5 text-titanium-400 border border-titanium-800 hover:bg-obsidian-800 transition-colors">
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                  <button title="Export" className="p-1.5 text-titanium-400 border border-titanium-800 hover:bg-obsidian-800 transition-colors">
                    <Download className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </OfficeContent>
    </>
  );
}
