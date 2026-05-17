import { useState } from 'react';
import { Copy, Check, FileCode2 } from 'lucide-react';
import type { RemediationSnippet } from './types';

interface Props {
  snippet: RemediationSnippet;
  index:   number;
}

// Renders a single remediation snippet. Copy button is the only action
// — there is no apply / merge / deploy button by design (CPS L3
// trust_level: prepare).

export function RemediationSnippetCard({ snippet, index }: Props) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable (insecure context) — silent */
    }
  };

  return (
    <div className="border border-titanium-800 bg-obsidian-900">
      <div className="flex items-center justify-between border-b border-titanium-900 px-4 py-2">
        <div className="flex items-center gap-2 text-xs">
          <FileCode2 className="h-4 w-4 text-security-400" />
          <span className="font-mono text-titanium-100">{snippet.path || `Snippet ${index + 1}`}</span>
          <span className="rounded-none border border-titanium-800 bg-obsidian-950 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-titanium-400">
            {snippet.language || 'text'}
          </span>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 border border-titanium-800 bg-obsidian-950 px-2.5 py-1 text-xs text-titanium-200 hover:bg-titanium-900 hover:text-titanium-50"
        >
          {copied
            ? <><Check className="h-3.5 w-3.5 text-emerald-400" /> Kopiert</>
            : <><Copy  className="h-3.5 w-3.5" /> Snippet kopieren</>}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3 font-mono text-[12px] leading-relaxed text-titanium-100">
        <code>{snippet.content || '(leer)'}</code>
      </pre>
      {snippet.notes ? (
        <p className="border-t border-titanium-900 px-4 py-2 text-xs text-titanium-300">
          {snippet.notes}
        </p>
      ) : null}
    </div>
  );
}
