// VorlagenView — geprüfte Vorlagen für Dokumente, Verträge und Policies (Office OS).
import { useMemo, useState } from 'react';
import {
  LayoutTemplate, Plus, Search, FileText, FileSignature, ShieldCheck,
  Table2, Presentation, Copy, CheckCircle2,
} from 'lucide-react';
import {
  OfficeViewHeader, OfficeAuditNote, OfficeContent, OfficeMetricRow,
  OfficeEmptyState, type OfficeStatus,
} from '../OfficePrimitives';
import type { LucideIcon } from 'lucide-react';

type TemplateKind = 'Dokument' | 'Vertrag' | 'Policy' | 'Tabelle' | 'Deck';

interface OfficeTemplate {
  id: string;
  title: string;
  kind: TemplateKind;
  status: OfficeStatus;
  usageCount: number;
  basis: string;
}

const KIND_ICON: Record<TemplateKind, LucideIcon> = {
  Dokument: FileText,
  Vertrag: FileSignature,
  Policy: ShieldCheck,
  Tabelle: Table2,
  Deck: Presentation,
};

const TEMPLATES: OfficeTemplate[] = [
  { id: 't1', title: 'AVV nach Art. 28 DSGVO', kind: 'Vertrag', status: 'freigegeben', usageCount: 47, basis: 'EU-Standardvertragsklauseln' },
  { id: 't2', title: 'Datenschutz-Folgenabschätzung', kind: 'Dokument', status: 'freigegeben', usageCount: 23, basis: 'Art. 35 DSGVO' },
  { id: 't3', title: 'KI-Nutzungsrichtlinie', kind: 'Policy', status: 'freigegeben', usageCount: 31, basis: 'EU AI Act' },
  { id: 't4', title: 'Risiko-Bewertungsmatrix', kind: 'Tabelle', status: 'freigegeben', usageCount: 19, basis: 'ISO 31000' },
  { id: 't5', title: 'Board-Review-Deck', kind: 'Deck', status: 'pruefung', usageCount: 8, basis: 'Intern' },
  { id: 't6', title: 'Auftragsbestätigung Pilotprojekt', kind: 'Vertrag', status: 'entwurf', usageCount: 3, basis: 'Intern' },
];

const KINDS = ['Alle', 'Dokument', 'Vertrag', 'Policy', 'Tabelle', 'Deck'] as const;

export function VorlagenView() {
  const [kind, setKind] = useState<(typeof KINDS)[number]>('Alle');
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () =>
      TEMPLATES.filter((t) => {
        const matchesKind = kind === 'Alle' || t.kind === kind;
        const matchesSearch = !search || t.title.toLowerCase().includes(search.toLowerCase());
        return matchesKind && matchesSearch;
      }),
    [kind, search],
  );

  return (
    <>
      <OfficeViewHeader
        icon={LayoutTemplate}
        title="Vorlagen"
        subtitle="Geprüfte Vorlagen für Dokumente, Verträge und Policies"
        actionLabel="Neue Vorlage"
        actionIcon={Plus}
      />
      <OfficeAuditNote>
        Aus einer Vorlage erzeugte Artefakte erben deren Freigabe-Status und Prüfpfad-Verknüpfung (Mock).
      </OfficeAuditNote>

      <div className="flex items-center gap-3 px-6 py-3 border-b border-titanium-900 shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-titanium-600" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Vorlage suchen …"
            className="w-full bg-obsidian-900 border border-titanium-800 pl-9 pr-3 py-1.5 text-xs font-mono text-titanium-100 placeholder-titanium-600 outline-none focus:border-teal-700 transition-colors"
          />
        </div>
        <div className="flex items-center gap-0 overflow-x-auto scrollbar-none">
          {KINDS.map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`px-3 py-1.5 text-xs font-mono border whitespace-nowrap transition-colors ${
                kind === k
                  ? 'bg-obsidian-800 border-titanium-700 text-titanium-100'
                  : 'border-transparent text-titanium-500 hover:text-titanium-300'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      <OfficeContent>
        <OfficeMetricRow
          metrics={[
            { label: 'Vorlagen', value: TEMPLATES.length },
            { label: 'Freigegeben', value: TEMPLATES.filter((t) => t.status === 'freigegeben').length },
            { label: 'Verwendungen', value: TEMPLATES.reduce((a, t) => a + t.usageCount, 0) },
            { label: 'In Prüfung', value: TEMPLATES.filter((t) => t.status === 'pruefung').length },
          ]}
        />

        {filtered.length === 0 ? (
          <OfficeEmptyState icon={LayoutTemplate} title="Keine Vorlagen gefunden" description="Filter anpassen oder eine neue Vorlage anlegen." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((tpl) => {
              const Icon = KIND_ICON[tpl.kind];
              return (
                <div key={tpl.id} className="bg-obsidian-900 border border-titanium-900 hover:border-titanium-700 transition-colors flex flex-col">
                  <div className="flex items-start gap-3 p-4 flex-1">
                    <div className="h-9 w-9 shrink-0 flex items-center justify-center bg-obsidian-800 border border-titanium-800">
                      <Icon className="h-4 w-4 text-titanium-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[9px] uppercase tracking-wide text-cyan-500 border border-cyan-900 px-1.5 py-0.5">{tpl.kind}</span>
                        {tpl.status === 'freigegeben' && <CheckCircle2 className="h-3 w-3 text-teal-500" />}
                      </div>
                      <h3 className="text-sm font-semibold text-titanium-100 leading-tight mt-1.5">{tpl.title}</h3>
                      <p className="font-mono text-[10px] text-titanium-500 mt-0.5">Basis: {tpl.basis}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5 border-t border-titanium-900">
                    <span className="font-mono text-[10px] text-titanium-600">{tpl.usageCount}× verwendet</span>
                    <button className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono text-teal-400 border border-teal-800 hover:bg-teal-700/20 transition-colors">
                      <Copy className="h-3 w-3" /> Verwenden
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </OfficeContent>
    </>
  );
}
