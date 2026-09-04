/**
 * Bot-Nachricht → Entscheidung (P2-5, Bot-PEP).
 *
 * WARUM DIESES MODUL EXISTIERT
 * Der Auftrag zu P2-5 lautet „Chatbot, WhatsApp, Voice über denselben PEP".
 * Das Entscheidende daran ist nicht, DASS die drei Kanäle prüfen, sondern
 * dass sie es an EINER Stelle tun. Drei Kopien derselben Prüfung sind der
 * Fragmentierungsbefund aus §1.4 des Plans, nur eine Ebene tiefer: Sie
 * laufen auseinander, und die Abweichung fällt erst auf, wenn ein Kanal
 * durchlässt, was ein anderer sperrt.
 *
 * ## Die Injektionsgrenze (K6) — hier die schärfste im ganzen Produkt
 *
 * `bot-chat` und `whatsapp-webhook` laufen mit `verify_jwt = false`. Der Text,
 * über den hier entschieden wird, stammt also von **einem beliebigen Fremden
 * aus dem Internet**. Ginge er in die Entscheidungsgrundlage, könnte jeder
 * Absender die Regeln des Mandanten adressieren, indem er sie in seine
 * Nachricht schreibt.
 *
 * Deshalb verlässt der Nachrichtentext diesen Prozess **nie**. An den PDP
 * gehen ausschließlich:
 *
 *   - Bot- und Mandanten-Kennung, Kanal
 *   - SIGNALNAMEN und Trefferzahlen aus `detectSignals` — nie die Treffer
 *     selbst (DSGVO Art. 5 Abs. 1 lit. c)
 *   - die daraus abgeleitete Datenklasse und ihre Erkennungsgüte
 *   - Längen und Zähler
 *
 * Kein Zeichen des Textes, keine Modellausgabe. Modellausgabe ist Evidenz,
 * nie Autorität.
 *
 * ## Warum der PEP VOR dem Modellaufruf sitzt
 *
 * Alle drei Kanäle haben dieselbe Form: Bot auflösen → Kontingent →
 * Nachricht speichern → Modell → Antwort senden. Die Schranke gehört vor
 * den Modellaufruf: Danach ist das Geld ausgegeben, und bei WhatsApp und
 * Voice ist die Antwort bereits unterwegs. Eine Prüfung nach dem Versand
 * ist ein Protokoll, keine Schranke.
 *
 * EU AI Act Art. 50 (Transparenz bei Interaktion mit einem KI-System),
 * Art. 12 (Aufzeichnung); DSGVO Art. 5 Abs. 1 lit. c, Art. 9.
 */

import type { DecisionRequest, PdpDecision } from './core.ts';
import { classifyFromSignals, detectSignals } from './classify.ts';
import { decide, logShadowComparison } from './decide.ts';

/** Kanäle, unter denen Bot-Entscheidungen im Prüfpfad erscheinen. */
export type BotPepChannel = 'bot-chat' | 'bot-whatsapp' | 'bot-voice';

/** Verb der Aktion — dasselbe für alle drei Kanäle. */
export const BOT_VERB = 'bot_reply';

/**
 * Betriebsart, gelesen aus `BOT_PDP_ENFORCEMENT`.
 *
 * Vorgabe ist `shadow`, aus demselben Grund wie beim Gateway (P0) und beim
 * Publish Gate (P2-3): Der Merge darf das Verhalten laufender Kundenkanäle
 * nicht ändern. Umgeschaltet wird bewusst, nachdem `pdp_shadow_log` zeigt,
 * was `enforce` bewirkt hätte.
 */
export type BotPepMode = 'off' | 'shadow' | 'enforce';

export function readBotPepMode(): BotPepMode {
  const raw = (Deno.env.get('BOT_PDP_ENFORCEMENT') ?? 'shadow').toLowerCase();
  return raw === 'off' || raw === 'enforce' ? raw : 'shadow';
}

