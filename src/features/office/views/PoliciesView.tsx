// PoliciesView — Richtlinien-Register mit Geltungsbereich und Review-Zyklus (Office OS).
import { useMemo, useState } from 'react';
import {
  ShieldCheck, Plus, Search, RefreshCw, Users, BookOpen, AlertTriangle,
} from 'lucide-react';
import {
  OfficeViewHeader, OfficeAuditNote, OfficeContent, OfficeMetricRow,
  OfficeStatusChip, OfficeEmptyState, type OfficeStatus,
} from '../OfficePrimitives';

interface OfficePolicy {
  id: string;
  title: string;
  scope: string;
  framework: string;
  reviewCycle: string;
  nextReview: string;
  acknowledged: number;
  total: number;
  status: OfficeStatus;
}

const POLICIES: OfficePolicy[] = [
  { id: 'pol1', title: 'Informationssicherheits-Richtlinie', scope: 'Gesamtorganisation', framework: 'ISO 27001', reviewCycle: 'jährlich', nextReview: '01.10.2026', acknowledged: 38, total: 42, status: 'freigegeben' },
  { id: 'pol2', title: 'KI-Nutzungsrichtlinie', scope: 'Alle Mitarbeitenden', framework: 'EU AI Act', reviewCycle: 'halbjährlich', nextReview: '15.09.2026', acknowledged: 40, total: 42, status: 'freigegeben' },
  { id: 'pol3', title: 'Datenklassifizierungs-Richtlinie', scope: 'Datenverarbeitende Teams', framework: 'DSGVO', reviewCycle: 'jährlich', nextReview: '20.06.2026', acknowledged: 18, total: 24, status: 'pruefung' },
  { id: 'pol4', title: 'Remote-Work-Richtlinie', scope: 'Gesamtorganisation', framework: 'Intern', reviewCycle: 'jährlich', nextReview: '12.11.2026', acknowledged: 42, total: 42, status: 'freigegeben' },
  { id: 'pol5', title: 'Lieferanten-Sicherheitsrichtlinie', scope: 'Einkauf & IT', framework: 'ISO 27036', reviewCycle: 'jährlich', nextReview: '05.06.2026', acknowledged: 9, total: 15, status: 'abgelaufen' },
  { id: 'pol6', title: 'Datenaufbewahrungs-Richtlinie', scope: 'Gesamtorganisation', framework: 'DSGVO Art. 5', reviewCycle: 'jährlich', nextReview: '30.08.2026', acknowledged: 5, total: 42, status: 'entwurf' },
];

export function PoliciesView() {
  const [search, setSearch] = useState('');
  const filtered = useMemo(
    () => POLICIES.filter((p) => !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.framework.toLowerCase().includes(search.toLowerCase())),
    [search],
  );

  return (
    <>
      <OfficeViewHeader
        icon={ShieldCheck}
        title="Policies"
        subtitle="Richtlinien-Register mit Geltungsbereich, Review-Zyklus und Kenntnisnahme"
        actionLabel="Neue Policy"
        actionIcon={Plus}
      />
      <OfficeAuditNote>
        Kenntnisnahmen und Review-Termine sind prüfpfadgesichert und speisen Compliance-Reports (Mock).
      </OfficeAuditNote>

      <div className="flex items-center gap-3 px-6 py-3 border-b border-titanium-900 shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-titanium-600" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Policy oder Rahmenwerk suchen …"
            className="w-full bg-obsidian-900 border border-titanium-800 pl-9 pr-3 py-1.5 text-xs font-mono text-titanium-100 placeholder-titanium-600 outline-none focus:border-teal-700 transition-colors"
          />
        </div>
      </div>

      <OfficeContent>
        <OfficeMetricRow
          metrics={[
            { label: 'Policies', value: POLICIES.length },
            { label: 'In Kraft', value: POLICIES.filter((p) => p.status === 'freigegeben').length },
            { label: 'Review überfällig', value: POLICIES.filter((p) => p.status === 'abgelaufen').length },
            { label: 'Ø Kenntnisnahme', value: `${Math.round((POLICIES.reduce((a, p) => a + p.acknowledged / p.total, 0) / POLICIES.length) * 100)}%` },
          ]}
        />

        {filtered.length === 0 ? (
          <OfficeEmptyState icon={ShieldCheck} title="Keine Policies gefunden" description="Suchbegriff anpassen oder eine neue Policy anlegen." />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map((p) => {
              const pct = Math.round((p.acknowledged / p.total) * 100);
              return (
                <div key={p.id} className="bg-obsidian-900 border border-titanium-900 hover:border-titanium-700 transition-colors">
                  <div className="flex items-start gap-3 p-4 border-b border-titanium-900">
                    <div className="h-9 w-9 shrink-0 flex items-center justify-center bg-obsidian-800 border border-titanium-800">
                      <ShieldCheck className="h-4 w-4 text-titanium-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold text-titanium-100 leading-tight">{p.title}</h3>
                        <OfficeStatusChip status={p.status} />
                      </div>
                      <div className="flex items-center gap-2 mt-1 font-mono text-[10px] text-titanium-500">
                        <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{p.framework}</span>
                        <span className="text-titanium-700">·</span>
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{p.scope}</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between font-mono text-[10px] text-titanium-600 mb-1.5">
                      <span>Kenntnisnahme</span>
                      <span className="text-titanium-300">{p.acknowledged}/{p.total} · {pct}%</span>
                    </div>
                    <div className="h-1.5 bg-obsidian-800 border border-titanium-900">
                      <div
                        className={`h-full ${pct === 100 ? 'bg-teal-500' : pct >= 75 ? 'bg-cyan-500' : 'bg-amber-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-3 font-mono text-[10px]">
                      <span className="flex items-center gap-1 text-titanium-500">
                        <RefreshCw className="h-3 w-3" />Review {p.reviewCycle}
                      </span>
                      <span className={`flex items-center gap-1 ${p.status === 'abgelaufen' ? 'text-red-400' : 'text-titanium-500'}`}>
                        {p.status === 'abgelaufen' && <AlertTriangle className="h-3 w-3" />}
                        nächster: {p.nextReview}
                      </span>
                    </div>
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
