import { GovardError, TRANSITIONS, type CommandState } from "../types";

/**
 * Die zwei Regeln, die den durablen Wiederanlauf korrekt machen.
 *
 * Sie stehen hier als reine Funktionen, nicht im Workflow, aus einem
 * Grund: Sie sind subtil, sie sind sicherheitsrelevant, und sie liessen
 * sich sonst nur von Hand gegen einen laufenden Worker pruefen. Ein Fehler
 * darin faellt im Betrieb nicht auf — er zeigt sich erst, wenn ein Command
 * doppelt ausgefuehrt wurde oder fuer immer in EXECUTING haengt. Beides
 * waere in einem Nachweissystem ein stiller Totalschaden.
 */

/**
 * Zustaende, in denen der Workflow taetig werden darf.
 *
 * APPROVED  — der Normalfall: Freigabe erteilt, Ausfuehrung beginnt.
 * EXECUTING — Wiederanlauf: Die Instanz ist nach dem Uebergang gestorben.
 *             Ohne diesen Fall bliebe der Command fuer immer haengen.
 *
 * Alles andere heisst: ein anderer Lauf war schneller, oder der Command
 * wurde abgelehnt. Dann ist Stillhalten richtig — nicht "sicherheitshalber
 * trotzdem ausfuehren".
 */
export const EXECUTABLE_STATES = ["APPROVED", "EXECUTING"] as const satisfies readonly CommandState[];

export function isExecutableState(state: CommandState): boolean {
  return (EXECUTABLE_STATES as readonly CommandState[]).includes(state);
}

/**
 * Ob ein Fehler bedeutet: "Der Uebergang ist bereits vollzogen."
 *
 * Ein wiederholter Workflow-Schritt versucht denselben bewachten Uebergang
 * ein zweites Mal. Das `WHERE state = ?` trifft dann nicht mehr zu, und das
 * Repository meldet STATE_CONFLICT. In diesem Zusammenhang ist das der
 * BELEG fuer Erfolg, nicht fuer Misserfolg.
 *
 * Eng gefasst mit Absicht: Nur dieser eine Code gilt als "schon erledigt".
 * Wer hier grosszuegiger wird, verschluckt echte Fehler — und ein
 * verschluckter Fehler im Zustandsautomaten ist genau das, was die
 * Governance-Zusage bricht.
 */
export function isAlreadyApplied(err: unknown): boolean {
  return err instanceof GovardError && err.code === "STATE_CONFLICT";
}

/**
 * Gegenprobe zur Uebergangstabelle: Aus jedem ausfuehrbaren Zustand muss
 * ein Weg zu einem Ausfuehrungsende bestehen. Waere das nicht so, koennte
 * der Workflow einen Command annehmen, den er nicht abschliessen kann.
 */
export function canReachExecutionOutcome(state: CommandState): boolean {
  const seen = new Set<CommandState>();
  const queue: CommandState[] = [state];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === "EXECUTED" || current === "FAILED") return true;
    if (seen.has(current)) continue;
    seen.add(current);
    queue.push(...TRANSITIONS[current]);
  }
  return false;
}
