import React from 'react';
import { Zap, Clock, Lightbulb } from 'lucide-react';
import type { ModuleStatus } from './moduleConfig';

interface ModuleStatusBadgeProps {
  status: ModuleStatus;
  compact?: boolean;
}

/**
 * Module status badge (Live / Beta / Roadmap).
 * Used in governance module navigation and module listings.
 */
export function ModuleStatusBadge({ status, compact = false }: ModuleStatusBadgeProps) {
  if (compact) {
    return <CompactBadge status={status} />;
  }
  return <InlineBadge status={status} />;
}

function InlineBadge({ status }: { status: ModuleStatus }) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/60 text-emerald-300 text-[10px] font-mono uppercase tracking-wider rounded-none">
        <Zap className="h-3 w-3" />
        Live
      </span>
    );
  }

  if (status === 'beta') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 border border-amber-500/60 text-amber-300 text-[10px] font-mono uppercase tracking-wider rounded-none">
        <Clock className="h-3 w-3" />
        Beta
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-titanium-700/30 border border-titanium-700/60 text-titanium-400 text-[10px] font-mono uppercase tracking-wider rounded-none">
      <Lightbulb className="h-3 w-3" />
      Roadmap
    </span>
  );
}

function CompactBadge({ status }: { status: ModuleStatus }) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-1" title="Live" />
    );
  }

  if (status === 'beta') {
    return (
      <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-amber-400 shrink-0 ml-1" title="Beta" />
    );
  }

  return (
    <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-titanium-500 shrink-0 ml-1" title="Roadmap" />
  );
}
