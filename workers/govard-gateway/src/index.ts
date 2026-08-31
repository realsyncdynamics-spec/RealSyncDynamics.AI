/// <reference path="./cf.d.ts" />
/**
 * GOVARD Gateway — Governance-/Evidence-Schicht vor austauschbaren Agenten.
 *
 * Der HTTP-Pfad macht ausschließlich:
 *   authenticate → validate → idempotency → policy evaluation → create
 *   command → return commandId
 * Ausführung passiert nie im Request: ALLOW und die erteilte Freigabe
 * starten eine Workflow-Instanz (siehe executor.ts), die den Neustart des
 * Workers überlebt. DENY und APPROVAL enden im jeweiligen Zustand.
 *
 * Die Frage, die dieses Gateway beantwortet, ist nicht „was kann der
 * Agent?", sondern: Darf diese KI-Aktion stattfinden — und lässt sich sechs
 * Monate später beweisen, was entschieden, ausgeführt und warum es erlaubt
 * oder blockiert wurde?
 */
import type { Env } from "./env";
import { authenticate, requireRole } from "./auth";
import { OrgRepository } from "./db/repository";
import { evaluatePolicies } from "./policy/engine";
import { evidenceFor, EvidenceSequencer } from "./evidence/sequencer";
import { CommandWorkflow } from "./workflows/command-workflow";
import { startCommandExecution } from "./executor";
import { hashObject } from "./lib/hash";
import { GovardError, type PolicyAction, type PolicyRule, type Principal } from "./types";

export { EvidenceSequencer, CommandWorkflow };

const MAX_PAYLOAD_BYTES = 64 * 1024;
const SOURCE_PATTERN = /^[a-z0-9_-]{1,32}$/;
const INTENT_PATTERN = /^[a-z0-9_.:-]{1,200}$/i;

// ---------------------------------------------------------------
// Eingabevalidierung an der Vertrauensgrenze — von Hand, siehe §4
// CLAUDE.md: zod ist keine Dependency und wird hier nicht eingeführt.
// ---------------------------------------------------------------
interface CommandBody {
  intent: string;
  source: string;
  payload: Record<string, unknown>;
}

function parseCommandBody(raw: unknown): CommandBody {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new GovardError("INVALID_BODY", "Body muss ein JSON-Objekt sein");
  }
  const body = raw as Record<string, unknown>;

  const intent = body.intent;
  if (typeof intent !== "string" || !INTENT_PATTERN.test(intent)) {
    throw new GovardError("INVALID_INTENT", "intent fehlt oder hat ein ungültiges Format");
  }

  const source = body.source ?? "api";
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

  return { intent, source, payload: payload as Record<string, unknown> };
}

const POLICY_ACTIONS: PolicyAction[] = ["DENY", "REQUIRE_APPROVAL", "WARN"];
const RULE_TYPES = [
  "ALLOWED_INTENTS", "MAX_BUDGET", "MAX_RECIPIENTS",
  "REQUIRE_APPROVAL_FOR_INTENT", "ALLOWED_RECIPIENT_DOMAINS", "TIME_WINDOW",
] as const;

function parsePolicyBody(raw: unknown): {
  policy_id?: string;
  name: string;
  rule: PolicyRule;
  action: PolicyAction;
} {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new GovardError("INVALID_BODY", "Body muss ein JSON-Objekt sein");
  }
  const body = raw as Record<string, unknown>;
  if (typeof body.name !== "string" || body.name.length === 0 || body.name.length > 200) {
    throw new GovardError("INVALID_POLICY", "name fehlt oder ist zu lang");
  }
  if (!POLICY_ACTIONS.includes(body.action as PolicyAction)) {
    throw new GovardError("INVALID_POLICY", `action muss eines von ${POLICY_ACTIONS.join(", ")} sein`);
  }
  const rule = body.rule as { type?: unknown } | undefined;
  if (!rule || !RULE_TYPES.includes(rule.type as (typeof RULE_TYPES)[number])) {
    throw new GovardError("INVALID_POLICY", `rule.type muss eines von ${RULE_TYPES.join(", ")} sein`);
  }
  if (body.policy_id !== undefined && typeof body.policy_id !== "string") {
    throw new GovardError("INVALID_POLICY", "policy_id muss ein String sein");
  }
  return {
    policy_id: body.policy_id as string | undefined,
    name: body.name,
    rule: rule as PolicyRule,
    action: body.action as PolicyAction,
  };
}

