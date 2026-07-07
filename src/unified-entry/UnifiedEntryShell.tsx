import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';

interface UnifiedEntryShellProps {
  children: React.ReactNode;
  showProgress?: boolean;
  currentStep?: number;
  totalSteps?: number;
}

export function UnifiedEntryShell({
  children,
  showProgress = true,
  currentStep = 1,
  totalSteps = 5,
}: UnifiedEntryShellProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen h-screen h-dvh flex flex-col bg-gradient-to-br from-obsidian-950 via-slate-900 to-obsidian-950 text-titanium-50">
      {/* Top bar */}
      <div className="border-b border-titanium-800 px-6 py-4 flex items-center justify-between bg-obsidian-950/50 backdrop-blur-sm">
        <button
          onClick={() => navigate('/')}
          className="hover:opacity-80 transition-opacity"
          aria-label="Go home"
        >
          <Logo size={40} />
        </button>

        {showProgress && totalSteps > 0 && (
          <div className="flex items-center gap-2 text-xs text-titanium-400">
            <span>Schritt {currentStep} von {totalSteps}</span>
            <div className="h-1 w-24 bg-titanium-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-petrol-600 transition-all duration-300"
                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
              />
            </div>
          </div>
        )}

        <button
          onClick={() => navigate('/')}
          className="text-xs text-titanium-400 hover:text-titanium-200 transition-colors"
        >
          Abbrechen
        </button>
      </div>

      {/* Main canvas */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-6 py-8 h-full flex flex-col justify-center">
          {children}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-titanium-800 px-6 py-4 bg-obsidian-950/50 backdrop-blur-sm text-center text-xs text-titanium-500">
        <p>EU-sovereign platform for compliance & governance</p>
      </div>
    </div>
  );
}
