/**
 * Tests für den AiCore-Wrapper (3D-Szene mit SVG-Fallback).
 *
 * In jsdom ist `window.matchMedia` standardmäßig nicht implementiert →
 * useHighEndViewport liefert `false` → AiCore rendert die SVG-Variante
 * (AiCoreVisual) und lädt NIEMALS die Three.js-Szene (kein WebGL-Crash).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AiCore } from '../../src/components/visual/AiCore';

afterEach(() => {
  // matchMedia-Mocks zwischen Tests zurücksetzen.
  delete (window as { matchMedia?: unknown }).matchMedia;
  vi.restoreAllMocks();
});

describe('AiCore', () => {
  it('rendert den SVG-Fallback, wenn matchMedia fehlt (jsdom)', () => {
    expect(window.matchMedia).toBeUndefined();
    const { container } = render(<AiCore size={200} />);
    // AiCoreVisual rendert ein <svg>; die 3D-Szene würde kein SVG erzeugen.
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('rendert den SVG-Fallback auch bei kleinem Viewport', () => {
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({
      matches: false, // weder Desktop noch motion-ok
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    }));
    const { container } = render(<AiCore size={200} />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('zeigt bei High-End-Viewport initial den SVG-Suspense-Fallback (Szene noch nicht geladen)', () => {
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({
      matches: true, // Desktop UND motion-ok
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    }));
    const { container } = render(<AiCore size={200} />);
    // Lazy-Chunk ist synchron noch nicht da → Suspense zeigt den SVG-Fallback.
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
