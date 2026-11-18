// MP-A: Policy-Prüfung und Evidence-Kette für den Shell-Assistenten
// (`governance-agent`, op `chat`, Tenant-Modus).
//
// Der Assistent ruft Anthropic weiterhin direkt auf (Tool-Use, das der
// ai-gateway noch nicht kann). Dieser Modul legt um die Tool-Schleife
// dieselbe Durchsetzung wie MP-0 im ai-gateway:
//
//   1. PDP über `guardedDecide` (fail-closed bei Fehler/Timeout/unklar).
//      Block/require_approval → `ai:call_blocked`, kein Provider-Aufruf.
//   2. `ai:call_started` VOR dem ersten Provider-Aufruf. Schlägt das fehl
//      → 503 EVIDENCE_UNAVAILABLE, kein Provider-Aufruf.
//   3. Nach der Schleife `ai:call` bzw. `ai:call_failed`. Schlägt das fehl
//      → 503 EVIDENCE_WRITE_FAILED; der Aufrufer liefert dann KEINEN
//      Antworttext aus (strenger als der Gateway, siehe Auftrag MP-A).
//
// Evidence enthält nie Prompt, Antwort oder Tool-Ausgaben, nur Hash und
// Länge der Nutzernachricht (`input` wird in buildAiCallEvidenceRow gehasht).
//
// Reine Logik ohne Deno-Imports, vitest-importierbar.

import {
  buildAiCallEvidenceRow,
  type AiEvidenceEventInsert,
} from './aiGateway/callEvidence.ts';
import type { AiGatewayUsage } from './aiGateway/types.ts';
import {
  guardedDecide,
  primaryPolicySource,
  type EnforcementMode,
  type GuardedDecision,
} from './aiGateway/pdpGuard.ts';

export const AGENT_CHAT_FEATURE = 'governance_agent_chat';
export const AGENT_CHAT_ROUTE = 'governance-agent';
/** `agent_runs.user_message` speichert dieselbe Kürzung; der REA hasht sie. */
export const AGENT_INPUT_LIMIT = 4000;

