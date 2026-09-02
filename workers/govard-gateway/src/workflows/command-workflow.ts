/// <reference path="../cf.d.ts" />
import { WorkflowEntrypoint } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import type { Env } from "../env";
import { OrgRepository } from "../db/repository";
import { evidenceFor } from "../evidence/sequencer";
import { isAlreadyApplied, isExecutableState } from "./execution-rules";
import { runIntent } from "../intents";

export interface CommandWorkflowParams {
  org_id: string;
  command_id: string;
}

/**
 * Serverseitige Ausfuehrung eines freigegebenen Commands — durable.
 *
 * Warum ein Workflow und nicht ctx.waitUntil: waitUntil endet mit der
 * Worker-Instanz. Faellt sie waehrend eines LLM-, Stripe- oder Mail-Aufrufs
 * aus, bleibt der Command fuer immer in EXECUTING stehen, und die
 * Evidence-Kette endet ohne Ergebnis — genau die Luecke, die ein
 * Governance-Nachweis nicht haben darf. Ein Workflow ueberlebt Neustarts,
 * nimmt an der letzten abgeschlossenen Stufe wieder auf und wiederholt
 * transiente Fehler mit Backoff.
 *
 * IDEMPOTENZ IST PFLICHT, NICHT KOMFORT: step.do() haelt nur das Ergebnis
 * ERFOLGREICHER Schritte fest. Ein Schritt, der auf halbem Weg scheitert,
 * wird vollstaendig wiederholt — inklusive allem, was er vorher schon
 * geschrieben hat. Jeder Rumpf hier muss ein zweites Mal laufen koennen,
 * ohne Schaden anzurichten:
 *
 *  - Zustandsuebergaenge sind durch `WHERE state = ?` bewacht. Beim zweiten
 *    Lauf trifft die Bedingung nicht mehr zu, das Repository wirft
 *    STATE_CONFLICT. Das ist hier KEIN Fehler, sondern der Beleg, dass der
 *    Uebergang bereits vollzogen ist — deshalb wird er abgefangen.
 *  - Evidence-Events sind bewusst NICHT abgefangen: Die Chain darf einen
 *    Wiederanlauf zeigen. Ein doppeltes EXECUTION_STARTED ist ehrlich,
 *    ein verschwiegener Neustart waere es nicht.
 */
export class CommandWorkflow extends WorkflowEntrypoint<Env, CommandWorkflowParams> {
  async run(event: WorkflowEvent<CommandWorkflowParams>, step: WorkflowStep) {
    const { org_id, command_id } = event.payload;
    const repo = new OrgRepository(this.env.DB, org_id);
    const evidence = evidenceFor(this.env, org_id);

    const command = await step.do("command laden", async () => {
      const c = await repo.getCommand(command_id);
      if (!c) {
        // Ein fehlender Command entsteht nicht durch einen transienten
        // Fehler — Wiederholen wuerde nichts aendern.
        throw new NonRetryableError(`Command ${command_id} existiert nicht`);
      }
      return { intent: c.intent, payload: c.payload, state: c.state };
    });

    if (!isExecutableState(command.state)) {
      // Kein Fehler: Ein anderer Lauf war schneller, oder der Command wurde
      // inzwischen abgelehnt. Stillhalten ist hier richtig.
      return { skipped: true, state: command.state };
    }

    await step.do("ausfuehrung beginnen", async () => {
      await evidence.append({
        org_id,
        command_id,
        actor_id: null,
        event_type: "EXECUTION_STARTED",
        payload: { intent: command.intent, instance: event.instanceId },
      });
      await this.transitionTolerant(repo, command_id, "APPROVED", "EXECUTING");
      return true;
    });

    // Der einzige Schritt, der nach aussen wirkt — und der einzige, der
    // Wiederholung wirklich braucht. Der Rumpf gehoert in intents.ts, damit
    // Governance-Huelle und Fachlogik getrennt bleiben.
    let result: unknown;
    let failure: string | null = null;
    try {
      result = await step.do(
        "agent ausfuehren",
        { retries: { limit: 3, delay: "10 seconds", backoff: "exponential" }, timeout: "5 minutes" },
        async () => runIntent(command.intent, command.payload),
      );
    } catch (err) {
      failure = err instanceof Error ? err.message : String(err);
    }

    await step.do("ergebnis festhalten", async () => {
      if (failure === null) {
        await evidence.append({
          org_id,
          command_id,
          actor_id: null,
          event_type: "EXECUTION_SUCCEEDED",
          payload: { result },
        });
        await this.transitionTolerant(repo, command_id, "EXECUTING", "EXECUTED");
      } else {
        await evidence.append({
          org_id,
          command_id,
          actor_id: null,
          event_type: "EXECUTION_FAILED",
          payload: { reason: failure },
        });
        await this.transitionTolerant(repo, command_id, "EXECUTING", "FAILED", failure);
      }
      return true;
    });

    return { command_id, state: failure === null ? "EXECUTED" : "FAILED", result, failure };
  }

  /**
   * Uebergang, der einen bereits vollzogenen Uebergang nicht als Fehler
   * behandelt. Notwendig, weil ein wiederholter Schritt denselben Uebergang
   * ein zweites Mal versucht — siehe Klassenkommentar.
   */
  private async transitionTolerant(
    repo: OrgRepository,
    commandId: string,
    from: Parameters<OrgRepository["transition"]>[1],
    to: Parameters<OrgRepository["transition"]>[2],
    failureReason?: string,
  ): Promise<void> {
    try {
      await repo.transition(commandId, from, to, { failureReason });
    } catch (err) {
      if (isAlreadyApplied(err)) return;
      throw err;
    }
  }
}
