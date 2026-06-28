import { useState, useRef, useEffect } from 'react';
import {
  X, RefreshCw, ExternalLink, Shield, ScanLine, FileCheck2,
  AlertTriangle, Loader2,
} from 'lucide-react';
import { getSupabase } from '../../lib/supabase';

interface EmbeddedBrowserCanvasProps {
  url: string;
  onClose: () => void;
  onScan: (url: string) => void;
}

export function EmbeddedBrowserCanvas({ url, onClose, onScan }: EmbeddedBrowserCanvasProps) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [evidenceLogged, setEvidenceLogged] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const logToolRun = async (toolKey: string, status: 'success' | 'error', metadata?: Record<string, unknown>) => {
    try {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const resp = await fetch('/functions/v1/log-tool-run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ tool_key: toolKey, status, metadata }),
      });
      if (!resp.ok) console.warn('Failed to log tool run:', resp.status);
    } catch (err) {
      console.warn('Error logging tool run:', err);
    }
  };

  const handleLoad = () => {
    setLoading(false);
    setLoadError(false);
    if (!evidenceLogged) {
      setEvidenceLogged(true);
      logToolRun('browser-preview-load', 'success', { url });
    }
  };

  const handleError = () => {
    setLoading(false);
    setLoadError(true);
    logToolRun('browser-preview-load', 'error', { url, error: 'iframe load failed' });
  };

  const reload = () => {
    setLoading(true);
    setLoadError(false);
    if (iframeRef.current) {
      // eslint-disable-next-line no-self-assign
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  const displayHost = (() => {
    try { return new URL(url).hostname; } catch { return url; }
  })();

  return (
    <div className="flex flex-col h-full bg-obsidian-950">
      {/* Embedded Browser Chrome */}
      <div className="h-10 shrink-0 bg-obsidian-900 border-b border-titanium-900 flex items-center gap-2 px-3">
        {/* Navigation */}
        <button
          onClick={reload}
          className="text-titanium-500 hover:text-titanium-200 transition-colors"
          title="Neu laden"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>

        {/* URL-Anzeige */}
        <div className="flex-1 flex items-center gap-2 bg-obsidian-950 border border-titanium-800 px-3 py-1 min-w-0">
          <Shield className="h-3 w-3 text-emerald-400 shrink-0" />
          <span className="font-mono text-[11px] text-titanium-300 truncate">{displayHost}</span>
          <span className="font-mono text-[10px] text-titanium-700 truncate hidden sm:block">{url}</span>
        </div>

        {/* DSGVO-Hinweis */}
        <span className="hidden md:flex items-center gap-1 font-mono text-[9px] text-titanium-600 border border-titanium-800 px-2 py-0.5 shrink-0">
          <AlertTriangle className="h-2.5 w-2.5 text-amber-600" />
          Client-seitig geladen
        </span>

        {/* Actions */}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-titanium-500 hover:text-titanium-200 transition-colors"
          title="In neuem Tab öffnen"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <button
          onClick={onClose}
          className="text-titanium-500 hover:text-titanium-200 transition-colors"
          title="Schließen"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Scan-Aktionsleiste */}
      <div className="h-9 shrink-0 bg-obsidian-900 border-b border-titanium-900 flex items-center gap-2 px-3">
        <span className="font-mono text-[9px] uppercase tracking-widest text-titanium-600 mr-1">
          Governance
        </span>
        <button
          onClick={() => onScan(url)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-obsidian-950 bg-cyan-400 hover:bg-cyan-300 transition-colors"
        >
          <ScanLine className="h-3 w-3" />
          Scan starten
        </button>
        <button
          onClick={() => onScan(url)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-titanium-200 bg-obsidian-800 border border-titanium-700 hover:border-titanium-500 transition-colors"
        >
          <FileCheck2 className="h-3 w-3" />
          Evidence erzeugen
        </button>
        {evidenceLogged && (
          <span className="font-mono text-[9px] text-emerald-400 ml-auto">
            ✓ Vorschau protokolliert
          </span>
        )}
      </div>

      {/* Iframe-Fläche */}
      <div className="flex-1 relative bg-white">
        {loading && !loadError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-obsidian-950 gap-3 z-10">
            <Loader2 className="h-5 w-5 text-cyan-400 animate-spin" />
            <span className="font-mono text-[11px] text-titanium-500">
              Lädt {displayHost}…
            </span>
          </div>
        )}

        {loadError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-obsidian-950 gap-4 z-10 p-6 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-400" />
            <div>
              <p className="text-sm font-semibold text-titanium-100 mb-1">
                Vorschau nicht verfügbar
              </p>
              <p className="text-xs text-titanium-500 max-w-sm">
                Diese Seite lässt keine Einbettung zu (X-Frame-Options/CSP).
                Der Scan funktioniert trotzdem.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onScan(url)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-obsidian-950 bg-cyan-400 hover:bg-cyan-300 transition-colors"
              >
                <ScanLine className="h-3.5 w-3.5" />
                Trotzdem scannen
              </button>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-titanium-200 border border-titanium-700 hover:border-titanium-500 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Direkt öffnen
              </a>
            </div>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={url}
          title={`Governance Preview: ${displayHost}`}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          onLoad={handleLoad}
          onError={handleError}
        />
      </div>
    </div>
  );
}
