import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { htmlFromFiles, sandboxTokens, type PreviewIsolation } from './bolt/preview';
import { assessProjectRuntime } from './bolt/runtime-capability';
import type { FileRecord } from './bolt/types';

const SandpackReactPreview = lazy(() => import('./SandpackReactPreview'));

export function BuilderPreview({ files, isolation }: { files: FileRecord[]; isolation: PreviewIsolation }) {
  const [started, setStarted] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const fail = useCallback(() => setUnavailable(true), []);
  const runtime = useMemo(() => assessProjectRuntime(files), [files]);
  const html = useMemo(() => htmlFromFiles(files, isolation), [files, isolation]);
  const sandpack = runtime.previewRuntime === 'sandpack' && isolation === 'interactive' && !unavailable;

  useEffect(() => {
    if (!sandpack || !started) return;
    const onViolation = (event: SecurityPolicyViolationEvent) => {
      if (event.disposition === 'enforce' && event.effectiveDirective === 'frame-src' &&
          /^https:\/\/[^/]*sandpack\.codesandbox\.io(?:\/|$)/.test(event.blockedURI)) fail();
    };
    document.addEventListener('securitypolicyviolation', onViolation);
    return () => document.removeEventListener('securitypolicyviolation', onViolation);
  }, [sandpack, started, fail]);

  const fallback = (
    <div className="grid h-full grid-rows-[auto_minmax(0,1fr)]">
      {unavailable ? (
        <p role="status" className="p-3 font-mono text-xs text-[#E4C56A]">
          Sandpack nicht verfügbar (CSP, Netzwerk oder Projektstruktur). srcDoc-Fallback; React wird hier nicht ausgeführt.
        </p>
      ) : <span />}
      <iframe
        title="Governed preview"
        srcDoc={html}
        sandbox={sandboxTokens(isolation)}
        referrerPolicy="no-referrer"
        allow=""
        className="h-full min-h-[360px] w-full bg-[#0A0A0B]"
      />
    </div>
  );

  if (!sandpack) return fallback;
  return (
    <div className="grid h-full grid-rows-[auto_minmax(0,1fr)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 p-3">
        <p className="font-mono text-xs text-white/55">
          Sandpack · nur React-Vorschau, kein Node/Backend. Start übermittelt Projektquelltext an CodeSandbox (externer Dienst).
        </p>
        {!started ? (
          <button type="button" onClick={() => setStarted(true)} className="min-h-11 border border-[#0052FF] px-3 text-xs">
            React-Vorschau starten
          </button>
        ) : null}
        <button type="button" onClick={fail} className="min-h-11 border border-white/15 px-3 text-xs">
          srcDoc verwenden
        </button>
      </div>
      {started ? (
        <ErrorBoundary variant="panel" onError={fail} fallback={fallback}>
          <Suspense fallback={<p role="status" className="p-3 font-mono text-xs">Sandpack wird geladen …</p>}>
            <SandpackReactPreview files={files} onUnavailable={fail} />
          </Suspense>
        </ErrorBoundary>
      ) : fallback}
    </div>
  );
}
