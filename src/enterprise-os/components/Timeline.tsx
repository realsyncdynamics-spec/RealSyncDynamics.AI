import React from 'react';
import type { RiskLevel } from './Badge';

export interface TimelineEvent {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  level: RiskLevel;
}

const DOT_COLOR: Record<RiskLevel, string> = {
  critical: 'bg-risk-critical',
  high: 'bg-risk-high',
  medium: 'bg-risk-medium',
  low: 'bg-risk-low',
  passed: 'bg-risk-passed',
};

export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="relative space-y-0">
      {events.map((event, idx) => (
        <li key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
          {idx < events.length - 1 && (
            <span className="absolute left-[5px] top-3 h-full w-px bg-titanium-800" aria-hidden="true" />
          )}
          <span className={`relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT_COLOR[event.level]}`} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-sm font-medium text-titanium-100">{event.title}</h4>
              <span className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 tabular">
                {event.timestamp}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-titanium-400">{event.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
