import type { CommandWorkflowParams } from "./types";

/**
 * Der Ausschnitt des COMMAND_WORKFLOW-Bindings, den der Start braucht.
 * Bewusst ohne Env: So bleibt die Doppelstart-Logik ausserhalb der
 * Worker-Runtime testbar (test/govard/), und Env erfuellt ihn strukturell.
 */
export interface CommandWorkflowStarter {
  create(options: { id: string; params: CommandWorkflowParams }): Promise<{ id: string }>;
  get(id: string): Promise<{ id: string; status(): Promise<{ status: string }> }>;
}

/**
 * Endzustaende einer Instanz, die nicht erfolgreich durchgelaufen ist
 * (Cloudflare Workflows, InstanceStatus). Eine solche Instanz arbeitet
 * nicht mehr — sie als laufenden Doppelstart zu werten, hiesse, einen
 * moeglicherweise haengenden Command zu verschweigen.
 */
const ENDED_UNSUCCESSFULLY = new Set(["errored", "terminated"]);

/**
 * Startet die serverseitige Ausfuehrung eines freigegebenen Commands.
 *
 * Der einreichende Agent und der Browser starten nie selbst — weder beim
 * ALLOW-Pfad noch bei der Freigabe. Beide Wege landen hier, und hier
 * entsteht eine Workflow-Instanz, die den Neustart des Workers ueberlebt.
 *
 * Die Instanz-Kennung IST die Command-Kennung. Das ist kein Schmuck: Eine
 * bereits vergebene Kennung weist Workflows ab, und damit kann ein Command
 * konstruktionsbedingt nicht zweimal ausgefuehrt werden — auch dann nicht,
 * wenn ALLOW-Pfad und eine spaetere Freigabe beide ausloesen wuerden. Der
 * abgewiesene Doppelstart ist der Normalfall, kein Fehler.
 */
export async function startCommandExecution(
  env: { COMMAND_WORKFLOW: CommandWorkflowStarter },
  orgId: string,
  commandId: string,
): Promise<{ started: boolean; instanceId: string }> {
  const params: CommandWorkflowParams = { org_id: orgId, command_id: commandId };
  try {
    const instance = await env.COMMAND_WORKFLOW.create({ id: commandId, params });
    return { started: true, instanceId: instance.id };
  } catch (err) {
    // Doppelstart wird am Bestand erkannt, nicht am Fehlertext: Der Wortlaut
    // der Workflows-Fehler ist kein Vertrag, und ein Muster wie /conflict/
    // wuerde echte Fehler verschlucken — der Command hinge dann ohne
    // laufende Instanz fuer immer.
    let existing: Awaited<ReturnType<CommandWorkflowStarter["get"]>>;
    try {
      existing = await env.COMMAND_WORKFLOW.get(commandId);
    } catch {
      throw err;
    }
    // Gefunden heisst nicht laufend. Ueber die heutigen Aufrufer ist eine
    // beendete Instanz nicht erreichbar (je Command genau ein Startpfad,
    // durch WHERE state bewacht) — tritt sie doch auf, wird sie laut statt
    // still. Die Wiederaufnahme selbst ist bewusst nicht Teil dieses Pfads.
    const { status } = await existing.status();
    if (ENDED_UNSUCCESSFULLY.has(status)) {
      throw new Error(
        `Workflow-Instanz ${commandId} existiert bereits, ist aber "${status}" — der Command braucht eine Wiederaufnahme`,
        { cause: err },
      );
    }
    return { started: false, instanceId: existing.id };
  }
}
