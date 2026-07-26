import React from 'react';

/**
 * Typography components for dashboard consistency
 * Ensures all text follows the design system hierarchy
 */

interface TypographyProps {
  children: React.ReactNode;
  className?: string;
}

/** Page title — largest, most important */
export const PageTitle: React.FC<TypographyProps> = ({ children, className = '' }) => (
  <h1 className={`text-4xl font-display font-bold text-white ${className}`}>
    {children}
  </h1>
);

/** Section heading — sub-title, groups related content */
export const SectionHeading: React.FC<TypographyProps> = ({ children, className = '' }) => (
  <h2 className={`text-2xl font-display font-semibold text-white ${className}`}>
    {children}
  </h2>
);

/** Sub-section heading — smaller, within sections */
export const SubHeading: React.FC<TypographyProps> = ({ children, className = '' }) => (
  <h3 className={`text-lg font-semibold text-titanium ${className}`}>
    {children}
  </h3>
);

/** Group label — uppercase, small, for nav groups & labels */
export const GroupLabel: React.FC<TypographyProps> = ({ children, className = '' }) => (
  <span className={`text-xs font-semibold uppercase tracking-wider text-titanium/60 ${className}`}>
    {children}
  </span>
);

/** Body text — standard content */
export const BodyText: React.FC<TypographyProps> = ({ children, className = '' }) => (
  <p className={`text-sm text-titanium/70 leading-6 ${className}`}>
    {children}
  </p>
);

/** Hint text — secondary, explanatory */
export const HintText: React.FC<TypographyProps> = ({ children, className = '' }) => (
  <span className={`text-xs text-titanium/50 font-mono ${className}`}>
    {children}
  </span>
);

/** Label text — form labels, small text */
export const LabelText: React.FC<TypographyProps> = ({ children, className = '' }) => (
  <label className={`text-sm font-semibold text-titanium uppercase tracking-wide ${className}`}>
    {children}
  </label>
);

/** Metric value — large numbers, KPI values */
export const MetricValue: React.FC<TypographyProps> = ({ children, className = '' }) => (
  <span className={`text-4xl font-display font-bold text-white ${className}`}>
    {children}
  </span>
);

/** Status badge text — small, badge-style */
export const BadgeText: React.FC<TypographyProps> = ({ children, className = '' }) => (
  <span className={`text-xs font-mono font-semibold ${className}`}>
    {children}
  </span>
);

/** Mono text — code, technical, IDs */
export const MonoText: React.FC<TypographyProps> = ({ children, className = '' }) => (
  <code className={`font-mono text-sm text-titanium/70 ${className}`}>
    {children}
  </code>
);
