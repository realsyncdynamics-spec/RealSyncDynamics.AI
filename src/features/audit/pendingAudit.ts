/**
 * Das offene Audit zwischen anonymem Bericht und Konto merken.
 *
 * ## Warum überhaupt etwas gemerkt wird
 *
 * Der Bericht entsteht **ohne** Konto. Die Übernahme in einen Mandanten kann
 * erst danach stattfinden — und dazwischen liegen Registrierung,
 * E-Mail-Bestätigung und womöglich ein Neustart des Browsers. Ohne eine
 * Notiz wäre die Kennung genau dann verloren, wenn sie gebraucht wird.
 *
 * ## Was hier bewusst **nicht** gespeichert wird
 *
 * Nur die Kennung. Keine Befunde, keine E-Mail, keine Domain, kein Score.
 * Der Bericht selbst liegt serverseitig; ihn zusätzlich im Browser zu halten,
 * würde personenbezogene Daten ohne Not verteilen — auf einem Gerät, das der
 * Betreiber nicht kontrolliert und für das er keine Löschfrist durchsetzen
 * kann.
 *
 * Die Kennung wird nach der Übernahme entfernt, nicht aufbewahrt.
 */
import { postEdgeFunction } from '../../lib/edgeFunction';

const KEY = 'rsd.pending_audit_id';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Kennung merken. Nur echte UUIDs — was aus einer Adresszeile kommt, ist
 * Eingabe eines Fremden, auch wenn es die eigene Seite ist.
 */
export function rememberPendingAudit(auditId: string | null | undefined): void {
  if (!auditId || !UUID_RE.test(auditId)) return;
  try { localStorage.setItem(KEY, auditId); } catch { /* privater Modus, kein Speicher */ }
}

export function readPendingAudit(): string | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && UUID_RE.test(v) ? v : null;
  } catch { return null; }
}

export function clearPendingAudit(): void {
  try { localStorage.removeItem(KEY); } catch { /* s. o. */ }
}

export interface ClaimResult {
  ok: true;
  already_claimed: boolean;
  audit_id: string;
  tenant_id: string;
  domain?: string;
  score?: number;
  severity?: string;
}

/**
 * Das gemerkte Audit übernehmen — sofern es eines gibt.
 *
 * Gibt `null` zurück, wenn nichts zu übernehmen war. Wirft **nicht**: Die
 * Übernahme ist ein Gewinn, kein Tor. Sie darf die Registrierung nicht
 * scheitern lassen, wenn sie fehlschlägt.
 *
 * Die Notiz wird auch bei `ALREADY_CLAIMED` entfernt — das Audit gehört dann
 * jemandem, und ein Wiederholungsversuch bei jedem Anmelden hätte keinen
 * anderen Ausgang.
 */
export async function claimPendingAudit(tenantId?: string | null): Promise<ClaimResult | null> {
  const auditId = readPendingAudit();
  if (!auditId) return null;

  try {
    const body = tenantId ? { audit_id: auditId, tenant_id: tenantId } : { audit_id: auditId };
    const result = await postEdgeFunction<ClaimResult>('audit-claim', body);
    clearPendingAudit();
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Endgültige Ausgänge: Die Notiz weg, sonst versucht es der Browser bei
    // jeder Anmeldung erneut.
    if (/bereits zu einem anderen Arbeitsbereich|nicht gefunden/i.test(message)) {
      clearPendingAudit();
    }
    // Alles andere (Netz, mehrdeutiger Mandant) bleibt liegen und darf es
    // beim nächsten Mal noch einmal versuchen.
    return null;
  }
}
