export interface RuntimeGaugeProps {
  label:    string;
  /** 0..1 (Anteil). */
  value:    number;
  hint?:    string;
}

export function RuntimeGauge({ label, value, hint }: RuntimeGaugeProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const radius      = 28;
  const stroke      = 4;
  const circumference = 2 * Math.PI * radius;
  const dash        = circumference * clamped;
  const gap         = circumference - dash;

  return (
    <div className="flex items-center gap-3 border border-titanium-800 bg-obsidian-950 p-3">
      <svg viewBox="0 0 72 72" className="h-16 w-16 -rotate-90" aria-hidden>
        <circle cx="36" cy="36" r={radius} stroke="var(--color-titanium-800)" strokeWidth={stroke} fill="none" />
        <circle
          cx="36"
          cy="36"
          r={radius}
          stroke="var(--color-ai-cyan-500)"
          strokeWidth={stroke}
          strokeLinecap="butt"
          strokeDasharray={`${dash} ${gap}`}
          fill="none"
        />
      </svg>
      <div className="min-w-0">
        <p className="font-mono text-[11px] uppercase tracking-wide text-titanium-500">{label}</p>
        <p className="font-display text-xl font-bold text-titanium-50">
          {Math.round(clamped * 100)}<span className="ml-0.5 font-mono text-sm text-titanium-400">%</span>
        </p>
        {hint ? <p className="text-[11px] text-titanium-500">{hint}</p> : null}
      </div>
    </div>
  );
}
