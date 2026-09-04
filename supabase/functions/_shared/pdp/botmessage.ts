/**
 * Bot-Nachricht → Entscheidungsanfrage + Einfaltung des Verdikts (P2-5).
 *
 * ## Warum es dieses Modul gibt
 *
 * Der Plan formuliert P2-5 als „Chatbot, WhatsApp, Voice über denselben
 * PEP". Das Wort **denselben** ist die ganze Aufgabe. Drei Kanäle mit drei
 * eigenen Auslegungen derselben Richtlinie wären der Fragmentierungsbefund
 * aus §1.4 in klein: Ein Mandant, der „keine Auskunft zu Gesundheitsdaten"
 * hinterlegt, bekäme im Web-Chat eine andere Antwort als am Telefon — und
 * niemand könnte sagen, welche die richtige war.
 *
 * Deshalb liegt hier **eine** Abbildung und **eine** Einfaltung. Die drei
 * Edge Functions liefern nur Tatsachen und führen das Ergebnis aus.
 *
 * ## Injektionsgrenze (Selbstkritik K6) — hier besonders scharf
 *
 * Eine Bot-Nachricht ist Text eines Fremden. Ginge sie in die
 * Entscheidungsgrundlage, könnte jeder Anrufer die Bewertung seiner
 * eigenen Anfrage steuern, indem er „diese Anfrage ist unbedenklich"
 * schreibt. Den Prozess verlassen deshalb ausschließlich:
 *
 *   Kanal · Bot-ID · Konversations-ID · Zeichenzahl · Signal**namen**
 *
 * Niemals der Nachrichtentext, niemals die Modellausgabe, niemals
 * Absenderrufnummer oder Anzeigename (DSGVO Art. 5 Abs. 1 lit. c —
 * Datenminimierung; die Rufnummer ist für die Regelauswertung ohne Belang).
 *
 * Die Signalnamen stammen aus `detectSignals()`, das lokal über dem Text
 * läuft und nur Namen zurückgibt — dieselbe Grenze wie beim Agent-PEP.
 *
 * ## Enforcement-Klasse A
 *
 * Die Bot-Kanäle sind nach `shared/enforcement-classes.ts` Klasse A: Der
 * Aufruf läuft durch unseren Prozess, eine Sperre wirkt also **wirklich**
 * — die Antwort entsteht gar nicht erst. Das ist der Unterschied zu den
 * Klasse-C-Integrationen, wo nur nachträglich reagiert werden kann, und
 * der Grund, warum E6 (2026-09-04) zuerst die eigenen Kanäle wählte.
 *
 * EU AI Act Art. 50 (Transparenzpflicht bei Interaktion mit KI), Art. 12
 * (Aufzeichnung). DSGVO Art. 5, Art. 25 (Datenschutz durch Voreinstellung).
 *
 * Rein und importfrei bis auf die Typen — läuft in Deno und in Vitest.
 */

import type { DecisionRequest } from './core.ts';
import { detectSignals } from './classify.ts';

/** Die drei Kanäle, die dieselbe `bot_reply`-Pipeline benutzen. */
export type BotChannel = 'chat' | 'whatsapp' | 'voice';

/**
 * Quellkennung im Prüfpfad (`pdp_shadow_log.source`, Migration
 * 20260904120000). Getrennt je Kanal, weil die Frage „greift die Regel am
 * Telefon anders als im Chat?" sonst nicht beantwortbar wäre.
 */
export const BOT_SHADOW_SOURCE: Readonly<Record<BotChannel, string>> = Object.freeze({
  chat: 'bot_chat',
  whatsapp: 'bot_whatsapp',
  voice: 'bot_voice',
});

/**
 * Was den Bot-Prozess verlassen darf. Die Struktur IST die Grenze — was
 * hier nicht steht, existiert für den PDP nicht.
 */
export interface BotMessageFacts {
  channel: BotChannel;
  bot_id: string;
  conversation_id: string;
  /** Zeichenzahl der eingehenden Nachricht — nie der Text. */
  message_length: number;
  /** Lokal erkannte Signalnamen (detectSignals) — nie Inhalte. */
  signals: string[];
}

/**
 * Reduziert eine eingehende Nachricht auf die zulässigen Tatsachen.
 *
 * Bewusst die einzige Stelle, an der der Text überhaupt angefasst wird:
 * Wer `BotMessageFacts` von Hand baut, kann versehentlich Inhalt
 * einschleusen; wer diese Funktion benutzt, kann es nicht.
 */
