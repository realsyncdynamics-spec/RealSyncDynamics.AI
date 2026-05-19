import type { ReactNode } from 'react';

export interface RuntimeSectionHeaderProps {
  eyebrow?: string;
  title:    string;
  subtitle?: string;
  actions?:  ReactNode;
}

export function RuntimeSectionHeader({ eyebrow, title, subtitle, actions }: RuntimeSectionHeaderProps) {
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-titanium-800 pb-3">
      <div>
        {eyebrow ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ai-cyan-400">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-1 font-display text-lg font-bold tracking-tight text-titanium-50">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 max-w-2xl text-sm text-titanium-400">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
