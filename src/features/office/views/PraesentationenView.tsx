// PraesentationenView — Decks für Audits, Reviews und Board-Reporting (Office OS).
import { useMemo, useState } from 'react';
import { Presentation, Plus, Search, Layers, Clock, Play } from 'lucide-react';
import {
  OfficeViewHeader, OfficeAuditNote, OfficeContent, OfficeMetricRow,
  OfficeStatusChip, OfficeEmptyState, type OfficeStatus,
} from '../OfficePrimitives';

interface OfficeDeck {
  id: string;
  title: string;
  slides: number;
  audience: string;
  status: OfficeStatus;
  updatedAt: string;
  accent: string;
}

const DECKS: OfficeDeck[] = [
  { id: 'p1', title: 'Board Review — Governance Q2/2026', slides: 24, audience: 'Aufsichtsrat', status: 'freigegeben', updatedAt: '14.06.2026', accent: 'from-teal-700 to-teal-900' },
  { id: 'p2', title: 'EU AI Act Readiness — Stakeholder', slides: 18, audience: 'Geschäftsführung', status: 'pruefung', updatedAt: '16.06.2026', accent: 'from-blue-700 to-blue-900' },
  { id: 'p3', title: 'Audit-Ergebnisbericht Kundenpilot', slides: 31, audience: 'Kunde', status: 'freigegeben', updatedAt: '10.06.2026', accent: 'from-indigo-700 to-indigo-900' },
  { id: 'p4', title: 'Onboarding-Deck Neue Agenturen', slides: 14, audience: 'Partner', status: 'entwurf', updatedAt: '15.06.2026', accent: 'from-amber-700 to-amber-900' },
  { id: 'p5', title: 'Incident Retrospektive — Mai', slides: 9, audience: 'Intern', status: 'archiviert', updatedAt: '02.06.2026', accent: 'from-titanium-700 to-titanium-900' },
];

export function PraesentationenView() {
  const [search, setSearch] = useState('');
  const filtered = useMemo(
    () => DECKS.filter((d) => !search || d.title.toLowerCase().includes(search.toLowerCase()) || d.audience.toLowerCase().includes(search.toLowerCase())),
    [search],
  );

  return (
    <>
      <OfficeViewHeader
        icon={Presentation}
        title="Präsentationen"
        subtitle="Decks für Audits, Reviews und Board-Reporting"
        actionLabel="Neues Deck"
        actionIcon={Plus}
      />
      <OfficeAuditNote>
        Freigegebene Decks erhalten einen Herkunftsnachweis (C2PA) auf jeder exportierten Folie (Mock).
      </OfficeAuditNote>

      <div className="flex items-center gap-3 px-6 py-3 border-b border-titanium-900 shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-titanium-600" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Präsentation suchen …"
            className="w-full bg-obsidian-900 border border-titanium-800 pl-9 pr-3 py-1.5 text-xs font-mono text-titanium-100 placeholder-titanium-600 outline-none focus:border-teal-700 transition-colors"
          />
        </div>
      </div>

      <OfficeContent>
        <OfficeMetricRow
          metrics={[
            { label: 'Decks', value: DECKS.length },
            { label: 'Folien gesamt', value: DECKS.reduce((a, d) => a + d.slides, 0) },
            { label: 'Freigegeben', value: DECKS.filter((d) => d.status === 'freigegeben').length },
            { label: 'In Prüfung', value: DECKS.filter((d) => d.status === 'pruefung').length },
          ]}
        />

        {filtered.length === 0 ? (
          <OfficeEmptyState icon={Presentation} title="Keine Präsentationen gefunden" description="Suchbegriff anpassen oder ein neues Deck anlegen." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((deck) => (
              <div key={deck.id} className="bg-obsidian-900 border border-titanium-900 hover:border-titanium-700 transition-colors group">
                <div className={`relative h-28 bg-gradient-to-br ${deck.accent} flex items-center justify-center`}>
                  <Presentation className="h-8 w-8 text-white/70" />
                  <button className="absolute inset-0 flex items-center justify-center bg-obsidian-950/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-obsidian-950/80 border border-titanium-700 text-xs font-mono text-titanium-100">
                      <Play className="h-3 w-3" /> Präsentieren
                    </span>
                  </button>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-titanium-100 leading-tight">{deck.title}</h3>
                    <OfficeStatusChip status={deck.status} />
                  </div>
                  <div className="flex items-center gap-3 mt-2 font-mono text-[10px] text-titanium-600">
                    <span className="flex items-center gap-1"><Layers className="h-3 w-3" />{deck.slides} Folien</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{deck.updatedAt}</span>
                  </div>
                  <p className="font-mono text-[10px] text-titanium-500 mt-1.5">Zielgruppe: {deck.audience}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </OfficeContent>
    </>
  );
}
