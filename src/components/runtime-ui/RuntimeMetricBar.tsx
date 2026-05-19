export interface RuntimeMetricBarProps {
  label:    string;
  value:    number;
  /** 0..100 — Wert wird visuell darauf normiert. */
  max?:     number;
  /** Optionaler Suffix-Text rechts vom Wert (z. B. „events/h"). */
  unit?:    string;
  tone?:    'cyan' | 'security' | 'warn' | 'danger';
}

const TRACK_TONES: Record<NonNullable<RuntimeMetricBarProps['tone']>, string> = {
  cyan:     'bg-ai-cyan-500',
  security: 'bg-security-500',
  warn:     'bg-amber-500',
  danger:   'bg-rose-500',
};

export function RuntimeMetricBar({
  label,
  value,
  max = 100,
  unit,
  tone = 'cyan',
}: RuntimeMetricBarProps) {
  const safeMax = max > 0 ? max : 100;
  const pct = Math.max(0, Math.min(100, Math.round((value / safeMax) * 100)));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-wide text-titanium-400">
        <span>{label}</span>
        <span>
          {value}
          {unit ? <span className="ml-1 text-titanium-500">{unit}</span> : null}
        </span>
      </div>
      <div
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-label={label}
        className="h-1.5 w-full border border-titanium-800 bg-obsidian-900"
      >
        <div
          className={`h-full ${TRACK_TONES[tone]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
