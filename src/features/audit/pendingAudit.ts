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
  AuditClaimError,
  PENDING_AUDIT_ID_KEY,
  claimPendingAudit as claimViaRpc,
  clearPendingAudit as clearAllPending,
} from '../../core/onboarding/claimAudit';
import type { ClaimErrorCode } from '../../../supabase/functions/_shared/audit-claim';

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
 * `audit-claim`; zu jenem Zeitpunkt war sie nicht deployt, und die
 * Übernahme aus dem Unified-Entry-Pfad schlug still fehl. Deployt ist sie
 * inzwischen (gemessen 2026-09-04) und ruft seit 2026-10-13 selbst nur
 * noch diese RPC auf — ein Schreibweg.
 *
 * `tenantId` ist der aktive Arbeitsbereich. Er wird nur verwendet, wenn der
 * Nutzer zu mehreren gehört und die RPC deshalb eine Auswahl verlangt.
 *
 * Endgültige Ausgänge (`ALREADY_CLAIMED`, `NOT_FOUND`, fremde E-Mail)
 * entfernen die Notiz bereits in `claimViaRpc` — ein Wiederholungsversuch
 * bei jedem Anmelden hätte keinen anderen Ausgang.
 */
export async function claimPendingAudit(tenantId?: string | null): Promise<ClaimResult | null> {
  const outcome = await claimPendingAuditWithStatus(tenantId);
  return outcome.status === 'claimed' ? outcome.result : null;
}

export type ClaimOutcome =
  | { status: 'none' }
  | { status: 'claimed'; result: ClaimResult }
  | { status: 'failed'; code: ClaimErrorCode; message: string; retryable: boolean };

/**
 * Wie `claimPendingAudit`, aber mit dem Ausgang — damit die Oberfläche eine
 * gescheiterte Übernahme erklären und einen erneuten Versuch anbieten kann,
 * statt sie zu verschweigen. Wirft nicht.
 */
export async function claimPendingAuditWithStatus(tenantId?: string | null): Promise<ClaimOutcome> {
  // Kein Vorab-Blick nur in diesen Merkplatz: `claimViaRpc` liest alle drei
  // (Sitzung, Permalink-Notiz, Trichter-Kontext) und kehrt ohne Netzaufruf
  // zurück, wenn keiner etwas enthält.
  try {
    const result = await claimViaRpc(tenantId);
    if (!result) return { status: 'none' };
    return {
      status: 'claimed',
      result: {
        ok: true,
        already_claimed: result.already_claimed,
        audit_id: result.audit_id,
        tenant_id: result.tenant_id,
        domain: result.domain || undefined,
      },
    };
  } catch (e) {
    const failure = e instanceof AuditClaimError ? e : new AuditClaimError('INTERNAL');
    return { status: 'failed', code: failure.code, message: failure.message, retryable: failure.retryable };
  }
}