export interface BotMessageInput {
  tenant_id: string;
  bot_id: string;
  channel: BotPepChannel;
  /**
   * Der Nachrichtentext. Wird **ausschließlich** lokal auf Signale geprüft
   * und verlässt diese Funktion nicht. Er steht hier, damit die Erkennung
   * dort läuft, wo der Inhalt ohnehin liegt.
   */
  message: string;
  /** Anzahl bisheriger Nachrichten der Konversation. Eine Zahl, kein Inhalt. */
  history_length: number;
  /** Fähigkeiten aus der Bot-Registry (`bots.capabilities`) — Schlüssel, keine Werte. */
  capability_keys?: string[];
}

/**
 * Ergebnis für den aufrufenden Kanal.
 *
 * `allowed: false` heißt: **keine** Modellantwort erzeugen und **nichts**
 * an den Absender senden ausser `safe_reply`.
 */
export interface BotPepVerdict {
  allowed: boolean;
  mode: BotPepMode;
  /** Entscheidung des PDP, sofern er befragt wurde und geantwortet hat. */
  decision: PdpDecision | null;
  /**
   * Begründungen des PDP — **nur für den Prüfpfad**, nie für den Absender.
   * Siehe `safe_reply`.
   */
  reasons: string[];
  matched_policy_ids: string[];
  /**
   * Was der Absender zu sehen bekommt, wenn gesperrt wurde.
   *
   * Bewusst neutral und ohne jeden Hinweis auf die Regel: Der Absender ist
   * ein Kunde DES MANDANTEN, nicht der Mandant. Ihm die Richtlinie zu
   * nennen, gäbe interne Regeln an einen Dritten preis — und lüde dazu ein,
   * sie durch Umformulieren zu umgehen.
   */
  safe_reply: string | null;
  /** Erkannte Signalnamen — für den Prüfpfad, enthält keinen Inhalt. */
  signals: string[];
}

const BLOCKED_REPLY =
  'Diese Anfrage kann ich hier nicht beantworten. Bitte wenden Sie sich direkt an uns.';

/**
 * Baut die Entscheidungsanfrage. Alles, was nicht hier steht, existiert für
 * den PDP nicht — die Struktur IST die Grenze.
 */
export function botMessageToDecisionRequest(
  input: BotMessageInput,
  signals: { signal: string; count: number }[],
  classification: { classification: string; confidence: number },
): DecisionRequest {
  return {
    contract: 'v1',
    tenant_id: input.tenant_id,
    // Der Absender ist kein Principal dieses Mandanten — er ist ein Fremder.
    // Ihn als `user` auszugeben, würde Rollenregeln auf jemanden anwenden,
    // der keine Rolle hat. `service` beschreibt den Bot, der antwortet.
    principal: { type: 'service', id: input.bot_id },
    action: {
      verb: BOT_VERB,
      channel: input.channel,
      event_type: 'bot_reply',
      event_source: input.channel,
    },
    data: {
      classification: classification.classification,
      classification_confidence: classification.confidence,
      // NUR die Namen. `detectSignals` gibt Trefferzahlen zurück, nie die
      // Treffer — siehe classify.ts.
      signals: signals.map((s) => s.signal),
    },
    payload: {
      bot_id: input.bot_id,
      channel: input.channel,
      message_length: input.message.length,
      history_length: input.history_length,
      signal_counts: Object.fromEntries(signals.map((s) => [s.signal, s.count])),
      ...(input.capability_keys && input.capability_keys.length > 0
        ? { capability_keys: input.capability_keys }
        : {}),
    },
    context: { feature: 'bots' },
  };
}

/**
 * Der Enforcement-Punkt. Einmal geschrieben, von allen drei Kanälen benutzt.
 *
 * ## Ausfallverhalten
 *
 * In `enforce` sperrt ein Ausfall (fail closed). Das weicht vom allgemeinen
 * Vorschlag aus E2 ab (durchlassen mit Alarm) und ist hier richtig: Eine
 * Bot-Antwort geht an einen Dritten hinaus und ist nicht zurückholbar —
 * dieselbe Überlegung wie beim Publish Gate. Wer das anders will, setzt
 * `BOT_PDP_ENFORCEMENT=shadow`; dann ist die Sperre aus, und das steht
 * ausdrücklich in der Betriebsart statt versteckt in einem `catch`.
 *
 * In `shadow` und `off` wird **nie** gesperrt. In `shadow` wird gerechnet
 * und protokolliert, in `off` gar nicht erst gefragt.
 */
