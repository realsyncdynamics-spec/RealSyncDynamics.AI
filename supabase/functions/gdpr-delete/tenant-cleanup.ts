/**
 * Eigene Ein-Personen-Workspaces bei der Konto-Löschung (Art. 17) — Entscheidungslogik.
 *
 * Deno-frei, damit Vitest sie direkt prüfen kann.
 *
 * Jede Registrierung legt einen Workspace an, dessen einziger Owner die Person
 * ist. Bis 23.10.2026 lehnte gdpr-delete deshalb JEDE Selbstlöschung mit 409
 * ab. Die RPC `delete_sole_member_tenants` (Migration 20261023120000) löscht
 * solche Workspaces mit — außer sie haben weitere Mitglieder, Stripe-
 * Abrechnung oder aufbewahrungspflichtige Nachweise.
 *
 * FAIL CLOSED: Ein Fehler, eine fehlende RPC oder ein unerwartetes Ergebnis
 * bricht ab, bevor am Konto etwas geändert ist.
 */

export type TenantBlockReason = 'other_members' | 'billing_records' | 'retained_records';

export type TenantCleanupCheck =
  | { ok: true; tenants: number }
  | {
    ok: false;
    status: 409 | 500 | 503;
    code: string;
    message: string;
    details?: { sole_owner_of: Array<{ tenant_id: string; name: string }> };
    logCode: string | null;
  };

const PRIVACY_CONTACT = 'privacy@realsyncdynamicsai.de';

/** Vorrang: Was die Person selbst lösen kann, zuerst nennen. */
const REASON_ORDER: TenantBlockReason[] = ['other_members', 'billing_records', 'retained_records'];

interface BlockedEntry {
  tenant_id?: unknown;
  name?: unknown;
  reason?: unknown;
  sqlstate?: unknown;
}

export function checkTenantCleanup(
  data: unknown,
  error: { code?: string; message?: string } | null,
): TenantCleanupCheck {
  if (error) {
    const missing = error.code === 'PGRST202' || error.code === '42883';
    return {
      ok: false,
      status: missing ? 503 : 500,
      code: missing ? 'WORKSPACE_CLEANUP_UNAVAILABLE' : 'WORKSPACE_CLEANUP_FAILED',
      message: missing
        ? 'Die Löschung ist vorübergehend nicht möglich. Dein Konto wurde nicht verändert. Bitte versuche es später erneut.'
        : 'Die Löschung konnte nicht abgeschlossen werden. Dein Konto wurde nicht verändert.',
      logCode: error.code ?? null,
    };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return unverified();
  const result = data as { ok?: unknown; tenants?: unknown; blocked?: unknown };

  if (result.ok === true) {
    if (typeof result.tenants !== 'number' || !Number.isInteger(result.tenants) || result.tenants < 0) {
      return unverified();
    }
    return { ok: true, tenants: result.tenants };
  }

  if (result.ok !== false || !Array.isArray(result.blocked) || result.blocked.length === 0) return unverified();
  const blocked = result.blocked as BlockedEntry[];
  const reasons = new Set(blocked.map((b) => b?.reason));
  const reason = REASON_ORDER.find((r) => reasons.has(r));
  if (!reason) return unverified();

  if (reason === 'other_members') {
    return {
      ok: false,
      status: 409,
      // Code bleibt SOLE_OWNER: Die Kontoeinstellungen kennen ihn seit jeher.
      code: 'SOLE_OWNER',
      message: 'Du bist alleiniger Owner eines Workspaces mit weiteren Mitgliedern. '
        + 'Übertrage erst die Ownership oder entferne die Mitglieder. Dein Konto wurde nicht verändert.',
      details: {
        sole_owner_of: blocked
          .filter((b) => b?.reason === 'other_members' && typeof b.tenant_id === 'string')
          .map((b) => ({ tenant_id: b.tenant_id as string, name: typeof b.name === 'string' ? b.name : '?' })),
      },
      logCode: 'other_members',
    };
  }
  if (reason === 'billing_records') {
    return {
      ok: false,
      status: 409,
      code: 'BILLING_RETENTION',
      message: 'Zu deinem Workspace gibt es Abrechnungsdaten, die wir gesetzlich aufbewahren müssen (HGB/AO). '
        + `Schreib uns an ${PRIVACY_CONTACT} — wir löschen dein Konto und sperren die Abrechnungsdaten bis zum Fristende. `
        + 'Dein Konto wurde nicht verändert.',
      logCode: 'billing_records',
    };
  }
  // Interner SQLSTATE nur ins Log, nie in die Antwort.
  const state = blocked.find((b) => b?.reason === 'retained_records')?.sqlstate;
  return {
    ok: false,
    status: 409,
    code: 'WORKSPACE_RETAINED',
    message: 'Dein Workspace enthält Nachweise, die aufbewahrt werden müssen. '
      + `Schreib uns an ${PRIVACY_CONTACT} — wir löschen dein Konto und entfernen den Personenbezug. `
      + 'Dein Konto wurde nicht verändert.',
    logCode: typeof state === 'string' ? `retained_records:${state}` : 'retained_records',
  };
}

function unverified(): TenantCleanupCheck {
  return {
    ok: false,
    status: 500,
    code: 'WORKSPACE_CLEANUP_UNVERIFIED',
    message: 'Die Löschung konnte nicht bestätigt werden. Dein Konto wurde nicht verändert.',
    logCode: 'unexpected_result',
  };
}
