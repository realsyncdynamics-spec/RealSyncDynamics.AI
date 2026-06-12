import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
}

export function Card({ children, className = '', as = 'div' }: CardProps) {
  const Tag = as;
  return (
    <Tag className={`border border-titanium-800 bg-obsidian-800/60 ${className}`}>
      {children}
    </Tag>
  );
}

interface CardHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  eyebrow?: React.ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, action, eyebrow, className = '' }: CardHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-4 border-b border-titanium-800 px-5 py-4 ${className}`}>
      <div>
        {eyebrow && (
          <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">
            {eyebrow}
          </p>
        )}
        <h3 className="font-display text-sm font-semibold text-titanium-50">{title}</h3>
        {subtitle && <p className="mt-1 text-xs text-titanium-400">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`border-t border-titanium-800 px-5 py-3 ${className}`}>{children}</div>;
}
