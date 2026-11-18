import { useEffect, useRef, useState } from 'react';
import type { HeroSceneHandle } from './heroScene3D';

/**
 * Bühne im Hero: zeigt immer zuerst das Standbild. Die 3D-Szene wird nur
 * nachgeladen, wenn
 *   - keine reduzierte Bewegung gewünscht ist (prefers-reduced-motion),
 *   - kein Datensparmodus aktiv ist (navigator.connection.saveData),
 *   - das Gerät nicht schwach ist (≤ 4 Kerne oder ≤ 4 GB Speicher, falls bekannt),
 *   - WebGL verfügbar ist.
 * Scheitert das Laden oder die Initialisierung, bleibt das Standbild.
 */

export type SceneMode = 'still' | 'loading' | 'scene';

interface NavigatorHints {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

export function canRun3D(win: Window = window): boolean {
  try {
    if (win.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
    const nav = win.navigator as Navigator & NavigatorHints;
    if (nav.connection?.saveData) return false;
    if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4) return false;
    if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4) return false;
    const probe = win.document.createElement('canvas');
    return Boolean(probe.getContext('webgl2') ?? probe.getContext('webgl'));
  } catch {
    return false;
  }
}

const COLORS = { bg: '#FFFFFF', fg: '#1F2A44', fg2: '#4A5878', fg3: '#8A95AC', line: '#C7CFDE', surface: '#E3E8F0' };

export function HeroStage({ active, caption, statusLabel }: { active: number; caption: string; statusLabel: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<HeroSceneHandle | null>(null);
  const [mode, setMode] = useState<SceneMode>('still');

  useEffect(() => {
    if (!canRun3D()) return;
    let cancelled = false;
    setMode('loading');
    import('./heroScene3D')
      .then(({ mountHeroScene }) => {
        if (cancelled || !canvasRef.current) return;
        handleRef.current = mountHeroScene(canvasRef.current, COLORS);
        handleRef.current.setActive(active);
        setMode('scene');
      })
      .catch(() => {
        if (!cancelled) setMode('still');
      });
    return () => {
      cancelled = true;
      handleRef.current?.dispose();
      handleRef.current = null;
    };
    // Einmal beim Einhängen; der aktive Index folgt unten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    handleRef.current?.setActive(active);
  }, [active]);

  return (
    <div className="lv3-stage" data-scene={mode}>
      <img
        className="lv3-stage-still"
        src="/landing-v3/hero-still.jpg"
        alt="KI-Assistent als Roboterfigur mit umlaufenden Symbolen für Anfrage, Antwort und Weiterleitung"
        width={1000}
        height={1250}
        decoding="async"
        hidden={mode === 'scene'}
      />
      <canvas ref={canvasRef} className="lv3-stage-canvas" aria-hidden="true" hidden={mode === 'still'} />
      <span className="lv3-stage-tag">{statusLabel}</span>
      <span className="lv3-stage-caption" aria-live="polite">{caption}</span>
    </div>
  );
}
