import type { Env } from "./env";
import type { CommandWorkflowParams } from "./workflows/command-workflow";

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
  env: Env,
  orgId: string,
  commandId: string,
): Promise<{ started: boolean; instanceId: string }> {
  const params: CommandWorkflowParams = { org_id: orgId, command_id: commandId };
  try {
    const instance = await env.COMMAND_WORKFLOW.create({ id: commandId, params });
    return { started: true, instanceId: instance.id };
  } catch (err) {
    // Bereits vergebene Kennung = laeuft schon. Alles andere ist echt.
    const message = err instanceof Error ? err.message : String(err);
    if (/already exists|duplicate|conflict/i.test(message)) {
      return { started: false, instanceId: commandId };
    }
    throw err;
  }
}
