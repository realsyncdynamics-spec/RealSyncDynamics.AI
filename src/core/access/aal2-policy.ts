// AAL2-Enforcement-Policy (P0c, ADR 0006) — REINE Logik, keine React/Supabase-
// Abhängigkeit, damit sie unit-testbar ist (analog `memberGuards.ts`).
//
// Grundsatz: Supabase-natives MFA (TOTP) wird für privilegierte Rollen in
// privilegierten Bereichen ERZWUNGEN (Hard-Enforce). Kein Eigenbau-MFA.
// Observe-only (`logAal2Intent`) wird durch echtes Blocken ersetzt — aber nur
// für privilegierte Bereiche, nicht global (kein Default-Deny für alles).

/** Rollen, die laut ADR 0006 MFA verpflichtend benötigen. `editor` und reine
 *  Viewer sind NICHT privilegiert. `viewer_auditor` ist der „Auditor" (darf
 *  Evidence exportieren → privilegiert). */
export const PRIVILEGED_ROLES = ['owner', 'admin', 'dpo', 'viewer_auditor'] as const;

export type Aal = 'aal1' | 'aal2' | null;

/**
 * Erfordert die aktuelle Rolle/der Tenant AAL2?
 * - Privilegierte Rolle → ja.
 * - Public-Sector-Tenant → ALLE Rollen (Behörden-Baseline, ADR 0009) —
 *   außer es gibt gar keine Rolle (kein Tenant-Kontext) → nein (kein Block).
 */
export function requiresAal2(role: string | null | undefined, isPublicSector: boolean): boolean {
  if (!role) return false;
  if (isPublicSector) return true;
  return (PRIVILEGED_ROLES as readonly string[]).includes(role);
}

export type Aal2Outcome =
  | 'allow'      // Zugriff erlaubt (kein Enforce nötig ODER bereits AAL2)
  | 'step-up'    // MFA vorhanden, Session nur AAL1 → Challenge bestätigen
  | 'enroll';    // kein Faktor → MFA erst einrichten

export interface Aal2DecisionInput {
  /** Liegt eine Session vor? Ohne Session greift der vorgelagerte Login-Gate. */
  hasSession: boolean;
  /** Erfordert Rolle/Tenant AAL2? (Ergebnis von `requiresAal2`) */
  required: boolean;
  /** Aktuelle Assurance-Stufe der Session. */
  currentLevel: Aal;
  /** Höchste erreichbare Stufe — `aal2`, wenn ein verifizierter Faktor existiert. */
  nextLevel: Aal;
}

/**
 * Entscheidet, was der Guard tun soll. Bewusst defensiv:
 * - Ohne Session: `allow` (der darunterliegende AuthGate zeigt Login — kein
 *   Verwechseln von „nicht eingeloggt" mit „MFA fehlt", keine Schleife).
 * - Kein Enforce nötig: `allow`.
 * - Bereits AAL2: `allow`.
 * - AAL1 + Faktor vorhanden (`nextLevel === 'aal2'`): `step-up`.
 * - AAL1 ohne Faktor: `enroll`.
 */
export function aal2Decision(input: Aal2DecisionInput): Aal2Outcome {
  const { hasSession, required, currentLevel, nextLevel } = input;
  if (!hasSession) return 'allow';
  if (!required) return 'allow';
  if (currentLevel === 'aal2') return 'allow';
  if (nextLevel === 'aal2') return 'step-up';
  return 'enroll';
}
