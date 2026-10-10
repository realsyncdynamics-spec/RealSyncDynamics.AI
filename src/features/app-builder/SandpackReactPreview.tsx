import { useEffect, useMemo } from 'react';
import { SandpackProvider, useSandpackClient } from '@codesandbox/sandpack-react';
import { sandpackProject } from './bolt/sandpack-project';
import type { FileRecord } from './bolt/types';

export const SANDPACK_BUNDLER_URL = 'https://2-19-8-sandpack.codesandbox.io/';

function PreviewFrame({ onUnavailable }: { onUnavailable: () => void }) {
  const { iframe, sandpack, listen } = useSandpackClient();
  useEffect(() => {
    const timer = window.setTimeout(onUnavailable, 30_000);
    const unsubscribe = listen((message) => {
      if (message.type === 'start' || message.type === 'done') window.clearTimeout(timer);
    });
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [listen, onUnavailable]);
  useEffect(() => {
    if (sandpack.status === 'timeout') onUnavailable();
  }, [sandpack.status, onUnavailable]);
  return (
    <div className="grid h-full grid-rows-[auto_minmax(0,1fr)]">
      {sandpack.error ? <p role="alert" className="p-3 font-mono text-xs text-[#E24A4A]">{sandpack.error.message}</p> : <span />}
      <iframe
        ref={iframe}
        title="Sandpack React preview"
        src={SANDPACK_BUNDLER_URL}
        // Sandpack needs its own origin for postMessage/storage, never the app's origin.
        sandbox="allow-scripts allow-same-origin"
        referrerPolicy="no-referrer"
        allow=""
        className="h-full min-h-[360px] w-full border-0 bg-[#0A0A0B]"
      />
    </div>
  );
}

export default function SandpackReactPreview({
  files,
  onUnavailable,
}: {
  files: FileRecord[];
  onUnavailable: () => void;
}) {
  const project = useMemo(() => sandpackProject(files), [files]);
  useEffect(() => {
    if (!project) onUnavailable();
  }, [project, onUnavailable]);
  if (!project) return null;
  return (
    <SandpackProvider
      files={project.files}
      customSetup={{ environment: 'create-react-app', entry: project.entry }}
      options={{ autorun: true, autoReload: true, bundlerURL: SANDPACK_BUNDLER_URL }}
      theme="dark"
    >
      <PreviewFrame onUnavailable={onUnavailable} />
    </SandpackProvider>
  );
}
