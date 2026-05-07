/**
 * SectionDivider — brass-etched horizontal rule with optional center label.
 *
 * Used between Landing sections to reinforce the Watchmaker-AI rhythm:
 *   - Thin brass-shimmer line spans the content width
 *   - Optional centered label box (gunmetal background, brass-700 border,
 *     mono uppercase brass-400 text) reads like an engraving plate
 *
 * Decorative only — `aria-hidden`. Doesn't introduce new spacing assumptions;
 * caller controls vertical rhythm via outer wrapper.
 */

type Props = {
  /** Optional label rendered as engraved center plate */
  label?: string;
  /** Vertical padding on the wrapper. Default 'lg' = py-16. */
  spacing?: 'sm' | 'md' | 'lg';
};

const SPACING = {
  sm: 'py-8',
  md: 'py-12',
  lg: 'py-16',
} as const;

export function SectionDivider({ label, spacing = 'lg' }: Props) {
  return (
    <div
      aria-hidden="true"
      className={`relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 ${SPACING[spacing]}`}
    >
      <div className="absolute inset-x-4 sm:inset-x-6 lg:inset-x-8 top-1/2 h-px surface-brass opacity-40" />
      {label && (
        <div className="relative flex justify-center">
          <span className="bg-obsidian-950 px-4 py-1.5 border border-brass-700/50 text-[10px] font-mono uppercase tracking-[0.3em] text-brass-400">
            {label}
          </span>
        </div>
      )}
    </div>
  );
}
