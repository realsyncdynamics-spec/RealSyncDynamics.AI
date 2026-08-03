import React from 'react';
import { BUTTON_VARIANTS, BUTTON_SIZES, COLORS } from '../../styles/design-tokens';

interface SovereignButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'outline' | 'ghost' | 'danger' | 'success' | 'warning' | 'subtle';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  isFullWidth?: boolean;
}

const LoadingSpinner = ({ size }: { size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' }) => {
  const spinnerSizeMap = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-7 h-7',
  };

  return (
    <svg
      className={`${spinnerSizeMap[size]} animate-spin`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
};

export const SovereignButton = ({
  variant = 'primary',
  size = 'md',
  children,
  leftIcon,
  rightIcon,
  loading = false,
  disabled = false,
  isFullWidth = false,
  className = '',
  ...props
}: SovereignButtonProps) => {
  const baseStyles = "inline-flex items-center justify-center gap-2 font-mono font-bold uppercase tracking-widest transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-obsidian focus:ring-security-blue";

  const variantStyles = {
    primary: `bg-security-blue text-obsidian hover:bg-blue-600 active:bg-blue-700 shadow-md hover:shadow-lg`,
    secondary: `bg-petrol text-white hover:bg-teal-700 active:bg-teal-800 shadow-md hover:shadow-lg`,
    tertiary: `bg-transparent border-2 border-titanium text-titanium hover:bg-titanium/10 active:bg-titanium/20 focus:ring-titanium`,
    outline: `bg-transparent border-2 border-titanium/50 text-titanium hover:border-titanium hover:bg-titanium/10 active:bg-titanium/20`,
    ghost: `bg-transparent text-titanium hover:bg-obsidian/40 active:bg-obsidian/60`,
    danger: `bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-md hover:shadow-lg`,
    success: `bg-green-600 text-white hover:bg-green-700 active:bg-green-800 shadow-md hover:shadow-lg`,
    warning: `bg-amber-500 text-obsidian hover:bg-amber-600 active:bg-amber-700 shadow-md hover:shadow-lg`,
    subtle: `bg-titanium/10 text-titanium hover:bg-titanium/20 active:bg-titanium/30`,
  };

  const sizeStyles = {
    xs: 'px-2 py-1 text-xs h-6',
    sm: 'px-3 py-2 text-sm h-8',
    md: 'px-4 py-2.5 text-base h-10',
    lg: 'px-6 py-3 text-lg h-12',
    xl: 'px-8 py-4 text-xl h-14',
  };

  const disabledStyles = 'opacity-60 cursor-not-allowed';
  const fullWidthStyles = isFullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${disabled || loading ? disabledStyles : ''} ${fullWidthStyles} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <LoadingSpinner size={size} />}
      {!loading && leftIcon && <span className="flex items-center justify-center">{leftIcon}</span>}
      {children}
      {!loading && rightIcon && <span className="flex items-center justify-center">{rightIcon}</span>}
    </button>
  );
};
