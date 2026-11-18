import { useEffect, useRef, useState } from 'react';

/**
 * Neon-Würfel im Hero mit Bildschirm („Voice-Show“).
 *
 * Führt fünf sichtbare Phasen (Glasgitter → Farbwürfel → Zerfall → leer → Neuordnung)
 * als reine CSS-Vorschau aus. Zeigt den geplanten Ablauf als Untertitel-Show und
 * kann ihn mit der Sprachausgabe des Browsers vorlesen. Bewusst KEINE
 * Verbindung zu einem Sprach-Agenten und keine Bot-/Agent-ID im Bundle:
 * Telefonie ist laut Registry (`voice-telephony`) nicht live, darum trägt
 * der Bildschirm sichtbar das Statuslabel aus der Registry und „Vorschau“.
 */
export interface NeonHeroScreenProps {
  heading: string;
  steps: readonly string[];
  /** Statuslabel aus der Registry, z. B. „In Vorbereitung“. */
  statusLabel: string;
}

const BAR_COUNT = 22;

/** Sichtbarer Fünf-Phasen-Zyklus der Designvorschau; keine Backend-Laufzeit. */
export const CUBE_PHASES = ['lattice', 'solid', 'shatter', 'empty', 'reassemble'] as const;

function reducedMotion(): boolean {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

export function screenLines(heading: string, steps: readonly string[]): string[] {
  return [heading, ...steps.map((s, i) => `Schritt ${i + 1}: ${s}.`)];
}

export function NeonHeroScreen({ heading, steps, statusLabel }: NeonHeroScreenProps) {
  const lines = screenLines(heading, steps);
  const [phase, setPhase] = useState(0);
  const idx = Math.min(phase, lines.length - 1);
  const speechRunRef = useRef(0);
  const nextLineTimerRef = useRef<number | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const barsRef = useRef<HTMLDivElement>(null);
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

  // Stumme Show: Zeilen nacheinander, solange die Stimme aus ist.
  useEffect(() => {
    if (voiceOn) return;
    if (reducedMotion()) return;
    const id = window.setInterval(() => setPhase((i) => (i + 1) % CUBE_PHASES.length), 3800);
    return () => window.clearInterval(id);
  }, [voiceOn, lines.length]);

  // Sprachwellen: nur Darstellung, keine Audioanalyse.
  useEffect(() => {
    if (reducedMotion()) return;
    let raf = 0;
    const loop = (t: number) => {
      const bars = barsRef.current?.children;
      if (bars) {
        const active = voiceOn ? speaking : true;
        for (let k = 0; k < bars.length; k++) {
          const h = active ? 18 + Math.abs(Math.sin(t / 160 + k * 0.7)) * 62 : 10;
          (bars[k] as HTMLElement).style.height = `${h}%`;
        }
      }
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(raf);
  }, [voiceOn, speaking]);

  useEffect(() => () => {
    speechRunRef.current += 1;
    if (nextLineTimerRef.current !== null) window.clearTimeout(nextLineTimerRef.current);
    if (canSpeak) window.speechSynthesis.cancel();
  }, [canSpeak]);

  function speakFrom(i: number, runId: number) {
    if (runId !== speechRunRef.current) return;
    if (i >= lines.length) {
      // Nach der vierten gesprochenen Zeile folgt die sichtbare Neuordnung.
      setPhase(CUBE_PHASES.length - 1);
      setVoiceOn(false);
      setSpeaking(false);
      return;
    }
    setPhase(i);
    const utterance = new SpeechSynthesisUtterance(lines[i]);
    utterance.lang = 'de-DE';
    const germanVoice = window.speechSynthesis.getVoices().find((v) => /^de/i.test(v.lang));
    if (germanVoice) utterance.voice = germanVoice;
    utterance.onstart = () => {
      if (runId === speechRunRef.current) setSpeaking(true);
    };
    utterance.onend = () => {
      if (runId !== speechRunRef.current) return;
      setSpeaking(false);
      nextLineTimerRef.current = window.setTimeout(() => speakFrom(i + 1, runId), 400);
    };
    utterance.onerror = () => {
      if (runId !== speechRunRef.current) return;
      setVoiceOn(false);
      setSpeaking(false);
    };
    window.speechSynthesis.speak(utterance);
  }

  function toggleVoice() {
    if (!canSpeak) return;
    // Die Laufnummer verhindert, dass ein verspätetes onend nach „Stoppen“
    // erneut einen Satz startet. Das betrifft auch den 400-ms-Übergang.
    speechRunRef.current += 1;
    if (nextLineTimerRef.current !== null) {
      window.clearTimeout(nextLineTimerRef.current);
      nextLineTimerRef.current = null;
    }
    window.speechSynthesis.cancel();
    if (voiceOn) {
      setVoiceOn(false);
      setSpeaking(false);
      return;
    }
    setVoiceOn(true);
    speakFrom(0, speechRunRef.current);
  }

  return (
    <div className="ln-stage" data-testid="neon-hero-screen">
      <div className="ln-cube" data-phase={CUBE_PHASES[phase]} data-testid="neon-cube-phase">
        <div className="ln-f ln-f-top" aria-hidden="true" />
        <div className="ln-f ln-f-side" aria-hidden="true" />
        <div className="ln-f ln-f-back" aria-hidden="true" />
        <div className="ln-f ln-f-front">
          <div className="ln-screen">
            <span className="ln-screen-top">
              <span className="ln-dot" aria-hidden="true" />
              Vorschau · {statusLabel}
            </span>
            <span className="ln-orb" aria-hidden="true"><span>RealSync AI</span></span>
            <div className="ln-bars" ref={barsRef} aria-hidden="true">
              {Array.from({ length: BAR_COUNT }, (_, k) => <i key={k} />)}
            </div>
            <p className="ln-cap" aria-live="polite" data-testid="neon-hero-caption">
              <b>RealSync AI:</b> {lines[idx]}
            </p>
            {canSpeak ? (
              <button type="button" className="ln-voice" onClick={toggleVoice} aria-pressed={voiceOn}>
                {voiceOn ? 'Vorlesen stoppen' : 'Ablauf vorlesen'}
              </button>
            ) : null}
          </div>
        </div>
        <div className="ln-shadow" aria-hidden="true" />
      </div>
    </div>
  );
}
