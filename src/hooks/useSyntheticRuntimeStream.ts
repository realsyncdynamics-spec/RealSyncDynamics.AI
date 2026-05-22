/**
 * useSyntheticRuntimeStream.ts
 *
 * Hook: Synthetic Runtime Demo Stream
 *
 * Emittiert rotierende Demo-Events mit echten Timestamps und zufälligen
 * Delays. Kein Backend, kein Netzwerk, kein Supabase.
 *
 * Features:
 *   - Events kommen aus SYNTHETIC_EVENT_POOL (40 Einträge)
 *   - Timestamp = aktuelle Uhrzeit beim Emit (HH:MM:SS)
 *   - Delay zufällig zwischen minDelay..maxDelay ms
 *   - useReducedMotion wird respektiert (kein Interval bei a11y-Präferenz)
 *   - Pausiert wenn Tab/Komponente invisible (visibilitychange)
 *   - Max. N Events im State um Memory-Leak zu verhindern
 *   - Cleanup via clearTimeout beim Unmount
 *
 * Usage:
 *   const { events, isRunning } = useSyntheticRuntimeStream();
 */

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import {
  type SyntheticRuntimeEvent,
  pickRandomTemplate,
  nowTimestamp,
} from '../lib/syntheticRuntimeEvents';

// ── Config ────────────────────────────────────────────────────────────────────

export interface UseSyntheticRuntimeStreamOptions {
  /**
   * Minimales Emit-Intervall in ms.
   * @default 1500
   */
  minDelay?: number;
  /**
   * Maximales Emit-Intervall in ms.
   * @default 3200
   */
  maxDelay?: number;
  /**
   * Maximale Anzahl Events im State (FIFO — älteste werden verworfen).
   * @default 40
   */
  maxEvents?: number;
  /**
   * Startet den Stream sofort beim Mount.
   * @default true
   */
  autoStart?: boolean;
}

export interface UseSyntheticRuntimeStreamResult {
  /** Die aktuell sichtbaren Demo-Events (neueste zuletzt). */
  events: SyntheticRuntimeEvent[];
  /** true während der Stream läuft. */
  isRunning: boolean;
}

// Laufender Zähler für eindeutige Event-IDs (modulweise, nicht global).
let _idCounter = 0;

export function useSyntheticRuntimeStream({
  minDelay = 1500,
  maxDelay = 3200,
  maxEvents = 40,
  autoStart = true,
}: UseSyntheticRuntimeStreamOptions = {}): UseSyntheticRuntimeStreamResult {
  const reduce = useReducedMotion();
  const [events, setEvents] = useState<SyntheticRuntimeEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedRef = useRef(false);

  // ── Emit-Funktion ───────────────────────────────────────────────────────────────────────────────
  function scheduleNext() {
    if (pausedRef.current) return;
    const delay = minDelay + Math.random() * (maxDelay - minDelay);
    timerRef.current = setTimeout(() => {
      const template = pickRandomTemplate();
      const event: SyntheticRuntimeEvent = {
        ...template,
        id: String(++_idCounter),
        ts: nowTimestamp(),
      };
      setEvents((prev) => {
        const next = [...prev, event];
        // FIFO: älteste verwerfen wenn maxEvents überschritten
        return next.length > maxEvents ? next.slice(next.length - maxEvents) : next;
      });
      scheduleNext();
    }, delay);
  }

  useEffect(() => {
    // Bei reduzierter Bewegung keinen Stream starten —
    // Konsumenten sollen stattdessen einen statischen Initial-State rendern.
    if (reduce || !autoStart) return;

    pausedRef.current = false;
    setIsRunning(true);
    scheduleNext();

    // Pause wenn Tab hidden (spart CPU, verhindert Event-Flut nach Tab-Wechsel)
    function handleVisibility() {
      if (document.hidden) {
        pausedRef.current = true;
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      } else {
        pausedRef.current = false;
        scheduleNext();
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
      setIsRunning(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce, autoStart, minDelay, maxDelay, maxEvents]);

  return { events, isRunning };
}
