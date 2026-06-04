/**
 * Read-only wrapper for /app/* routes in demo mode.
 * Blocks mutations and shows registration prompt.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, AlertTriangle, ArrowRight } from 'lucide-react';
import { useDemoMode, useActionBlockerInDemo } from '../core/demo/DemoModeProvider';

interface DemoReadOnlyWrapperProps {
  children: React.ReactNode;
  section?: string;
}

export function DemoReadOnlyWrapper({ children, section }: DemoReadOnlyWrapperProps) {
  const navigate = useNavigate();
  const { isDemoMode } = useDemoMode();
  const blocker = useActionBlockerInDemo();

  if (!isDemoMode || !blocker) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {/* Lock overlay banner */}
      <div className="sticky top-0 z-40 border-b border-amber-900 bg-amber-950/80 backdrop-blur-sm px-4 sm:px-6 py-3 flex items-center gap-3">
        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-amber-100">
            <span className="font-semibold">Demo-Modus:</span> Änderungen sind in dieser Vorschau gesperrt.
          </p>
        </div>
        <button
          onClick={() => navigate('/welcome?source=demo-readonly-action')}
          className="shrink-0 flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-amber-400 text-obsidian-950 rounded-none hover:bg-amber-300 transition-colors"
        >
          <Lock className="h-3.5 w-3.5" />
          Registrieren
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {/* Dimmed content area */}
      <div className="opacity-60 pointer-events-none select-none">
        {children}
      </div>
    </div>
  );
}
