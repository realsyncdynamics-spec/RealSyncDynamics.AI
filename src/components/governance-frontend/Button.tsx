import { forwardRef } from 'react';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  /** Zeigt einen Spinner und sperrt die Interaktion. */
  loading?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
  className?: string;
};

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & { href?: undefined };

type ButtonAsLink = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps> & { href: string };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

const base =
  'relative inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold ' +
  'transition-[transform,filter,background-color,border-color,color,box-shadow] duration-150 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ' +
  'disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-cyan-400 to-teal-300 text-[#03212b] ' +
    'shadow-[0_0_36px_-10px_rgba(34,211,238,0.85)] ' +
    'hover:brightness-110 hover:shadow-[0_0_48px_-8px_rgba(34,211,238,0.95)] ' +
    'active:scale-[0.98] active:brightness-95',
  secondary:
    'border border-white/15 bg-white/[0.03] text-slate-200 backdrop-blur-sm ' +
    'hover:border-cyan-300/50 hover:bg-cyan-400/[0.07] hover:text-white ' +
    'active:scale-[0.98]',
  ghost:
    'text-slate-300 hover:bg-white/[0.06] hover:text-white active:scale-[0.98]',
  link:
    'rounded-md px-0 py-0 font-medium text-cyan-300 hover:text-cyan-200 ' +
    'underline-offset-4 hover:underline',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-[13px]',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-sm',
};

/**
 * Button des Governance-AI-Frontends (Referenzdesign, Upload 2026-08-16).
 * Rendert <a>, sobald `href` gesetzt ist — sonst <button>.
 */
const Button = forwardRef<HTMLButtonElement & HTMLAnchorElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    iconLeft,
    iconRight,
    loading = false,
    fullWidth = false,
    className = '',
    children,
    ...rest
  },
  ref
) {
  const classes = [
    base,
    variants[variant],
    variant === 'link' ? '' : sizes[size],
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
      {!loading && iconLeft}
      {children}
      {!loading && iconRight}
    </>
  );

  if ('href' in rest && rest.href !== undefined) {
    const { href, ...anchorRest } = rest as ButtonAsLink;
    const disabled = loading;
    return (
      <a
        ref={ref}
        href={disabled ? undefined : href}
        aria-disabled={disabled || undefined}
        aria-busy={loading || undefined}
        className={classes}
        {...anchorRest}
      >
        {content}
      </a>
    );
  }

  const { disabled, type, ...buttonRest } = rest as ButtonAsButton;
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes}
      {...buttonRest}
    >
      {content}
    </button>
  );
});

export default Button;
