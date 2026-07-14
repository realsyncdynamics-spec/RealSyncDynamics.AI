/**
 * DemoTourDashboard — Governance-Dashboard im Demo-Mode
 *
 * Zeigt:
 * - Demo-Mode Banner oben (zeigt Demo-Benutzer-Daten)
 * - Echtes Governance-Dashboard mit Demo-Daten
 * - CTA-Footer zum echten Zugang
 */
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Lock } from 'lucide-react';
import { useDemoMode } from '../core/demo/DemoModeProvider';
import { useDemoTour } from '../core/demo/DemoTourContext';
import { DemoGovernanceDashboard } from './DemoGovernanceDashboard';

export function DemoTourDashboard() {
  const navigate = useNavigate();
  const { setDemoMode } = useDemoMode();
  const { tourState } = useDemoTour();

  useEffect(() => {
    setDemoMode(true);
  }, [setDemoMode]);

  const handleExitDemo = () => {
    setDemoMode(false);
    navigate('/');
  };

  const handleSignUp = () => {
    setDemoMode(false);
    navigate('/welcome?source=demo-exit');
  };

  return (
    <div className="min-h-screen bg-obsidian-950 flex flex-col">
      {/* Demo Banner */}
      <div className="bg-gradient-to-r from-amber-900 to-orange-900 border-b border-amber-800/50 sticky top-0 z-50">
        <div className="px-4 py-3 max-w-8xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <div className="min-w-0 text-sm">
              <p className="font-medium text-amber-100 flex items-center gap-2">
                <Lock className="w-4 h-4 shrink-0" />
                <strong>Demo-Modus</strong> — Interaktive Vorschau
              </p>
              <p className="text-xs text-amber-200 mt-0.5">
                {tourState.demoUserName} · {tourState.demoEmail} · {tourState.demoCompany}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleSignUp}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-700 hover:bg-amber-600 text-white text-sm font-semibold rounded transition-colors whitespace-nowrap"
            >
              Registrieren
            </button>
            <button
              onClick={handleExitDemo}
              className="p-2 hover:bg-amber-800/50 rounded transition-colors"
              title="Demo beenden"
            >
              <X className="w-5 h-5 text-amber-100" />
            </button>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="flex-1 overflow-auto">
        <DemoGovernanceDashboard />
      </div>

      {/* Footer CTA */}
      <div className="border-t border-titanium-800/30 bg-obsidian-900/50">
        <div className="px-4 py-6 max-w-8xl mx-auto">
          <div className="bg-obsidian-800/50 rounded-lg border border-titanium-800/30 p-6 flex items-center justify-between gap-6">
            <div>
              <h3 className="text-lg font-semibold text-titanium-100 mb-2">
                Bereit für den echten Zugang?
              </h3>
              <p className="text-sm text-titanium-400">
                Registrieren Sie sich kostenlos und nutzen Sie Governance OS mit Ihren eigenen Daten und AI-Systemen.
              </p>
            </div>
            <div className="flex gap-3 shrink-0">
              <button
                onClick={handleExitDemo}
                className="px-6 py-2.5 border border-titanium-700 text-titanium-100 hover:bg-titanium-800/20 rounded-lg font-semibold transition-colors whitespace-nowrap"
              >
                Später
              </button>
              <button
                onClick={handleSignUp}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors whitespace-nowrap"
              >
                Kostenlos registrieren
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
