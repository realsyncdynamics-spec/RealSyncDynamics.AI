/**
 * Hält einen begonnenen Bedarfs-Check über die Anmeldung hinweg fest.
 * sessionStorage: nur dieser Tab, endet mit dem Tab. Höchstens 60 Minuten alt.
 */
import { validateAnswers, type Answers } from './model';

const KEY = 'rsd.needsCheck.pending.v1';
const MAX_AGE_MS = 60 * 60 * 1000;

export interface Pending {
  answers: Answers;
  auditId: string | null;
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
    store()?.setItem(KEY, JSON.stringify({ ...p, at: now }));
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
    if (typeof p.at !== 'number' || now - p.at > MAX_AGE_MS) return null;
    const v = validateAnswers(p.answers ?? {});
    if (!v.ok) return null;
    const auditId = typeof p.auditId === 'string' ? p.auditId : null;
    return { answers: v.answers, auditId, wantsSave: p.wantsSave === true };
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
