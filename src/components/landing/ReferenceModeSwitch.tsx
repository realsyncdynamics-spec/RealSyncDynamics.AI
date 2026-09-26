import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';

export type ReferenceMode = 'dark' | 'light';
export const REFERENCE_MODES: readonly ReferenceMode[] = ['dark', 'light'] as const;

const LABEL: Record<ReferenceMode, string> = { dark: 'Dunkel', light: 'Hell' };
const STORAGE_KEY = 'rsd-reference-mode';

export function useReferenceMode() {
  const [mode, setModeState] = useState<ReferenceMode>('dark');
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') setModeState(stored);
    } catch { /* session-only fallback */ }
  }, []);
  const setMode = useCallback((next: ReferenceMode) => {
    setModeState(next);
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* session-only fallback */ }
  }, []);
  return { mode, setMode };
}

export function ReferenceModeSwitch({ mode, onChange }: { mode: ReferenceMode; onChange: (mode: ReferenceMode) => void }) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const select = (index: number) => {
    const next = REFERENCE_MODES[(index + REFERENCE_MODES.length) % REFERENCE_MODES.length];
    onChange(next);
    buttons.current[(index + REFERENCE_MODES.length) % REFERENCE_MODES.length]?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); select(index + 1); }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); select(index - 1); }
    if (event.key === 'Home') { event.preventDefault(); select(0); }
    if (event.key === 'End') { event.preventDefault(); select(REFERENCE_MODES.length - 1); }
  };
  return (
    <span className="rs-reference-switch" role="radiogroup" aria-label="Farbmodus">
      {REFERENCE_MODES.map((option, index) => (
        <button key={option} ref={(node) => { buttons.current[index] = node; }} type="button" role="radio"
          aria-checked={mode === option} tabIndex={mode === option ? 0 : -1} onClick={() => onChange(option)}
          onKeyDown={(event) => onKeyDown(event, index)}>
          {LABEL[option].toUpperCase()}
        </button>
      ))}
    </span>
  );
}