// ---------------------------------------------------------------
// Antworten + CORS
// ---------------------------------------------------------------
function corsHeaders(env: Env, request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");
  const allowed = (env.ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Idempotency-Key",
    "Vary": "Origin",
  };
}

function json(env: Env, request: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(env, request) },
  });
}

// ---------------------------------------------------------------
// POST /api/command — der eine Eingang für alle Agenten-Aktionen
// ---------------------------------------------------------------
async function handleCommand(
  env: Env,
  ctx: ExecutionContext,
  request: Request,
  principal: Principal,
): Promise<Response> {
  const idempotencyKey = request.headers.get("Idempotency-Key");
  if (!idempotencyKey || idempotencyKey.length > 128) {
    throw new GovardError("IDEMPOTENCY_KEY_REQUIRED", "Header Idempotency-Key fehlt", 400);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    throw new GovardError("INVALID_JSON", "Body ist kein gültiges JSON");
  }
  const body = parseCommandBody(rawBody);

  const repo = new OrgRepository(env.DB, principal.org_id);
  const requestHash = await hashObject({ intent: body.intent, source: body.source, payload: body.payload });

  const commandId = crypto.randomUUID();
  const reserved = await repo.reserveIdempotency(idempotencyKey, requestHash, commandId);
  if (!reserved) {
    // Key existiert: gespeicherte Antwort zurückgeben (wirft 422 bei anderem Body).
    const replayed = await repo.replay(idempotencyKey, requestHash);
    return json(env, request, replayed, 200);
  }

  const payload_hash = await hashObject(body.payload);
  await repo.createCommand({
    id: commandId,
    actor_id: principal.actor_id,
    source: body.source,
    intent: body.intent,
    payload: body.payload,
    payload_hash,
  });

  const evidence = evidenceFor(env, principal.org_id);
  await evidence.append({
    org_id: principal.org_id,
    command_id: commandId,
    actor_id: principal.actor_id,
    event_type: "COMMAND_RECEIVED",
    payload: { intent: body.intent, source: body.source, payload_hash },
  });

  const policies = await repo.activePolicyVersions();
  const evaluation = await evaluatePolicies(
    { intent: body.intent, payload: body.payload, payload_hash },
    policies,
  );

  await repo.attachEvaluation(commandId, evaluation);
  await evidence.append({
    org_id: principal.org_id,
    command_id: commandId,
    actor_id: null,
    event_type: "POLICY_EVALUATED",
    payload: evaluation,
  });
  await repo.transition(commandId, "RECEIVED", "EVALUATED");

  let state: string;
  if (evaluation.decision === "DENY") {
    const reason = evaluation.policy_set_size === 0
      ? "NO_POLICY_SET: Für diese Org ist keine Policy konfiguriert (deny by default)"
      : evaluation.violations.filter((v) => v.action === "DENY").map((v) => v.reason).join("; ");
    await repo.transition(commandId, "EVALUATED", "DENIED", { failureReason: reason });
    state = "DENIED";
  } else if (evaluation.decision === "APPROVAL") {
    const approvalId = await repo.createApproval({
      command_id: commandId,
      evaluation_hash: evaluation.evaluation_hash,
      requested_by: principal.actor_id,
    });
    await repo.transition(commandId, "EVALUATED", "PENDING_APPROVAL");
    await evidence.append({
      org_id: principal.org_id,
      command_id: commandId,
      actor_id: principal.actor_id,
      event_type: "APPROVAL_REQUESTED",
      payload: { approval_id: approvalId, evaluation_hash: evaluation.evaluation_hash },
    });
    state = "PENDING_APPROVAL";
  } else {
    await repo.transition(commandId, "EVALUATED", "APPROVED");
    // Ausführung nach der Antwort — der Request blockiert nie auf den Agenten.
    // Der Workflow überlebt den Worker-Neustart; waitUntil deckt nur das
    // Anlegen der Instanz ab, nicht die Ausführung selbst.
    ctx.waitUntil(startCommandExecution(env, principal.org_id, commandId));
    state = "APPROVED";
  }

  const response = {
    commandId,
    state,
    decision: evaluation.decision,
    evaluation: {
      evaluation_hash: evaluation.evaluation_hash,
      policy_set_size: evaluation.policy_set_size,
      passed: evaluation.evaluated.filter((e) => e.result === "PASS").length,
      not_applicable: evaluation.evaluated.filter((e) => e.result === "NOT_APPLICABLE").length,
      violations: evaluation.violations.map((v) => ({
        policy_id: v.policy_id, name: v.name, action: v.action, reason: v.reason,
      })),
    },
  };
  await repo.finalizeIdempotency(idempotencyKey, response);
  return json(env, request, response, 201);
}

