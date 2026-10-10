import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cx } from './cx';

/**
 * Brand-Button im Landing-v4-Look (Dark/Gold/Cream).
 *
 * - `primary`   — auf dunkel: Champagner-Fläche; auf hell: Gold-Outline (wie `.gv4 .btn-primary`)
 * - `secondary` — Hairline-Outline
 * - `ghost`     — nur Text in Akzentfarbe
 *
 * `tone` wählt den Untergrund (`dark` = Obsidian-Flächen, `light` = Paper).
 * Kein Blau, kein Cyan — Cyan ist dem Live-Status vorbehalten.
 */
export type BrandButtonVariant = 'primary' | 'secondary' | 'ghost';
export type BrandTone = 'dark' | 'light';
export type BrandButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 font-[family-name:var(--brand-sans)] font-semibold tracking-tight ' +
  'rounded-[var(--brand-radius-md)] border transition-colors no-underline ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-champ)] ' +
  'disabled:opacity-45 disabled:cursor-not-allowed';

const SIZES: Record<BrandButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-sm sm:text-base',
};

const VARIANTS: Record<BrandTone, Record<BrandButtonVariant, string>> = {
  dark: {
    primary:
      'bg-[var(--brand-champ)] border-[var(--brand-champ)] text-[var(--brand-bg-0)] hover:bg-[var(--brand-champ-hi)] hover:border-[var(--brand-champ-hi)]',
    secondary:
      'bg-transparent border-[var(--brand-line-dark-strong)] text-[var(--brand-champ-hi)] hover:border-[var(--brand-champ)] hover:bg-[rgba(242,201,138,0.08)]',
    ghost:
      'bg-transparent border-transparent text-[var(--brand-champ)] hover:text-[var(--brand-champ-hi)] hover:bg-[rgba(242,201,138,0.08)]',
  },
  light: {
    primary:
      'bg-transparent border-[var(--brand-gold)] text-[var(--brand-gold-ink)] hover:bg-[color-mix(in_srgb,var(--brand-gold)_12%,transparent)]',
    secondary:
      'bg-transparent border-[var(--brand-divider)] text-[var(--brand-ink)] hover:bg-[color-mix(in_srgb,var(--brand-ink)_7%,transparent)]',
    ghost:
      'bg-transparent border-transparent text-[var(--brand-gold-ink)] hover:bg-[color-mix(in_srgb,var(--brand-gold)_10%,transparent)]',
  },
};

export function brandButtonClass({
  variant = 'primary',
  tone = 'dark',
  size = 'md',
  className,
}: {
  variant?: BrandButtonVariant;
  tone?: BrandTone;
  size?: BrandButtonSize;
  className?: string;
} = {}): string {
  return cx(BASE, SIZES[size], VARIANTS[tone][variant], className);
}

interface CommonProps {
  variant?: BrandButtonVariant;
  tone?: BrandTone;
  size?: BrandButtonSize;
  className?: string;
  children: ReactNode;
}

type ButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, tone, size, className, type = 'button', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      data-variant={variant ?? 'primary'}
      className={brandButtonClass({ variant, tone, size, className })}
      {...rest}
    >
      {children}
    </button>
  );
});

/** Link-Variante (react-router) mit identischer Optik. */
export function ButtonLink({
  to,
  variant,
  tone,
  size,
  className,
  children,
}: CommonProps & { to: string }) {
  return (
    <Link
      to={to}
      data-variant={variant ?? 'primary'}
      className={brandButtonClass({ variant, tone, size, className })}
    >
      {children}
    </Link>
  );
}
