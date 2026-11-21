import { useEffect, useRef, useState } from 'react';
import type { SyncMascotHandle } from '../../visual/sync-mascot/syncMascotScene';
import { STAGE_SCENES, StageProp, type StageVariant } from './stageScenes';

/**
 * 3D-Bühne der Produkt-Landingpages: SYNC, das Maskottchen aus `/sync`.
 *
 * Die three-Szene wird per `import()` nachgeladen und beim Verlassen
 * aufgeräumt (`syncMascotScene.ts`). Ohne WebGL bleibt eine ruhige Fläche
 * mit Hinweis stehen. Jede Erhöhung von `waveSignal` lässt SYNC einmal winken.
 * Mit `variant` bekommt jede Produktseite ihre eigene Szene (stageScenes.tsx).
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
  /** Eigene Szene je Produktseite: Kamera, Pose, Seite und Produktkarte. */
  variant?: StageVariant;
}

export function MascotStage({ tag, caption, waveSignal = 0, variant }: MascotStageProps) {
  const sceneConfig = variant ? STAGE_SCENES[variant] : null;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<SyncMascotHandle | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const scene = variant ? STAGE_SCENES[variant] : null;
    import('../../visual/sync-mascot/syncMascotScene')
      .then(({ mountSyncMascot }) => {
        if (cancelled) return;
        handleRef.current = mountSyncMascot(canvas, {
          src: MODEL_SRC,
          onLoad: () => setPhase('ready'),
          onError: () => setPhase('error'),
          onWaveFinished: () => setPhase('ready'),
          orbit: scene?.orbit,
          poseAt: scene?.poseAt,
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
  }, [variant]);

  useEffect(() => {
    if (waveSignal > 0 && handleRef.current?.wave()) setPhase('waving');
  }, [waveSignal]);

  return (
    <figure
      className="pl-stage"
      aria-label="3D-Ansicht: SYNC"
      data-testid="pl-stage"
      data-variant={variant}
      data-side={sceneConfig?.side}
    >
      <span className="pl-stage-tag">{tag}</span>
      {variant ? <StageProp variant={variant} /> : null}
      <div className={sceneConfig ? `pl-stage-view pl-stage-view--${sceneConfig.side}` : 'pl-stage-view'}>
        <canvas
          ref={canvasRef}
          className="pl-stage-canvas"
          tabIndex={0}
          role="img"
          aria-label="SYNC: petrolfarbener Roboter mit Würfelkopf und leuchtendem Visier"
          hidden={phase === 'error'}
        />
      </div>
      <figcaption className="pl-stage-caption">{caption}</figcaption>
      <span role="status" className="pl-stage-status">{STATUS_TEXT[phase]}</span>
    </figure>
  );
}
