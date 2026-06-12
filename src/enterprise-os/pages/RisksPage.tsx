import React, { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { RiskCard } from '../components/RiskCard';
import { RISK_LABELS, type RiskLevel } from '../components/Badge';
import { EmptyState } from '../components/States';
import { RISKS } from '../mock/data';

const FILTERS: { id: RiskLevel | 'all'; label: string }[] = [
  { id: 'all', label: 'Alle' },
  { id: 'critical', label: RISK_LABELS.critical },
  { id: 'high', label: RISK_LABELS.high },
  { id: 'medium', label: RISK_LABELS.medium },
  { id: 'low', label: RISK_LABELS.low },
  { id: 'passed', label: RISK_LABELS.passed },
];

export function RisksPage() {
  const [filter, setFilter] = useState<RiskLevel | 'all'>('all');
  const risks = RISKS.filter((r) => filter === 'all' || r.level === filter);
  const openCount = RISKS.filter((r) => r.level !== 'passed').length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">
          Risk Intelligence
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold text-titanium-50 sm:text-3xl">Risiken</h1>
        <p className="mt-1 text-sm text-titanium-400">
          {openCount} offene Findings über alle Assets · automatisch erkannt und priorisiert
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`border px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider transition-colors ${
              filter === f.id
                ? 'border-security-500 bg-security-500/10 text-security-300'
                : 'border-titanium-800 text-titanium-400 hover:border-titanium-600 hover:text-titanium-100'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {risks.length === 0 ? (
        <EmptyState
          icon={<ShieldAlert className="h-5 w-5" />}
          title="Keine Risiken in dieser Kategorie"
          description="Wählen Sie einen anderen Filter, um Findings anzuzeigen."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {risks.map((risk) => (
            <RiskCard key={risk.id} risk={risk} />
          ))}
        </div>
      )}
    </div>
  );
}
