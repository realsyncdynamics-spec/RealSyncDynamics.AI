import { motion, useReducedMotion } from 'motion/react';
import { RuntimeStatusPill, type RuntimeStatus } from './RuntimeStatusPill';

// RuntimeCard — bordered card with an optional macOS-traffic-light header,
// title, badge slot, and status pill. The primary primitive most other
// runtime widgets compose with.

export interface RuntimeCardProps {
  /** Mono title in the header. */
  title?: string;
  /** Badge / status info on the right of the header. */
  badge?: React.ReactNode;
  /** Optional runtime status pill in the header. */
  status?: RuntimeStatus;
  /** Status pill label (defaults to status). */
  statusLabel?: string;
  /** Show the macOS-traffic-light dots in the header. */
  trafficLights?: boolean;
  /** Padding for the body. */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** ARIA label. */
  ariaLabel?: string;
  /** Fade-in on viewport entry. Disabled if reduced-motion is set. */
  reveal?: boolean;
  className?: string;
  children: React.ReactNode;
}

const PADDING: Record<NonNullable<RuntimeCardProps['padding']>, string> = {
  none: 'p-0',
  sm:   'p-3',
  md:   'p-4',
  lg:   'p-6',
};

export function RuntimeCard({
  title,
  badge,
  status,
  statusLabel,
  trafficLights = false,
  padding = 'md',
  ariaLabel,
  reveal = true,
  className,
  children,
}: RuntimeCardProps) {
  const reduce = useReducedMotion();
  const showHeader = !!(title || badge || status || trafficLights);

  return (
    <motion.article
      aria-label={ariaLabel ?? title}
      initial={!reveal || reduce ? false : { opacity: 0, y: 6 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.35 }}
      className={[
        'bg-obsidian-950 border border-titanium-900 flex flex-col overflow-hidden',
        className ?? '',
      ].join(' ')}
    >
      {showHeader && (
        <header className="flex items-center justify-between gap-3 px-3 py-2 border-b border-titanium-900 bg-obsidian-900 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
          <div className="flex items-center gap-2 min-w-0">
            {trafficLights && (
              <span className="inline-flex gap-1 shrink-0">
                <span className="w-2 h-2 rounded-full bg-red-500/70" />
                <span className="w-2 h-2 rounded-full bg-amber-500/70" />
                <span className="w-2 h-2 rounded-full bg-emerald-500/70" />
              </span>
            )}
            {title && <span className="truncate">{title}</span>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {status && <RuntimeStatusPill status={status} label={statusLabel} />}
            {badge && <span>{badge}</span>}
          </div>
        </header>
      )}
      <div className={PADDING[padding]}>{children}</div>
    </motion.article>
  );
}
