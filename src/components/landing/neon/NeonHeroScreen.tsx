import { useEffect, useRef, useState } from 'react';
import { GlassCube } from '../../neon/GlassCube';
import { GlassPanel } from '../../neon/GlassPanel';

/**
 * Glaswürfel im Hero mit Untertitel-Leiste („Voice-Show“).
 *
 * Seit 18.11.2026 (Owner-Vorlage „3D-Glaswürfel“) ist der Würfel selbst
 * transparent (GlassCube); der Ablauf läuft in einer Glasleiste darunter.
 *
 * Zeigt den geplanten Ablauf des AI Receptionist als Untertitel-Show und
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
  const [idx, setIdx] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const barsRef = useRef<HTMLDivElement>(null);
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Stumme Show: Zeilen nacheinander, solange die Stimme aus ist.
  useEffect(() => {
    if (voiceOn) return;
    if (reducedMotion()) return;
    const id = window.setInterval(() => setIdx((i) => (i + 1) % lines.length), 3800);
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
    if (canSpeak) window.speechSynthesis.cancel();
  }, [canSpeak]);

  function speakFrom(i: number) {
    if (i >= lines.length) {
      setVoiceOn(false);
      setSpeaking(false);
      return;
    }
    setIdx(i);
    const u = new SpeechSynthesisUtterance(lines[i]);
    u.lang = 'de-DE';
    const de = window.speechSynthesis.getVoices().find((v) => /^de/i.test(v.lang));
    if (de) u.voice = de;
    u.onstart = () => setSpeaking(true);
    u.onend = () => {
      setSpeaking(false);
      window.setTimeout(() => speakFrom(i + 1), 400);
    };
    u.onerror = () => {
      setVoiceOn(false);
      setSpeaking(false);
    };
    window.speechSynthesis.speak(u);
  }

  function toggleVoice() {
    if (!canSpeak) return;
    window.speechSynthesis.cancel();
    if (voiceOn) {
      setVoiceOn(false);
      setSpeaking(false);
      return;
    }
    setVoiceOn(true);
    speakFrom(0);
  }

  return (
    <div className="ln-stage ln-stage--glass" data-testid="neon-hero-screen">
      <GlassCube className="ln-cube-stage" />
      <span className="ln-screen-top ln-glass-tag">
        <span className="ln-dot" aria-hidden="true" />
        Vorschau · {statusLabel}
      </span>
      <GlassPanel className="ln-glass-bar">
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
      </GlassPanel>
    </div>
  );
}