// ---------------------------------------------------------------
// Approval-Entscheidung — Freigabe startet die serverseitige Ausführung
// ---------------------------------------------------------------
async function handleApprovalDecision(
  env: Env,
  ctx: ExecutionContext,
  request: Request,
  principal: Principal,
  approvalId: string,
  decision: "APPROVED" | "DENIED",
): Promise<Response> {
  requireRole(principal, "approver");

  let reason: string | undefined;
  try {
    const body = (await request.json()) as Record<string, unknown> | null;
    if (body && typeof body.reason === "string") reason = body.reason.slice(0, 1000);
  } catch {
    // Body ist optional.
  }

  const repo = new OrgRepository(env.DB, principal.org_id);
  const claimed = await repo.decideApproval(approvalId, decision, principal.actor_id, reason);
  if (!claimed) {
    throw new GovardError("APPROVAL_NOT_ACTIONABLE", "Freigabe existiert nicht, ist entschieden oder verfallen", 409);
  }

  // Bindung prüfen: Die Freigabe gilt für genau die evaluierte Fassung des
  // Commands. Weicht der Hash ab, wurde nach der Evaluation etwas verändert.
  const command = await repo.getCommand(claimed.command_id);
  if (!command || command.evaluation_hash !== claimed.evaluation_hash) {
    throw new GovardError("EVALUATION_MISMATCH", "Freigabe passt nicht zur evaluierten Command-Fassung", 409);
  }

  const evidence = evidenceFor(env, principal.org_id);
  await evidence.append({
    org_id: principal.org_id,
    command_id: claimed.command_id,
    actor_id: principal.actor_id,
    event_type: decision === "APPROVED" ? "APPROVAL_GRANTED" : "APPROVAL_DENIED",
    payload: { approval_id: approvalId, evaluation_hash: claimed.evaluation_hash, reason },
  });

  if (decision === "APPROVED") {
    await repo.transition(claimed.command_id, "PENDING_APPROVAL", "APPROVED", {
      actorId: principal.actor_id,
    });
    ctx.waitUntil(startCommandExecution(env, principal.org_id, claimed.command_id));
  } else {
    await repo.transition(claimed.command_id, "PENDING_APPROVAL", "DENIED", {
      actorId: principal.actor_id,
      failureReason: reason ?? "Von Freigebendem abgelehnt",
    });
  }

  return json(env, request, {
    approvalId,
    commandId: claimed.command_id,
    status: decision,
  });
}

