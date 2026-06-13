import React, { useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { Card, CardHeader } from '../components/Card';
import { StatusBadge } from '../components/Badge';
import { ScoreGauge } from '../components/ScoreGauge';
import { EmptyState } from '../components/States';
import { COMPLIANCE_OBLIGATIONS, SCORES } from '../mock/data';

const CATEGORIES = ['Alle', 'DSGVO', 'EU AI Act', 'TTDSG'] as const;

export function CompliancePage() {
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('Alle');

  const obligations = COMPLIANCE_OBLIGATIONS.filter((o) =>
    category === 'Alle' ? true : o.framework.startsWith(category)
  );
  const openCount = COMPLIANCE_OBLIGATIONS.filter((o) => o.status !== 'passed').length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">
          Compliance Command Center
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold text-titanium-50 sm:text-3xl">Compliance</h1>
        <p className="mt-1 text-sm text-titanium-400">
          {openCount} offene Pflichten · DSGVO, TTDSG &amp; EU AI Act im Überblick
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="flex flex-col items-center justify-center gap-3 py-6">
          <ScoreGauge score={SCORES.overall} label="Gesamt-Score" />
        </Card>
        <Card className="flex flex-col items-center justify-center gap-3 py-6">
          <ScoreGauge score={SCORES.dsgvo} label="DSGVO" />
        </Card>
        <Card className="flex flex-col items-center justify-center gap-3 py-6">
          <ScoreGauge score={SCORES.aiAct} label="EU AI Act" />
        </Card>
        <Card className="flex flex-col items-center justify-center gap-3 py-6">
          <ScoreGauge score={SCORES.monitoring} label="Monitoring" />
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`border px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider transition-colors ${
              category === c
                ? 'border-security-500 bg-security-500/10 text-security-300'
                : 'border-titanium-800 text-titanium-400 hover:border-titanium-600 hover:text-titanium-100'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader
          eyebrow="Pflichten & Fristen"
          title="Offene und erledigte Aufgaben"
          subtitle="Nach Frist sortiert · automatisch aus Scans und manuellen Eingaben abgeleitet"
        />
        {obligations.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck className="h-5 w-5" />}
            title="Keine Pflichten in dieser Kategorie"
            description="Wählen Sie eine andere Kategorie, um Pflichten anzuzeigen."
          />
        ) : (
          <div className="divide-y divide-titanium-800">
            {obligations.map((o) => (
              <div key={o.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <StatusBadge level={o.status} />
                    <span className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">{o.framework}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-titanium-100">{o.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-titanium-400">{o.description}</p>
                </div>
                <div className="shrink-0 text-left font-mono text-[10px] uppercase tracking-wider text-titanium-500 sm:text-right">
                  <p>Fällig: <span className="tabular text-titanium-300">{o.dueDate}</span></p>
                  <p className="mt-1">{o.owner}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
