// Nutzerplätze (`limit.team_seats`) — serverseitig durchgesetzt.
//
// `shared/pricing.ts` bewirbt je Plan eine feste Zahl an Plätzen (Free und
// Starter 1, Growth 5, Agency 15 …), und `entitlements.limit.team_seats`
// trägt sie seit 20260430 mit dem Vermerk „checked at invitation time“. Bis
// 2026-10-16 prüfte `tenant-invite` sie nirgends: Jeder Plan konnte beliebig
// viele Mitglieder aufnehmen.
//
// Geprüft wird zweimal:
// - **Einladen:** belegte Plätze = Mitglieder + offene Einladungen (nicht
//   angenommen, nicht widerrufen, nicht abgelaufen). Sonst ließen sich
//   beliebig viele Einladungen ausstellen und danach alle annehmen.
// - **Annehmen:** belegte Plätze = Mitglieder. Das ist die eigentliche Grenze —
//   eine Einladung kann vor einem Downgrade ausgestellt worden sein.
//
// Fehlt der Schlüssel im Plan, wird abgelehnt (fail closed). Bestehende
// Mitglieder über der Grenze bleiben unberührt; nur neue kommen nicht hinzu.
//
// Deno-frei, damit Vitest denselben Code prüft, der in Produktion läuft.

export type SeatPhase = 'invite' | 'accept';

export interface SeatInput {
  phase: SeatPhase;
  /** Wert von `limit.team_seats`: -1 unbegrenzt, `undefined` = nicht im Plan. */
  limit: number | undefined;
  members: number;
  pendingInvites: number;
  /** Nur beim Annehmen: Der Nutzer ist schon Mitglied (Reload, Doppelklick). */
  alreadyMember?: boolean;
}

export type SeatDecision =
  | { ok: true }
  | { ok: false; code: 'SEATS_NOT_IN_PLAN' }
  | { ok: false; code: 'SEAT_LIMIT_REACHED'; limit: number; used: number };

export function decideSeat(input: SeatInput): SeatDecision {
  if (input.phase === 'accept' && input.alreadyMember) return { ok: true };
  const { limit } = input;
  if (limit === undefined || !Number.isFinite(limit)) return { ok: false, code: 'SEATS_NOT_IN_PLAN' };
  if (limit === -1) return { ok: true };

  const used = input.phase === 'invite'
    ? input.members + input.pendingInvites
    : input.members;
  if (used >= limit) return { ok: false, code: 'SEAT_LIMIT_REACHED', limit, used };
  return { ok: true };
}

export function seatDecisionMessage(decision: Exclude<SeatDecision, { ok: true }>, phase: SeatPhase): string {
  if (decision.code === 'SEATS_NOT_IN_PLAN') {
    return 'Dieser Plan enthält keine weiteren Nutzerplätze.';
  }
  if (phase === 'accept') {
    return `Der Arbeitsbereich hat alle Nutzerplätze belegt (${decision.used} von ${decision.limit}). Bitten Sie die einladende Person, einen Platz freizugeben oder den Plan zu wechseln.`;
  }
  return `Alle Nutzerplätze Ihres Plans sind belegt (${decision.used} von ${decision.limit}, offene Einladungen eingerechnet). Widerrufen Sie eine offene Einladung oder wechseln Sie den Plan.`;
}