// ---------------------------------------------------------------
// Router
// ---------------------------------------------------------------
async function route(
  env: Env,
  ctx: ExecutionContext,
  request: Request,
): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method;

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(env, request) });
  }
  if (method === "GET" && pathname === "/health") {
    return json(env, request, { ok: true, service: "govard-gateway" });
  }

  const principal = await authenticate(env.DB, request);
  const repo = new OrgRepository(env.DB, principal.org_id);

  if (method === "POST" && pathname === "/api/command") {
    return handleCommand(env, ctx, request, principal);
  }

  const commandMatch = pathname.match(/^\/api\/command\/([0-9a-f-]{36})$/);
  if (method === "GET" && commandMatch) {
    const command = await repo.getCommand(commandMatch[1]);
    if (!command) throw new GovardError("NOT_FOUND", "Command nicht gefunden", 404);
    const [transitions, events] = await Promise.all([
      repo.transitionsFor(command.id),
      repo.evidenceForCommand(command.id),
    ]);
    return json(env, request, { command, transitions, evidence: events });
  }

  if (method === "GET" && pathname === "/api/approvals") {
    requireRole(principal, "approver");
    return json(env, request, { approvals: await repo.inbox() });
  }

  const approvalMatch = pathname.match(/^\/api\/approvals\/([0-9a-f-]{36})\/(approve|deny)$/);
  if (method === "POST" && approvalMatch) {
    return handleApprovalDecision(
      env, ctx, request, principal, approvalMatch[1],
      approvalMatch[2] === "approve" ? "APPROVED" : "DENIED",
    );
  }

  if (method === "GET" && pathname === "/api/policies") {
    requireRole(principal, "approver");
    return json(env, request, { policies: await repo.listPolicies() });
  }

  if (method === "POST" && pathname === "/api/policies") {
    requireRole(principal, "admin");
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      throw new GovardError("INVALID_JSON", "Body ist kein gültiges JSON");
    }
    const policy = parsePolicyBody(raw);
    const created = await repo.upsertPolicyVersion({ ...policy, created_by: principal.actor_id });
    return json(env, request, created, 201);
  }

  if (method === "GET" && pathname === "/api/evidence/head") {
    return json(env, request, await evidenceFor(env, principal.org_id).head());
  }

  if (method === "GET" && pathname === "/api/evidence/verify") {
    requireRole(principal, "approver");
    return json(env, request, await evidenceFor(env, principal.org_id).verify());
  }

  if (method === "POST" && pathname === "/api/evidence/seal") {
    requireRole(principal, "admin");
    const seal = await evidenceFor(env, principal.org_id).seal(principal.org_id);
    await evidenceFor(env, principal.org_id).append({
      org_id: principal.org_id,
      command_id: null,
      actor_id: principal.actor_id,
      event_type: "CHAIN_SEALED",
      payload: seal,
    });
    return json(env, request, seal, 201);
  }

  throw new GovardError("NOT_FOUND", "Unbekannter Endpunkt", 404);
}

/** Verfallene Freigaben ordentlich schließen: Übergang + Evidence, kein stilles UPDATE. */
async function expireApprovalsForOrg(env: Env, orgId: string): Promise<void> {
  const repo = new OrgRepository(env.DB, orgId);
  const evidence = evidenceFor(env, orgId);
  for (const expired of await repo.expireApprovals()) {
    await evidence.append({
      org_id: orgId,
      command_id: expired.command_id,
      actor_id: null,
      event_type: "APPROVAL_DENIED",
      payload: { approval_id: expired.id, reason: "EXPIRED" },
    });
    try {
      await repo.transition(expired.command_id, "PENDING_APPROVAL", "DENIED", {
        failureReason: "Freigabe verfallen (TTL überschritten)",
      });
    } catch (err) {
      if (!(err instanceof GovardError && err.code === "STATE_CONFLICT")) throw err;
    }
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await route(env, ctx, request);
    } catch (err) {
      if (err instanceof GovardError) {
        return json(env, request, { error: err.code, message: err.message }, err.status);
      }
      console.error("govard-gateway unhandled", err);
      return json(env, request, { error: "INTERNAL", message: "Interner Fehler" }, 500);
    }
  },

  /** Täglicher Cron: Chain-Head pro Org nach R2 siegeln, verfallene Freigaben schließen. */
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil((async () => {
      for (const orgId of await OrgRepository.allOrgIds(env.DB)) {
        try {
          await expireApprovalsForOrg(env, orgId);
          await evidenceFor(env, orgId).seal(orgId);
        } catch (err) {
          console.error("scheduled maintenance failed for org", orgId, err);
        }
      }
    })());
  },
};
