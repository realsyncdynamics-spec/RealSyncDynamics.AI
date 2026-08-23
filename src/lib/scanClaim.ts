/**
 * Übernahme des anonymen Scans in den frisch angelegten Arbeitsbereich.
 *
 * Der Trichter verspricht: „Analyse speichern & Dashboard öffnen." Ohne
 * diesen Schritt bekäme der Kunde ein leeres Dashboard und müsste die Adresse
 * erneut eingeben — die Registrierung hätte ihm dann nichts eingebracht.
 *
 * ## Bewusst ohne Blockade
 *
 * Der Aufruf ist absichtlich fehlertolerant. Schlägt er fehl, ist das
 * ärgerlich, aber der Nutzer hat trotzdem ein Konto — und ein Konto ohne
 * zugeordneten Scan ist unendlich viel besser als eine Registrierung, die an
 * der Zuordnung scheitert. Deshalb: kein `throw` nach aussen, kein Aufhalten
 * des Onboardings.
 *
 * ## Warum kein tenant_id mitgeschickt wird
 *
 * Der Mandant wird serverseitig aus dem Token des Aufrufers aufgelöst. Ein
 * `tenant_id` aus dem Browser wäre eine Einladung, fremde Arbeitsbereiche zu
 * benennen.
 */
import { postEdgeFunction } from './edgeFunction';
import { clearScanSession, isValidScanId, readScanSession } from './scanSession';

export type ScanClaimResult =
  | { status: 'claimed'; scanId: string }
  | { status: 'already_claimed'; scanId: string }
  | { status: 'nothing_to_claim' }
  | { status: 'failed'; scanId: string; reason: string };

interface ClaimResponse {
  ok: true;
  scan_id: string;
  tenant_id: string;
  already_claimed: boolean;
}

/**
 * Übernimmt den in dieser Sitzung gemerkten Scan, sofern es einen gibt.
 *
 * @param explicitScanId Kennung aus der Adresszeile, falls vorhanden. Sie hat
 *   Vorrang vor dem Sitzungsspeicher — wer einem Link folgt, meint den Scan
 *   aus dem Link.
 */
export async function claimPendingScan(explicitScanId?: string | null): Promise<ScanClaimResult> {
  const scanId = isValidScanId(explicitScanId)
    ? explicitScanId
    : readScanSession()?.scanId ?? null;

  if (scanId === null) return { status: 'nothing_to_claim' };

  try {
    const data = await postEdgeFunction<ClaimResponse>('public-site-scan/claim', { scan_id: scanId });
    // Erst nach bestätigter Übernahme aufräumen: Bleibt der Eintrag bei einem
    // Fehlschlag stehen, kann ein späterer Versuch ihn noch einlösen.
    clearScanSession();
    return data.already_claimed
      ? { status: 'already_claimed', scanId }
      : { status: 'claimed', scanId };
  } catch (err) {
    return {
      status: 'failed',
      scanId,
      reason: err instanceof Error ? err.message : 'unbekannter Fehler',
    };
  }
}
