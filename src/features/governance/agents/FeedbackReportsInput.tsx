// FeedbackReportsInput — strukturiertes Eingabefeld für den Feedback-
// Intelligence-Agenten. Sammelt wiederholbare Report-Zeilen (Typ, Schweregrad,
// optionaler Titel) und baut daraus das `{ reports: [...] }`-payload.
//
// Der Agent liest `input.payload.reports` als Array von { type, severity, title }
// (siehe src/lib/enterprise-ai-os/agents/feedback-intelligence-agent.ts) und
// clustert nach Typ; Titel-Stichworte (crash/error, performance, api,
// security …) verfeinern die Cluster.
import React, { useState } from 'react';
import { Play, Loader2, Plus, Trash2 } from 'lucide-react';

export interface ReportRow {
  type: string;
  severity: string;
  title: string;
}

export const REPORT_TYPE_OPTIONS = [
  { value: 'bug', label: 'Fehler' },
  { value: 'feature_request', label: 'Feature-Wunsch' },
  { value: 'other', label: 'Sonstiges' },
];

export const REPORT_SEVERITY_OPTIONS = [
  { value: 'critical', label: 'Kritisch' },
  { value: 'high', label: 'Hoch' },
  { value: 'medium', label: 'Mittel' },
  { value: 'low', label: 'Niedrig' },
];

function emptyRow(): ReportRow {
  return { type: 'bug', severity: 'medium', title: '' };
}

/**
 * Baut aus den Zeilen das `{ reports }`-payload. Leere Titel werden weggelassen;
 * Zeilen ohne Typ werden übersprungen.
 */
export function buildReportsPayload(rows: ReportRow[]): { reports: Array<Record<string, unknown>> } {
  const reports = rows
    .filter((r) => r.type)
    .map((r) => {
      const report: Record<string, unknown> = { type: r.type, severity: r.severity };
      const title = r.title.trim();
      if (title.length > 0) report.title = title;
      return report;
    });
  return { reports };
}

interface Props {
  busy: boolean;
  onSubmit: (payload: { reports: Array<Record<string, unknown>> }) => void;
}

export function FeedbackReportsInput({ busy, onSubmit }: Props) {
  const [rows, setRows] = useState<ReportRow[]>([emptyRow()]);

  function updateRow(idx: number, patch: Partial<ReportRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }
  function removeRow(idx: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(buildReportsPayload(rows));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs text-titanium-500">
        Feedback-Meldungen für die Cluster-Analyse. Titel-Stichworte (z. B. „crash", „performance", „api") verfeinern die Cluster.
      </p>

      <div className="space-y-2">
        {rows.map((row, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-start">
            <div>
              {idx === 0 && <span className="block font-mono text-[9px] text-titanium-600 uppercase mb-1">Typ</span>}
              <select
                aria-label={`Typ ${idx + 1}`}
                value={row.type}
                onChange={(e) => updateRow(idx, { type: e.target.value })}
                className="w-full bg-obsidian-950 border border-titanium-800 px-2 py-1.5 text-xs text-titanium-100 focus:border-teal-600 focus:outline-none"
              >
                {REPORT_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              {idx === 0 && <span className="block font-mono text-[9px] text-titanium-600 uppercase mb-1">Schweregrad</span>}
              <select
                aria-label={`Schweregrad ${idx + 1}`}
                value={row.severity}
                onChange={(e) => updateRow(idx, { severity: e.target.value })}
                className="w-full bg-obsidian-950 border border-titanium-800 px-2 py-1.5 text-xs text-titanium-100 focus:border-teal-600 focus:outline-none"
              >
                {REPORT_SEVERITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              {idx === 0 && <span className="block font-mono text-[9px] text-titanium-600 uppercase mb-1">&nbsp;</span>}
              <button
                type="button"
                aria-label={`Zeile ${idx + 1} entfernen`}
                onClick={() => removeRow(idx)}
                disabled={rows.length === 1}
                className="p-1.5 text-titanium-500 border border-titanium-800 hover:text-red-400 hover:border-red-800 transition-colors disabled:opacity-30"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <input
              type="text"
              aria-label={`Titel ${idx + 1}`}
              value={row.title}
              placeholder="Titel (optional) — z. B. Login crash"
              onChange={(e) => updateRow(idx, { title: e.target.value })}
              className="col-span-3 w-full bg-obsidian-950 border border-titanium-800 px-2 py-1.5 text-xs text-titanium-100 placeholder:text-titanium-700 focus:border-teal-600 focus:outline-none"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-mono text-titanium-400 border border-titanium-800 hover:bg-obsidian-800 transition-colors"
      >
        <Plus className="h-3 w-3" /> Meldung hinzufügen
      </button>

      <div className="pt-1">
        <button
          type="submit"
          disabled={busy}
          className="flex items-center justify-center gap-1.5 w-full py-2 text-xs font-mono text-white bg-teal-600 hover:bg-teal-500 transition-colors disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          Skill starten
        </button>
      </div>
    </form>
  );
}
