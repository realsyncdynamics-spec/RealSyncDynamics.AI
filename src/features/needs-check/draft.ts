/**
 * Begonnenen Bedarfs-Check über eine Anmeldung hinweg erhalten.
 *
 * Gespeichert werden nur die drei Auswahlwerte (Ziel, Bereich, Website
 * ja/nein) — keine Adresse, keine E-Mail, kein Freitext. `localStorage`
 * statt `sessionStorage`, weil der Anmelde-Link aus der E-Mail in einem
 * neuen Tab öffnet.
 */
import { parseNeedsAnswers, type NeedsAnswers } from '@/shared/needs-check';

export const NEEDS_CHECK_DRAFT_KEY = 'rsd.needs_check_draft';

export function readNeedsDraft(): NeedsAnswers | null {
  try {
    const raw = localStorage.getItem(NEEDS_CHECK_DRAFT_KEY);
    if (!raw) return null;
    return parseNeedsAnswers(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeNeedsDraft(answers: NeedsAnswers): void {
  try {
    localStorage.setItem(NEEDS_CHECK_DRAFT_KEY, JSON.stringify(answers));
  } catch {
    /* privater Modus, kein Speicher — der Ablauf funktioniert ohne Entwurf */
  }
}

export function clearNeedsDraft(): void {
  try {
    localStorage.removeItem(NEEDS_CHECK_DRAFT_KEY);
  } catch {
    /* nichts zu entfernen */
  }
}
