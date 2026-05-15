// RuntimeStatusPill — tiny status indicator with a pulsing dot.
// Used as a sub-component everywhere a "live / warn / error / idle"
// state needs to be surfaced inline (cards, headers, agent rows).

export type RuntimeStatus = 'live' | 'warn' | 'error' | 'idle';

export interface RuntimeStatusPillProps {
  status: RuntimeStatus;
  /** Human-readable label, e.g. "streaming". Defaults to the status string. */
  label?: string;
  /** Disable the ping animation. Honoured automatically under
   *  prefers-reduced-motion in modern browsers via CSS. */
  pulse?: boolean;
  className?: string;
}

const TONE: Record<RuntimeStatus, { dot: string; text: string; border: string; bg: string }> = {
  live:  { dot: 'bg-emerald-400', text: 'text-emerald-300', border: 'border-emerald-500/30', bg: 'bg-emerald-950/30' },
  warn:  { dot: 'bg-amber-400',   text: 'text-amber-300',   border: 'border-amber-500/30',   bg: 'bg-amber-950/30' },
  error: { dot: 'bg-red-400',     text: 'text-red-300',     border: 'border-red-500/30',     bg: 'bg-red-950/30' },
  idle:  { dot: 'bg-titanium-500', text: 'text-titanium-400', border: 'border-titanium-800',  bg: 'bg-obsidian-900' },
};

export function RuntimeStatusPill({
  status,
  label,
  pulse = true,
  className,
}: RuntimeStatusPillProps) {
  const t = TONE[status];
  return (
    <span
      role="status"
      aria-label={`runtime ${status}`}
      className={[
        'inline-flex items-center gap-1.5 px-2 py-0.5 border font-mono text-[10px] uppercase tracking-wider',
        t.border,
        t.bg,
        t.text,
        className ?? '',
      ].join(' ')}
    >
      <span className="relative inline-flex h-1.5 w-1.5">
        {pulse && status !== 'idle' && (
          <span
            className={`absolute inset-0 rounded-full opacity-75 motion-safe:animate-ping ${t.dot}`}
          />
        )}
        <span className={`relative inline-block h-1.5 w-1.5 rounded-full ${t.dot}`} />
      </span>
      {label ?? status}
    </span>
  );
}
