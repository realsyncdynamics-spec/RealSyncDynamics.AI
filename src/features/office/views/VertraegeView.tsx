// VertraegeView — Vertrags-Lebenszyklus mit Fristen und Freigaben (Office OS).
import { useMemo, useState } from 'react';
import {
  FileSignature, Plus, Search, Building2, CalendarX2, Euro, AlertTriangle,
} from 'lucide-react';
import {
  OfficeViewHeader, OfficeAuditNote, OfficeContent, OfficeMetricRow,
  OfficeStatusChip, OfficeEmptyState, type OfficeStatus,
} from '../OfficePrimitives';

interface OfficeContract {
  id: string;
  title: string;
  counterparty: string;
  type: string;
  value: string;
  renewalDate: string;
  daysToRenewal: number;
  status: OfficeStatus;
}

const CONTRACTS: OfficeContract[] = [
  { id: 'c1', title: 'AVV — Supabase EU', counterparty: 'Supabase Inc.', type: 'AVV', value: '—', renewalDate: '31.12.2026', daysToRenewal: 197, status: 'freigegeben' },
  { id: 'c2', title: 'Enterprise-Lizenz Anthropic', counterparty: 'Anthropic PBC', type: 'Lizenz', value: '€ 48.000 / Jahr', renewalDate: '01.09.2026', daysToRenewal: 76, status: 'freigegeben' },
  { id: 'c3', title: 'Pilotvertrag Agentur Nord', counterparty: 'Nord Digital GmbH', type: 'Dienstleistung', value: '€ 12.500', renewalDate: '30.06.2026', daysToRenewal: 13, status: 'pruefung' },
  { id: 'c4', title: 'Hosting-Rahmenvertrag', counterparty: 'Hostinger', type: 'Rahmenvertrag', value: '€ 6.200 / Jahr', renewalDate: '22.06.2026', daysToRenewal: 5, status: 'abgelaufen' },
  { id: 'c5', title: 'NDA Pilotkunde FinTech', counterparty: 'FinPilot AG', type: 'NDA', value: '—', renewalDate: '15.03.2027', daysToRenewal: 271, status: 'entwurf' },
];

export function VertraegeView() {
  const [search, setSearch] = useState('');
  const filtered = useMemo(
    () => CONTRACTS.filter((c) => !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.counterparty.toLowerCase().includes(search.toLowerCase())),
    [search],
  );

  return (
    <>
      <OfficeViewHeader
        icon={FileSignature}
        title="Verträge"
        subtitle="Vertrags-Lebenszyklus mit Fristenüberwachung und Freigaben"
        actionLabel="Neuer Vertrag"
        actionIcon={Plus}
      />
      <OfficeAuditNote>
        Unterschriften und Fristen sind prüfpfadgesichert; Verlängerungen lösen Alerts aus (Mock).
      </OfficeAuditNote>

      <div className="flex items-center gap-3 px-6 py-3 border-b border-titanium-900 shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-titanium-600" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Vertrag oder Vertragspartner suchen …"
            className="w-full bg-obsidian-900 border border-titanium-800 pl-9 pr-3 py-1.5 text-xs font-mono text-titanium-100 placeholder-titanium-600 outline-none focus:border-teal-700 transition-colors"
          />
        </div>
      </div>

      <OfficeContent>
        <OfficeMetricRow
          metrics={[
            { label: 'Verträge', value: CONTRACTS.length },
            { label: 'Aktiv', value: CONTRACTS.filter((c) => c.status === 'freigegeben').length },
            { label: 'Frist < 30 Tage', value: CONTRACTS.filter((c) => c.daysToRenewal < 30 && c.status !== 'entwurf').length },
            { label: 'Abgelaufen', value: CONTRACTS.filter((c) => c.status === 'abgelaufen').length },
          ]}
        />

        {filtered.length === 0 ? (
          <OfficeEmptyState icon={FileSignature} title="Keine Verträge gefunden" description="Suchbegriff anpassen oder einen neuen Vertrag anlegen." />
        ) : (
          <div className="border border-titanium-900 overflow-hidden">
            <div className="hidden md:grid grid-cols-[1fr_140px_120px_120px_110px] gap-3 px-4 py-2 bg-obsidian-900 border-b border-titanium-900 font-mono text-[10px] uppercase tracking-wide text-titanium-600">
              <span>Vertrag</span>
              <span>Typ</span>
              <span>Wert</span>
              <span>Verlängerung</span>
              <span>Status</span>
            </div>
            <div className="divide-y divide-titanium-900">
              {filtered.map((c) => {
                const urgent = c.daysToRenewal < 30 && c.status !== 'entwurf';
                return (
                  <div key={c.id} className="grid grid-cols-1 md:grid-cols-[1fr_140px_120px_120px_110px] gap-3 px-4 py-3 items-center hover:bg-obsidian-900 transition-colors">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-titanium-100 truncate">{c.title}</div>
                      <div className="flex items-center gap-1 font-mono text-[10px] text-titanium-600 mt-0.5">
                        <Building2 className="h-3 w-3" />{c.counterparty}
                      </div>
                    </div>
                    <span className="font-mono text-[11px] text-titanium-300">{c.type}</span>
                    <span className="flex items-center gap-1 font-mono text-[11px] text-titanium-300">
                      {c.value !== '—' && <Euro className="h-3 w-3 text-titanium-600" />}{c.value}
                    </span>
                    <span className={`flex items-center gap-1 font-mono text-[11px] ${urgent ? 'text-amber-400' : 'text-titanium-300'}`}>
                      {urgent ? <AlertTriangle className="h-3 w-3" /> : <CalendarX2 className="h-3 w-3 text-titanium-600" />}
                      {c.renewalDate}
                    </span>
                    <OfficeStatusChip status={c.status} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </OfficeContent>
    </>
  );
}
