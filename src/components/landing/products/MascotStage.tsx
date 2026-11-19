import { useEffect, useRef, useState } from 'react';
import type { SyncMascotHandle } from '../../visual/sync-mascot/syncMascotScene';

/**
 * 3D-Bühne der Produkt-Landingpages: SYNC, das Maskottchen aus `/sync`.
 *
 * Die three-Szene wird per `import()` nachgeladen und beim Verlassen
 * aufgeräumt (`syncMascotScene.ts`). Ohne WebGL bleibt eine ruhige Fläche
 * mit Hinweis stehen. Jede Erhöhung von `waveSignal` lässt SYNC einmal winken.
 */

const MODEL_SRC = '/models/sync-mascot.glb';

type Phase = 'loading' | 'ready' | 'waving' | 'error';

const STATUS_TEXT: Record<Phase, string> = {
  loading: '3D-Modell lädt …',
  ready: '',
  waving: 'SYNC winkt.',
  error: '3D-Modell konnte nicht geladen werden.',
};

export interface MascotStageProps {
  /** Kurzer Text oben rechts, z. B. Produktname. Monospace. */
  tag: string;
  /** Bildunterschrift unten links. */
  caption: string;
  /** Jede Änderung (> 0) startet einmal die Winken-Animation. */
  waveSignal?: number;
}

export function MascotStage({ tag, caption, waveSignal = 0 }: MascotStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<SyncMascotHandle | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    import('../../visual/sync-mascot/syncMascotScene')
      .then(({ mountSyncMascot }) => {
        if (cancelled) return;
        handleRef.current = mountSyncMascot(canvas, {
          src: MODEL_SRC,
          onLoad: () => setPhase('ready'),
          onError: () => setPhase('error'),
          onWaveFinished: () => setPhase('ready'),
        });
      })
      .catch(() => {
        if (!cancelled) setPhase('error');
      });
    return () => {
      cancelled = true;
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (waveSignal > 0 && handleRef.current?.wave()) setPhase('waving');
  }, [waveSignal]);

  return (
    <figure className="pl-stage" aria-label="3D-Ansicht: SYNC" data-testid="pl-stage">
      <span className="pl-stage-tag">{tag}</span>
      <canvas
        ref={canvasRef}
        className="pl-stage-canvas"
        tabIndex={0}
        role="img"
        aria-label="SYNC: petrolfarbener Roboter mit Würfelkopf und leuchtendem Visier"
        hidden={phase === 'error'}
      />
      <figcaption className="pl-stage-caption">{caption}</figcaption>
      <span role="status" className="pl-stage-status">{STATUS_TEXT[phase]}</span>
    </figure>
  );
}
