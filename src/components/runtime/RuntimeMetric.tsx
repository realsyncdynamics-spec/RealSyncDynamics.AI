import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

// RuntimeMetric — a large number tile with a mono uppercase label and a
// delta tagline. Used inside metric strips (4-up grids) and dashboards.
// Animates the number from 0 to the target value once on first mount
// (cubic ease-out, ~1.2s). Respects useReducedMotion.

export type RuntimeMetricTone = 'cyan' | 'amber' | 'violet' | 'emerald' | 'titanium';

export interface RuntimeMetricProps {
  label: string;
  /** Numeric value (will be count-up animated) or a string (rendered as-is). */
  value: number | string;
  /** Small delta line below the value, e.g. "▲ live" or "open: 12". */
  delta?: string;
  /** Lucide icon, sized externally. */
  icon?: React.ReactNode;
  /** Tone of the value text. Default cyan. */
  tone?: RuntimeMetricTone;
  /** Disable the count-up animation. */
  static?: boolean;
  className?: string;
}

const TONE_TEXT: Record<RuntimeMetricTone, string> = {
  cyan:     'text-cyan-300',
  amber:    'text-amber-300',
  violet:   'text-violet-300',
  emerald:  'text-emerald-300',
  titanium: 'text-titanium-50',
};

const DELTA_TEXT: Record<RuntimeMetricTone, string> = {
  cyan:     'text-cyan-400',
  amber:    'text-amber-400',
  violet:   'text-violet-400',
  emerald:  'text-emerald-400',
  titanium: 'text-titanium-500',
};

export function RuntimeMetric({
  label,
  value,
  delta,
  icon,
  tone = 'cyan',
  static: isStatic = false,
  className,
}: RuntimeMetricProps) {
  const reduce = useReducedMotion();
  const isNum = typeof value === 'number';
  const [n, setN] = useState<number>(isNum && !isStatic && !reduce ? 0 : (isNum ? value : 0));
  const target = isNum ? value : 0;
  const started = useRef(false);

  useEffect(() => {
    if (!isNum || isStatic || reduce) {
      if (isNum) setN(value);
      return;
    }
    if (started.current) return;
    started.current = true;
    const start = performance.now();
    const dur = 1200;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isNum, isStatic, reduce, target, value]);

  const display = isNum ? n.toLocaleString('en-US') : String(value);

  return (
    <div className={['flex flex-col gap-2', className ?? ''].join(' ')}>
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
        {icon}
        {label}
      </div>
      <div className={`font-display font-semibold text-2xl sm:text-3xl tabular-nums ${TONE_TEXT[tone]}`}>
        {display}
      </div>
      {delta && (
        <div className={`font-mono text-[10px] ${DELTA_TEXT[tone]}`}>{delta}</div>
      )}
    </div>
  );
}
