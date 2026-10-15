// KI-Nutzung & Kosten — nur nachweisbare Werte aus den bestehenden Ledgern.
// Provider-Kontingente sind nicht angebunden und werden ausdrücklich nicht
// geschätzt. Beträge in USD, wie sie im Ledger stehen (keine Umrechnung).

import React from 'react';
import { useAiOsResource } from '../aiOsApi';
import { Empty, Kpi, Note, Panel, ReloadButton, ResourceView } from '../ui';

interface Bucket { key: string; amountUsd: number; rows: number }

export interface CostsResponse {
  configured?: boolean;
  message?: string;
  periodDays: number;
  since: string;
  currency: 'USD';
  ledger:
    | { available: false; error: string }
    | { available: true; rows: number; truncated: boolean; totalUsd: number; byVendor: Bucket[]; byModel: Bucket[]; byKind: Bucket[] };
  toolRuns:
    | { available: false; error: string }
    | { available: true; rows: number; truncated: boolean; inputTokens: number; outputTokens: number; errorRuns: number; byTool: Bucket[] };
  providerQuotas: { available: false; message: string };
}

const usd = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const int = (n: number) => n.toLocaleString('de-DE');

function BucketTable({ rows, label }: { rows: Bucket[]; label: string }) {
  if (rows.length === 0) return <Empty>Keine Einträge im Zeitraum.</Empty>;
  const max = Math.max(...rows.map((r) => r.amountUsd), 0);
  return (
    <div className="aios-table-wrap">
      <table className="aios-table">
        <thead><tr><th>{label}</th><th>USD</th><th>Einträge</th><th aria-hidden="true" /></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="aios-mono">{r.key}</td>
              <td className="aios-mono">{usd(r.amountUsd)}</td>
              <td className="aios-mono">{int(r.rows)}</td>
              <td style={{ width: '30%' }} aria-hidden="true">
                <div style={{ height: 6, background: 'var(--aios-panel-2)' }}>
                  <div style={{ height: 6, width: `${max > 0 ? (r.amountUsd / max) * 100 : 0}%`, background: 'var(--aios-accent)' }} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CostsSection() {
  const res = useAiOsResource<CostsResponse>('costs');
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="aios-h1">KI-Nutzung & Kosten</h1>
          <p className="aios-lead">Plattformweite Summen der letzten 30 Tage aus dem Kosten-Ledger und den Werkzeugläufen. Keine Einzelzeilen, keine Mandantenkennungen.</p>
        </div>
        <ReloadButton onClick={res.reload} loading={res.loading} />
      </div>
      <ResourceView resource={res}>
        {(d) => (
          <>
            <div className="aios-grid">
              <Kpi label="Ledger-Kosten (USD)" value={d.ledger.available ? usd(d.ledger.totalUsd) : '—'} sub={d.ledger.available ? `${int(d.ledger.rows)} Buchungen${d.ledger.truncated ? ' (gekappt)' : ''}` : d.ledger.error} />
              <Kpi label="Eingabe-Tokens" value={d.toolRuns.available ? int(d.toolRuns.inputTokens) : '—'} sub="ai_tool_runs" />
              <Kpi label="Ausgabe-Tokens" value={d.toolRuns.available ? int(d.toolRuns.outputTokens) : '—'} sub="ai_tool_runs" />
              <Kpi label="Fehlgeschlagene Läufe" value={d.toolRuns.available ? int(d.toolRuns.errorRuns) : '—'} sub={d.toolRuns.available ? `von ${int(d.toolRuns.rows)}` : d.toolRuns.error} />
            </div>
            {((d.ledger.available && d.ledger.truncated) || (d.toolRuns.available && d.toolRuns.truncated)) && (
              <Note tone="warn">Mehr als 20.000 Zeilen im Zeitraum — die Summen sind gekappt und damit Untergrenzen.</Note>
            )}
            <Note tone="info">{d.providerQuotas.message}</Note>
            {d.ledger.available && (
              <>
                <Panel title="Nach Anbieter" source={`tenant_cost_ledger seit ${d.since.slice(0, 10)}, is_simulated = false`}><BucketTable rows={d.ledger.byVendor} label="Anbieter" /></Panel>
                <Panel title="Nach Modell (Top 15)" source="tenant_cost_ledger.model_ref"><BucketTable rows={d.ledger.byModel} label="Modell" /></Panel>
                <Panel title="Nach Kostenart" source="tenant_cost_ledger.cost_kind"><BucketTable rows={d.ledger.byKind} label="Kostenart" /></Panel>
              </>
            )}
            {d.toolRuns.available && (
              <Panel title="Nach Werkzeug (Top 15)" source="ai_tool_runs.cost_usd"><BucketTable rows={d.toolRuns.byTool} label="Werkzeug" /></Panel>
            )}
          </>
        )}
      </ResourceView>
    </>
  );
}
