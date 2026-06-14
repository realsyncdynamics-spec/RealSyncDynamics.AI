import React from 'react';
import { Inbox, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick?: () => void };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 border border-dashed border-titanium-800 px-6 py-14 text-center ${className}`}>
      <span className="flex h-12 w-12 items-center justify-center border border-titanium-800 bg-obsidian-900 text-titanium-500">
        {icon ?? <Inbox className="h-5 w-5" />}
      </span>
      <div>
        <h3 className="font-display text-sm font-semibold text-titanium-100">{title}</h3>
        {description && <p className="mt-1 max-w-sm text-xs text-titanium-500">{description}</p>}
      </div>
      {action && (
        <Button variant="secondary" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function LoadingState({ label = 'Lädt …', className = '' }: { label?: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 px-6 py-14 text-center ${className}`}>
      <Loader2 className="h-5 w-5 animate-spin text-security-400" />
      <p className="font-mono text-[10px] uppercase tracking-widest text-titanium-500">{label}</p>
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  description?: string;
  action?: { label: string; onClick?: () => void };
  className?: string;
}

export function ErrorState({
  title = 'Etwas ist schiefgelaufen',
  description = 'Die Daten konnten nicht geladen werden. Bitte versuche es erneut.',
  action,
  className = '',
}: ErrorStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 border border-risk-critical/30 bg-risk-critical-soft px-6 py-14 text-center ${className}`}>
      <span className="flex h-12 w-12 items-center justify-center border border-risk-critical/40 bg-obsidian-900 text-risk-critical">
        <AlertTriangle className="h-5 w-5" />
      </span>
      <div>
        <h3 className="font-display text-sm font-semibold text-titanium-100">{title}</h3>
        <p className="mt-1 max-w-sm text-xs text-titanium-400">{description}</p>
      </div>
      {action && (
        <Button variant="secondary" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-titanium-800/60 ${className}`} />;
}
