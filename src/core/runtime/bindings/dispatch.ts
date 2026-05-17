// Action-Dispatcher fuer die Skill-Bindings.
//
// Jeder Skill exponiert mehrere Aktionen (z. B. marketing.cr vs.
// marketing.ctr). Der Handler im Bindings-Layer erwartet ein
// `ctx.args.action`-Feld und ruft die entsprechende pure Funktion auf.
//
// Bewusst minimal: KEINE Default-Werte erfinden, KEINE Args mutieren.
// Fehlt eine Aktion oder ein Pflicht-Arg, wirft der Handler und der
// Executor markiert die Ausfuehrung als `handler_threw`.

import type { HandlerContext, HandlerResult } from '../handlers';
import { defaultHasher } from '../handlers';

export type ActionFn = (args: Record<string, unknown>) => unknown | Promise<unknown>;

export interface ActionMap {
  [action: string]: ActionFn;
}

/**
 * Baut einen Runtime-Handler aus einer Action-Map. Der zurueckgegebene
 * Handler liest `ctx.args.action`, prueft Existenz in der Map, ruft die
 * Funktion mit `ctx.args` und liefert `{ output, output_hash }` zurueck.
 */
export function makeDispatchHandler(actions: ActionMap) {
  return async (ctx: HandlerContext): Promise<HandlerResult> => {
    const action = ctx.args.action;
    if (typeof action !== 'string' || !action.trim()) {
      throw new Error('args.action is required');
    }
    const fn = actions[action];
    if (!fn) {
      throw new Error(`unknown action: ${action}`);
    }
    const output = await fn(ctx.args);
    return {
      output,
      output_hash: defaultHasher(output),
    };
  };
}

/** Test/Introspection-Helper: liefert die Action-Namen fuer einen Skill. */
export function listActions(actions: ActionMap): readonly string[] {
  return Object.keys(actions).sort();
}