export async function enforceBotMessage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  input: BotMessageInput,
): Promise<BotPepVerdict> {
  const mode = readBotPepMode();

  const hits = detectSignals(input.message);
  const signalNames = hits.map((h) => h.signal);

  if (mode === 'off') {
    return {
      allowed: true, mode, decision: null, reasons: [], matched_policy_ids: [],
      safe_reply: null, signals: signalNames,
    };
  }

  const classification = classifyFromSignals(hits);
  const request = botMessageToDecisionRequest(input, hits, classification);

  let decision: PdpDecision;
  let reasons: string[];
  let matchedIds: string[];
  let snapshotVersion: string;

  try {
    const result = await decide(admin, request);
    decision = result.decision;
    reasons = result.reasons.map((r) => r.text_de);
    matchedIds = result.matched_policy_ids;
    snapshotVersion = result.snapshot_version;
  } catch (e) {
    const detail = (e as Error)?.message ?? String(e);
    console.error(JSON.stringify({
      level: 'error', scope: 'bot_pdp_unavailable',
      tenant_id: input.tenant_id, bot_id: input.bot_id, channel: input.channel, error: detail,
    }));
    // Fail closed — aber nur, wo die Betriebsart das sagt.
    return {
      allowed: mode !== 'enforce',
      mode,
      decision: null,
      reasons: [`Richtlinienprüfung nicht erreichbar: ${detail}`],
      matched_policy_ids: [],
      safe_reply: mode === 'enforce' ? BLOCKED_REPLY : null,
      signals: signalNames,
    };
  }

  if (mode === 'shadow') {
    // Mitrechnen und protokollieren, aber nicht anwenden.
    //
    // Bewusst OHNE `.catch(() => {})`: `logShadowComparison` faengt seine
    // Fehler selbst und protokolliert sie. Ein zusaetzlicher stiller Fang
    // hier hat in P2-3 dazu gefuehrt, dass der Beobachtungsbetrieb gar
    // nichts sammelte, ohne dass es jemandem auffiel.
    await logShadowComparison(admin, {
      tenant_id: input.tenant_id,
      source: input.channel,
      // Vor P2-5 hat auf diesen Kanaelen keine Engine entschieden. `null`
      // sagt das; 'allow' wuerde eine Entscheidung behaupten, die niemand
      // getroffen hat.
      legacy_status: null,
      v2_status: decision,
      snapshot_version: snapshotVersion,
      detail: {
        bot_id: input.bot_id,
        channel: input.channel,
        matched_policy_ids: matchedIds,
        signals: signalNames,
      },
    });
    return {
      allowed: true, mode, decision, reasons, matched_policy_ids: matchedIds,
      safe_reply: null, signals: signalNames,
    };
  }

  // ── enforce ────────────────────────────────────────────────────────
  //
  // `require_approval` sperrt hier wie `block`, und das ist eine Entscheidung,
  // keine Vereinfachung: Ein Web-Chat, WhatsApp und ein Telefonat sind
  // synchron. Es gibt niemanden, der binnen Sekunden freigeben könnte. Die
  // ehrliche Umsetzung ist deshalb, die automatische Antwort zu unterlassen
  // und den Fall an einen Menschen zu verweisen — nicht, den Absender warten
  // zu lassen auf eine Freigabe, die in diesem Kanal nie kommt.
  const blocks = decision === 'block' || decision === 'require_approval';

  return {
    allowed: !blocks,
    mode,
    decision,
    reasons,
    matched_policy_ids: matchedIds,
    safe_reply: blocks ? BLOCKED_REPLY : null,
    signals: signalNames,
  };
}
