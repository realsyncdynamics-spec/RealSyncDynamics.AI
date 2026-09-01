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
import {
  PENDING_AUDIT_ID_KEY,
  claimPendingAudit as claimViaRpc,
  clearPendingAudit as clearAllPending,
} from '../../core/onboarding/claimAudit';

const KEY = PENDING_AUDIT_ID_KEY;

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
  clearAllPending();
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
 * **Ein Schreibweg.** Übernommen wird über die RPC `claim_gdpr_audit`
 * (`core/onboarding/claimAudit.ts`) — dieselbe, die `/welcome` und die
 * Dashboard-Karte benutzen. Vorher rief diese Datei die Edge Function
 * `audit-claim`, die nie deployt wurde (UNBACKED_CALLERS); die Übernahme
 * aus dem Unified-Entry-Pfad schlug damit still fehl. Der Mandant ergibt
 * sich aus der Mitgliedschaft des angemeldeten Nutzers; `tenantId` bleibt
 * als Parameter erhalten, damit Aufrufer unverändert bleiben.
 *
 * Die Notiz wird auch bei `ALREADY_CLAIMED` entfernt — das Audit gehört dann
 * jemandem, und ein Wiederholungsversuch bei jedem Anmelden hätte keinen
 * anderen Ausgang.
 */
export async function claimPendingAudit(_tenantId?: string | null): Promise<ClaimResult | null> {
  const auditId = readPendingAudit();
  if (!auditId) return null;

  try {
    const result = await claimViaRpc();
    if (!result) return null;
    return {
      ok: true,
      already_claimed: result.already_claimed,
      audit_id: result.audit_id,
      tenant_id: result.tenant_id,
      domain: result.domain || undefined,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Endgültige Ausgänge: Die Notiz weg, sonst versucht es der Browser bei
    // jeder Anmeldung erneut.
    if (/bereits zu einem anderen Arbeitsbereich|nicht gefunden|ALREADY_CLAIMED|NOT_FOUND/i.test(message)) {
      clearPendingAudit();
    }
    // Alles andere (Netz, mehrdeutiger Mandant) bleibt liegen und darf es
    // beim nächsten Mal noch einmal versuchen.
    return null;
  }
}
