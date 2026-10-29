/**
 * Governance Tool Gateway (PR 4/6).
 *
 * Nach Policy-Entscheidung:
 *   DENY                    → keine Ausführung, Evidenz, denied an Modell
 *   REQUIRE_CONFIRMATION    → ohne Bestätigung keine Ausführung
 *   ALLOW / confirmed       → Executor → voice_executions → Evidenz-Hash-Kette
 *
 * Vor dem Executor: executionGuard (Abbruch/Kill-Switch, SEC-05). Fehlt er,
 * wird nicht ausgeführt. Schreibende Tools (VOICE_WRITE_TOOLS) sind gesperrt,
 * solange allowWriteTools nicht gesetzt ist.
 *
 * PolicyDecision.decidedBy ist immer 'policy-engine'.
 * evaluate() in policy-engine.ts bleibt unberührt.
 * Kein voice_channels / bot_agents.
 *
 * Ohne konfigurierten Store (kein injizierter Store, kein Supabase aus Env):
 * fail-closed failed/not_configured — kein Memory-Default in Produktion.
 */

import { isContractToolName, type VoiceToolResult } from '../voice-provider-types.js';
import {
  VOICE_AGENT_ID,
  type VoicePolicyDecision,
  type VoiceToolName,
  type VoiceVerdict,
} from '../voice-types.js';
import { sanitizeToolArgs } from './voice-tool-client.js';
import { VOICE_TOOL_EXECUTORS } from './tool-executors.js';
import { createSupabaseVoiceStoreFromEnv } from './supabase-voice-store.js';
import type { VoiceStore } from './voice-store.js';

export interface ToolGatewayInput {
  tenantId: string;
  botId: string;
  sessionId: string;
  callId: string;
  tool: string;
  args: Record<string, unknown>;
  /** Volle Policy-Entscheidung (decidedBy = policy-engine). */
  decision: VoicePolicyDecision;
  /** true nur nach expliziter Bestätigung (caller/staff). */
  confirmed?: boolean;
  confirmedBy?: 'caller' | 'staff';
  policyRef?: string;
  /** Zweite Prüfung unmittelbar vor dem Executor (SEC-05). Fehlt → keine Ausführung. */
  executionGuard?: VoiceExecutionGuard;
}

/**
 * Prüfung zwischen Policy-Entscheidung und Executor-Start (SEC-05).
 * recheck: asynchron (z. B. Kill-Switch frisch aus dem Store).
 * isLive: synchron, wird im selben Tick wie der Executor-Start ausgewertet.
 */
export interface VoiceExecutionGuard {
  recheck(): Promise<boolean>;
  isLive(): boolean;
}

/**
 * Tools mit echtem Schreibzugriff. Gesperrt, bis das Restrisiko aus SEC-05
 * geklärt ist: Ein Kill-Switch, den ein anderer Prozess nach dem Re-Read
 * setzt, kann die Ausführung nicht mehr atomar verhindern.
 */
export const VOICE_WRITE_TOOLS: ReadonlySet<VoiceToolName> = new Set<VoiceToolName>(['schedule_appointment']);

export interface VoiceToolGateway {
  handle(input: ToolGatewayInput): Promise<VoiceToolResult>;
}

export interface VoiceToolGatewayOptions {
  /**
   * Persistenz. Tests: createMemoryVoiceStore() explizit injizieren.
   * Produktion: weglassen → Supabase aus Env, sonst fail-closed not_configured.
   */
  store?: VoiceStore;
  /** Env für Supabase-Auflösung (Tests). Default: process.env. */
  env?: NodeJS.Dict<string | undefined>;
  /**
   * Nur Tests. Default false: VOICE_WRITE_TOOLS → denied write_tool_disabled.
   * Bewusst ohne Env-Schalter (SEC-05 Restrisiko).
   */
  allowWriteTools?: boolean;
}

export function createVoiceToolGateway(options: VoiceToolGatewayOptions = {}): VoiceToolGateway {
  const store =
    options.store ??
    createSupabaseVoiceStoreFromEnv({ env: options.env ?? process.env });

  if (!store) {
    return createNotConfiguredGateway();
  }

  return createConfiguredGateway(store, options.allowWriteTools === true);
}

/** Jedes Tool fail-closed — keine Ausführung, verified false. */
function createNotConfiguredGateway(): VoiceToolGateway {
  return {
    async handle(input: ToolGatewayInput): Promise<VoiceToolResult> {
      const callId = input.callId.trim() || 'unknown';
      return {
        callId,
        outcome: 'failed',
        verified: false,
        output: { reason: 'not_configured', tool: input.tool },
      };
    },
  };
}

function storeErrorResult(callId: string): VoiceToolResult {
  // Keine Fehlertexte/Secrets in output — nur stabiler Grund.
  return {
    callId: callId || 'unknown',
    outcome: 'failed',
    verified: false,
    output: { reason: 'store_error' },
  };
}