export interface AgentLoopResult {
  /** Erfolg im Sinne von agent_runs.outcome === 'success'. */
  ok: boolean;
  errorCode?: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface GovernedTurnDeps<D extends GuardedDecision> {
  mode: EnforcementMode;
  timeoutMs?: number;
  decide: () => Promise<D>;
  recordEvidence: (row: AiEvidenceEventInsert) => Promise<void>;
  now?: () => number;
  newId?: () => string;
  log?: (line: Record<string, unknown>) => void;
}

export interface GovernedTurnContext {
  tenantId: string;
  userId: string;
  /** Nutzernachricht, bereits getrimmt. Wird gekürzt gehasht. */
  message: string;
  provider: string;
  model: string;
  providerRegion?: string;
}

export type GovernedTurnResult<R extends AgentLoopResult> =
  | { kind: 'denied'; status: number; code: string; message: string; requestId: string }
  | { kind: 'evidence_unavailable'; status: 503; code: 'EVIDENCE_UNAVAILABLE'; message: string; requestId: string }
  | { kind: 'evidence_write_failed'; status: 503; code: 'EVIDENCE_WRITE_FAILED'; message: string; requestId: string; loop: R }
  | { kind: 'ran'; requestId: string; loop: R };

export function agentEvidenceInput(message: string): string {
  return message.slice(0, AGENT_INPUT_LIMIT);
}

export async function runGovernedAgentTurn<D extends GuardedDecision, R extends AgentLoopResult>(
  deps: GovernedTurnDeps<D>,
  ctx: GovernedTurnContext,
  runLoop: (requestId: string) => Promise<R>,
): Promise<GovernedTurnResult<R>> {
  const now = deps.now ?? (() => Date.now());
  const requestId = (deps.newId ?? (() => crypto.randomUUID()))();
  const log = deps.log ?? ((l) => console.error(JSON.stringify(l)));
  const input = agentEvidenceInput(ctx.message);
  const startedAt = now();

  const row = (extra: {
    stage: 'started' | 'completed' | 'failed' | 'blocked';
    verdict?: string | null;
    reasons?: string[];
    policyId?: string | null;
    policySource?: string | null;
    errorCode?: string | null;
    model?: string;
    usage?: AiGatewayUsage | null;
  }) =>
    buildAiCallEvidenceRow({
      tenantId: ctx.tenantId,
      stage: extra.stage,
      path: 'user',
      userId: ctx.userId,
      feature: AGENT_CHAT_FEATURE,
      route: AGENT_CHAT_ROUTE,
      op: 'chat',
      provider: ctx.provider,
      model: extra.model ?? ctx.model,
      modelProfile: ctx.model,
      providerRegion: ctx.providerRegion,
      verdict: extra.verdict ?? null,
      blocked: extra.stage === 'blocked',
      reasons: extra.reasons ?? [],
      policyId: extra.policyId ?? null,
      policySource: extra.policySource ?? null,
      errorCode: extra.errorCode ?? null,
      usage: extra.usage ?? null,
      requestId,
      latencyMs: Math.max(0, now() - startedAt),
      input,
    });

  // 1. Policy — fail-closed.
  const guarded = await guardedDecide<D>({
    mode: deps.mode,
    decide: deps.decide,
    timeoutMs: deps.timeoutMs,
    log,
    scope: 'governance-agent-pep',
  });
  let verdict: D | null = null;
  if (guarded.kind === 'deny') {
    if (guarded.cause === 'blocked') {
      // Block-Eintrag ist Nachweis, kein Gate: Fehler hier wird geloggt,
      // die Ablehnung gilt so oder so.
      try {
        await deps.recordEvidence(await row({
          stage: 'blocked',
          verdict: guarded.code === 'APPROVAL_REQUIRED' ? 'require_approval' : 'block',
          reasons: [guarded.code],
          policyId: guarded.result?.primary_policy_id ?? null,
          policySource: primaryPolicySource(guarded.result),
        }));
      } catch (e) {
        log({ scope: 'governance-agent-evidence', event: 'blocked_record_failed', severity: 'critical', alert: true, request_id: requestId, error: String((e as Error)?.message ?? e).slice(0, 200) });
      }
    }
    return { kind: 'denied', status: guarded.status, code: guarded.code, message: guarded.message, requestId };
  }
  if (guarded.kind === 'ok') verdict = guarded.result;

  const policyId = verdict?.primary_policy_id ?? null;
  const policySource = primaryPolicySource(verdict);
  const reasons = verdict?.reasons?.map((r) => r.text_de) ?? [];
  const decision = verdict?.decision ?? 'allow';

  // 2. Reservierung VOR dem Provider — fail-closed.
  try {
    await deps.recordEvidence(await row({ stage: 'started', verdict: decision, reasons, policyId, policySource }));
  } catch (e) {
    log({ scope: 'governance-agent-evidence', event: 'reserve_failed', severity: 'critical', request_id: requestId, error: String((e as Error)?.message ?? e).slice(0, 200) });
    return {
      kind: 'evidence_unavailable',
      status: 503,
      code: 'EVIDENCE_UNAVAILABLE',
      message: 'Anfrage abgelehnt: Der Prüfpfad (Evidence) ist nicht verfügbar.',
      requestId,
    };
  }

  // 3. Tool-Schleife (Provider-Aufrufe).
  const loop = await runLoop(requestId);

  // 4. Abschluss — Fehler hier → keine Antwort an den Nutzer.
  try {
    await deps.recordEvidence(await row({
      stage: loop.ok ? 'completed' : 'failed',
      verdict: decision,
      reasons,
      policyId,
      policySource,
      errorCode: loop.ok ? null : (loop.errorCode ?? 'agent_error'),
      model: loop.model,
      usage: {
        input_tokens: loop.inputTokens,
        output_tokens: loop.outputTokens,
        total_tokens: loop.inputTokens + loop.outputTokens,
      } as AiGatewayUsage,
    }));
  } catch (e) {
    log({ scope: 'governance-agent-evidence', event: 'complete_failed', severity: 'critical', alert: true, request_id: requestId, error: String((e as Error)?.message ?? e).slice(0, 200) });
    return {
      kind: 'evidence_write_failed',
      status: 503,
      code: 'EVIDENCE_WRITE_FAILED',
      message: 'Die Antwort wurde nicht ausgeliefert: Der Prüfpfad (Evidence) konnte nicht abgeschlossen werden.',
      requestId,
      loop,
    };
  }
  return { kind: 'ran', requestId, loop };
}
