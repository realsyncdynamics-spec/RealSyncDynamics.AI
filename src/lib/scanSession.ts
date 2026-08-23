/**
 * Der Scan zwischen Ergebnisseite und Registrierung.
 *
 * ## Warum überhaupt gespeichert wird
 *
 * Der Trichter lautet: Scan → Ergebnis → Konto → Dashboard. Der Scan
 * entsteht **vor** der Anmeldung; zu diesem Zeitpunkt gibt es keinen
 * Mandanten, unter dem er liegen könnte. Bis zur Übernahme reist die
 * Scan-Kennung deshalb mit dem Besucher.
 *
 * ## Warum sessionStorage
 *
 * Wie bei `src/unified-entry/productTrack.ts`: Das ist eine
 * Trichter-Entscheidung, keine dauerhafte Einstellung. Sie soll mit dem
 * Schliessen des Tabs enden und nicht Monate später eine fremde Analyse in
 * ein neues Konto ziehen.
 *
 * ## Warum jeder Lesepfad prüft
 *
 * Speicher und Query-Parameter sind Nutzereingabe. Beschädigter Inhalt, eine
 * erfundene Kennung oder ein manipulierter Wert dürfen nicht bis in den
 * Übernahme-Aufruf durchlaufen — sie fallen hier weg.
 */

const STORAGE_KEY = 'rsd.scan.session';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ScanSession {
  /** Kennung des Scans. Zugleich das Zugriffsmittel auf den Bericht. */
  scanId: string;
  /** Geprüfte Domain — nur zur Anzeige, etwa „Analyse für firma.de sichern". */
  domain: string;
}

/** Ist das eine Scan-Kennung, wie der Server sie vergibt? */
export function isValidScanId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function rememberScanSession(session: ScanSession): void {
  if (!isValidScanId(session.scanId)) return;
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ scanId: session.scanId, domain: String(session.domain ?? '') }),
    );
  } catch {
    // Privater Modus oder gesperrter Speicher. Der Trichter funktioniert
    // auch ohne — die Kennung steht zusätzlich in der Adresszeile.
  }
}

export function readScanSession(): ScanSession | null {
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const candidate = parsed as Record<string, unknown>;
    if (!isValidScanId(candidate.scanId)) return null;
    return {
      scanId: candidate.scanId,
      domain: typeof candidate.domain === 'string' ? candidate.domain : '',
    };
  } catch {
    // Beschädigter Inhalt wird verworfen, nicht repariert.
    return null;
  }
}

export function clearScanSession(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nichts zu tun — der Eintrag verfällt spätestens mit dem Tab.
  }
}

/**
 * Kennung für die Übernahme: erst die Adresszeile, dann der Speicher.
 *
 * Die Reihenfolge ist wichtig. Wer einen Ergebnis-Link öffnet, meint den
 * Scan aus dem Link — auch wenn im selben Tab vorher ein anderer lief.
 */
export function resolveScanId(searchParams: URLSearchParams): string | null {
  const fromUrl = searchParams.get('scan');
  if (isValidScanId(fromUrl)) return fromUrl;
  return readScanSession()?.scanId ?? null;
}
