import { useEffect, useRef, useState } from 'react';
import type { SyncMascotHandle } from '../../visual/sync-mascot/syncMascotScene';
import { canRun3D, type SceneMode } from './HeroStage';

/**
 * Hero-Bühne der Startseite mit SYNC, dem 3D-Maskottchen (Weg 1, Owner 19.11.2026):
 * SYNC ersetzt die frühere Produkt-Szene (HeroStage), alles darunter bleibt.
 *
 * Wie HeroStage zeigt sie zuerst ein Standbild. Die three-Szene
 * (`syncMascotScene.ts`, eigener Chunk) wird nur nachgeladen, wenn
 *   - keine reduzierte Bewegung gewünscht ist (prefers-reduced-motion: reduce),
 *   - kein Datensparmodus aktiv und das Gerät nicht schwach ist,
 *   - WebGL verfügbar ist (alles über canRun3D).
 * Scheitert das Laden, bleibt das Standbild. Nach dem Laden winkt SYNC einmal;
 * jede Erhöhung von `waveSignal` (Klick im Produktkatalog) lässt ihn erneut winken.
 */

export const SYNC_MODEL_SRC = '/models/sync-mascot.glb';
export const SYNC_STILL_SRC = '/landing-v3/sync-still.jpg';

export function SyncHeroStage({ caption, statusLabel, waveSignal = 0 }: {
  caption: string;
  statusLabel: string;
  waveSignal?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<SyncMascotHandle | null>(null);
  const [mode, setMode] = useState<SceneMode>('still');

  useEffect(() => {
    if (!canRun3D()) return;
    let cancelled = false;
    setMode('loading');
    import('../../visual/sync-mascot/syncMascotScene')
      .then(({ mountSyncMascot }) => {
        if (cancelled || !canvasRef.current) return;
        handleRef.current = mountSyncMascot(canvasRef.current, {
          src: SYNC_MODEL_SRC,
          onLoad: () => {
            if (cancelled) return;
            setMode('scene');
            handleRef.current?.wave();
          },
          onError: () => {
            if (!cancelled) setMode('still');
          },
          onWaveFinished: () => {},
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
  }, []);

  useEffect(() => {
    if (waveSignal > 0) handleRef.current?.wave();
  }, [waveSignal]);

  return (
    <div className="lv3-stage" data-scene={mode} data-variant="sync" data-testid="v3-sync-stage">
      <img
        className="lv3-stage-still"
        src={SYNC_STILL_SRC}
        alt="SYNC, das Maskottchen von RealSync: petrolfarbener Roboter mit Würfelkopf und lächelndem Bildschirmgesicht"
        width={1116}
        height={1100}
        decoding="async"
        hidden={mode === 'scene'}
      />
      <canvas
        ref={canvasRef}
        className="lv3-stage-canvas"
        role="img"
        aria-label="SYNC als 3D-Figur. Ziehen dreht die Figur."
        hidden={mode === 'still'}
      />
      <span className="lv3-stage-tag">{statusLabel}</span>
      <span className="lv3-stage-caption" aria-live="polite">{caption}</span>
    </div>
  );
}
