/**
 * Produktpfad und Modulauswahl über den Trichter hinweg festhalten.
 *
 * Der Kunde trifft nach dem kostenlosen Scan zwei getrennte Entscheidungen
 * — Governance ja/nein und Frontend-Umbau ja/nein — und zwar **bevor** er
 * ein Konto hat. Bis zur Registrierung gibt es keinen Mandanten, unter dem
 * sich das speichern liesse; deshalb liegt die Auswahl solange im
 * `sessionStorage` und wird nach dem Anlegen des Kontos übernommen.
 *
 * Bewusst `sessionStorage` und nicht `localStorage`: Es ist eine
 * Trichter-Entscheidung, keine dauerhafte Einstellung. Wer den Tab
 * schliesst und Tage später wiederkommt, soll die Frage neu gestellt
 * bekommen und nicht stillschweigend im alten Pfad landen.
 *
 * Diese Werte sind **keine Berechtigung**. Zugriff wird ausschliesslich
 * über `hasModule()` / `hasPermission()` gegen das gebuchte Abo
 * entschieden — hier steht nur, was der Kunde vorhat.
 */

import {
  isProductTrack,
  normalizeModuleSelection,
  type BookableModuleId,
  type ProductTrack,
} from '@/shared/pricing';

const TRACK_KEY = 'rsd.funnel.track';
const MODULES_KEY = 'rsd.funnel.modules';

/** Query-Parameter, über den der Pfad zwischen Trichter-Seiten wandert. */
export const TRACK_PARAM = 'track';

/**
 * `sessionStorage` ist in drei Fällen nicht benutzbar: beim Prerendering
 * (`scripts/prerender.mjs`, kein DOM), im privaten Modus mancher Browser
 * und wenn der Nutzer Website-Daten blockiert. In allen dreien darf der
 * Trichter weiterlaufen — nur eben ohne Erinnerung.
 */
function storage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readTrack(): ProductTrack | null {
  const raw = storage()?.getItem(TRACK_KEY);
  return isProductTrack(raw) ? raw : null;
}

export function writeTrack(track: ProductTrack): void {
  try {
    storage()?.setItem(TRACK_KEY, track);
  } catch {
    // Speichern ist eine Bequemlichkeit, kein Teil des Ablaufs.
  }
}

export function readModuleSelection(): BookableModuleId[] {
  const raw = storage()?.getItem(MODULES_KEY);
  if (!raw) return normalizeModuleSelection([]);
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return normalizeModuleSelection([]);
    return normalizeModuleSelection(parsed.filter((v): v is string => typeof v === 'string'));
  } catch {
    return normalizeModuleSelection([]);
  }
}

export function writeModuleSelection(selection: readonly BookableModuleId[]): void {
  try {
    storage()?.setItem(MODULES_KEY, JSON.stringify(normalizeModuleSelection(selection)));
  } catch {
    // s. o.
  }
}

/**
 * Pfad aus der URL lesen, sonst aus der Sitzung, sonst `null`.
 *
 * Die URL gewinnt, damit ein geteilter Link reproduzierbar bleibt — und
 * damit ein Wechsel des Pfades nicht an einem alten Sitzungswert scheitert.
 */
export function resolveTrack(search: URLSearchParams | string): ProductTrack | null {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const fromUrl = params.get(TRACK_PARAM);
  if (isProductTrack(fromUrl)) return fromUrl;
  return readTrack();
}

/** Bestehende Scan-Parameter erhalten und den Pfad ergänzen. */
export function withTrack(search: URLSearchParams | string, track: ProductTrack): string {
  const params = new URLSearchParams(typeof search === 'string' ? search : search.toString());
  params.set(TRACK_PARAM, track);
  return params.toString();
}
