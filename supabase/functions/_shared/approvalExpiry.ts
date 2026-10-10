/**
 * Ablauf von governance_approvals — eine Regel für Liste, Entscheidung und Zähler.
 *
 * Eine Freigabe mit status 'pending' und expires_at <= jetzt ist abgelaufen,
 * auch wenn noch kein Job den gespeicherten Status auf 'expired' gesetzt hat
 * (es gibt keinen solchen Job). Sie gehört dann nicht mehr zu „offen“, darf
 * nicht mehr freigegeben werden und erscheint unter „Abgelaufen“.
 *
 * Bewusst ohne Imports: wird von der Edge Function `governance-approvals`
 * und von Tests (Vitest) gleichermaßen genutzt.
 */

/** Ist der Zeitpunkt `expiresAt` erreicht oder überschritten? Fehlend/ungültig = nicht abgelaufen. */
export function isApprovalExpired(expiresAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!expiresAt) return false;
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return false;
  return t <= now.getTime();
}

/**
 * PostgREST-`or`-Filter für die Liste „Abgelaufen“: gespeichert 'expired'
 * ODER noch 'pending', aber Frist vorbei. Der Zeitstempel steht in
 * Anführungszeichen, damit Doppelpunkte/Punkte im ISO-String nicht als
 * Filter-Syntax gelesen werden.
 */
export function expiredApprovalsOrFilter(nowIso: string): string {
  return `status.eq.expired,and(status.eq.pending,expires_at.lte."${nowIso}")`;
}