function createConfiguredGateway(store: VoiceStore, allowWriteTools: boolean): VoiceToolGateway {
  return {
    async handle(input: ToolGatewayInput): Promise<VoiceToolResult> {
      const callId = input.callId.trim();
      if (!callId) {
        return { callId: 'unknown', outcome: 'denied', verified: false, output: { reason: 'missing_call_id' } };
      }

      // Gesamter Store-/Executor-Pfad fail-closed: DB-Trigger/FK (fehlende
      // voice_sessions-Zeile, tenant mismatch, http_4xx) dürfen den Tool-Call
      // nicht hängen lassen — nie executed/verified:true nach Store-Fehler.
      try {
        if (!isContractToolName(input.tool)) {
          return { callId, outcome: 'denied', verified: false, output: { reason: 'unknown_tool' } };
        }
        const tool = input.tool;

        if (input.decision.decidedBy !== 'policy-engine') {
          return {
            callId,
            outcome: 'denied',
            verified: false,
            output: { reason: 'invalid_decided_by' },
          };
        }
        if (input.decision.tenantId !== input.tenantId || input.decision.sessionId !== input.sessionId) {
          return {
            callId,
            outcome: 'denied',
            verified: false,
            output: { reason: 'tenant_session_mismatch' },
          };
        }

        const clean = sanitizeToolArgs(input.args);
        if (clean === null) {
          return { callId, outcome: 'denied', verified: false, output: { reason: 'invalid_arguments' } };
        }

        const argumentKeys = Object.keys(clean).sort();
        const policyRef = input.policyRef ?? input.decision.trace[0]?.detail ?? 'voice.channel.v1';

        const request = await store.insertToolRequest({
          tenantId: input.tenantId,
          sessionId: input.sessionId,
          providerCallId: callId,
          tool,
          argumentKeys,
          args: clean,
          verdict: input.decision.verdict,
          reason: input.decision.reason,
          risk: input.decision.risk,
          policyRef,
          trace: input.decision.trace,
          decidedBy: 'policy-engine',
          decidedAt: input.decision.decidedAt,
          confirmedBy: null,
          confirmedAt: null,
        });

        await store.appendEvidence({
          tenantId: input.tenantId,
          sessionId: input.sessionId,
          kind: 'tool.request',
          toolRequestId: request.id,
          payload: { tool, argumentKeys, provider_call_id: callId },
        });
        await store.appendEvidence({
          tenantId: input.tenantId,
          sessionId: input.sessionId,
          kind: 'policy.decision',
          toolRequestId: request.id,
          payload: {
            verdict: input.decision.verdict,
            decided_by: 'policy-engine',
            decision_id: input.decision.decisionId,
            risk: input.decision.risk,
          },
        });

        if (input.decision.verdict === 'DENY') {
          return {
            callId,
            outcome: 'denied',
            verified: false,
            output: { verdict: 'DENY', reason: input.decision.reason },
          };
        }

        if (input.decision.verdict === 'REQUIRE_CONFIRMATION' && !input.confirmed) {
          return {
            callId,
            outcome: 'awaiting_confirmation',
            verified: false,
            output: { verdict: 'REQUIRE_CONFIRMATION' },
          };
        }

        let active = request;
        if (input.decision.verdict === 'REQUIRE_CONFIRMATION' && input.confirmed) {
          const confirmed = await store.confirmToolRequest(
            input.tenantId,
            request.id,
            input.confirmedBy ?? 'caller',
          );
          if (!confirmed) {
            return {
              callId,
              outcome: 'denied',
              verified: false,
              output: { reason: 'confirmation_failed' },
            };
          }
          active = confirmed;
          await store.appendEvidence({
            tenantId: input.tenantId,
            sessionId: input.sessionId,
            kind: 'confirmation.received',
            toolRequestId: active.id,
            payload: { confirmed_by: active.confirmedBy },
          });
        }

        if (VOICE_WRITE_TOOLS.has(tool) && !allowWriteTools) {
          await store.appendEvidence({
            tenantId: input.tenantId,
            sessionId: input.sessionId,
            kind: 'tool.result',
            toolRequestId: active.id,
            payload: { status: 'blocked', reason: 'write_tool_disabled' },
          });
          return {
            callId,
            outcome: 'denied',
            verified: false,
            output: { reason: 'write_tool_disabled', verdict: active.verdict },
          };
        }

        return await executeAndVerify({
          store,
          tenantId: input.tenantId,
          botId: input.botId,
          sessionId: input.sessionId,
          callId,
          tool,
          args: clean,
          toolRequestId: active.id,
          verdict: active.verdict,
          guard: input.executionGuard,
        });
      } catch {
        return storeErrorResult(callId);
      }
    },
  };
}

