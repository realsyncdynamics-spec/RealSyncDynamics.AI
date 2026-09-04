/**
 * Bot-PEP (P2-5) — der eine Enforcement-Punkt für Chat, WhatsApp und Voice.
 *
 * Diese Datei ist die IO-Hälfte: Betriebsmodus lesen, PDP befragen,
 * Beobachtungsbetrieb protokollieren. Die Fachlichkeit — was den Prozess
 * verlassen darf und wie ein Verdikt zu handeln ist — liegt rein und
 * getestet in `pdp/botmessage.ts`. Trennung wie bei P2-3: Der Kern bleibt
 * ohne `Deno`-Globals und damit in Vitest prüfbar.
 *
 * Alle drei Edge Functions rufen `consultBotPolicy()` an derselben Stelle
 * ihres Ablaufs auf: **nachdem** die eingehende Nachricht im Prüfpfad
 * steht, **bevor** das Modell antwortet. Vorher wäre die Sperre nicht
 * dokumentiert, nachher käme sie zu spät (Plan §1.3).
 *
 * Sicherheitsrelevanz: Läuft mit service_role und liegt deshalb
 * ausschließlich unter `supabase/functions/` (CLAUDE.md §4). `tenant_id`
 * stammt immer aus dem aufgelösten Bot, nie aus dem Request-Rumpf — sonst
 * könnte ein Anrufer fremde Richtlinien zur Anwendung bringen.
 *
 * EU AI Act Art. 50 · Art. 12 · DSGVO Art. 5 Abs. 1 lit. c.
 */

// deno-lint-ignore-file no-explicit-any
import { decide, logShadowComparison } from './pdp/decide.ts';
import {
  applyBotPolicy,
  botMessageFacts,
  botMessageToDecisionRequest,
  BOT_SHADOW_SOURCE,
  KNOWN_BOT_VERDICTS,
  type BotChannel,
  type BotFailureMode,
  type BotPolicyOutcome,
  type BotPolicyState,
  type BotVerdict,
} from './pdp/botmessage.ts';

export {
  applyBotPolicy,
  type BotChannel,
  type BotPolicyOutcome,
  type BotPolicyState,
};

/**
 * `off | shadow | enforce` — Default `shadow`.
 *
 * Wie an jedem anderen Enforcement-Punkt dieses Plans: Ein Deploy ändert
 * das Verhalten nicht von selbst. Umgestellt wird bewusst, nachdem die
 * Abweichungen in `pdp_shadow_log` gemessen sind.
 */
export function botPdpMode(): string {
  return (Deno.env.get('BOT_PDP_MODE') ?? 'shadow').trim().toLowerCase();
}

/** `allow | block` — Default `block`. Begründung in `pdp/botmessage.ts`. */
export function botFailureMode(): BotFailureMode {
  return (Deno.env.get('BOT_PDP_FAILURE_MODE') ?? 'block').trim().toLowerCase() === 'allow'
    ? 'allow'
    : 'block';
}

/**
 * Fragt den PDP, ob dieser Bot auf diese Nachricht antworten darf.
 *
 * Gibt **immer** einen Zustand zurück und wirft nie — ein PEP, der beim
 * Fragen abstürzt, nimmt dem Aufrufer die Entscheidung darüber ab, wie
 * mit dem Ausfall umzugehen ist. Genau diese Entscheidung soll aber
 * sichtbar bleiben (`BOT_PDP_FAILURE_MODE`).
 */
export async function consultBotPolicy(
  admin: any,
  input: {
    tenantId: string;
    botId: string;
    conversationId: string;
    channel: BotChannel;
    /** Wird lokal ausgewertet und verlässt den Prozess NICHT. */
    message: string;
  },
): Promise<BotPolicyState> {
  const mode = botPdpMode();
  if (mode === 'off') {
    return { engine: 'not_enforcing', reason: 'Richtlinienpruefung ist abgeschaltet (BOT_PDP_MODE=off).' };
  }

  const facts = botMessageFacts({
    channel: input.channel,
    botId: input.botId,
    conversationId: input.conversationId,
    message: input.message,
  });
  const request = botMessageToDecisionRequest(input.tenantId, facts);

  try {
    const result = await decide(admin, request);

    if (mode !== 'enforce') {
      // Mitrechnen und protokollieren, aber nicht anwenden.
      await logShadowComparison(admin, {
        tenant_id: input.tenantId,
        source: BOT_SHADOW_SOURCE[input.channel] as never,
        // Vor P2-5 gab es in diesem Kanal ueberhaupt keine
        // Richtlinienpruefung — der Alt-Zustand ist nicht "allow",
        // sondern "es wurde nicht gefragt". Das gehoert so
        // hingeschrieben, sonst zaehlt die Auswertung spaeter jede
        // Sperre als Divergenz gegen eine Erlaubnis, die nie erteilt
        // wurde.
        legacy_status: null,
        v2_status: result.decision,
        snapshot_version: result.snapshot_version ?? '',
        detail: {
          bot_id: facts.bot_id,
          conversation_id: facts.conversation_id,
          channel: facts.channel,
          signal_count: facts.signals.length,
          matched_policy_ids: result.matched_policy_ids ?? [],
        },
      });
      return {
        engine: 'not_enforcing',
        reason: `Beobachtungsbetrieb (BOT_PDP_MODE=${mode}); der PDP haette "${result.decision}" entschieden.`,
      };
    }

    // Vertrag v1 kennt genau fuenf Verdikte. Ein unbekanntes ist ein
    // Vertragsbruch — dann entscheidet das Ausfallverhalten, nicht ein
    // geratenes "allow".
    if (!KNOWN_BOT_VERDICTS.includes(result.decision as BotVerdict)) {
      return { engine: 'unavailable', detail: `unbekanntes Verdikt "${result.decision}"` };
    }
    return {
      engine: 'consulted',
      decision: result.decision as BotVerdict,
      reasons: (result.reasons ?? []).map((r: { text_de?: string }) => r.text_de ?? '').filter(Boolean),
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unbekannter Fehler';
    console.error(JSON.stringify({ level: 'error', scope: 'bot_pdp_failed', channel: input.channel, error: detail }));
    if (mode !== 'enforce') {
      // Im Beobachtungsbetrieb darf ein Ausfall nichts blockieren.
      return { engine: 'not_enforcing', reason: `Beobachtungsbetrieb; die Pruefung schlug fehl (${detail}).` };
    }
    return { engine: 'unavailable', detail };
  }
}

/**
 * Der vollständige Schritt, wie ihn alle drei Kanäle brauchen: befragen,
 * falten, Ausfallverhalten anwenden.
 */
export async function evaluateBotPolicy(
  admin: any,
  input: Parameters<typeof consultBotPolicy>[1],
): Promise<BotPolicyOutcome> {
  const state = await consultBotPolicy(admin, input);
  return applyBotPolicy(state, { failureMode: botFailureMode() });
}
