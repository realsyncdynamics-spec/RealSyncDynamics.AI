import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cx } from './cx';
import type { BrandTone } from './Button';

/** Brand-Eingabefeld (v4 `.input`): Hairline, Gold-Fokus, 36px Mindesthöhe. */
export const Input = forwardRef<
  HTMLInputElement,
  { label?: string; hint?: string; tone?: BrandTone; className?: string } & Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'className'
  >
>(function Input({ label, hint, tone = 'dark', className, id, ...rest }, ref) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const dark = tone === 'dark';
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className={cx(
            'mb-1.5 block font-[family-name:var(--brand-sans)] text-xs',
            dark ? 'text-[var(--brand-muted)]' : 'text-[color-mix(in_srgb,var(--brand-ink)_70%,transparent)]',
          )}
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-describedby={hintId}
        className={cx(
          'w-full min-h-9 rounded-[var(--brand-radius-md)] border px-2.5 py-1.5 text-sm font-[family-name:var(--brand-sans)]',
          'outline-none transition-colors disabled:opacity-50',
          dark
            ? 'bg-[var(--brand-bg-1)] border-[var(--brand-line-dark-strong)] text-[var(--brand-champ-hi)] placeholder:text-[var(--brand-titan)] caret-[var(--brand-champ)] focus:border-[var(--brand-champ)]'
            : 'bg-transparent border-[var(--brand-divider)] text-[var(--brand-ink)] caret-[var(--brand-gold)] focus:border-[var(--brand-gold)]',
          className,
        )}
        {...rest}
      />
      {hint && (
        <p id={hintId} className={cx('mt-1 text-xs', dark ? 'text-[var(--brand-titan)]' : 'text-[var(--brand-neutral-700)]')}>
          {hint}
        </p>
      )}
    </div>
  );
});
