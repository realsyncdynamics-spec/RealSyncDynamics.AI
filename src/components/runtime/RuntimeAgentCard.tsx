import { motion, useReducedMotion } from 'motion/react';
import { RuntimeStatusPill } from './RuntimeStatusPill';
import type { RuntimeMetricTone } from './RuntimeMetric';

// RuntimeAgentCard — control-plane style card for a single governance agent.
// Top row: icon + name + role + status pill. Body: blurb. Footer: up to 4
// inline metrics. Compact (~260px tall) and tiles nicely in a 2-col grid.

export interface RuntimeAgentMetric {
  label: string;
  value: string;
  tone?: RuntimeMetricTone;
}

export interface RuntimeAgentCardProps {
  /** Lucide icon, sized externally. */
  icon: React.ReactNode;
  /** Mono technical name, e.g. "drift-agent". */
  name: string;
  /** Optional role label, e.g. "detect · monitor". */
  role?: string;
  /** Status of the agent: live (running), warn (degraded), idle (paused). */
  status?: 'live' | 'warn' | 'idle';
  /** One-sentence description. */
  blurb: string;
  /** Up to 4 metrics rendered as a grid below the blurb. */
  metrics?: RuntimeAgentMetric[];
  /** Pulse the status dot on this card. */
  pulse?: boolean;
  className?: string;
}

const TONE_TEXT: Record<RuntimeMetricTone, string> = {
  cyan:     'text-cyan-300',
  amber:    'text-amber-300',
  violet:   'text-violet-300',
  emerald:  'text-emerald-300',
  titanium: 'text-titanium-100',
};

export function RuntimeAgentCard({
  icon,
  name,
  role,
  status = 'live',
  blurb,
  metrics = [],
  pulse = true,
  className,
}: RuntimeAgentCardProps) {
  const reduce = useReducedMotion();
  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.35 }}
      className={[
        'bg-obsidian-950 border border-titanium-900 p-5 flex flex-col gap-4',
        className ?? '',
      ].join(' ')}
    >
      <header className="flex items-center gap-3 justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex w-8 h-8 items-center justify-center bg-obsidian-900 border border-titanium-800 text-titanium-200 shrink-0">
            {icon}
          </span>
          <div className="min-w-0">
            <div className="font-mono text-sm text-titanium-50 truncate">{name}</div>
            {role && (
              <div className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mt-0.5 truncate">
                {role}
              </div>
            )}
          </div>
        </div>
        <RuntimeStatusPill status={status} pulse={pulse} />
      </header>

      <p className="text-sm text-titanium-300 leading-relaxed flex-1">{blurb}</p>

      {metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-px bg-titanium-900/60">
          {metrics.slice(0, 4).map((m) => (
            <div key={m.label} className="bg-obsidian-950 p-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-1">
                {m.label}
              </div>
              <div
                className={`font-display font-semibold text-xl tabular-nums ${
                  TONE_TEXT[m.tone ?? 'cyan']
                }`}
              >
                {m.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.article>
  );
}
