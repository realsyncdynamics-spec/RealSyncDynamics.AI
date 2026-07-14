import React from 'react';
import { AlertCircle, Calendar, RotateCcw, Zap } from 'lucide-react';

interface ScanLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  limit: number;
  used: number;
  remaining: number;
  resetDate: Date | null;
}

export function ScanLimitModal({
  isOpen,
  onClose,
  limit,
  used,
  remaining,
  resetDate,
}: ScanLimitModalProps) {
  if (!isOpen) return null;

  const resetDateStr = resetDate
    ? new Intl.DateTimeFormat('de-DE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(resetDate)
    : 'Unbekannt';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-obsidian-900 border border-titanium-800 rounded-none max-w-md w-full p-6 space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-none bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
            <AlertCircle className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-titanium-50 mb-1">
              Scan-Limit erreicht
            </h2>
            <p className="text-sm text-titanium-400">
              Du hast dein monatliches Scan-Limit aufgebraucht.
            </p>
          </div>
        </div>

        <div className="space-y-3 bg-obsidian-950 p-4 border border-titanium-800 rounded-none">
          <div className="flex items-center justify-between">
            <span className="text-sm text-titanium-400">Scans diesen Monat:</span>
            <span className="font-mono text-lg font-semibold text-titanium-300">
              {used} / {limit}
            </span>
          </div>
          <div className="w-full bg-titanium-900 rounded-none h-2 overflow-hidden">
            <div
              className="bg-amber-500 h-full transition-all"
              style={{ width: `${(used / limit) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-obsidian-950 p-4 border border-titanium-800 rounded-none space-y-3">
          <div className="flex items-start gap-3">
            <Calendar className="w-4 h-4 text-titanium-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-titanium-500 font-mono mb-1">NÄCHSTER RESET</p>
              <p className="text-sm text-titanium-300">{resetDateStr}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <RotateCcw className="w-4 h-4 text-titanium-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-titanium-500 font-mono mb-1">VERBLEIBEND</p>
              <p className="text-sm text-titanium-300">
                Dein Limit setzt sich am {resetDateStr} zurück.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-ai-cyan-500/10 border border-ai-cyan-500/30 p-4 rounded-none">
          <div className="flex items-start gap-2">
            <Zap className="w-4 h-4 text-ai-cyan-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-ai-cyan-300 mb-1">
                Plan upgraden?
              </p>
              <p className="text-xs text-ai-cyan-200">
                Mit einem Upgrade hast du unbegrenzte Scans und viele weitere Features.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-none border border-titanium-700 text-titanium-300 hover:text-titanium-50 hover:border-titanium-600 transition-colors font-medium"
          >
            Schließen
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-none bg-ai-cyan-500 hover:bg-ai-cyan-600 text-obsidian-950 font-semibold transition-colors"
          >
            Plan upgraden
          </button>
        </div>
      </div>
    </div>
  );
}
