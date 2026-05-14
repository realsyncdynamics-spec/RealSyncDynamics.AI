import { motion, useReducedMotion } from 'motion/react';

// RuntimeShell — section wrapper for any runtime surface.
// Renders a dark observability-grade background with an optional subtle
// cyan grid, plus a standard eyebrow / title / sub header block. Wraps
// children in <section>, applies the canonical max-width container.

export interface RuntimeShellProps {
  /** Mono uppercase eyebrow above the title, e.g. "02 · detect". */
  eyebrow?: string;
  /** Section h2. */
  title?: string;
  /** Section sub-paragraph. */
  sub?: string;
  /** Override the background tone. */
  tone?: 'obsidian-950' | 'obsidian-900';
  /** Hide the grid backdrop. */
  hideGrid?: boolean;
  /** ARIA label override. */
  ariaLabel?: string;
  children: React.ReactNode;
}

export function RuntimeShell({
  eyebrow,
  title,
  sub,
  tone = 'obsidian-950',
  hideGrid = false,
  ariaLabel,
  children,
}: RuntimeShellProps) {
  const reduce = useReducedMotion();
  return (
    <section
      aria-label={ariaLabel ?? title ?? 'Runtime section'}
      className={[
        'relative border-b border-titanium-900 py-20 sm:py-28 px-4 sm:px-6 overflow-hidden',
        tone === 'obsidian-900' ? 'bg-obsidian-900' : 'bg-obsidian-950',
      ].join(' ')}
    >
      {!hideGrid && (
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(34,211,238,1) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,1) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />
      )}

      <div className="relative max-w-7xl mx-auto">
        {(eyebrow || title || sub) && (
          <motion.header
            initial={reduce ? false : { opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.4 }}
            className="max-w-3xl mb-10"
          >
            {eyebrow && (
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-titanium-500 mb-3">
                {eyebrow}
              </div>
            )}
            {title && (
              <h2 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight text-titanium-50 mb-3">
                {title}
              </h2>
            )}
            {sub && (
              <p className="text-titanium-300 text-base sm:text-lg leading-relaxed max-w-2xl">
                {sub}
              </p>
            )}
          </motion.header>
        )}

        {children}
      </div>
    </section>
  );
}