async function executeAndVerify(input: {
  store: VoiceStore;
  tenantId: string;
  botId: string;
  sessionId: string;
  callId: string;
  tool: VoiceToolName;
  args: Record<string, unknown>;
  toolRequestId: string;
  verdict: VoiceVerdict;
  guard: VoiceExecutionGuard | undefined;
}): Promise<VoiceToolResult> {
  const startedAt = new Date().toISOString();
  let execution;
  try {
    execution = await input.store.insertExecution({
      tenantId: input.tenantId,
      toolRequestId: input.toolRequestId,
      status: 'pending',
      externalRef: null,
      errorCode: null,
      verificationStatus: 'unverified',
      verifiedAt: null,
      startedAt,
      finishedAt: null,
    });
  } catch {
    return {
      callId: input.callId,
      outcome: 'denied',
      verified: false,
      output: { reason: 'execution_gate_rejected', verdict: input.verdict },
    };
  }

  // SEC-05: zweite Prüfung zwischen Entscheidung und Ausführung. Zwischen
  // isLive() und dem Executor-Start liegt kein Await — ein Abbruch in diesem
  // Prozess kann nicht mehr dazwischenkommen.
  let guardPassed = false;
  if (input.guard) {
    let rechecked = false;
    try {
      rechecked = await input.guard.recheck();
    } catch {
      rechecked = false;
    }
    guardPassed = rechecked && input.guard.isLive();
  }
  if (!guardPassed) {
    const reason = input.guard ? 'session_inactive' : 'execution_guard_missing';
    await input.store.updateExecution(input.tenantId, execution.id, {
      status: 'failed',
      errorCode: reason,
      verificationStatus: 'failed',
      finishedAt: new Date().toISOString(),
    });
    await input.store.appendEvidence({
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      kind: 'tool.result',
      toolRequestId: input.toolRequestId,
      payload: { status: 'blocked', reason },
    });
    return {
      callId: input.callId,
      outcome: 'denied',
      verified: false,
      output: { reason, verdict: input.verdict },
    };
  }

  const executor = VOICE_TOOL_EXECUTORS[input.tool];
  const result = await executor({
    tenantId: input.tenantId,
    botId: input.botId,
    sessionId: input.sessionId,
    toolRequestId: input.toolRequestId,
    args: input.args,
    store: input.store,
  });

  const finishedAt = new Date().toISOString();

  if (!result.ok) {
    await input.store.updateExecution(input.tenantId, execution.id, {
      status: 'failed',
      errorCode: result.errorCode,
      verificationStatus: 'failed',
      finishedAt,
    });
    await input.store.appendEvidence({
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      kind: 'tool.result',
      toolRequestId: input.toolRequestId,
      payload: { status: 'failed', error_code: result.errorCode, agent_id: VOICE_AGENT_ID },
    });
    await input.store.appendEvidence({
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      kind: 'verification.result',
      toolRequestId: input.toolRequestId,
      payload: { verification_status: 'failed' },
    });
    return {
      callId: input.callId,
      outcome: 'failed',
      verified: false,
      output: { ...result.output, verdict: input.verdict },
    };
  }

  // Verifikation: Re-Read des geschriebenen Datensatzes per id + tenant_id.
  // external_ref muss die persistierte Appointment-ID sein — nie nur Insert-Echo.
  const verifiedRow = await input.store.getAppointment(input.tenantId, result.externalRef);
  if (!verifiedRow || verifiedRow.id !== result.externalRef || verifiedRow.tenantId !== input.tenantId) {
    await input.store.updateExecution(input.tenantId, execution.id, {
      status: 'failed',
      externalRef: result.externalRef,
      errorCode: 'verification_mismatch',
      verificationStatus: 'mismatch',
      finishedAt,
    });
    await input.store.appendEvidence({
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      kind: 'tool.result',
      toolRequestId: input.toolRequestId,
      payload: { status: 'failed', error_code: 'verification_mismatch', external_ref: result.externalRef },
    });
    await input.store.appendEvidence({
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      kind: 'verification.result',
      toolRequestId: input.toolRequestId,
      payload: { verification_status: 'mismatch', external_ref: result.externalRef },
    });
    return {
      callId: input.callId,
      outcome: 'failed',
      verified: false,
      output: {
        reason: 'verification_mismatch',
        appointmentId: result.externalRef,
        verdict: input.verdict,
      },
    };
  }

  const verifiedAt = new Date().toISOString();
  await input.store.updateExecution(input.tenantId, execution.id, {
    status: 'succeeded',
    externalRef: result.externalRef,
    errorCode: null,
    verificationStatus: 'confirmed',
    verifiedAt,
    finishedAt,
  });
  await input.store.appendEvidence({
    tenantId: input.tenantId,
    sessionId: input.sessionId,
    kind: 'tool.result',
    toolRequestId: input.toolRequestId,
    payload: { status: 'succeeded', external_ref: result.externalRef },
  });
  await input.store.appendEvidence({
    tenantId: input.tenantId,
    sessionId: input.sessionId,
    kind: 'verification.result',
    toolRequestId: input.toolRequestId,
    payload: { verification_status: 'confirmed', external_ref: result.externalRef },
  });

  return {
    callId: input.callId,
    outcome: 'executed',
    verified: true,
    output: { ...result.output, verdict: input.verdict },
  };
}

export { createMemoryVoiceStore } from './voice-store.js';
export {
  createSupabaseVoiceStore,
  createSupabaseVoiceStoreFromEnv,
  createPostgrestVoiceDbClient,
} from './supabase-voice-store.js';
export { VOICE_GENESIS_HASH, computeEvidenceHash, appendEvidenceLink } from './evidence-hash.js';
export { VOICE_TOOL_EXECUTORS } from './tool-executors.js';
