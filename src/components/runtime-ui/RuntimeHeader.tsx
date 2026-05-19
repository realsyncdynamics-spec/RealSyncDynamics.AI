import { Activity } from 'lucide-react';
import type { ReactNode } from 'react';
import { RuntimeStatusBadge } from './RuntimeStatusBadge';

export interface RuntimeHeaderProps {
  title:    string;
  /** Kurzer Untertitel — meist Mission-Statement der Surface. */
  subtitle?: string;
  /** „Demo", „Live", „Review" — wird als Badge rechts angezeigt. */
  state?:   { label: string; tone?: 'success' | 'warn' | 'danger' | 'demo'; live?: boolean };
  /** CTAs oder Filter rechts in der Toolbar. */
  actions?: ReactNode;
}

export function RuntimeHeader({ title, subtitle, state, actions }: RuntimeHeaderProps) {
  return (
    <header className="border-b border-titanium-800 bg-obsidian-900/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
        <div className="border border-titanium-800 bg-obsidian-950 p-2">
          <Activity className="h-4 w-4 text-ai-cyan-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-lg font-bold tracking-tight text-titanium-50 sm:text-xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="font-mono text-[11px] uppercase tracking-wide text-titanium-500">
              {subtitle}
            </p>
          ) : null}
        </div>
        {state ? (
          <RuntimeStatusBadge label={state.label} tone={state.tone ?? 'cyan'} live={state.live} />
        ) : null}
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
