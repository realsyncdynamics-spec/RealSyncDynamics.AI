import { useState, type FormEvent } from 'react';
import { ArrowUp, Plus } from 'lucide-react';
import { ASSISTANT_PROMPT_EVENT } from '../../components/governance-os/assistantPrompt';

/**
 * Shared entry point for the AI home and the operational dashboard.
 * Submitting prepares the existing assistant; it never calls a model,
 * sends the message, or performs a tool action without user confirmation.
 */
export function AiCommandComposer({ compact = false }: { compact?: boolean }) {
  const [prompt, setPrompt] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = prompt.trim();
    if (!text) return;
    window.dispatchEvent(new CustomEvent(ASSISTANT_PROMPT_EVENT, { detail: { prompt: text } }));
    setPrompt('');
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`w-full rounded-2xl border border-titanium-700 bg-obsidian-900 p-3 shadow-lg transition-colors focus-within:border-cyan-500/70 ${compact ? '' : 'mt-9 max-w-2xl'}`}
      data-testid="ai-command-composer"
    >
      <label htmlFor={compact ? 'ai-dashboard-prompt' : 'ai-os-prompt'} className="sr-only">
        Nachricht an RealSync AI
      </label>
      <textarea
        id={compact ? 'ai-dashboard-prompt' : 'ai-os-prompt'}
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
        placeholder="Frage stellen, Website prüfen, Agenten oder Workflow vorbereiten ..."
        rows={compact ? 2 : 3}
        className="block w-full resize-y bg-transparent px-2 py-2 text-sm text-titanium-100 placeholder:text-titanium-500 focus:outline-none"
      />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 px-2 text-xs text-titanium-500">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Enter öffnen · Shift+Enter Zeilenumbruch</span>
        </div>
        <button
          type="submit"
          disabled={!prompt.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#00B8D4] text-obsidian-950 transition-opacity disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          aria-label="Im Assistenten öffnen"
        >
          <ArrowUp className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}
