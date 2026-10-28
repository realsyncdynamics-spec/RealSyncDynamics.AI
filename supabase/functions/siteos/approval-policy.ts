// SiteOS — Rollen und Vier-Augen-Regel (Baustein A, G2).
//
// Reine Funktionen ohne Importe: läuft in Deno (Edge Function) und in
// Vitest. Dieselben Regeln erzwingt die Datenbank zusätzlich per Trigger
// (Migration 20261025100000_siteos_four_eyes_approval.sql). Die Edge
// Function prüft zuerst, damit der Aufrufer eine verständliche Antwort
// bekommt; der Trigger hält auch dann, wenn ein Schreibpfad mit
// `service_role` die Funktion umgeht.
//
// Festlegungen (Dominik, 25.10.2026):
//   - Bearbeiten: owner, admin, editor. `dpo` prüft, bearbeitet nicht.
//   - Freigeben: owner, admin, dpo — aber nie der Autor der bewerteten
//     Version bzw. der Auslöser des Agentenlaufs.
//   - Ausnahme: Ist die freigebende Person das EINZIGE freigabeberechtigte
//     Mitglied des Mandanten, ist eine dokumentierte Selbstfreigabe
//     zulässig (Begründung ≥ SELF_APPROVAL_MIN_REASON Zeichen, im
//     Prüfpfad als `self_approval` markiert).
//   - Autor unbekannt (NULL) ⇒ keine Freigabe (fail-closed, G3).

/** Rollen, die eine Site bauen oder bearbeiten dürfen (neue Version). */
export const SITE_EDITOR_ROLES: ReadonlySet<string> = new Set(['owner', 'admin', 'editor']);

/** Rollen, die eine Veröffentlichung oder einen Agentenlauf freigeben dürfen. */
export const SITE_APPROVER_ROLES: ReadonlySet<string> = new Set(['owner', 'admin', 'dpo']);

/** Mindestlänge der Begründung einer dokumentierten Selbstfreigabe. */
export const SELF_APPROVAL_MIN_REASON = 30;

export function canEditSite(role: string | null | undefined): boolean {
  return typeof role === 'string' && SITE_EDITOR_ROLES.has(role);
}

export interface ApprovalCheckInput {
  /** Wer freigeben will (aus dem JWT, nie aus dem Body). */
  approverId: string;
  /** Rolle der freigebenden Person in diesem Mandanten. */
  approverRole: string;
  /** Autor der Version bzw. Auslöser des Laufs; `null` = unbekannt. */
  authorId: string | null;
  /** Anzahl Mitglieder mit einer Rolle aus SITE_APPROVER_ROLES im Mandanten. */
  eligibleApproverCount: number;
  /** Begründung der Freigabe (bereits getrimmt), leer wenn keine. */
  reason: string;
}

export type ApprovalCheck =
  | { allowed: true; selfApproval: boolean }
  | { allowed: false; status: 403 | 409; code: 'FORBIDDEN' | 'FOUR_EYES' | 'AUTHOR_UNKNOWN'; message: string };

/**
 * Entscheidet, ob diese Person freigeben darf. Gleiche Eingabe ⇒ gleiches
 * Ergebnis; keine Seiteneffekte.
 */
export function checkApproval(input: ApprovalCheckInput): ApprovalCheck {
  if (!SITE_APPROVER_ROLES.has(input.approverRole)) {
    return {
      allowed: false, status: 403, code: 'FORBIDDEN',
      message: `role "${input.approverRole}" may not approve`,
    };
  }

  if (input.authorId === null) {
    return {
      allowed: false, status: 409, code: 'AUTHOR_UNKNOWN',
      message: 'author of this version is unknown — save a new version or re-trigger the run, then approve that',
    };
  }

  if (input.authorId !== input.approverId) {
    return { allowed: true, selfApproval: false };
  }

  // Ab hier: Autor will selbst freigeben.
  if (input.eligibleApproverCount !== 1) {
    return {
      allowed: false, status: 403, code: 'FOUR_EYES',
      message: 'four-eyes rule: the author may not approve their own version — another owner, admin or dpo must approve',
    };
  }
  if (input.reason.length < SELF_APPROVAL_MIN_REASON) {
    return {
      allowed: false, status: 403, code: 'FOUR_EYES',
      message: `self-approval is only allowed as the sole approver and needs a documented reason of at least ${SELF_APPROVAL_MIN_REASON} characters`,
    };
  }
  return { allowed: true, selfApproval: true };
}
