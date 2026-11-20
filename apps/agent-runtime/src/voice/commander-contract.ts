/**
 * Voice Commander — untrusted LLM proposal parser (M0, NO execution).
 *
 * Converts structured proposals into strictly bounded candidates. This module
 * never authenticates a caller, determines a tenant, grants an action, writes
 * a task, or executes a tool. The caller MUST derive identity, tenant, agent
 * catalogue, policy, confirmation and idempotency from trusted server state.
 */
export type CommanderIntent = 'read_inbox' | 'propose_task';

export type CommanderCandidate =
  | { intent: 'read_inbox' }
  | { intent: 'propose_task'; agent: string; instruction: string };

export type CommanderParseResult =
  | { ok: true; status: 'proposal_only'; candidate: CommanderCandidate }
  | {
      ok: false;
      status: 'rejected';
      reason:
        | 'invalid_payload'
        | 'invalid_intent'
        | 'unexpected_field'
        | 'invalid_agent'
        | 'agent_not_available'
        | 'invalid_instruction';
    };

function plainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function exactFields(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

/**
 * Parse one LLM-produced structured command; NEVER call this an authorization.
 *
 * Caller-supplied tenant IDs, role claims, approvals, tool grants, URLs and
 * execution flags are rejected as unknown fields rather than silently trusted.
 *
 * @param trustedAgentIds Canonical IDs resolved from authorized server state.
 */
export function parseVoiceCommanderProposal(
  value: unknown,
  trustedAgentIds: readonly string[],
): CommanderParseResult {
  if (!plainRecord(value)) {
    return { ok: false, status: 'rejected', reason: 'invalid_payload' };
  }
  if (value.intent !== 'read_inbox' && value.intent !== 'propose_task') {
    return { ok: false, status: 'rejected', reason: 'invalid_intent' };
  }
  if (value.intent === 'read_inbox') {
    if (!exactFields(value, ['intent'])) {
      return { ok: false, status: 'rejected', reason: 'unexpected_field' };
    }
    return { ok: true, status: 'proposal_only', candidate: { intent: 'read_inbox' } };
  }
  if (!exactFields(value, ['intent', 'agent', 'instruction'])) {
    return { ok: false, status: 'rejected', reason: 'unexpected_field' };
  }
  if (typeof value.agent !== 'string' || !/^[a-z][a-z0-9-]{1,63}$/.test(value.agent)) {
    return { ok: false, status: 'rejected', reason: 'invalid_agent' };
  }
  if (!trustedAgentIds.includes(value.agent)) {
    return { ok: false, status: 'rejected', reason: 'agent_not_available' };
  }
  if (
    typeof value.instruction !== 'string' ||
    !value.instruction.trim() ||
    value.instruction.length > 1200
  ) {
    return { ok: false, status: 'rejected', reason: 'invalid_instruction' };
  }
  return {
    ok: true,
    status: 'proposal_only',
    candidate: {
      intent: 'propose_task',
      agent: value.agent,
      instruction: value.instruction.trim(),
    },
  };
}
