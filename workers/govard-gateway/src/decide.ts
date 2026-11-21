import { GovardError, type PolicyEvaluation } from "./types";

const MAX_PAYLOAD_BYTES = 64 * 1024;
const SOURCE_PATTERN = /^[a-z0-9_-]{1,32}$/;
const INTENT_PATTERN = /^[a-z0-9_.:-]{1,200}$/i;

export interface DecideBody {
  intent: string;
  source: string;
  payload: Record<string, unknown>;
  claimedActor: string | null;
}

export interface DecideOutcome {
  decision: PolicyEvaluation["decision"];
  browser_may_proceed: boolean;
  executes: false;
  reason: string | null;
}

/**
 * Decision-only. Der Browser darf nur bei ALLOW weiter. APPROVAL startet
 * hier keine Freigabe und keine Ausführung. Ein Akteur aus dem Body, der
 * nicht zum API-Key passt, ist DENY — der verifizierte Akteur bleibt der Key.
 */
export function decideOutcome(
  engineDecision: PolicyEvaluation["decision"],
  claimedActor: string | null,
  principalActorId: string,
): DecideOutcome {
  if (claimedActor !== null && claimedActor !== principalActorId) {
    return {
      decision: "DENY",
      browser_may_proceed: false,
      executes: false,
      reason: "ACTOR_MISMATCH",
    };
  }
  return {
    decision: engineDecision,
    browser_may_proceed: engineDecision === "ALLOW",
    executes: false,
    reason: null,
  };
}

export function parseDecideBody(raw: unknown): DecideBody {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new GovardError("INVALID_BODY", "Body muss ein JSON-Objekt sein");
  }
  const body = raw as Record<string, unknown>;
  const intent = body.intent;
  if (typeof intent !== "string" || !INTENT_PATTERN.test(intent)) {
    throw new GovardError("INVALID_INTENT", "intent fehlt oder hat ein ungültiges Format");
  }
  const source = body.source ?? "extension";
  if (typeof source !== "string" || !SOURCE_PATTERN.test(source)) {
    throw new GovardError("INVALID_SOURCE", "source muss [a-z0-9_-]{1,32} entsprechen");
  }
  const payload = body.payload ?? {};
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new GovardError("INVALID_PAYLOAD", "payload muss ein JSON-Objekt sein");
  }
  if (JSON.stringify(payload).length > MAX_PAYLOAD_BYTES) {
    throw new GovardError("PAYLOAD_TOO_LARGE", "payload überschreitet 64 KiB", 413);
  }
  let claimedActor: string | null = null;
  if (body.actor !== undefined && body.actor !== null) {
    if (typeof body.actor !== "string" || body.actor.length === 0 || body.actor.length > 128) {
      throw new GovardError("INVALID_ACTOR", "actor muss ein String sein");
    }
    claimedActor = body.actor;
  }
  return { intent, source, payload: payload as Record<string, unknown>, claimedActor };
}

export interface DecideResponse {
  action_id: string;
  decision: PolicyEvaluation["decision"];
  browser_may_proceed: boolean;
  executes: false;
  reason: string | null;
  evaluation: {
    evaluation_hash: string;
    policy_set_size: number;
    engine_decision: PolicyEvaluation["decision"];
  };
}

export async function runDecide(opts: {
  reserved: boolean;
  actionId: string;
  claimedActor: string | null;
  principalActorId: string;
  replay: () => Promise<unknown>;
  evaluate: () => Promise<PolicyEvaluation>;
  append: (payload: DecideResponse & { actor_id: string; claimed_actor: string | null }) => Promise<void>;
  finalize: (response: DecideResponse) => Promise<void>;
}): Promise<{ status: number; body: unknown }> {
  if (!opts.reserved) {
    return { status: 200, body: await opts.replay() };
  }

  const evaluation = await opts.evaluate();
  const outcome = decideOutcome(evaluation.decision, opts.claimedActor, opts.principalActorId);
  const body: DecideResponse = {
    action_id: opts.actionId,
    decision: outcome.decision,
    browser_may_proceed: outcome.browser_may_proceed,
    executes: false,
    reason: outcome.reason,
    evaluation: {
      evaluation_hash: evaluation.evaluation_hash,
      policy_set_size: evaluation.policy_set_size,
      engine_decision: evaluation.decision,
    },
  };

  await opts.append({
    ...body,
    actor_id: opts.principalActorId,
    claimed_actor: opts.claimedActor,
  });
  await opts.finalize(body);
  return { status: 201, body };
}
