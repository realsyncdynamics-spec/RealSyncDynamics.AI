/**
 * Guard-Stapel: Auth, dann Mandant, dann Rolle/Plan.
 *
 * Die Reihenfolge ist Vertrag. Eine frühere Sprosse, die fehlschlägt,
 * beendet die Prüfung. Demo-Modus und Umgebungsvariablen sind keine
 * Eingabe: eine Vorschau kann die Sitzung nicht ersetzen.
 *
 * Auf den bestehenden /app-Seiten bleibt `AppGate` der laufende Auth-Guard
 * (nur Sitzung). Der Stapel hängt an der neuen Hülle und wird dort
 * durchgesetzt, wo eine Route ihn deklariert. Ihn auf jede bestehende
 * Seite zu legen würde Mandanten ohne Datensatz aussperren — das ist
 * heute ausdrücklich nicht das Verhalten von `AppGate`.
 */
import type { TenantRole } from '../core/billing/types';
import type { PlanKey } from '@/shared/pricing';

export type GuardStep = 'auth' | 'tenant' | 'role';

export interface RouteGuard {
  /** Ausgewertet in dieser Reihenfolge. */
  steps: readonly GuardStep[];
  roles?: readonly TenantRole[];
  plans?: readonly PlanKey[];
}

export const GUARD_NONE: RouteGuard = { steps: [] };
export const GUARD_AUTH: RouteGuard = { steps: ['auth'] };
/** Eigentümer oder Admin, nachdem Sitzung und Mandant stehen. */
export const GUARD_ROLE_ADMIN: RouteGuard = {
  steps: ['auth', 'tenant', 'role'],
  roles: ['owner', 'admin'],
};

export interface GuardContext {
  authenticated: boolean;
  tenantId: string | null;
  role: TenantRole | null;
  plan: PlanKey | null;
}

export type GuardFailure = 'auth' | 'tenant' | 'role' | 'plan';

export type GuardDecision =
  | { ok: true }
  | { ok: false; failure: GuardFailure };

export function evaluateGuard(guard: RouteGuard, ctx: GuardContext): GuardDecision {
  for (const step of guard.steps) {
    if (step === 'auth' && !ctx.authenticated) {
      return { ok: false, failure: 'auth' };
    }
    if (step === 'tenant' && !ctx.tenantId) {
      return { ok: false, failure: 'tenant' };
    }
    if (step === 'role') {
      if (guard.roles && guard.roles.length > 0) {
        if (!ctx.role || !guard.roles.includes(ctx.role)) {
          return { ok: false, failure: 'role' };
        }
      }
      if (guard.plans && guard.plans.length > 0) {
        if (!ctx.plan || !guard.plans.includes(ctx.plan)) {
          return { ok: false, failure: 'plan' };
        }
      }
    }
  }
  return { ok: true };
}
