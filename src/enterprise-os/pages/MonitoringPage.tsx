import React, { useState } from 'react';
import { Activity } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../components/Card';
import { RISK_LABELS, type RiskLevel } from '../components/Badge';
import { Timeline } from '../components/Timeline';
import { EmptyState } from '../components/States';
import { MONITORING_EVENTS } from '../mock/data';

const FILTERS: { id: RiskLevel | 'all'; label: string }[] = [
  { id: 'all', label: 'Alle' },
  { id: 'critical', label: RISK_LABELS.critical },
  { id: 'high', label: RISK_LABELS.high },
  { id: 'medium', label: RISK_LABELS.medium },
  { id: 'low', label: RISK_LABELS.low },
  { id: 'passed', label: RISK_LABELS.passed },
];

export function MonitoringPage() {
  const [filter, setFilter] = useState<RiskLevel | 'all'>('all');
  const events = MONITORING_EVENTS.filter((e) => filter === 'all' || e.level === filter);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">Live</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-titanium-50 sm:text-3xl">Monitoring</h1>
        <p className="mt-1 text-sm text-titanium-400">
          Kontinuierliche Überwachung aller Assets · {MONITORING_EVENTS.length} Ereignisse in den letzten 7 Tagen
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

      <Card>
        <CardHeader eyebrow="Timeline" title="Ereignisverlauf" subtitle="Neueste Ereignisse zuerst" />
        <CardBody>
          {events.length === 0 ? (
            <EmptyState
              icon={<Activity className="h-5 w-5" />}
              title="Keine Ereignisse in dieser Kategorie"
              description="Wählen Sie einen anderen Filter, um Ereignisse anzuzeigen."
            />
          ) : (
            <Timeline events={events} />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
