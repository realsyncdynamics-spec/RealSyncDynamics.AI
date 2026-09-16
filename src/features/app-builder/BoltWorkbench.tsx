/**
 * Drop-in workbench for /builder/:slug (Phase 3).
 * This file is not routed in Phase 2. Puck remains the default canvas.
 */
import { useMemo, useState, type ReactElement } from 'react';
import { BoltEngine } from './bolt/engine';
import { generateBoltArtifact } from './bolt/demo-generator';
import { htmlFromFiles } from './bolt/preview';
import type { GovernanceContext } from './bolt/types';

export function BoltWorkbench({ ctx }: { ctx: GovernanceContext }): ReactElement {
  const [prompt, setPrompt] = useState('Compliance-Status, nur Vorschau.');
  const [log, setLog] = useState('Bereit. Kein Deploy.');
  const [html, setHtml] = useState('');
  const engine = useMemo(() => new BoltEngine(ctx), [ctx]);

  const run = async () => {
    const model = generateBoltArtifact(prompt);
    const result = await engine.ingest(`ui-${Date.now()}`, model, prompt);
    const files = Object.values(result.snapshot.files);
    setHtml(files.length ? htmlFromFiles(files, 'static') : '');
    setLog(
      result.audit
        .map((a) => `${a.decision} ${a.event} · ${a.control}`)
        .join('\n') || 'keine Ereignisse',
    );
  };

  return (
    <section className="grid gap-3" data-testid="bolt-workbench">
      <p className="font-mono text-[10px] tracking-widest text-cyan-700 uppercase">
        bolt.diy engine · gated
      </p>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={3}
        className="w-full border border-black/15 bg-white p-3 text-sm"
      />
      <button
        type="button"
        onClick={() => void run()}
        className="h-11 bg-[#111827] px-4 text-sm font-bold text-white"
      >
        Ausführen
      </button>
      {html ? (
        <iframe
          title="Governed preview"
          srcDoc={html}
          sandbox=""
          referrerPolicy="no-referrer"
          allow=""
          className="h-80 w-full border border-black/10 bg-white"
        />
      ) : null}
      <pre className="max-h-48 overflow-auto border border-black/10 bg-[#f3f5f7] p-3 font-mono text-[11px] leading-5">
        {log}
      </pre>
    </section>
  );
}

export default BoltWorkbench;
