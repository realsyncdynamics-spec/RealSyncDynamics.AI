import { useState } from 'react';
import { Activity, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ModuleStatusBadge } from '../../../components/governance-os/ModuleStatusBadge';
import type { ControlSignal, ControlSignalStatus } from './dsgvoControlPackTypes';
import { DsgvoControlSignalRow } from './DsgvoControlSignalRow';

const ROADMAP_ITEMS = [
  { label: 'EU AI Act Monitoring',     desc: 'Automatische Erkennung von KI-Systemen und Risikoeinstufung nach Annex III', tier: 'Growth' },
  { label: 'Vendor Risk Scanner',      desc: 'Bewertung aller Drittanbieter gegen SCCs, BCRs und Adequacy Decisions', tier: 'Growth' },
  { label: 'Security Header Watcher',  desc: 'CSP, HSTS, X-Frame-Options — kontinuierliches Drift-Monitoring', tier: 'Starter' },
  { label: 'Evidence Vault',           desc: 'SHA-256-versiegelte Snapshots aller Findings mit Zeitstempel-Chain', tier: 'Agency' },
];

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

      {/* Roadmap */}
      <div className="mt-6 border border-titanium-900 bg-obsidian-900">
        <div className="px-4 py-2 border-b border-titanium-900 flex items-center gap-2">
          <Lock className="h-3 w-3 text-titanium-600" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-titanium-500">
            Kommende Module · Roadmap
          </span>
        </div>
        <div className="divide-y divide-titanium-900">
          {ROADMAP_ITEMS.map((item) => (
            <div key={item.label} className="flex items-start justify-between gap-4 px-4 py-3 opacity-60">
              <div>
                <p className="text-xs font-semibold text-titanium-300">{item.label}</p>
                <p className="text-[11px] text-titanium-600 leading-relaxed mt-0.5">{item.desc}</p>
              </div>
              <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider border border-titanium-800 px-1.5 py-0.5 text-titanium-600">
                {item.tier}
              </span>
            </div>
          ))}
        </div>
        <div className="px-4 py-2 border-t border-titanium-900">
          <Link
            to="/pricing"
            className="font-mono text-[10px] text-cyan-500 hover:text-cyan-300 transition-colors"
          >
            Upgrade für frühen Zugang →
          </Link>
        </div>
      </div>
    </section>
  );
}
