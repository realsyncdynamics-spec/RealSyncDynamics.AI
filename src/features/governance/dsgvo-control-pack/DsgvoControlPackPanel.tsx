import { useState } from 'react';
import { Activity } from 'lucide-react';
import { ModuleStatusBadge } from '../../../components/governance-os/ModuleStatusBadge';
import type { ControlSignal, ControlSignalStatus } from './dsgvoControlPackTypes';
import { DsgvoControlSignalRow } from './DsgvoControlSignalRow';

interface Props {
  signals: ControlSignal[];
}

export function DsgvoControlPackPanel({ signals: initialSignals }: Props) {
  const [signals, setSignals] = useState(initialSignals);

  const handleStatusChange = (id: string, status: ControlSignalStatus) => {
    setSignals((prev) => prev.map((s) => s.id === id ? { ...s, status } : s));
  };

  const openCount = signals.filter((s) => s.status === 'open').length;

  return (
    <section className="mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-cyan-400" />
          <span className="font-display font-semibold text-sm text-titanium-50">
            Post-Market Monitoring
          </span>
          <ModuleStatusBadge status="beta" />
        </div>
        <span className="font-mono text-[10px] text-titanium-600">
          {openCount > 0 ? `${openCount} offen` : 'Alles behoben'} · letzte Prüfung: vor 14 min
        </span>
      </div>

      {/* Signal list */}
      <div className="border border-titanium-900 divide-y divide-titanium-900 bg-obsidian-950">
        {signals.map((signal) => (
          <DsgvoControlSignalRow
            key={signal.id}
            signal={signal}
            onStatusChange={handleStatusChange}
          />
        ))}
      </div>

      {/* Footer */}
      <p className="mt-2 font-mono text-[9px] text-titanium-700">
        Nächster Scan: automatisch · EU-Daten · kein Export an Dritte · Ergebnisse sind keine Rechtsberatung
      </p>
    </section>
  );
}
