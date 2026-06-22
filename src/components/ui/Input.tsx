import React from 'react';
import { INPUT_VARIANTS } from '../../styles/design-tokens';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'outline' | 'ghost' | 'filled';
  size?: 'sm' | 'md' | 'lg';
  error?: boolean;
  errorMessage?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  label?: string;
  helper?: string;
  isFullWidth?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      variant = 'outline',
      size = 'md',
      error = false,
      errorMessage,
      leftIcon,
      rightIcon,
      label,
      helper,
      isFullWidth = false,
      className = '',
      disabled = false,
      ...props
    },
    ref
  ) => {
    const baseInputStyles = 'font-mono transition-colors focus:outline-none';

    const variantStyles = {
      outline: `border border-titanium/30 bg-transparent text-titanium placeholder:text-titanium/40 hover:border-titanium/50 focus:border-security-blue focus:ring-1 focus:ring-security-blue/30`,
      ghost: `border-0 bg-obsidian/50 text-titanium placeholder:text-titanium/40 hover:bg-obsidian/60 focus:bg-obsidian/80 focus:ring-1 focus:ring-security-blue`,
      filled: `border-0 bg-titanium/10 text-titanium placeholder:text-titanium/40 hover:bg-titanium/15 focus:bg-titanium/20 focus:ring-1 focus:ring-security-blue`,
    };

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-sm h-8',
      md: 'px-4 py-2 text-base h-10',
      lg: 'px-5 py-3 text-lg h-12',
    };

    const errorStyles = error ? 'border-red-500 focus:border-red-600 focus:ring-red-500/30' : '';
    const disabledStyles = disabled ? 'opacity-50 cursor-not-allowed' : '';
    const fullWidthStyles = isFullWidth ? 'w-full' : '';

    const containerClasses = `flex flex-col gap-1 ${fullWidthStyles}`;
    const wrapperClasses = 'relative flex items-center';
    const inputClasses = `${baseInputStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${errorStyles} ${disabledStyles} ${className}`;

    return (
      <div className={containerClasses}>
        {label && (
          <label className="text-sm font-semibold text-titanium">
            {label}
          </label>
        )}
        <div className={wrapperClasses}>
          {leftIcon && (
            <span className="absolute left-3 flex items-center justify-center text-titanium/60">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            className={`${inputClasses} ${leftIcon ? 'pl-10' : ''} ${rightIcon ? 'pr-10' : 'w-full'}`}
            disabled={disabled}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-3 flex items-center justify-center text-titanium/60">
              {rightIcon}
            </span>
          )}
        </div>
        {error && errorMessage && (
          <span className="text-xs text-red-400">{errorMessage}</span>
        )}
        {!error && helper && (
          <span className="text-xs text-titanium/50">{helper}</span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
