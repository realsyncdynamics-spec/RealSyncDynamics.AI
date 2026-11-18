import { useEffect, useRef, useState } from 'react';
import { canRun3D, type SceneMode } from '../landing/v3/HeroStage';
import type { BotMove, VoiceBotHandle } from './voiceBotScene3D';

/**
 * Bühne der Voice-Agent-Seite: zeigt zuerst das Standbild und lädt den
 * 3D-Assistenten nur nach, wenn `canRun3D()` zustimmt (keine reduzierte
 * Bewegung, kein Datensparmodus, kein schwaches Gerät, WebGL vorhanden).
 * Scheitert das Laden, bleibt das Standbild.
 *
 * `speaking` ist der Anschluss für eine spätere Sprachausgabe: Die Seite spielt
 * selbst keinen Ton ab. Eine echte Stimme braucht eine eigene Freigabe
 * (Abhängigkeit, CSP, Agent-Konfiguration, Sicherheitstests).
 */

export const BOT_LINES: readonly string[] = [
  'Guten Tag! Was darf ich für Sie aufnehmen?',
  'Ich nehme Bestellungen, Terminwünsche und Rückrufbitten an.',
  'Alles landet geordnet im Dashboard Ihres Betriebs.',
  'Zusagen macht Ihr Team, nicht ich.',
];

const LINE_MS = 4200;
const GRID_COLOR = '#D3D8E1';
const MOVES: readonly BotMove[] = ['dance', 'jump', 'spin'];

export function VoiceBotStage({ speaking = false }: { speaking?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<VoiceBotHandle | null>(null);
  const [mode, setMode] = useState<SceneMode>('still');
  const [out, setOut] = useState(true);
  const [line, setLine] = useState(0);

  useEffect(() => {
    if (!canRun3D()) return;
    let cancelled = false;
    setMode('loading');
    import('./voiceBotScene3D')
      .then(({ mountVoiceBot }) => {
        if (cancelled || !canvasRef.current) return;
        handleRef.current = mountVoiceBot(canvasRef.current, { gridColor: GRID_COLOR });
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
  }, []);

  useEffect(() => {
    if (mode !== 'scene' || !out || speaking) return;
    const id = window.setInterval(() => setLine((i) => (i + 1) % BOT_LINES.length), LINE_MS);
    return () => window.clearInterval(id);
  }, [mode, out, speaking]);

  useEffect(() => {
    handleRef.current?.setSpeaking(speaking);
  }, [speaking]);

  const toggle = () => {
    const next = !out;
    setOut(next);
    handleRef.current?.setOut(next);
  };

  const poke = () => {
    if (mode !== 'scene') return;
    if (!out) {
      toggle();
      return;
    }
    handleRef.current?.play(MOVES[Math.floor(Math.random() * MOVES.length)]!);
    setLine((i) => (i + 1) % BOT_LINES.length);
  };

  return (
    <div className="va-stage" data-scene={mode} data-testid="va-bot-stage">
      <img
        className="lv3-stage-still"
        src="/landing-v3/hero-still.jpg"
        alt="KI-Assistent als Roboterfigur"
        width={1000}
        height={1250}
        decoding="async"
        hidden={mode === 'scene'}
      />
      <canvas ref={canvasRef} className="va-stage-canvas" aria-hidden="true" hidden={mode === 'still'} onClick={poke} />
      <span className="lv3-stage-tag">KI-Assistent · Vorschau</span>
      <p className={`va-say${out ? '' : ' va-say--off'}`} aria-live="polite">
        {speaking ? 'Ich spreche …' : BOT_LINES[line]}
      </p>
      {mode === 'scene' ? (
        <button type="button" className="lv3-btn va-stage-toggle" onClick={toggle}>
          {out ? 'Zurück in den Kasten' : 'Assistent holen'}
        </button>
      ) : null}
    </div>
  );
}
