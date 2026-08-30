import type { Env } from "./env";
import { OrgRepository } from "./db/repository";
import { evidenceFor } from "./evidence/sequencer";
import { GovardError } from "./types";

/**
 * Serverseitige Ausführung nach Freigabe. Der Browser bzw. der einreichende
 * Agent startet nie selbst — die Freigabe stößt diesen Pfad an, und der
 * HTTP-Request von /api/command blockiert nicht auf LLM-/Stripe-/Mail-Läufe
 * (Aufruf via ctx.waitUntil).
 *
 * v1 enthält bewusst nur den Referenz-Executor "echo": Er beweist die
 * Governance-Kette Ende-zu-Ende (APPROVED → EXECUTING → EXECUTED, jede
 * Stufe in der Evidence), ohne einen externen Agenten zu brauchen. Der
 * nächste Ausbauschritt ersetzt diese Funktion durch eine Cloudflare
 * Workflow-Definition (durable, Retries bei transienten Fehlern) — die
 * Zustandsübergänge und Evidence-Events bleiben identisch.
 */
async function runIntent(intent: string, payload: Record<string, unknown>): Promise<unknown> {
  return { executor: "echo", intent, payload_keys: Object.keys(payload).sort() };
}

export async function executeCommand(env: Env, orgId: string, commandId: string): Promise<void> {
  const repo = new OrgRepository(env.DB, orgId);
  const evidence = evidenceFor(env, orgId);

  const command = await repo.getCommand(commandId);
  if (!command) return;
  if (command.state !== "APPROVED") return; // Ein anderer Worker war schneller.

  try {
    await repo.transition(commandId, "APPROVED", "EXECUTING");
  } catch (err) {
    // STATE_CONFLICT: genau ein Gewinner — der Verlierer hört hier auf.
    if (err instanceof GovardError && err.code === "STATE_CONFLICT") return;
    throw err;
  }
  await evidence.append({
    org_id: orgId,
    command_id: commandId,
    actor_id: null,
    event_type: "EXECUTION_STARTED",
    payload: { intent: command.intent },
  });

  try {
    const result = await runIntent(command.intent, command.payload);
    await evidence.append({
      org_id: orgId,
      command_id: commandId,
      actor_id: null,
      event_type: "EXECUTION_SUCCEEDED",
      payload: { result },
    });
    await repo.transition(commandId, "EXECUTING", "EXECUTED");
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await evidence.append({
      org_id: orgId,
      command_id: commandId,
      actor_id: null,
      event_type: "EXECUTION_FAILED",
      payload: { reason },
    });
    await repo.transition(commandId, "EXECUTING", "FAILED", { failureReason: reason });
  }
}
