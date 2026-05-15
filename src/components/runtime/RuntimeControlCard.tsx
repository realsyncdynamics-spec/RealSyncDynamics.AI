import { motion, useReducedMotion } from 'motion/react';
import { RuntimeStatusPill } from './RuntimeStatusPill';

// RuntimeControlCard — surface for a single governance control / policy.
// E.g. "consent-banner enforcement · enforced · 12 sites compliant".
// Compact layout: icon + name + status pill + description + scope strip.

export type ControlStatus =
  | 'enforced'
  | 'monitor-only'
  | 'draft'
  | 'failing'
  | 'disabled';

const STATUS_MAP: Record<ControlStatus, { pill: 'live' | 'warn' | 'error' | 'idle'; label: string }> = {
  enforced:       { pill: 'live',  label: 'enforced' },
  'monitor-only': { pill: 'warn',  label: 'monitor' },
  draft:          { pill: 'idle',  label: 'draft' },
  failing:        { pill: 'error', label: 'failing' },
  disabled:       { pill: 'idle',  label: 'disabled' },
};

export interface RuntimeControlMeta {
  /** Inline mono label, e.g. "scope" or "owner". */
  label: string;
  value: string;
}

export interface RuntimeControlCardProps {
  /** Lucide icon, sized externally. */
  icon: React.ReactNode;
  /** Mono technical name, e.g. "consent-pre-load-block". */
  name: string;
  /** Human-readable description. */
  description: string;
  status: ControlStatus;
  /** Optional inline metadata strip (up to 4 entries). */
  meta?: RuntimeControlMeta[];
  /** Optional action slot, e.g. a "view policy" link. */
  action?: React.ReactNode;
  className?: string;
}

export function RuntimeControlCard({
  icon,
  name,
  description,
  status,
  meta = [],
  action,
  className,
}: RuntimeControlCardProps) {
  const reduce = useReducedMotion();
  const s = STATUS_MAP[status];
  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.35 }}
      className={[
        'bg-obsidian-950 border border-titanium-900 p-5 flex flex-col gap-3',
        className ?? '',
      ].join(' ')}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex w-8 h-8 items-center justify-center bg-obsidian-900 border border-titanium-800 text-titanium-200 shrink-0">
            {icon}
          </span>
          <div className="min-w-0">
            <div className="font-mono text-sm text-titanium-50 truncate">{name}</div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mt-0.5">
              control
            </div>
          </div>
        </div>
        <RuntimeStatusPill status={s.pill} label={s.label} />
      </header>

      <p className="text-sm text-titanium-300 leading-relaxed flex-1">{description}</p>

      {meta.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 pt-2 border-t border-titanium-900/60">
          {meta.slice(0, 4).map((m) => (
            <li
              key={m.label}
              className="font-mono text-[10px] uppercase tracking-wider text-titanium-500"
            >
              {m.label}: <span className="text-titanium-200 normal-case">{m.value}</span>
            </li>
          ))}
        </ul>
      )}

      {action && (
        <div className="pt-2 border-t border-titanium-900/60">{action}</div>
      )}
    </motion.article>
  );
}
