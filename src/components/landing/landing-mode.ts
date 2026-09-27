/**
 * Startseite: Gold / Cyan / Hell.
 *
 * Erster React-Render liest Storage oder prefers-color-scheme.
 * Gespeicherte Wahl gewinnt; ohne Key folgt das OS und der Listener.
 * Kein Inline-Boot in index.html — CSP verbietet script-src unsafe-inline.
 */
import { useCallback, useEffect, useState } from 'react';

export type LandingMode = 'gold' | 'cyan' | 'light';

export const LANDING_MODES: readonly LandingMode[] = ['gold', 'cyan', 'light'] as const;

export const LANDING_MODE_LABEL: Record<LandingMode, string> = {
  gold: 'Dunkel',
  cyan: 'Cyan',
  light: 'Hell',
};

export const STORAGE_KEY = 'rsd-landing-mode';

const DEFAULT_MODE: LandingMode = 'gold';

export function parseMode(value: string | null): LandingMode | null {
  if (value === 'cyan' || value === 'gold' || value === 'light') return value;
  return null;
}

export function readStored(): LandingMode | null {
  try {
    return parseMode(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function modeFromPrefersColorScheme(): LandingMode {
  try {
    if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    return 'gold';
  } catch {
    return DEFAULT_MODE;
  }
}

export function initialMode(): LandingMode {
  if (typeof window === 'undefined') return DEFAULT_MODE;
  return readStored() ?? modeFromPrefersColorScheme();
}

export function useLandingMode(): { mode: LandingMode; setMode: (next: LandingMode) => void } {
  const [mode, setModeState] = useState<LandingMode>(initialMode);

  useEffect(() => {
    if (readStored()) return undefined;
    let mq: MediaQueryList | null = null;
    const onChange = (event: MediaQueryListEvent) => {
      if (readStored()) return;
      setModeState(event.matches ? 'light' : 'gold');
    };
    try {
      mq = window.matchMedia('(prefers-color-scheme: light)');
      mq.addEventListener('change', onChange);
    } catch {
      /* alte Engine */
    }
    return () => {
      mq?.removeEventListener('change', onChange);
    };
  }, []);

  const setMode = useCallback((next: LandingMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* Sitzung nur */
    }
  }, []);

  return { mode, setMode };
}

export const MODE_ACCENT = 'var(--rsd-accent, #d6ad68)';
export const MODE_ACCENT_SOFT = 'var(--rsd-accent-soft, #e8c98a)';
export const MODE_ACCENT_LITE = 'var(--rsd-accent-lite, #e4cfa2)';
export const MODE_BG = 'var(--rsd-bg, #0a0a0b)';
export const MODE_PANEL = 'var(--rsd-panel, #121214)';
export const MODE_BUTTON_INK = 'var(--rsd-btn-ink, #0a0a0b)';
export const MODE_TEXT = 'var(--rsd-text, #f2eee6)';
export const MODE_MUTED = 'var(--rsd-muted, #9a9aa1)';
export const MODE_LINE = 'var(--rsd-line, rgba(214, 173, 104, 0.22))';
export const MODE_HEADER_BORDER = 'var(--rsd-header-border, rgba(255, 255, 255, 0.06))';
export const MODE_HEADER_BG = 'var(--rsd-header-bg, rgba(10, 10, 11, 0.82))';
export const MODE_HEADER_BG_OVERLAY = 'var(--rsd-header-bg-overlay, rgba(10, 10, 11, 0.35))';
export const MODE_GLOW = 'var(--rsd-glow, 0 0 32px rgba(214, 173, 104, 0.28))';
export const MODE_VEIL = 'var(--rsd-veil, #0a0a0b)';
export const MODE_SHOT_OPACITY = 'var(--rsd-shot-opacity, 0.55)';
export const MODE_SHOT_FILTER =
  'var(--rsd-shot-filter, sepia(0.5) saturate(1.5) hue-rotate(-14deg) contrast(1.08))';

export const MODE_PILL_FACE =
  'linear-gradient(180deg, var(--rsd-accent-soft, #e8c98a) 0%, var(--rsd-accent, #d6ad68) 100%)';

export function modeAccent(percent: number): string {
  return `color-mix(in srgb, ${MODE_ACCENT} ${percent}%, transparent)`;
}

export function modeAccentSoft(percent: number): string {
  return `color-mix(in srgb, ${MODE_ACCENT_SOFT} ${percent}%, transparent)`;
}

export function modeVeil(percent: number): string {
  return `color-mix(in srgb, ${MODE_VEIL} ${percent}%, transparent)`;
}
