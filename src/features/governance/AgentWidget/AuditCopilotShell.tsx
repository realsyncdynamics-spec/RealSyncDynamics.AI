import { useState } from 'react';
import { Bot, FileWarning, Sparkles, Wand2 } from 'lucide-react';
import {
  explainFindingAnon,
  generateFixSnippetAnon,
  type ExplainFindingResponse,
  type GenerateFixSnippetAnonResponse,
} from './agentApi';

/**
 * Phase 4 (Hostinger-Pattern): Audit-Copilot-Shell.
 *
 * Schmaler Right-Panel-Container, der die zwei neuen anon-Tools
 * (explain_finding + generate_fix_snippet) unterhalb eines konkreten Audits
 * verfuegbar macht. Wird via `<AgentWidget mode="audit_copilot" auditId=...>`
 * geladen.
 *
 * Bewusst minimal: Phase 4 baut die Tool-Vertragsoberflaeche raus, nicht
 * den finalen Copy/UX. Listen-Renderer + tatsaechliche Findings kommen
 * aus dem Aufrufer (AuditResultView.tsx) via Props oder via Lookup-Hook
 * — fuer den ersten Cut ist ein „Add Finding ID"-Input ausreichend.
 */

type Stage =
  | { kind: 'idle' }
  | { kind: 'explaining' }
  | { kind: 'snipping' }
  | { kind: 'explained'; data: ExplainFindingResponse }
  | { kind: 'snipped';   data: GenerateFixSnippetAnonResponse }
  | { kind: 'error';     message: string };

interface AuditCopilotShellProps {
  auditId: string;
}

export function AuditCopilotShell({ auditId }: AuditCopilotShellProps) {
  const [findingId, setFindingId] = useState('');
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });

  const onExplain = async () => {
    if (!findingId) return;
    setStage({ kind: 'explaining' });
    const r = await explainFindingAnon({ audit_id: auditId, finding_id: findingId });
    if (r.kind === 'ok') setStage({ kind: 'explained', data: r.data });
    else if (r.kind === 'rate_limited') setStage({ kind: 'error', message: 'Zu viele Anfragen — bitte gleich erneut versuchen.' });
    else if (r.kind === 'invalid') setStage({ kind: 'error', message: r.error.message });
    else setStage({ kind: 'error', message: r.error.message });
  };

  const onSnippet = async () => {
    if (!findingId) return;
    setStage({ kind: 'snipping' });
    const r = await generateFixSnippetAnon({ audit_id: auditId, finding_id: findingId });
    if (r.kind === 'ok') setStage({ kind: 'snipped', data: r.data });
    else if (r.kind === 'rate_limited') setStage({ kind: 'error', message: 'Zu viele Anfragen — bitte gleich erneut versuchen.' });
    else if (r.kind === 'invalid') setStage({ kind: 'error', message: r.error.message });
    else setStage({ kind: 'error', message: r.error.message });
  };

  return (
    <aside className="flex flex-col gap-3 border border-titanium-800 bg-obsidian-900 p-4">
      <header className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-violet-300" />
        <h2 className="font-display text-sm font-semibold tracking-tight text-titanium-50">Audit-Copilot</h2>
      </header>
      <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
        Audit · {auditId}
      </p>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] text-titanium-400">Befund-ID</span>
        <input
          type="text"
          value={findingId}
          onChange={(e) => setFindingId(e.target.value)}
          placeholder="z. B. pre_consent_tracker_01"
          className="border border-titanium-800 bg-obsidian-950 px-2 py-1.5 text-sm text-titanium-100 outline-none focus:border-titanium-500"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!findingId || stage.kind === 'explaining' || stage.kind === 'snipping'}
          onClick={onExplain}
          className="inline-flex items-center gap-1.5 border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-violet-100 hover:bg-violet-500/20 disabled:opacity-40"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Erklaeren
        </button>
        <button
          type="button"
          disabled={!findingId || stage.kind === 'explaining' || stage.kind === 'snipping'}
          onClick={onSnippet}
          className="inline-flex items-center gap-1.5 border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-40"
        >
          <Wand2 className="h-3.5 w-3.5" />
          Fix vorschlagen
        </button>
      </div>

      <Output stage={stage} />

      <footer className="mt-auto flex items-start gap-1.5 border-t border-titanium-800 pt-3 text-[10px] text-titanium-500">
        <FileWarning className="mt-0.5 h-3 w-3 shrink-0" />
        <span>Phase 4 liefert Demo-Responses. Echte LLM-Inferenz folgt in einem Folge-PR via ai-gateway strict-json.</span>
      </footer>
    </aside>
  );
}

function Output({ stage }: { stage: Stage }) {
  if (stage.kind === 'idle') return null;
  if (stage.kind === 'explaining' || stage.kind === 'snipping') {
    return <p className="font-mono text-[11px] text-titanium-400">Co-Pilot arbeitet ...</p>;
  }
  if (stage.kind === 'error') {
    return <p className="border border-rose-500/40 bg-rose-500/10 p-2 text-[11px] text-rose-200">{stage.message}</p>;
  }
  if (stage.kind === 'explained') {
    return (
      <div className="space-y-1 border border-violet-500/40 bg-violet-500/10 p-3 text-[12px] text-titanium-200">
        <p>{stage.data.explanation.summary}</p>
        <p className="text-[11px] text-titanium-400">Rechtsgrundlage-Hinweis: {stage.data.explanation.legal_hint}</p>
        <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">{stage.data.explanation.disclaimer}</p>
      </div>
    );
  }
  // snipped
  return (
    <div className="space-y-1 border border-cyan-500/40 bg-cyan-500/10 p-3 text-[12px] text-titanium-200">
      <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
        CMS: {stage.data.snippet.cms} · {stage.data.snippet.language}
      </p>
      <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] text-titanium-100">{stage.data.snippet.snippet}</pre>
      <p className="text-[11px] text-titanium-300">{stage.data.snippet.notes}</p>
    </div>
  );
}
