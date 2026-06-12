import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-security-500 text-white hover:bg-security-400 border border-security-500 focus-visible:outline-security-300',
  secondary:
    'bg-transparent text-titanium-100 border border-titanium-700 hover:border-titanium-400 hover:text-white focus-visible:outline-titanium-300',
  ghost:
    'bg-transparent text-titanium-300 border border-transparent hover:bg-titanium-800/40 hover:text-white focus-visible:outline-titanium-400',
  danger:
    'bg-transparent text-risk-critical border border-risk-critical/50 hover:bg-risk-critical/10 hover:border-risk-critical focus-visible:outline-risk-critical',
};

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-[11px] gap-1.5',
  md: 'px-4 py-2.5 text-xs gap-2',
  lg: 'px-6 py-3.5 text-sm gap-2.5',
};

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center font-mono font-semibold uppercase tracking-wider transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40 disabled:pointer-events-none ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
