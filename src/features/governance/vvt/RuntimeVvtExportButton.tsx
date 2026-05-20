import { Download } from 'lucide-react';
import type { RuntimeVvtEntry } from './types';

interface Props {
  entries: RuntimeVvtEntry[];
  /** Optional: zusaetzlicher Kontext, der mit-exportiert wird. */
  context?: Record<string, unknown>;
}

/**
 * Exportiert die uebergebenen Eintraege als JSON-File. Kein Server-Roundtrip,
 * keine Telemetrie — rein clientseitiges Blob + Download-Trigger.
 *
 * Dateiname: realsync-runtime-vvt-export-YYYY-MM-DD.json
 */
export function RuntimeVvtExportButton({ entries, context }: Props) {
  const onClick = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      disclaimer:
        'Technisch generierter VVT-Entwurf — aus Runtime-Ereignissen abgeleitet. ' +
        'Keine Rechtsfreigabe. Human Review erforderlich.',
      context: context ?? {},
      entries,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const today = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `realsync-runtime-vvt-export-${today}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 border border-ai-cyan-500/50 bg-ai-cyan-900/20 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-ai-cyan-200 hover:bg-ai-cyan-900/40 disabled:opacity-40"
      disabled={entries.length === 0}
    >
      <Download className="h-3.5 w-3.5" />
      JSON exportieren
    </button>
  );
}
