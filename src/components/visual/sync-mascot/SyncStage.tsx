import { useEffect, useRef, useState } from 'react';
import type { ProductSlug } from '../../../config/productLandings';
import { canRun3D } from '../../landing/v3/HeroStage';
import type { SyncMascotHandle } from './syncMascotScene';
import '../../../styles/sync-stage.css';

/**
 * One canonical SYNC GLB for the main hero and all six product pages.
 * Lazy Three.js runtime; static SYNC fallback for reduced motion,
 * low-powered devices, offline GLB or disabled WebGL.
 */
export const SYNC_MODEL_SRC = '/models/sync-mascot.glb';
export const SYNC_STILL_SRC = '/landing-v3/sync-still.jpg';

export type SyncVariant = ProductSlug | 'home';
type StageState = 'still' | 'loading' | 'scene';

const CAMERA: Record<SyncVariant, { theta: number; phi: number; poseAt: number }> = {
  home: { theta: 20, phi: 79, poseAt: 0 },
  'governance-os': { theta: -14, phi: 76, poseAt: 0.12 },
  'voice-agent': { theta: 18, phi: 78, poseAt: 0 },
  'app-builder': { theta: 32, phi: 83, poseAt: 0.08 },
  'software-factory': { theta: -28, phi: 80, poseAt: 0.2 },
  'automation-os': { theta: 24, phi: 80, poseAt: 0.1 },
  'creative-studio': { theta: -21, phi: 78, poseAt: 0.15 },
};

export interface SyncStageProps {
  variant: SyncVariant;
  caption: string;
  statusLabel?: string;
  /** Increment on a direct product selection to replay the wave animation. */
  waveSignal?: number;
}

export function SyncStage({
  variant,
  caption,
  statusLabel = 'SYNC · 3D-Markenfigur',
  waveSignal = 0,
}: SyncStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<SyncMascotHandle | null>(null);
  const [mode, setMode] = useState<StageState>('still');
  const [waveState, setWaveState] = useState<'idle' | 'playing' | 'finished'>('idle');

  useEffect(() => {
    setWaveState('idle');
    if (!canRun3D()) {
      setMode('still');
      return;
    }
    let cancelled = false;
    setMode('loading');
    import('./syncMascotScene')
      .then(({ mountSyncMascot }) => {
        if (cancelled || !canvasRef.current) return;
        handleRef.current = mountSyncMascot(canvasRef.current, {
          src: SYNC_MODEL_SRC,
          orbit: CAMERA[variant],
          poseAt: CAMERA[variant].poseAt,
          onLoad: () => {
            if (cancelled) return;
            setMode('scene');
            if (handleRef.current?.wave()) setWaveState('playing');
          },
          onError: () => {
            if (!cancelled) setMode('still');
          },
          onWaveFinished: () => {
            if (!cancelled) setWaveState('finished');
          },
        });
      })
      .catch(() => {
        if (!cancelled) setMode('still');
      });

    return () => {
      cancelled = true;
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, [variant]);

  useEffect(() => {
    if (waveSignal > 0 && handleRef.current?.wave()) setWaveState('playing');
  }, [waveSignal]);

  return (
    <figure
      className={'rs-sync-stage rs-sync-stage--' + (variant === 'home' ? 'hero' : 'product')}
      data-scene={mode}
      data-wave={waveState}
      data-variant={variant}
      data-testid="sync-master-stage"
      aria-label="SYNC, die einheitliche 3D-Markenfigur von RealSync"
    >
      <img
        className="rs-sync-stage__still"
        src={SYNC_STILL_SRC}
        alt="SYNC: petrolfarbener Roboter mit Würfelkopf, Visier und freundlichem Gesicht"
        width={1116}
        height={1100}
        decoding="async"
        hidden={mode === 'scene'}
      />
      <canvas
        ref={canvasRef}
        className="rs-sync-stage__canvas"
        role="img"
        aria-label="Animierte 3D-Ansicht von SYNC; mit der Tastatur oder Maus drehbar"
        tabIndex={mode === 'scene' ? 0 : -1}
        aria-hidden={mode !== 'scene'}
        data-visible={mode === 'scene'}
      />
      <span className="rs-sync-stage__tag">{statusLabel}</span>
      <figcaption className="rs-sync-stage__caption" aria-live="off">{caption}</figcaption>
    </figure>
  );
}
