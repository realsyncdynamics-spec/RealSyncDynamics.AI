import React from 'react';

interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'error';
}

const variantClasses = {
  default: 'bg-security-blue',
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
};

const sizeClasses = {
  sm: 'h-2',
  md: 'h-3',
  lg: 'h-4',
};

export const ProgressBar = React.forwardRef<HTMLDivElement, ProgressBarProps>(
  (
    {
      value,
      max = 100,
      showLabel = false,
      size = 'md',
      variant = 'default',
      className = '',
      ...props
    },
    ref
  ) => {
    const percentage = Math.min((value / max) * 100, 100);

    return (
      <div ref={ref} className={className} {...props}>
        <div className={`w-full ${sizeClasses[size]} bg-titanium/10 rounded-full overflow-hidden`}>
          <div
            className={`${sizeClasses[size]} ${variantClasses[variant]} transition-all duration-300 rounded-full`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {showLabel && (
          <p className="text-xs text-titanium/60 font-mono mt-1">
            {Math.round(percentage)}%
          </p>
        )}
      </div>
    );
  }
);

ProgressBar.displayName = 'ProgressBar';

interface ProgressRingProps extends React.SVGProps<SVGSVGElement> {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'error';
}

const variantCircleClasses = {
  default: '#0052FF',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
};

export const ProgressRing = React.forwardRef<SVGSVGElement, ProgressRingProps>(
  (
    {
      value,
      max = 100,
      size = 100,
      strokeWidth = 4,
      showLabel = true,
      variant = 'default',
      className = '',
      ...props
    },
    ref
  ) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (value / max) * circumference;
    const percentage = Math.min((value / max) * 100, 100);

    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="relative" style={{ width: size, height: size }}>
          <svg
            ref={ref}
            width={size}
            height={size}
            style={{ transform: 'rotate(-90deg)' }}
            {...props}
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#E2E2E2"
              strokeWidth={strokeWidth}
              opacity="0.1"
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={variantCircleClasses[variant]}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 300ms ease' }}
            />
          </svg>
          {showLabel && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-mono font-semibold text-titanium">
                {Math.round(percentage)}%
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }
);

ProgressRing.displayName = 'ProgressRing';
