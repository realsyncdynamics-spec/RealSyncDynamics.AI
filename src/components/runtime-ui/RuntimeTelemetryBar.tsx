import type { ReactNode } from 'react';
import { RuntimeStatusBadge } from './RuntimeStatusBadge';

export interface RuntimeTelemetryBarProps {
  /** Linke Seite: Quelle / Zeitstempel-Label. */
  source:     string;
  /** Rechte Seite: Live/Demo/Status-Badge Inhalt. */
  state:      'live' | 'demo' | 'simulated' | 'paused';
  /** Optional zusaetzlicher Inhalt (z. B. Generated-At). */
  meta?:      ReactNode;
}

const STATE_PROPS: Record<RuntimeTelemetryBarProps['state'], { label: string; tone: 'success' | 'demo' | 'warn' | 'neutral'; live: boolean }> = {
  live:      { label: 'Live-Telemetrie',          tone: 'success', live: true  },
  demo:      { label: 'Demo-Telemetrie',          tone: 'demo',    live: false },
  simulated: { label: 'Simulierter Runtime-Stream', tone: 'warn',    live: false },
  paused:    { label: 'Pausiert',                 tone: 'neutral', live: false },
};

export function RuntimeTelemetryBar({ source, state, meta }: RuntimeTelemetryBarProps) {
  const props = STATE_PROPS[state];
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border border-titanium-800 bg-obsidian-900 px-3 py-1.5">
      <div className="flex items-center gap-3">
        <RuntimeStatusBadge label={props.label} tone={props.tone} live={props.live} />
        <span className="font-mono text-[11px] uppercase tracking-wide text-titanium-400">
          Quelle: {source}
        </span>
      </div>
      <div className="rt-telemetry-track h-1 w-24 sm:w-40" aria-hidden />
      {meta ? (
        <span className="font-mono text-[11px] uppercase tracking-wide text-titanium-500">{meta}</span>
      ) : null}
    </div>
  );
}
