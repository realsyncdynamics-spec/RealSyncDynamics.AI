import type { RuntimeLogEntry } from '../../lib/runtime/runtimeTypes';
import { RuntimeStatusBadge, severityToTone } from './RuntimeStatusBadge';

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('de-DE', { hour12: false });
  } catch {
    return iso;
  }
}

export interface RuntimeLogStreamProps {
  entries:   RuntimeLogEntry[];
  /** Wenn true, wird der Live-Dot im Header angezeigt. Default true. */
  live?:     boolean;
  /** Maximalhoehe in px (default 320). */
  maxHeight?: number;
}

export function RuntimeLogStream({ entries, live = true, maxHeight = 320 }: RuntimeLogStreamProps) {
  return (
    <div className="border border-titanium-800 bg-obsidian-950">
      <div className="flex items-center justify-between border-b border-titanium-800 bg-obsidian-900 px-3 py-2">
        <span className="font-mono text-[11px] uppercase tracking-wide text-titanium-400">
          Runtime-Stream
        </span>
        {live ? (
          <RuntimeStatusBadge label="Live" tone="cyan" live />
        ) : (
          <RuntimeStatusBadge label="Pausiert" tone="neutral" />
        )}
      </div>
      <ul
        style={{ maxHeight }}
        className="divide-y divide-titanium-800/60 overflow-y-auto font-mono text-xs"
      >
        {entries.length === 0 ? (
          <li className="px-3 py-6 text-center text-titanium-500">
            — kein Ereignis im Stream —
          </li>
        ) : (
          entries.map((entry) => (
            <li key={entry.id} className="rt-stream-row flex items-start gap-3 px-3 py-2">
              <span className="w-20 shrink-0 text-titanium-500">{formatTime(entry.occurred_at)}</span>
              <RuntimeStatusBadge label={entry.severity} tone={severityToTone(entry.severity)} />
              <span className="min-w-0 flex-1 break-words text-titanium-200">
                {entry.message}
                {entry.source ? (
                  <span className="ml-2 text-titanium-500">· {entry.source}</span>
                ) : null}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
