import React from 'react';

interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  error?: boolean;
  helperText?: string;
}

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  (
    {
      label,
      description,
      size = 'md',
      error = false,
      helperText,
      className = '',
      disabled = false,
      ...props
    },
    ref
  ) => {
    const sizeStyles = {
      sm: 'w-4 h-4',
      md: 'w-5 h-5',
      lg: 'w-6 h-6',
    };

    const labelSizeStyles = {
      sm: 'text-xs',
      md: 'text-sm',
      lg: 'text-base',
    };

    const radioClasses = `${sizeStyles[size]} accent-security-blue cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-obsidian focus:ring-security-blue ${
      error ? 'border-red-500' : 'border-titanium/30'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`;

    return (
      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            ref={ref}
            type="radio"
            className={`${radioClasses} mt-1`}
            disabled={disabled}
            {...props}
          />
          <div className="flex flex-col gap-0.5">
            {label && (
              <span className={`font-mono font-semibold text-titanium ${labelSizeStyles[size]}`}>
                {label}
              </span>
            )}
            {description && (
              <span className={`font-mono text-titanium/60 ${labelSizeStyles[size]}`}>
                {description}
              </span>
            )}
          </div>
        </label>
        {error && helperText && (
          <span className="text-xs text-red-400 ml-8">{helperText}</span>
        )}
      </div>
    );
  }
);

Radio.displayName = 'Radio';
