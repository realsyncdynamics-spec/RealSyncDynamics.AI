import { Copy, Check, AlertCircle, ArrowRight } from 'lucide-react';
import { useState } from 'react';

interface ApiSuccessStepProps {
  keyName: string;
  fullKey: string;
  onCopyConfirmed: () => void;
}

export function ApiSuccessStep({ keyName, fullKey, onCopyConfirmed }: ApiSuccessStepProps) {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const handleConfirmed = () => {
    setConfirmed(true);
    onCopyConfirmed();
  };

  if (confirmed) {
    return (
      <div className="space-y-4">
        <div className="bg-emerald-950/50 border border-emerald-700 rounded-none p-4 text-center">
          <div className="text-2xl mb-2">✓</div>
          <h3 className="text-base font-display font-bold text-emerald-200 mb-2">
            API-Key erstellt!
          </h3>
          <p className="text-sm text-emerald-100">
            Der Schlüssel ist jetzt aktiv und kannst du in deiner Integration verwenden.
          </p>
        </div>

        <div className="bg-obsidian-900 border border-titanium-800 rounded-none p-4">
          <p className="text-xs font-mono uppercase tracking-[0.1em] text-titanium-500 mb-2">
            API-Key Name
          </p>
          <p className="text-sm font-semibold text-titanium-100">{keyName}</p>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-titanium-300">Nächste Schritte:</p>
          <ul className="text-sm text-titanium-400 space-y-2">
            <li className="flex items-start gap-2">
              <span className="font-semibold text-titanium-300">1.</span>
              <span>Öffne die Dokumentation und kopiere ein Code-Beispiel</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-titanium-300">2.</span>
              <span>Ersetze <code className="text-xs px-1 py-0.5 bg-obsidian-950 rounded-none">YOUR_API_KEY</code> mit deinem Schlüssel</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-titanium-300">3.</span>
              <span>Integriere es in dein System</span>
            </li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-emerald-950/50 border border-emerald-700 rounded-none p-4">
        <div className="text-2xl mb-2">✓</div>
        <h3 className="text-base font-display font-bold text-emerald-200 mb-1">
          API-Key wurde erstellt
        </h3>
        <p className="text-sm text-emerald-100">
          Das ist das EINZIGE MAL, dass du diesen Schlüssel sehen wirst.
        </p>
      </div>

      <div className="bg-obsidian-900 border border-titanium-800 rounded-none p-4">
        <p className="text-xs font-mono uppercase tracking-[0.1em] text-titanium-500 mb-2">
          Dein API-Key (sicher kopieren)
        </p>
        <div className="flex items-start gap-2">
          <code className="flex-1 px-3 py-2 bg-obsidian-950 border border-titanium-700 text-emerald-300 text-xs font-mono break-all rounded-none overflow-x-auto max-h-24">
            {fullKey}
          </code>
          <button
            onClick={handleCopy}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-none font-bold text-xs transition-all ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-security-600 hover:bg-security-500 text-white'
            }`}
            data-testid="api-copy-button"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" /> Kopiert!
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" /> Kopieren
              </>
            )}
          </button>
        </div>
      </div>

      <div className="bg-amber-950/50 border border-amber-700 rounded-none p-4 flex gap-3">
        <div className="shrink-0 mt-0.5">
          <AlertCircle className="h-5 w-5 text-amber-300" />
        </div>
        <div className="text-sm text-amber-100">
          <p className="font-semibold mb-1">⚠️ Speichere den Schlüssel JETZT</p>
          <p className="text-xs">
            Nach dieser Seite wird der Key nicht mehr angezeigt. Speichere ihn in deinem Password-Manager oder an einem sicheren Ort.
          </p>
        </div>
      </div>

      <button
        onClick={handleConfirmed}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-none transition-colors"
        data-testid="api-confirm-saved-button"
      >
        Ich habe den Key gespeichert <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
