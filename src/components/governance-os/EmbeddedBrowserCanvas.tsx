import { useState, useRef, useEffect } from 'react';
import {
  X, RefreshCw, ExternalLink, Shield, ScanLine, FileCheck2,
  AlertTriangle, Loader2,
} from 'lucide-react';
import { getSupabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { useCurrentTenant } from '../../lib/useCurrentTenant';
import { useBrowserSession } from '../../lib/useBrowserSession';

interface EmbeddedBrowserCanvasProps {
  url: string;
  onClose: () => void;
  onScan: (url: string) => void;
  workflowId?: string;
  runId?: string;
  toolName?: string;
}

async function logBrowserAction(payload: {
  tenantId: string;
  actorId?: string;
  sessionId: string;
  workflowId?: string;
  runId?: string;
  toolName?: string;
  browserAction: 'preview_load' | 'preview_error' | 'reload' | 'scan_start' | 'scan_complete' | 'evidence_generate' | 'open_external';
  status: 'started' | 'completed' | 'failed' | 'blocked';
  url?: string;
  httpStatus?: number;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  evidenceHash?: string;
  evidenceSizeBytes?: number;
  errorMessage?: string;
  errorCode?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      console.warn('Supabase URL not configured');
      return null;
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/browser-action-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn(`Browser action logging returned ${response.status}`);
      return null;
    }

    const result = await response.json();
    return result.id;
  } catch (err) {
    console.error('Failed to log browser action:', err);
    return null;
  }
}

export function EmbeddedBrowserCanvas({
  url,
  onClose,
  onScan,
  workflowId,
  runId,
  toolName,
}: EmbeddedBrowserCanvasProps) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [evidenceLogged, setEvidenceLogged] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const startTimeRef = useRef<number>(Date.now());

  const auth = useAuth();
  const tenant = useCurrentTenant();
  const sessionId = useBrowserSession();

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
    const endTime = Date.now();
    const duration = endTime - startTimeRef.current;

    setLoading(false);
    setLoadError(false);

    if (!evidenceLogged && tenant?.id && sessionId) {
      setEvidenceLogged(true);
      logBrowserAction({
        tenantId: tenant.id,
        actorId: auth?.user?.id,
        sessionId,
        workflowId,
        runId,
        toolName: toolName || 'governance-preview',
        browserAction: 'preview_load',
        status: 'completed',
        url,
        httpStatus: 200,
        startedAt: new Date(startTimeRef.current).toISOString(),
        completedAt: new Date(endTime).toISOString(),
        durationMs: duration,
        metadata: {
          loadSource: 'iframe',
          displayHost: new URL(url).hostname,
        },
      });
    }
  };

  const handleError = () => {
    const endTime = Date.now();
    const duration = endTime - startTimeRef.current;

    setLoading(false);
    setLoadError(true);

    if (tenant?.id && sessionId) {
      logBrowserAction({
        tenantId: tenant.id,
        actorId: auth?.user?.id,
        sessionId,
        workflowId,
        runId,
        toolName: toolName || 'governance-preview',
        browserAction: 'preview_error',
        status: 'failed',
        url,
        httpStatus: 0,
        startedAt: new Date(startTimeRef.current).toISOString(),
        completedAt: new Date(endTime).toISOString(),
        durationMs: duration,
        errorCode: 'IFRAME_LOAD_BLOCKED',
        errorMessage: 'Preview not available: X-Frame-Options/CSP prevented embedding',
      });
    }
  };

  const reload = () => {
    const reloadTime = Date.now();
    startTimeRef.current = reloadTime;
    setLoading(true);
    setLoadError(false);

    if (tenant?.id && sessionId) {
      logBrowserAction({
        tenantId: tenant.id,
        actorId: auth?.user?.id,
        sessionId,
        workflowId,
        runId,
        toolName: toolName || 'governance-preview',
        browserAction: 'reload',
        status: 'started',
        url,
        startedAt: new Date(reloadTime).toISOString(),
      });
    }

    if (iframeRef.current) {
      // eslint-disable-next-line no-self-assign
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  const handleScan = (scanUrl: string) => {
    if (tenant?.id && sessionId) {
      logBrowserAction({
        tenantId: tenant.id,
        actorId: auth?.user?.id,
        sessionId,
        workflowId,
        runId,
        toolName: 'governance-scan',
        browserAction: 'scan_start',
        status: 'started',
        url: scanUrl,
        startedAt: new Date().toISOString(),
      });
    }
    onScan(scanUrl);
  };

  const handleEvidenceGenerate = (evidenceUrl: string) => {
    if (tenant?.id && sessionId) {
      logBrowserAction({
        tenantId: tenant.id,
        actorId: auth?.user?.id,
        sessionId,
        workflowId,
        runId,
        toolName: 'governance-evidence',
        browserAction: 'evidence_generate',
        status: 'started',
        url: evidenceUrl,
        startedAt: new Date().toISOString(),
        metadata: {
          evidenceType: 'screenshot-hash',
        },
      });
    }
    onScan(evidenceUrl);
  };

  const handleOpenExternal = () => {
    if (tenant?.id && sessionId) {
      logBrowserAction({
        tenantId: tenant.id,
        actorId: auth?.user?.id,
        sessionId,
        workflowId,
        runId,
        toolName: toolName || 'governance-preview',
        browserAction: 'open_external',
        status: 'completed',
        url,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
      });
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
          onClick={handleOpenExternal}
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
          onClick={() => handleScan(url)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-obsidian-950 bg-cyan-400 hover:bg-cyan-300 transition-colors"
        >
          <ScanLine className="h-3 w-3" />
          Scan starten
        </button>
        <button
          onClick={() => handleEvidenceGenerate(url)}
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
                onClick={() => handleScan(url)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-obsidian-950 bg-cyan-400 hover:bg-cyan-300 transition-colors"
              >
                <ScanLine className="h-3.5 w-3.5" />
                Trotzdem scannen
              </button>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleOpenExternal}
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
