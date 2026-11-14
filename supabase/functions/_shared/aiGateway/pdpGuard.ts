// MP-0: Fail-closed PEP-Hülle um den PDP für ai-gateway und governance-router.
//
// Vorher (ai-gateway/index.ts pdpCheck, governance-router pdpCheck): ein
// PDP-Fehler liess den Aufruf durch („fail open“). Jetzt gilt in JEDEM Modus
// außer `off`:
//   Fehler / Ausnahme            → deny 503 POLICY_UNAVAILABLE
//   Timeout                      → deny 503 POLICY_TIMEOUT
//   unbekannte Entscheidung      → deny 503 POLICY_UNCLEAR
// Durchgesetzt werden block / require_approval weiterhin nur im Modus
// `enforce` (Rollout-Regel R5: Enforcement nie still einschalten). Der
// Default-Modus bleibt `shadow`. Fail-closed betrifft also die Verfügbarkeit
// der Prüfung, nicht die Durchsetzung einzelner Policy-Treffer.
//
// `off` ist eine bewusste Betreiber-Einstellung (Env) und bleibt „keine
// Prüfung“ — das ist kein Fehlerfall.
//
// Reine Logik, vitest-importierbar.

export type EnforcementMode = 'off' | 'shadow' | 'enforce';

export const KNOWN_DECISIONS = new Set(['allow', 'warn', 'block', 'require_approval', 'log_only']);

export const DEFAULT_PDP_TIMEOUT_MS = 2_000;

export interface GuardedDecisionReason {
  text_de: string;
  policy_id?: string;
  policy_source?: string;
  /** `null` = globale Regel; siehe DecisionReason in _shared/pdp/core.ts. */
  policy_tenant_id?: string | null;
  /** Regel nennt das Aktionsverb ausdruecklich (`verbs` in der Condition). */
  verb_scoped?: boolean;
}

export interface GuardedDecision {
  decision: string;
  reasons: Array<GuardedDecisionReason>;
  matched_policy_ids?: string[];
  primary_policy_id?: string | null;
  snapshot_version?: string;
}

export type PdpGuardResult<D extends GuardedDecision> =
  | { kind: 'off' }
  | { kind: 'ok'; mode: 'shadow' | 'enforce'; result: D }
  | { kind: 'deny'; status: number; code: string; message: string; result: D | null; cause: 'blocked' | 'unavailable' };

export function parseEnforcementMode(raw: string | undefined | null): EnforcementMode {
  const v = (raw ?? 'shadow').trim().toLowerCase();
  return v === 'off' || v === 'enforce' ? v : 'shadow';
}

export function parsePdpTimeoutMs(raw: string | undefined | null): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 10_000) : DEFAULT_PDP_TIMEOUT_MS;
}

class PdpTimeoutError extends Error {
  constructor() { super('pdp timeout'); this.name = 'PdpTimeoutError'; }
}

