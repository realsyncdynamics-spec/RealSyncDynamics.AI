// TabellenView — strukturierte Daten, Register und Berechnungen (Office OS).
import { useMemo, useState } from 'react';
import { Table2, Plus, Search, Users, Clock, BarChart3 } from 'lucide-react';
import {
  OfficeViewHeader, OfficeAuditNote, OfficeContent, OfficeMetricRow,
  OfficeStatusChip, OfficeEmptyState, type OfficeStatus,
} from '../OfficePrimitives';

interface OfficeSheet {
  id: string;
  title: string;
  rows: number;
  columns: number;
  collaborators: number;
  status: OfficeStatus;
  updatedAt: string;
  purpose: string;
}

const SHEETS: OfficeSheet[] = [
  { id: 's1', title: 'Verarbeitungstätigkeiten-Register', rows: 142, columns: 12, collaborators: 4, status: 'freigegeben', updatedAt: '14.06.2026', purpose: 'VVT-Datenbasis' },
  { id: 's2', title: 'Risiko-Bewertungsmatrix Q2', rows: 38, columns: 9, collaborators: 3, status: 'pruefung', updatedAt: '16.06.2026', purpose: 'Risikomanagement' },
  { id: 's3', title: 'Vendor-Kostenübersicht', rows: 67, columns: 7, collaborators: 2, status: 'freigegeben', updatedAt: '11.06.2026', purpose: 'Finanzen' },
  { id: 's4', title: 'KI-System-Inventar', rows: 23, columns: 15, collaborators: 5, status: 'entwurf', updatedAt: '15.06.2026', purpose: 'EU AI Act' },
  { id: 's5', title: 'Audit-Maßnahmen-Tracker', rows: 91, columns: 8, collaborators: 6, status: 'freigegeben', updatedAt: '13.06.2026', purpose: 'Audit' },
];

export function TabellenView() {
  const [search, setSearch] = useState('');
  const filtered = useMemo(
    () => SHEETS.filter((s) => !search || s.title.toLowerCase().includes(search.toLowerCase()) || s.purpose.toLowerCase().includes(search.toLowerCase())),
    [search],
  );

  return (
    <>
      <OfficeViewHeader
        icon={Table2}
        title="Tabellen"
        subtitle="Strukturierte Register und Berechnungen mit Spaltenebenen-Prüfpfad"
        actionLabel="Neue Tabelle"
        actionIcon={Plus}
      />
      <OfficeAuditNote>
        Zell-Änderungen werden zeilenweise protokolliert; Register speisen Governance-Module (Mock).
      </OfficeAuditNote>

      <div className="flex items-center gap-3 px-6 py-3 border-b border-titanium-900 shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-titanium-600" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tabelle suchen …"
            className="w-full bg-obsidian-900 border border-titanium-800 pl-9 pr-3 py-1.5 text-xs font-mono text-titanium-100 placeholder-titanium-600 outline-none focus:border-teal-700 transition-colors"
          />
        </div>
      </div>

      <OfficeContent>
        <OfficeMetricRow
          metrics={[
            { label: 'Tabellen', value: SHEETS.length },
            { label: 'Zeilen gesamt', value: SHEETS.reduce((a, s) => a + s.rows, 0) },
            { label: 'Mitarbeitende', value: SHEETS.reduce((a, s) => a + s.collaborators, 0) },
            { label: 'In Prüfung', value: SHEETS.filter((s) => s.status === 'pruefung').length },
          ]}
        />

        {filtered.length === 0 ? (
          <OfficeEmptyState icon={Table2} title="Keine Tabellen gefunden" description="Suchbegriff anpassen oder eine neue Tabelle anlegen." />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map((sheet) => (
              <div key={sheet.id} className="bg-obsidian-900 border border-titanium-900 hover:border-titanium-700 transition-colors">
                <div className="flex items-start gap-3 p-4 border-b border-titanium-900">
                  <div className="h-9 w-9 shrink-0 flex items-center justify-center bg-obsidian-800 border border-titanium-800">
                    <Table2 className="h-4 w-4 text-titanium-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-titanium-100 leading-tight truncate">{sheet.title}</h3>
                        <p className="font-mono text-[10px] text-titanium-500 mt-0.5">{sheet.purpose}</p>
                      </div>
                      <OfficeStatusChip status={sheet.status} />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 divide-x divide-titanium-900">
                  <div className="px-3 py-2 flex items-center gap-1.5">
                    <BarChart3 className="h-3 w-3 text-titanium-600" />
                    <span className="font-mono text-xs text-titanium-200">{sheet.rows}×{sheet.columns}</span>
                  </div>
                  <div className="px-3 py-2 flex items-center gap-1.5">
                    <Users className="h-3 w-3 text-titanium-600" />
                    <span className="font-mono text-xs text-titanium-200">{sheet.collaborators}</span>
                  </div>
                  <div className="px-3 py-2 flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-titanium-600" />
                    <span className="font-mono text-xs text-titanium-200">{sheet.updatedAt}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </OfficeContent>
    </>
  );
}
