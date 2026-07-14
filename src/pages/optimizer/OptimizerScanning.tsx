/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SEITE 3 — /optimizer/scanning  (Live-Scan / Loading)
 * Typ: FEEDBACK (Info-Only). Kein manueller Button im Erfolgsfall —
 * Auto-Redirect → /optimizer/results. Bei Fehler: Inline-Error + Aktionen.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Loader2, RotateCw, ArrowLeft } from 'lucide-react';

import { OptimizerLayout } from './OptimizerLayout';
import { getTargetUrl, setScanResult, domainFromUrl } from '../../lib/optimizer/state';
import { runOptimizerScan } from '../../lib/optimizer/scan';

const STATUS_MESSAGES = [
  'Rufe Startseite ab …',
  'Analysiere Meta-Tags …',
  'Prüfe HTTPS-Konfiguration …',
  'Ermittle Ladezeit …',
  'Suche Tracking- & Consent-Signale …',
  'Bewerte Sicherheits-Header …',
  'Stelle Ergebnis zusammen …',
];

export function OptimizerScanning() {
  const navigate = useNavigate();
  const [targetUrl] = useState<string | null>(() => getTargetUrl());
  const [statusIdx, setStatusIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  // Verhindert doppelten Scan-Start (React StrictMode ruft Effekte 2×).
  const startedRef = useRef(false);

  // Ohne Ziel-URL direkt zurück zur Eingabe.
  useEffect(() => {
    if (!targetUrl) navigate('/optimizer/scan', { replace: true });
  }, [targetUrl, navigate]);

  // Rotierende Status-Meldungen (nur solange kein Fehler).
  useEffect(() => {
    if (error || !targetUrl) return;
    const interval = setInterval(() => {
      setStatusIdx((i) => (i + 1 < STATUS_MESSAGES.length ? i + 1 : i));
    }, 1800);
    return () => clearInterval(interval);
  }, [error, targetUrl]);

  // Eigentlicher Scan.
  useEffect(() => {
    if (!targetUrl || startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const result = await runOptimizerScan(targetUrl, new Date().toISOString());
        if (cancelled) return;
        setScanResult(result);
        navigate('/optimizer/results', { replace: true });
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message || 'Der Scan konnte nicht abgeschlossen werden.');
      }
    })();

    return () => { cancelled = true; };
  }, [targetUrl, navigate, retry]);

  const domain = targetUrl ? domainFromUrl(targetUrl) : '';

  return (
    <OptimizerLayout
      step={2}
      pageType="feedback"
      metaTitle="Scan läuft — Cloud Code Optimizer"
      metaDescription="Deine Website wird analysiert."
    >
      {error ? (
        <>
          <h1 className="text-3xl font-display font-bold text-titanium-50 tracking-tight mb-4">
            Scan fehlgeschlagen
          </h1>
          <div role="alert" className="flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-none p-4 mb-6">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
            <div>
              <p className="font-bold text-red-200 mb-1">Wir konnten {domain || 'die Seite'} nicht analysieren.</p>
              <p>{error}</p>
              <p className="mt-2 text-red-300/80">
                Prüfe die Schreibweise der URL und ob die Seite öffentlich erreichbar ist.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStatusIdx(0);
                startedRef.current = false;
                // Bump: der Scan-Effekt läuft dank retry-Dependency erneut.
                setRetry((n) => n + 1);
              }}
              className="inline-flex items-center gap-2 bg-security-500 hover:bg-security-400 text-white font-bold px-5 py-2.5 rounded-none transition-colors"
            >
              <RotateCw className="h-4 w-4" /> Erneut versuchen
            </button>
            <button
              type="button"
              onClick={() => navigate('/optimizer/scan')}
              className="inline-flex items-center gap-2 text-titanium-300 hover:text-titanium-100 px-3 py-2.5 rounded-none transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Andere URL eingeben
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center text-center py-8">
          {/* Scan-Animation: pulsierender Ring + Scan-Line */}
          <div className="relative w-40 h-40 mb-8" aria-hidden>
            <div className="absolute inset-0 border border-security-700 rounded-none" />
            <div className="absolute inset-0 border border-security-500/40 rounded-none animate-glow-pulse" />
            <div className="absolute inset-x-0 top-0 h-0.5 bg-security-400/80 animate-[scanline_2s_linear_infinite]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-security-400 animate-spin" />
            </div>
          </div>

          <h1 className="text-3xl font-display font-bold text-titanium-50 tracking-tight mb-2">
            Scan läuft …
          </h1>
          {domain && (
            <p className="font-mono text-sm text-security-300 mb-6 break-all">{domain}</p>
          )}

          <div
            className="font-mono text-sm text-titanium-300 min-h-[1.5rem]"
            aria-live="polite"
            role="status"
          >
            {STATUS_MESSAGES[statusIdx]}
          </div>

          <p className="mt-8 text-xs text-titanium-500">Dieser Vorgang dauert 15–60 Sekunden.</p>

          {/* Scan-Line-Keyframe lokal (kein globales CSS nötig). */}
          <style>{`@keyframes scanline { 0% { top: 0 } 100% { top: 100% } }`}</style>
        </div>
      )}
    </OptimizerLayout>
  );
}