export async function guardedDecide<D extends GuardedDecision>(args: {
  mode: EnforcementMode;
  decide: () => Promise<D>;
  timeoutMs?: number;
  log?: (line: Record<string, unknown>) => void;
  scope?: string;
}): Promise<PdpGuardResult<D>> {
  if (args.mode === 'off') return { kind: 'off' };
  const log = args.log ?? ((l) => console.error(JSON.stringify(l)));
  const scope = args.scope ?? 'pep';
  const timeoutMs = args.timeoutMs ?? DEFAULT_PDP_TIMEOUT_MS;

  let timer: ReturnType<typeof setTimeout> | undefined;
  let result: D;
  try {
    result = await Promise.race([
      args.decide(),
      new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new PdpTimeoutError()), timeoutMs); }),
    ]);
  } catch (e) {
    const timeout = e instanceof PdpTimeoutError;
    log({ scope, event: timeout ? 'pdp_timeout' : 'pdp_unavailable', mode: args.mode, fail: 'closed', error: String((e as Error)?.message ?? e).slice(0, 200) });
    return {
      kind: 'deny',
      status: 503,
      code: timeout ? 'POLICY_TIMEOUT' : 'POLICY_UNAVAILABLE',
      message: timeout
        ? 'Anfrage abgelehnt: Die Richtlinienprüfung hat nicht rechtzeitig geantwortet.'
        : 'Anfrage abgelehnt: Die Richtlinienprüfung ist nicht verfügbar.',
      result: null,
      cause: 'unavailable',
    };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }

  if (!result || typeof result.decision !== 'string' || !KNOWN_DECISIONS.has(result.decision)) {
    log({ scope, event: 'pdp_unclear', mode: args.mode, fail: 'closed', decision: String(result?.decision ?? null).slice(0, 40) });
    return {
      kind: 'deny',
      status: 503,
      code: 'POLICY_UNCLEAR',
      message: 'Anfrage abgelehnt: Die Richtlinienprüfung lieferte keine eindeutige Entscheidung.',
      result: null,
      cause: 'unavailable',
    };
  }

  if (args.mode === 'enforce' && result.decision === 'block') {
    return {
      kind: 'deny', status: 403, code: 'POLICY_BLOCKED',
      message: result.reasons?.[0]?.text_de ?? 'Diese Aktion ist durch eine Unternehmensrichtlinie blockiert.',
      result, cause: 'blocked',
    };
  }
  if (args.mode === 'enforce' && result.decision === 'require_approval') {
    return {
      kind: 'deny', status: 403, code: 'APPROVAL_REQUIRED',
      message: result.reasons?.[0]?.text_de ?? 'Diese Aktion erfordert eine Freigabe gemäß Unternehmensrichtlinie.',
      result, cause: 'blocked',
    };
  }
  return { kind: 'ok', mode: args.mode, result };
}

/**
 * Erlaubt eine Tenant-Policy einen Provider-Wechsel ausdrücklich?
 *
 * Reicht NICHT: ein beliebiger Treffer mit `allow`. Eine gewöhnliche
 * `model_usage`-Freigabe für einen Anbieter matchte sonst die
 * `provider_fallback`-Abfrage und schaltete damit einen automatischen
 * Wechsel des Datenempfängers frei, ohne dass der Mandant dem je
 * zugestimmt hätte (Codex P1 governance-router:215).
 *
 * Verlangt werden daher beide Eigenschaften der gewinnenden Allow-Regel:
 *   (a) mandantenspezifisch — `policy_tenant_id` gleich dem Mandanten des
 *       Principals; eine globale Regel (`null`) genügt nicht;
 *   (b) ausdrücklich verbgebunden — `verb_scoped`, die Regel nennt das
 *       Verb `provider_fallback` in ihrer Condition.
 *
 * Alles andere bedeutet: kein Fallback (fail-closed). Ohne Mandanten
 * (`tenantId` null/leer) gibt es keine Mandanten-Zustimmung und damit nie
 * eine Freigabe.
 */
export function fallbackExplicitlyAllowed(
  result: GuardedDecision | null | undefined,
  tenantId: string | null | undefined,
): boolean {
  if (!result || result.decision !== 'allow') return false;
  if (!tenantId) return false;
  const primaryId = result.primary_policy_id ?? null;
  if (!primaryId) return false;
  const primary = (result.reasons ?? []).find((r) => r.policy_id === primaryId);
  if (!primary) return false;
  if (primary.verb_scoped !== true) return false;
  return primary.policy_tenant_id === tenantId;
}

/**
 * @deprecated Zu schwach für Fallback-Entscheidungen — prüft nur, DASS eine
 * Regel traf, nicht WELCHE. Für Provider-Wechsel `fallbackExplicitlyAllowed`
 * verwenden.
 */
export function explicitlyAllowed(result: GuardedDecision | null | undefined): boolean {
  if (!result || result.decision !== 'allow') return false;
  return Boolean(result.primary_policy_id) || (result.matched_policy_ids?.length ?? 0) > 0;
}
