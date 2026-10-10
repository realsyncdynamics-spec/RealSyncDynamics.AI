import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import type { BrandTone } from './Button';

/** Brand-Karte: Hairline-Rahmen, v4-Radius, optional Kicker + Titel. */
export function brandCardClass(tone: BrandTone = 'dark', className?: string): string {
  return cx(
    'rounded-[var(--brand-radius-lg)] border p-5 sm:p-6',
    tone === 'dark'
      ? 'bg-[var(--brand-bg-2)] border-[var(--brand-line-dark)] text-[var(--brand-champ-hi)] shadow-[var(--brand-shadow-dark)]'
      : 'bg-[var(--brand-paper)] border-[var(--brand-divider)] text-[var(--brand-ink)] shadow-[var(--brand-shadow-sm)]',
    className,
  );
}

export function Card({
  tone = 'dark',
  kicker,
  title,
  className,
  children,
  ...rest
}: {
  tone?: BrandTone;
  kicker?: ReactNode;
  title?: ReactNode;
  className?: string;
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'className' | 'children'>) {
  return (
    <div data-tone={tone} className={brandCardClass(tone, className)} {...rest}>
      {kicker && (
        <div
          className={cx(
            'mb-2 font-[family-name:var(--brand-mono)] text-[10px] uppercase tracking-[0.18em]',
            tone === 'dark' ? 'text-[var(--brand-champ)]' : 'text-[var(--brand-gold-ink)]',
          )}
        >
          {kicker}
        </div>
      )}
      {title && (
        <h3
          className={cx(
            'mb-2 font-[family-name:var(--brand-serif)] text-xl font-semibold leading-tight',
            tone === 'dark' ? 'text-[var(--brand-champ-hi)]' : 'text-[var(--brand-ink)]',
          )}
        >
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
