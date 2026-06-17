// MeetingsView — Protokolle, Beschlüsse und Maßnahmen mit Nachweis (Office OS).
import { useMemo, useState } from 'react';
import {
  CalendarClock, Plus, Search, Users, CheckSquare, FileText, Clock, ChevronRight,
} from 'lucide-react';
import {
  OfficeViewHeader, OfficeAuditNote, OfficeContent, OfficeMetricRow,
  OfficeStatusChip, OfficeEmptyState, type OfficeStatus,
} from '../OfficePrimitives';

interface OfficeMeeting {
  id: string;
  title: string;
  date: string;
  participants: number;
  decisions: number;
  openActions: number;
  status: OfficeStatus;
  body: string;
}

const MEETINGS: OfficeMeeting[] = [
  { id: 'm1', title: 'Governance-Board Juni', date: '12.06.2026', participants: 7, decisions: 4, openActions: 2, status: 'freigegeben', body: 'Aufsichtsrat' },
  { id: 'm2', title: 'AI-Act-Steuerkreis KW24', date: '15.06.2026', participants: 5, decisions: 3, openActions: 5, status: 'pruefung', body: 'Steuerkreis' },
  { id: 'm3', title: 'Incident-Review Mai', date: '03.06.2026', participants: 6, decisions: 2, openActions: 0, status: 'freigegeben', body: 'Security' },
  { id: 'm4', title: 'Kunden-Pilot Kickoff', date: '16.06.2026', participants: 9, decisions: 1, openActions: 7, status: 'entwurf', body: 'Projektteam' },
  { id: 'm5', title: 'DSB-Quartalsabstimmung', date: '08.06.2026', participants: 3, decisions: 5, openActions: 1, status: 'freigegeben', body: 'Datenschutz' },
];

export function MeetingsView() {
  const [search, setSearch] = useState('');
  const filtered = useMemo(
    () => MEETINGS.filter((m) => !search || m.title.toLowerCase().includes(search.toLowerCase()) || m.body.toLowerCase().includes(search.toLowerCase())),
    [search],
  );

  return (
    <>
      <OfficeViewHeader
        icon={CalendarClock}
        title="Meetings"
        subtitle="Protokolle, Beschlüsse und Maßnahmen mit revisionssicherem Nachweis"
        actionLabel="Neues Protokoll"
        actionIcon={Plus}
      />
      <OfficeAuditNote>
        Beschlüsse und Maßnahmen werden als Prüfpfad-Einträge geführt und mit Fristen überwacht (Mock).
      </OfficeAuditNote>

      <div className="flex items-center gap-3 px-6 py-3 border-b border-titanium-900 shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-titanium-600" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Meeting oder Gremium suchen …"
            className="w-full bg-obsidian-900 border border-titanium-800 pl-9 pr-3 py-1.5 text-xs font-mono text-titanium-100 placeholder-titanium-600 outline-none focus:border-teal-700 transition-colors"
          />
        </div>
      </div>

      <OfficeContent>
        <OfficeMetricRow
          metrics={[
            { label: 'Meetings', value: MEETINGS.length },
            { label: 'Beschlüsse', value: MEETINGS.reduce((a, m) => a + m.decisions, 0) },
            { label: 'Offene Maßnahmen', value: MEETINGS.reduce((a, m) => a + m.openActions, 0) },
            { label: 'In Prüfung', value: MEETINGS.filter((m) => m.status === 'pruefung').length },
          ]}
        />

        {filtered.length === 0 ? (
          <OfficeEmptyState icon={CalendarClock} title="Keine Meetings gefunden" description="Suchbegriff anpassen oder ein neues Protokoll anlegen." />
        ) : (
          <div className="border border-titanium-900 divide-y divide-titanium-900">
            {filtered.map((mtg) => (
              <button key={mtg.id} className="w-full flex items-center gap-4 px-4 py-3 hover:bg-obsidian-900 transition-colors text-left group">
                <div className="h-9 w-9 shrink-0 flex items-center justify-center bg-obsidian-800 border border-titanium-800">
                  <CalendarClock className="h-4 w-4 text-titanium-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-titanium-100 truncate">{mtg.title}</span>
                    <span className="font-mono text-[9px] uppercase tracking-wide text-titanium-600 border border-titanium-800 px-1.5 py-0.5">{mtg.body}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 font-mono text-[10px] text-titanium-600">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{mtg.date}</span>
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{mtg.participants}</span>
                    <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{mtg.decisions} Beschlüsse</span>
                    <span className={`flex items-center gap-1 ${mtg.openActions > 0 ? 'text-amber-500' : 'text-titanium-600'}`}>
                      <CheckSquare className="h-3 w-3" />{mtg.openActions} offen
                    </span>
                  </div>
                </div>
                <OfficeStatusChip status={mtg.status} />
                <ChevronRight className="h-4 w-4 text-titanium-700 group-hover:text-titanium-400 transition-colors" />
              </button>
            ))}
          </div>
        )}
      </OfficeContent>
    </>
  );
}
