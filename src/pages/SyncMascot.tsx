import { useEffect, useRef, useState } from 'react';
import type { SyncMascotHandle } from '../components/visual/sync-mascot/syncMascotScene';

/**
 * SYNC — das 3D-Maskottchen (Route `/sync`, src/App.tsx).
 *
 * Nachbau der Einzeldatei-Vorlage: Aufbau, Texte und Verhalten 1:1, Gestaltung
 * in den Marken-Tokens (Obsidian-Schrift, Security-Blue, 90°-Kanten, Monospace
 * für Label und Status) auf einheitlich weißem Grund (#ffffff) statt der dunklen Vorlage. Die Vorlage nutzte model-viewer; hier rendert three
 * direkt (`syncMascotScene.ts`, per `import()` nachgeladen).
 */

const MODEL_SRC = '/models/sync-mascot.glb';

type Phase = 'loading' | 'ready' | 'waving' | 'error';

const STATUS_TEXT: Record<Phase, string> = {
  loading: '3D-Modell lädt …',
  ready: '',
  waving: 'SYNC winkt.',
  error: '3D-Modell konnte nicht geladen werden.',
};

const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-security-500';

/** Einheitliches Weiß für Seite, Karte und Bühne (ein Ton, keine Off-White-Verläufe). */
const WHITE = 'bg-[#ffffff]';

export default function SyncMascot() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const handleRef = useRef<SyncMascotHandle | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    setPhase('loading');
    import('../components/visual/sync-mascot/syncMascotScene')
      .then(({ mountSyncMascot }) => {
        if (cancelled) return;
        handleRef.current = mountSyncMascot(canvas, {
          src: MODEL_SRC,
          onLoad: () => setPhase('ready'),
          onError: () => setPhase('error'),
          onWaveFinished: () => {
            setPhase('ready');
            // Der Button war während des Winkens deaktiviert und hat dabei den
            // Fokus verloren; zurückgeben, wenn der Nutzer nicht woanders ist.
            requestAnimationFrame(() => {
              const active = document.activeElement;
              if (!active || active === document.body) buttonRef.current?.focus();
            });
          },
        });
      })
      .catch(() => {
        // Kein WebGL oder Chunk nicht ladbar.
        if (!cancelled) setPhase('error');
      });
    return () => {
      cancelled = true;
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, []);

  const onWave = () => {
    if (handleRef.current?.wave()) setPhase('waving');
  };

  return (
    <div className={`grid min-h-[100svh] place-items-center p-6 font-sans text-obsidian-900 ${WHITE}`}>
      <main className={`grid w-full max-w-[1040px] grid-cols-1 items-center overflow-hidden border border-titanium-300 ${WHITE} shadow-[0_24px_60px_-30px_rgba(10,10,11,0.25)] min-[651px]:grid-cols-[1fr_1.45fr]`}>
        <header className="p-6 min-[651px]:p-[clamp(24px,5vw,70px)]">
          <small className="font-mono text-[0.8rem] tracking-[0.1em] text-titanium-600">
            RealSyncDynamics.AI
          </small>
          <h1 className="my-3 text-[clamp(62px,9vw,126px)] font-bold leading-[0.9] tracking-[-0.08em] min-[651px]:my-[22px]">
            SYNC
          </h1>
          <p className="my-4 leading-normal text-titanium-600">
            Das 3D-Maskottchen von RealSyncDynamics.
          </p>
          <button
            ref={buttonRef}
            type="button"
            onClick={onWave}
            disabled={phase !== 'ready'}
            className={`mt-2.5 cursor-pointer bg-security-500 px-5 py-[13px] font-bold text-white outline-offset-4 hover:bg-security-400 disabled:cursor-default disabled:opacity-[0.58] disabled:hover:bg-security-500 ${FOCUS_RING}`}
          >
            Winken lassen
          </button>
          <div role="status" className="mt-2 min-h-[1.4em] font-mono text-[0.86rem] text-titanium-600">
            {STATUS_TEXT[phase]}
          </div>
        </header>
        <section
          aria-label="3D-Ansicht"
          className={`relative border-t border-titanium-200 min-[651px]:border-l min-[651px]:border-t-0 ${WHITE}`}
        >
          <canvas
            ref={canvasRef}
            tabIndex={0}
            role="img"
            aria-label="Petrolfarbener Roboter mit Würfelkopf und leuchtendem Visier"
            className={`block h-[46svh] min-h-[300px] w-full cursor-grab outline-offset-[-3px] active:cursor-grabbing min-[651px]:h-[min(64svh,620px)] min-[651px]:min-h-[350px] ${FOCUS_RING}`}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-3.5 text-center text-[0.82rem] text-titanium-600">
            Ziehen zum Drehen · Scrollen zum Zoomen
          </div>
        </section>
      </main>
    </div>
  );
}
