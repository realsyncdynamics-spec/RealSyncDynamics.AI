import { cx } from './cx';

/**
 * Einheitlicher Status-Badge, Semantik wie Landing v4 (`[data-st]`):
 *   live      → Cyan (einzige erlaubte Cyan-Verwendung)
 *   beta      → Champagner
 *   in-arbeit → Bronze
 *   geplant   → Titan
 */
export type BrandStatus = 'live' | 'beta' | 'in-arbeit' | 'geplant';

export const STATUS_LABELS: Record<BrandStatus, string> = {
  live: 'Live',
  beta: 'Beta',
  'in-arbeit': 'In Arbeit',
  geplant: 'Geplant',
};

export const STATUS_COLOR_VAR: Record<BrandStatus, string> = {
  live: '--brand-live',
  beta: '--brand-status-beta',
  'in-arbeit': '--brand-status-wip',
  geplant: '--brand-status-planned',
};

const STYLES: Record<BrandStatus, string> = {
  live: 'text-[var(--brand-live)] border-[color-mix(in_srgb,var(--brand-live)_45%,transparent)] bg-[color-mix(in_srgb,var(--brand-live)_10%,transparent)]',
  beta: 'text-[var(--brand-status-beta)] border-[color-mix(in_srgb,var(--brand-status-beta)_45%,transparent)] bg-[color-mix(in_srgb,var(--brand-status-beta)_10%,transparent)]',
  'in-arbeit':
    'text-[var(--brand-status-wip)] border-[color-mix(in_srgb,var(--brand-status-wip)_45%,transparent)] bg-[color-mix(in_srgb,var(--brand-status-wip)_10%,transparent)]',
  geplant:
    'text-[var(--brand-status-planned)] border-[color-mix(in_srgb,var(--brand-status-planned)_40%,transparent)] bg-transparent',
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: BrandStatus;
  /** Optionaler Text; Standard ist das deutsche Status-Label. */
  label?: string;
  className?: string;
}) {
  return (
    <span
      data-status={status}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-[var(--brand-radius-sm)] border px-2 py-0.5',
        'font-[family-name:var(--brand-mono)] text-[10px] uppercase tracking-[0.14em]',
        STYLES[status],
        className,
      )}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {label ?? STATUS_LABELS[status]}
    </span>
  );
}
