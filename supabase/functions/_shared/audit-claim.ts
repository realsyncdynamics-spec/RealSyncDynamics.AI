/**
 * Übernahme eines anonymen Audits in einen Mandanten — die Entscheidungslogik.
 *
 * ## Warum es das braucht
 *
 * `gdpr_audits` trägt seit jeher `user_id`, `tenant_id` und `claimed_at`, und
 * die Lese-Policy ist bereits darauf geschrieben:
 *
 * ```sql
 * "gdpr_audits tenant_read": (tenant_id IS NOT NULL) AND is_tenant_member(tenant_id)
 * ```
 *
 * Ein Audit wird für einen Mandanten also **erst sichtbar, wenn es übernommen
 * ist**. Gemessen am 2026-08-30: 0 von 159 Zeilen haben `claimed_at`, und
 * nichts im Repository schreibt die Spalte. Der Lesepfad war fertig und hat
 * auf einen Schreiber gewartet, den es nie gab — der Trichter endete am
 * Bericht (`docs/product/canonical-funnel-decision.md` §1).
 *
 * ## Kein zweites Claim-Modell
 *
 * Das Muster stammt unverändert aus `siteos/handlers/anonymous.ts`:
 * Bearer-Token → Nutzer → Mitgliedschaft im Mandanten prüfen → atomar
 * übernehmen, wenn noch frei. Der Entscheid in
 * `canonical-funnel-decision.md` verbietet ausdrücklich ein zweites Modell;
 * hier wird deshalb dasselbe nachgezogen, nicht ein neues erfunden.
 *
 * ## Vertrauensmodell — ausdrücklich benannt
 *
 * Wer die `audit_id` kennt, darf sie **einmal** übernehmen. Die Kennung ist
 * eine UUIDv4, serverseitig vergeben und nicht ratbar; sie erreicht nur, wem
 * der Ergebnis-Link gegeben wurde. Das ist dieselbe Fähigkeits-Logik wie bei
 * `siteos_anonymous_builds` und beim Teilen über `audit_share_get`.
 *
 * Bewusst **nicht** verlangt wird, dass die E-Mail des Audits zur E-Mail des
 * Kontos passt: Der Scan über den Optimizer-Pfad erhebt gar keine E-Mail
 * (`gdpr-audit/index.ts`, `isOptimizerScan`), und wer mit einer Arbeitsadresse
 * scannt und sich privat registriert, wäre sonst ausgesperrt. Eine
 * Abweichung wird stattdessen im Prüfpfad festgehalten — beobachtbar statt
 * blockierend.
 *
 * Pure Funktionen ohne Netzwerk — direkt unter Vitest prüfbar.
 */

export interface AuditClaimRow {
  id: string;
  tenant_id: string | null;
  user_id: string | null;
  claimed_at: string | null;
  email: string | null;
}

export type ClaimDecision =
  /** Frei — die Übernahme darf versucht werden. */
  | { status: 'claimable' }
  /** Schon von genau diesem Mandanten übernommen. Kein Fehler. */
  | { status: 'already_mine' }
  /** Von einem anderen Mandanten übernommen. */
  | { status: 'taken'; conflictTenantId: string };

/**
 * Darf dieser Mandant das Audit übernehmen?
 *
 * Die zweite Übernahme durch denselben Mandanten ist **kein Fehler**: Ein
 * Nutzer, der den Link erneut öffnet oder die Seite neu lädt, soll dieselbe
 * Antwort bekommen wie beim ersten Mal. Nur eine fremde Übernahme ist ein
 * Konflikt.
 */
export function decideClaim(row: AuditClaimRow, tenantId: string): ClaimDecision {
  // `claimed_at` ist die führende Spalte. `tenant_id` allein genügt nicht:
  // Ein Audit koennte theoretisch einem Mandanten zugeordnet sein, ohne dass
  // je eine Uebernahme stattfand — dann ist der Zeitstempel die Wahrheit.
  if (row.claimed_at === null) return { status: 'claimable' };
  if (row.tenant_id === tenantId) return { status: 'already_mine' };
  return { status: 'taken', conflictTenantId: row.tenant_id ?? 'unknown' };
}

/**
 * Welchen Mandanten übernimmt der Nutzer?
 *
 * Ohne Angabe wird abgeleitet — aber nur, wenn es genau einen gibt. Bei
 * mehreren zu raten hiesse, ein fremdes Audit im falschen Arbeitsbereich
 * abzulegen; das ist über die Oberfläche nicht mehr zu korrigieren, weil die
 * Lese-Policy es dem richtigen Mandanten dann dauerhaft verbirgt.
 */
export type TenantResolution =
  | { ok: true; tenantId: string }
  | { ok: false; code: 'TENANT_NOT_FOUND' | 'TENANT_AMBIGUOUS' | 'FORBIDDEN' };

export function resolveTenant(
  memberships: readonly { tenant_id: string }[],
  requested: string | null,
): TenantResolution {
  if (requested) {
    return memberships.some((m) => m.tenant_id === requested)
      ? { ok: true, tenantId: requested }
      : { ok: false, code: 'FORBIDDEN' };
  }
  if (memberships.length === 0) return { ok: false, code: 'TENANT_NOT_FOUND' };
  if (memberships.length > 1) return { ok: false, code: 'TENANT_AMBIGUOUS' };
  return { ok: true, tenantId: memberships[0].tenant_id };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Kennungen werden geprüft, bevor sie in eine Abfrage gehen. */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * Weicht die E-Mail des Audits von der des Kontos ab?
 *
 * Blockiert nicht (siehe Vertrauensmodell oben), landet aber im Prüfpfad.
 * Ein Audit ohne E-Mail (Optimizer-Pfad) gilt nicht als Abweichung.
 */
export function emailMismatch(auditEmail: string | null, accountEmail: string | null): boolean {
  if (!auditEmail || !accountEmail) return false;
  return auditEmail.trim().toLowerCase() !== accountEmail.trim().toLowerCase();
}
