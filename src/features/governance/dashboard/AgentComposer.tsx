import { useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowUp, Bot } from 'lucide-react';
import {
  ASSISTANT_PROMPT_EVENT,
  type AssistantPromptDetail,
} from '../../../components/governance-os/assistantPrompt';
import { GOVERNANCE_AGENTS } from '../../../components/governance-os/governanceAgents';
import { useLang } from '../../../i18n/useLang';

type Agent = (typeof GOVERNANCE_AGENTS)[number];

/** Offene @-Abfrage am Textende, z. B. „Bitte prüfen @dsg" → „dsg". */
export function mentionQuery(value: string): string | null {
  const match = /(?:^|\s)@([^\s@]*)$/.exec(value);
  return match ? match[1].toLowerCase() : null;
}

export function matchAgents(query: string): Agent[] {
  const q = query.replace(/[\s-]/g, '');
  return GOVERNANCE_AGENTS.filter(
    (a) => a.label.toLowerCase().replace(/[\s-]/g, '').includes(q) || a.id.replace(/-/g, '').includes(q),
  ).slice(0, 6);
}

/**
 * Agenten-Eingabe der Übersicht: eine Frage, `@` wählt einen der
 * Governance-Agenten. „Senden" übergibt Text und Agent an den Assistenten
 * der Shell (ASSISTANT_PROMPT_EVENT) — abgeschickt wird erst dort, nach dem
 * Datenhinweis. Kein eigener Modell-Call auf dieser Fläche.
 */
export function AgentComposer() {
  const { t } = useLang();
  const [value, setValue] = useState('');
  const [agent, setAgent] = useState<Agent | null>(null);
  const [highlight, setHighlight] = useState(0);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const listId = useId();
  const hintId = useId();

  const query = mentionQuery(value);
  const options = useMemo(() => (query === null ? [] : matchAgents(query)), [query]);
  const menuOpen = options.length > 0;

  function pick(next: Agent) {
    setAgent(next);
    setValue((v) => v.replace(/(^|\s)@[^\s@]*$/, '$1'));
    setHighlight(0);
    fieldRef.current?.focus();
  }

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const prompt = value.trim();
    if (!prompt) return;
    const detail: AssistantPromptDetail = { prompt, agent: agent?.id };
    window.dispatchEvent(new CustomEvent(ASSISTANT_PROMPT_EVENT, { detail }));
    setValue('');
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (menuOpen) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlight((h) => (h + 1) % options.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlight((h) => (h - 1 + options.length) % options.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        pick(options[Math.min(highlight, options.length - 1)]);
        return;
      }
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <section className="rs-agent" aria-labelledby={`${listId}-title`} data-testid="dashboard-agent-composer">
      <h2 id={`${listId}-title`} className="rs-agent__title">{t('agentTitle')}</h2>
      <form className="rs-agent__box" onSubmit={submit}>
        {agent && (
          <button
            type="button"
            className="rs-agent__chip"
            onClick={() => setAgent(null)}
            aria-label={`${agent.label} entfernen`}
          >
            <Bot className="h-3.5 w-3.5" aria-hidden="true" />
            {agent.label}
            <span aria-hidden="true">×</span>
          </button>
        )}
        <textarea
          ref={fieldRef}
          className="rs-agent__field"
          rows={2}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setHighlight(0);
          }}
          onKeyDown={onKeyDown}
          placeholder={t('agentPlaceholder')}
          aria-label={t('agentFieldLabel')}
          aria-describedby={hintId}
          role="combobox"
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={menuOpen ? `${listId}-${highlight}` : undefined}
        />
        {menuOpen && (
          <ul id={listId} role="listbox" aria-label={t('agentListLabel')} className="rs-agent__menu">
            {options.map((option, index) => (
              <li
                key={option.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === highlight}
                className="rs-agent__opt"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(option);
                }}
              >
                <Bot className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {option.label}
              </li>
            ))}
          </ul>
        )}
        <div className="rs-agent__bar">
          <p id={hintId} className="rs-agent__hint">{t('agentHint')}</p>
          <button type="submit" className="rs-agent__go" disabled={!value.trim()} aria-label={t('agentSend')} title={t('agentSend')}>
            <ArrowUp className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </form>
    </section>
  );
}
