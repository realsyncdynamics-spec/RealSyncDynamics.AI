/**
 * Governance Tool Gateway (PR 4/6).
 *
 * Nach Policy-Entscheidung:
 *   DENY                    → keine Ausführung, Evidenz, denied an Modell
 *   REQUIRE_CONFIRMATION    → ohne Bestätigung keine Ausführung
 *   ALLOW / confirmed       → Executor → voice_executions → Evidenz-Hash-Kette
 *
 * PolicyDecision.decidedBy ist immer 'policy-engine'.
 * evaluate() in policy-engine.ts bleibt unberührt.
 * Kein voice_channels / bot_agents.
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
import { createMemoryVoiceStore, type VoiceStore } from './voice-store.js';

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
}

export interface VoiceToolGateway {
  handle(input: ToolGatewayInput): Promise<VoiceToolResult>;
}

export interface VoiceToolGatewayOptions {
  store?: VoiceStore;
}

export function createVoiceToolGateway(options: VoiceToolGatewayOptions = {}): VoiceToolGateway {
  const store = options.store ?? createMemoryVoiceStore();

  return {
    async handle(input: ToolGatewayInput): Promise<VoiceToolResult> {
      const callId = input.callId.trim();
      if (!callId) {
        return { callId: 'unknown', outcome: 'denied', verified: false, output: { reason: 'missing_call_id' } };
      }

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

      return executeAndVerify({
        store,
        tenantId: input.tenantId,
        botId: input.botId,
        sessionId: input.sessionId,
        callId,
        tool,
        args: clean,
        toolRequestId: active.id,
        verdict: active.verdict,
      });
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
export { VOICE_GENESIS_HASH, computeEvidenceHash, appendEvidenceLink } from './evidence-hash.js';
export { VOICE_TOOL_EXECUTORS } from './tool-executors.js';
