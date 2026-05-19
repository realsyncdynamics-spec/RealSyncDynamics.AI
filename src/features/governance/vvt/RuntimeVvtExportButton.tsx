import { Download } from 'lucide-react';
import type { RuntimeVvtEntry } from './types';

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm   = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd   = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function buildExportPayload(entries: RuntimeVvtEntry[]): string {
  const payload = {
    schema:        'realsync.runtime-vvt.v1',
    generated_at:  new Date().toISOString(),
    disclaimer:    'Technisch aus Runtime-Ereignissen abgeleitet. Keine rechtliche Bewertung. Human Review erforderlich.',
    entry_count:   entries.length,
    entries,
  };
  return JSON.stringify(payload, null, 2);
}

export function exportFileName(): string {
  return `realsync-runtime-vvt-export-${todayIso()}.json`;
}

export function RuntimeVvtExportButton({ entries }: { entries: RuntimeVvtEntry[] }) {
  const disabled = entries.length === 0;
  function onClick() {
    if (disabled) return;
    const json = buildExportPayload(entries);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = exportFileName();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 border border-titanium-700 bg-obsidian-950 px-3 py-2 font-mono text-xs uppercase tracking-wide text-titanium-100 hover:border-security-500 hover:text-security-200 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Download className="h-4 w-4" />
      JSON-Export ({entries.length})
    </button>
  );
}
