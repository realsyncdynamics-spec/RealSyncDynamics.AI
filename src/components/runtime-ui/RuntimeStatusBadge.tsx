import type { ReactNode } from 'react';
import type { RuntimeSeverity } from '../../lib/runtime/runtimeTypes';

type Tone =
  | 'neutral' | 'info' | 'cyan' | 'warn' | 'danger' | 'success' | 'demo';

const TONES: Record<Tone, string> = {
  neutral: 'text-titanium-200 border-titanium-700 bg-obsidian-900',
  info:    'text-security-200 border-security-500/40 bg-security-500/10',
  cyan:    'text-ai-cyan-300 border-ai-cyan-500/40 bg-ai-cyan-900/30',
  warn:    'text-amber-200 border-amber-500/40 bg-amber-500/10',
  danger:  'text-rose-200 border-rose-500/40 bg-rose-500/10',
  success: 'text-emerald-200 border-emerald-500/40 bg-emerald-500/10',
  demo:    'text-ai-cyan-200 border-ai-cyan-500/30 bg-ai-cyan-900/20',
};

export interface RuntimeStatusBadgeProps {
  label:  ReactNode;
  tone?:  Tone;
  icon?:  ReactNode;
  live?:  boolean;
}

export function RuntimeStatusBadge({ label, tone = 'neutral', icon, live }: RuntimeStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide ${TONES[tone]}`}
    >
      {live ? (
        <span aria-hidden className="inline-block h-1.5 w-1.5 bg-ai-cyan-400 rt-live-dot" />
      ) : null}
      {icon ?? null}
      {label}
    </span>
  );
}

export function severityToTone(severity: RuntimeSeverity): Tone {
  switch (severity) {
    case 'critical': return 'danger';
    case 'high':     return 'danger';
    case 'medium':   return 'warn';
    case 'low':      return 'info';
    case 'info':
    default:         return 'neutral';
  }
}