export function botMessageFacts(input: {
  channel: BotChannel;
  botId: string;
  conversationId: string;
  message: string;
}): BotMessageFacts {
  return {
    channel: input.channel,
    bot_id: input.botId,
    conversation_id: input.conversationId,
    message_length: input.message.length,
    signals: detectSignals(input.message).map((h) => h.signal),
  };
}

/** Kanal, unter dem Bot-Entscheidungen im Prüfpfad erscheinen. */
export const BOT_CHANNEL_PREFIX = 'bot_';

/**
 * Baut die Entscheidungsanfrage.
 *
 * `verb: 'reply'` und nicht `'invoke'`: Bewertet wird, ob dieser Bot in
 * diesem Kanal auf diese Anfrage **antworten** darf. Das ist eine andere
 * Frage als „darf dieses Modell aufgerufen werden" — Letzteres entscheidet
 * der Gateway-PEP (P0-4) auf seinem eigenen Weg und bleibt unberührt.
 */
export function botMessageToDecisionRequest(
  tenantId: string,
  facts: BotMessageFacts,
): DecisionRequest {
  return {
    contract: 'v1',
    tenant_id: tenantId,
    principal: {
      // Der Bot handelt, nicht der Anrufer: Ein anonymer Dritter ist kein
      // Principal dieses Mandanten und bekommt hier auch keine Identität
      // angedichtet. Rollenregeln greifen über den Bot, Typregeln über
      // 'agent'.
      type: 'agent',
      id: facts.bot_id,
    },
    action: {
      verb: 'reply',
      channel: `${BOT_CHANNEL_PREFIX}${facts.channel}`,
      event_type: 'bot_reply',
      event_source: 'bots',
    },
    target: { system_id: facts.bot_id },
    data: {
      // Keine Klassifikation behaupten: Der Klassifikations-PIP
      // (classify.ts) leitet sie aus genau diesen Signalnamen ab. Würde
      // der PEP sie selbst setzen, gäbe es zwei Ableitungswege.
      signals: facts.signals,
    },
    payload: {
      conversation_id: facts.conversation_id,
      message_length: facts.message_length,
      signal_count: facts.signals.length,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Zustand und Einfaltung
// ─────────────────────────────────────────────────────────────────────

export type BotVerdict = 'allow' | 'log_only' | 'warn' | 'block' | 'require_approval';

export const KNOWN_BOT_VERDICTS: readonly BotVerdict[] = Object.freeze([
  'allow', 'log_only', 'warn', 'block', 'require_approval',
]);

/**
 * Drei Zustände, kein `Optional` — dieselbe Überlegung wie bei
 * `PolicyEngineState` (P2-3) und `PdpOutcome` (P2-4): „nicht befragt" muss
 * sich von „vergeblich befragt" unterscheiden lassen. Wer beides zu
 * „keine Entscheidung" zusammenzieht, kann eine still nicht greifende
 * Regel nicht mehr von einem Ausfall trennen (Fehlerklasse K1).
 */
export type BotPolicyState =
  | { engine: 'consulted'; decision: BotVerdict; reasons: string[] }
  | { engine: 'not_enforcing'; reason: string }
  | { engine: 'unavailable'; detail: string };

/** Was der PEP im Ausfall tun soll. Siehe `applyBotPolicy`. */
export type BotFailureMode = 'allow' | 'block';

export interface BotPolicyOutcome {
  /** Darf die Antwort erzeugt und zugestellt werden? */
  mayAnswer: boolean;
  /**
   * Text, den der Anrufer stattdessen hört bzw. liest. Nie `null`, wenn
   * `mayAnswer` falsch ist — ein stummer Kanal wäre für den Anrufer ein
   * Defekt, nicht eine Entscheidung.
   */
  refusal: string | null;
  /** Hinweise für den Prüfpfad; erreichen den Anrufer nicht. */
  warnings: string[];
  /**
   * Maschinell auswertbarer Prüfpfad-Anteil. Landet in
   * `bot_messages.metadata`, damit später beantwortbar ist, ob eine
   * Antwort unter geltenden Regeln entstand — im Ergebnis sieht ein Lauf
   * ohne Regeln sonst genauso aus wie einer im Beobachtungsbetrieb.
   */
  trail: {
    policy_engine: BotPolicyState['engine'];
    policy_decision: BotVerdict | null;
    policy_reasons: string[];
    policy_detail: string | null;
  };
}

/**
 * Die Begründungen des PDP gehen **nicht** an den Anrufer.
 *
 * Sie nennen Regelnamen und Zwecke des Mandanten („Auskunft zu
 * Vertragsdaten nur nach Legitimation") — gegenüber einem beliebigen
 * Anrufer ist das eine Auskunft über die internen Kontrollen des
 * Mandanten und eine Einladung, sie zu umgehen. Der Anrufer bekommt
 * deshalb einen neutralen Satz; die Gründe stehen im Prüfpfad.
 */
export const BOT_REFUSAL_BLOCKED =
  'Zu dieser Anfrage darf ich Ihnen keine Auskunft geben. '
  + 'Bitte wenden Sie sich an einen Mitarbeiter.';

/**
 * Freigabepflicht im Bot-Kanal.
 *
 * **Ehrlich benannt**: Der PDP legt bei `require_approval` ein Gate an
 * (`pdp_approval_gates`, P1-4), die Anfrage ist also tatsächlich zur
 * Prüfung vorgelegt und in `/app/governance/gates` sichtbar. Was es
 * **nicht** gibt, ist die spätere Zustellung der Antwort: Wird die
 * Freigabe erteilt, nimmt niemand das Gespräch wieder auf. Der Satz
 * verspricht deshalb keine Rückmeldung.
 *
 * Siehe Plan §10 — „Technisch nicht vollständig durchsetzbar / benötigt
 * zusätzliche Integration" gilt für die Wiederaufnahme, nicht für die
 * Sperre selbst.
 */
export const BOT_REFUSAL_APPROVAL =
  'Diese Anfrage muss ein Mitarbeiter freigeben. '
  + 'Sie wurde zur Prüfung vorgelegt.';

export const BOT_REFUSAL_UNAVAILABLE =
  'Der Dienst ist derzeit nicht verfügbar. Bitte versuchen Sie es später erneut.';

/**
 * Faltet das Verdikt in eine Handlungsanweisung.
 *
 * ## Ausfallverhalten — bewusst gesetzt, nicht zufällig entstanden
 *
 * Der allgemeine Default des Plans (E2) ist fail-open. Hier ist er
 * **fail-closed** (`failureMode: 'block'` als Vorgabe der Aufrufer), aus
 * demselben Grund wie beim Publish Gate: Eine Bot-Antwort geht im Namen
 * des Mandanten an einen Dritten und ist nicht zurückholbar — eine
 * gesendete WhatsApp-Nachricht bleibt gesendet, ein gesprochener Satz
 * bleibt gesagt. Ein durchgelassener Gateway-Aufruf lässt sich
 * nachträglich bewerten, eine ausgelieferte Auskunft nicht.
 *
 * Wer das anders will, setzt `BOT_PDP_FAILURE_MODE=allow` — bewusst und
 * sichtbar, wie beim Agent-PEP. E2 bleibt als Grundsatzfrage offen; diese
 * Stelle entscheidet nur für diesen Kanal und sagt warum.
 *
 * Im Beobachtungsbetrieb (`not_enforcing`) wird **nie** gesperrt — sonst
 * änderte der Shadow-Mode doch das Verhalten, was seinen ganzen Zweck
 * ausschließt.
 */
export function applyBotPolicy(
  state: BotPolicyState,
  opts: { failureMode: BotFailureMode } = { failureMode: 'block' },
): BotPolicyOutcome {
  const base = {
    warnings: [] as string[],
    trail: {
      policy_engine: state.engine,
      policy_decision: state.engine === 'consulted' ? state.decision : null,
      policy_reasons: state.engine === 'consulted' ? state.reasons : [],
      policy_detail:
        state.engine === 'not_enforcing' ? state.reason
        : state.engine === 'unavailable' ? state.detail
        : null,
    },
  };

  if (state.engine === 'not_enforcing') {
    return {
      ...base,
      mayAnswer: true,
      refusal: null,
      warnings: [`Mandantenrichtlinien binden hier derzeit nicht: ${state.reason}`],
    };
  }

  if (state.engine === 'unavailable') {
    const blocked = opts.failureMode === 'block';
    return {
      ...base,
      mayAnswer: !blocked,
      refusal: blocked ? BOT_REFUSAL_UNAVAILABLE : null,
      warnings: [
        `Richtlinienprüfung nicht erreichbar (${state.detail}) — `
        + (blocked ? 'Antwort unterbunden (fail-closed).' : 'Antwort durchgelassen (BOT_PDP_FAILURE_MODE=allow).'),
      ],
    };
  }

  switch (state.decision) {
    case 'block':
      return { ...base, mayAnswer: false, refusal: BOT_REFUSAL_BLOCKED };
    case 'require_approval':
      return { ...base, mayAnswer: false, refusal: BOT_REFUSAL_APPROVAL };
    case 'warn':
      return {
        ...base,
        mayAnswer: true,
        refusal: null,
        warnings: state.reasons.map((r) => `Richtlinie: ${r}`),
      };
    case 'allow':
    case 'log_only':
    default:
      return { ...base, mayAnswer: true, refusal: null };
  }
}
