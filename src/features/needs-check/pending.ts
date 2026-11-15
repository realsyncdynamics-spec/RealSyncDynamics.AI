/**
 * Hält einen begonnenen Bedarfs-Check über die Anmeldung hinweg fest.
 * sessionStorage: nur dieser Tab, endet mit dem Tab. Höchstens 60 Minuten alt.
 * Gespeichert werden nur die Angaben — Empfehlungen berechnet der Server.
 */
import { validateAnswers, type Answers } from '../../../shared/needs-check';

const KEY = 'rsd.needsCheck.pending.v2';
const MAX_AGE_MS = 60 * 60 * 1000;

export interface Pending {
  answers: Answers;
  /** Der Nutzer hatte „Speichern“ gewählt, bevor er sich anmelden musste. */
  wantsSave: boolean;
}

function store(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export function writePending(p: Pending, now = Date.now()): void {
  try {
    store()?.setItem(KEY, JSON.stringify({ answers: p.answers, wantsSave: p.wantsSave, at: now }));
  } catch {
    /* Speicher voll oder gesperrt: Ablauf geht ohne Wiederaufnahme weiter. */
  }
}

export function readPending(now = Date.now()): Pending | null {
  let raw: string | null = null;
  try {
    raw = store()?.getItem(KEY) ?? null;
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<Pending> & { at?: number };
    if (typeof p.at !== 'number' || now - p.at > MAX_AGE_MS || p.at > now) return null;
    const v = validateAnswers(p.answers ?? {});
    if (!v.ok) return null;
    return { answers: v.answers, wantsSave: p.wantsSave === true };
  } catch {
    return null;
  }
}

export function clearPending(): void {
  try {
    store()?.removeItem(KEY);
  } catch {
    /* ignorieren */
  }
}
