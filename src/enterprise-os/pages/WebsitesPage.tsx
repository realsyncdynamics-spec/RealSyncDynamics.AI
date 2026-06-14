import React, { useState } from 'react';
import { Globe2, RefreshCw } from 'lucide-react';
import { Button } from '../components/Button';
import { Card, CardHeader } from '../components/Card';
import { StatusBadge, RISK_LABELS, type RiskLevel } from '../components/Badge';
import { ScoreGauge } from '../components/ScoreGauge';
import { EmptyState } from '../components/States';
import { WEBSITES } from '../mock/data';

const FILTERS: { id: RiskLevel | 'all'; label: string }[] = [
  { id: 'all', label: 'Alle' },
  { id: 'critical', label: RISK_LABELS.critical },
  { id: 'high', label: RISK_LABELS.high },
  { id: 'medium', label: RISK_LABELS.medium },
  { id: 'passed', label: RISK_LABELS.passed },
];

export function WebsitesPage() {
  const [filter, setFilter] = useState<RiskLevel | 'all'>('all');
  const sites = WEBSITES.filter((s) => filter === 'all' || s.status === filter);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">
            Asset Overview
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-titanium-50 sm:text-3xl">Websites</h1>
          <p className="mt-1 text-sm text-titanium-400">
            {WEBSITES.length} überwachte Domains · letzter vollständiger Scan vor 2 Std.
          </p>
        </div>
        <Button variant="primary" size="sm">
          <RefreshCw className="mr-2 h-3.5 w-3.5" /> Neuen Scan starten
        </Button>
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

      {sites.length === 0 ? (
        <EmptyState
          icon={<Globe2 className="h-5 w-5" />}
          title="Keine Websites in dieser Kategorie"
          description="Wählen Sie einen anderen Filter, um Ihre Domains anzuzeigen."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((site) => (
            <Card key={site.id}>
              <CardHeader
                eyebrow="Domain"
                title={site.domain}
                subtitle={`${site.pages} Seiten · ${site.cookies} Cookies · ${site.trackers} Tracker`}
                action={<StatusBadge level={site.status} />}
              />
              <div className="flex items-center justify-between gap-4 px-5 py-4">
                <ScoreGauge score={site.score} label="Score" size={72} />
                <div className="flex flex-col gap-2 text-right">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                    Letzter Scan: {site.lastScan}
                  </p>
                  <Button variant="secondary" size="sm">
                    Details ansehen
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
