import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Search,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  Command,
  Lock,
  Send,
} from 'lucide-react';
import {
  filterCommands,
  isCommandRunnable,
  type CommandDefinition,
} from './commandCenterCatalog';

export interface CommandCenterProps {
  open: boolean;
  onClose: () => void;
  items: CommandDefinition[];
  onRun: (item: CommandDefinition) => void;
  /** Optional, explicit handoff of free text as an editable assistant draft — no automatic send or agent execution. */
  onSubmitIntent?: (text: string) => void;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

export function CommandCenter({ open, onClose, items, onRun, onSubmitIntent }: CommandCenterProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const listId = useId();
  const reducedMotion = usePrefersReducedMotion();

  const filtered = useMemo(() => filterCommands(items, query), [items, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(0);
      return;
    }
    // Defer focus so the dialog is in the DOM.
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const active = listRef.current?.querySelector<HTMLElement>(`[data-cmd-index="${activeIndex}"]`);
    active?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, open, filtered.length]);

  useEffect(() => {
    if (!open) return;

    function submitDraft() {
      const text = query.trim();
      if (!onSubmitIntent || !text) return;
      onSubmitIntent(text);
      onClose();
    }

    function runActive() {
      const item = filtered[activeIndex];
      if (item && isCommandRunnable(item)) {
        onRun(item);
        onClose();
        return;
      }
      // Never silently turn a disabled or Coming-Soon command into a chat request.
      if (filtered.length === 0) submitDraft();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        submitDraft();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        runActive();
        return;
      }
      // Simple focus trap: keep Tab inside the panel
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'input, button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, filtered, activeIndex, onClose, onRun, onSubmitIntent, query]);

  if (!open) return null;

  let lastGroup = '';
  const motionClass = reducedMotion
    ? ''
    : 'animate-in fade-in duration-150';

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-start justify-center bg-obsidian-950/75 pt-[12vh] backdrop-blur-sm ${motionClass}`}
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`w-full max-w-xl border border-titanium-700/80 bg-obsidian-900/95 shadow-2xl shadow-black/50 ring-1 ring-[#4FD4E8]/15 ${
          reducedMotion ? '' : 'animate-in zoom-in-95 duration-150'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="sr-only">
          Command Center
        </h2>

        <div className="flex items-center gap-3 border-b border-titanium-800 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-[#4FD4E8]/80" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Was möchtest du erledigen?"
            aria-label="Was möchtest du erledigen?"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              filtered[activeIndex] ? `cmd-option-${filtered[activeIndex].id}` : undefined
            }
            className="flex-1 bg-transparent text-sm text-titanium-100 placeholder:text-titanium-600 focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 border border-titanium-700 px-1.5 py-0.5 font-mono text-[10px] text-titanium-500">
            <Command className="h-2.5 w-2.5" aria-hidden />K
          </kbd>
          <kbd className="border border-titanium-700 px-1.5 py-0.5 font-mono text-[10px] text-titanium-500">
            ESC
          </kbd>
        </div>

        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Befehle"
          className="max-h-80 overflow-y-auto py-2"
        >
          {filtered.length === 0 && (
            <p className="px-4 py-8 text-center text-xs text-titanium-500">
              {onSubmitIntent && query.trim()
                ? `Enter: „${query.trim()}“ als Entwurf im Assistenten öffnen`
                : `Keine Treffer für „${query}“`}
            </p>
          )}
          {filtered.map((item, idx) => {
            const showGroup = item.group !== lastGroup;
            lastGroup = item.group;
            const runnable = isCommandRunnable(item);
            const active = idx === activeIndex;
            return (
              <React.Fragment key={item.id}>
                {showGroup && (
                  <p className="px-4 pb-1 pt-3 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-600">
                    {item.group}
                  </p>
                )}
                <button
                  type="button"
                  id={`cmd-option-${item.id}`}
                  role="option"
                  aria-selected={active}
                  aria-disabled={!runnable}
                  disabled={!runnable}
                  data-cmd-index={idx}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => {
                    if (!runnable) return;
                    onRun(item);
                    onClose();
                  }}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm transition-colors ${
                    !runnable
                      ? 'cursor-not-allowed text-titanium-600 opacity-70'
                      : active
                        ? 'bg-[#4FD4E8]/10 text-titanium-50'
                        : 'text-titanium-300 hover:bg-titanium-800/40'
                  } ${active && runnable ? 'border-l-2 border-l-[#4FD4E8]' : 'border-l-2 border-l-transparent'}`}
                >
                  <span className="min-w-0 flex-1 truncate">
                    <span className="block truncate">{item.label}</span>
                    {item.description && (
                      <span className="mt-0.5 block truncate font-mono text-[10px] text-titanium-600">
                        {item.description}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {item.badge && (
                      <span
                        className={`font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 border ${
                          item.state === 'coming_soon'
                            ? 'border-titanium-800 text-titanium-500 bg-obsidian-800'
                            : item.state === 'preview'
                              ? 'border-[#4FD4E8]/40 text-[#4FD4E8]/90 bg-[#4FD4E8]/5'
                              : 'border-amber-800 text-amber-300 bg-amber-950'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                    {!runnable && <Lock className="h-3 w-3 text-titanium-700" aria-hidden />}
                  </span>
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {onSubmitIntent && query.trim() && (
          <div className="border-t border-titanium-800 px-4 py-2">
            <button
              type="button"
              onClick={() => {
                onSubmitIntent(query.trim());
                onClose();
              }}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-xs text-titanium-100 hover:bg-titanium-800/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4FD4E8]"
            >
              <Send className="h-3.5 w-3.5 text-[#4FD4E8]" aria-hidden />
              Entwurf im Governance-Assistenten öffnen
            </button>
            <p className="px-2 text-[10px] text-titanium-500">
              Kein automatischer Versand oder Agentenlauf. Vor dem Absenden prüfen.
            </p>
          </div>
        )}

        <div className="flex items-center gap-4 border-t border-titanium-800 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-titanium-600">
          <span className="flex items-center gap-1">
            <ArrowUp className="h-3 w-3" aria-hidden />
            <ArrowDown className="h-3 w-3" aria-hidden /> Navigieren
          </span>
          <span className="flex items-center gap-1">
            <CornerDownLeft className="h-3 w-3" aria-hidden />{' '}
            {onSubmitIntent ? 'Befehl / Entwurf' : 'Ausführen'}
          </span>
          <span className="ml-auto text-titanium-700">Esc schließen</span>
        </div>
      </div>
    </div>
  );
}
