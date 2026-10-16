// bot-chat — öffentlicher Chat-Endpoint für Konversations-Bots.
//
// POST /functions/v1/bot-chat
// Body: {
//   tenant_id: string,
//   bot_id: string,
//   message: string,
//   conversation_ref?: string,   // Web-Session-ID o.ä.; ohne ref → neue Konversation
//   contact_label?: string
// }
//
// Ablauf:
//   0. Eingaben prüfen, Bremse je Quelle           parseBotChatInput, checkAnonRateLimit
//   1. Bot auflösen (tenant + enabled)            resolveBot
//   2. Herkunft gegen config.allowed_origins      decideOrigin
//   3. Feature-Gate                               bots.enabled
//   4. Takt je Mandant und Konversation           bot_messages der letzten Minute
//   5. Monats-Quota prüfen + zählen               limit.bot_messages_monthly
//   6. User-Nachricht persistieren, Richtlinien, AI aufrufen, Antwort speichern
//
// verify_jwt = false (config.toml). Zugriff über (tenant_id, bot_id) plus die
// Schranken aus `_shared/bot-chat-guard.ts`. Abgelehnte Anfragen verbuchen
// weder Kontingent noch Modellkosten — alle Schranken stehen vor Schritt 5.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError, methodNotAllowed } from '../_shared/gateway.ts';
import { gateFeature, EntitlementError } from '../_shared/entitlements.ts';
import { consumeUsage, UsageError } from '../_shared/usage.ts';
import { runAiTool, AiInvokeError } from '../_shared/ai.ts';
import {
  resolveBot, upsertConversation, insertMessage, loadRecentHistory,
  buildBotPrompt, BotError,
} from '../_shared/bots.ts';
import { enforceBotMessage } from '../_shared/pdp/botmessage.ts';
import { runRestaurantConversationTurn } from '../_shared/restaurant-conversation.ts';
import { sha256Hex } from '../_shared/hash.ts';
import { checkAnonRateLimit } from '../_shared/anonRateLimit.ts';
import {
  SOURCE_REQUESTS_PER_MINUTE, decideOrigin, exceededScope, parseBotChatInput,
} from '../_shared/bot-chat-guard.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function rateLimited(scope: string): Response {
  return new Response(
    JSON.stringify({ ok: false, error: { code: 'RATE_LIMITED', message: 'Zu viele Nachrichten. Bitte kurz warten.', details: { scope } } }),
    { status: 429, headers: { ...corsHeaders, 'content-type': 'application/json', 'retry-after': '60' } },
  );
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return methodNotAllowed();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json body');
  }

  const input = parseBotChatInput(body);
  if (!input.ok) return jsonError(400, 'BAD_REQUEST', input.message);
  const { tenantId, botId, message, conversationRef, contactLabel } = input.value;

  // Bremse je Quelle — vor jedem Datenbankzugriff. Nur im Arbeitsspeicher
  // (siehe anonRateLimit.ts); die belastbare Grenze ist der Takt unten.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const source = checkAnonRateLimit(await sha256Hex(ip), {
    bucket: 'bot-chat', max: SOURCE_REQUESTS_PER_MINUTE, windowMs: 60_000,
  });
  if (!source.allowed) return rateLimited('source');

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  try {
    const bot = await resolveBot(admin, tenantId, botId);

    const origin = decideOrigin(req.headers.get('origin'), bot.config);
    if (!origin.allowed) return jsonError(403, 'ORIGIN_NOT_ALLOWED', 'Dieser Bot ist für diese Website nicht freigegeben.');

    // Feature-Gate: Tenant-Plan muss Bots freigeschaltet haben.
    try {
      await gateFeature(admin, tenantId, 'bots.enabled');
    } catch (e) {
      if (e instanceof EntitlementError) return jsonError(403, e.code, e.message);
      throw e;
    }

    // Takt aus der Datenbank: über Isolate und Kaltstarts hinweg gültig.
    const since = new Date(Date.now() - 60_000).toISOString();
    const tenantRecent = await admin.from('bot_messages')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('role', 'user').gte('created_at', since);
    if (tenantRecent.error) throw new Error(tenantRecent.error.message);

    const conversationId = await upsertConversation(admin, bot, {
      channel: 'chat', externalRef: conversationRef, contactLabel,
    });
    const conversationRecent = await admin.from('bot_messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId).eq('role', 'user').gte('created_at', since);
    if (conversationRecent.error) throw new Error(conversationRecent.error.message);

    const exceeded = exceededScope({
      conversation: conversationRecent.count ?? 0,
      tenant: tenantRecent.count ?? 0,
    });
    if (exceeded) return rateLimited(exceeded);

    // Monats-Quota prüfen + zählen (vor dem AI-Aufruf).
    try {
      await consumeUsage(admin, tenantId, 'limit.bot_messages_monthly', 1, { bot_id: bot.id });
    } catch (e) {
      if (e instanceof UsageError) {
        return jsonError(e.code === 'QUOTA_EXCEEDED' ? 402 : 500, e.code, e.message, undefined, e.details);
      }
      throw e;
    }

    await insertMessage(admin, bot, conversationId, 'user', message.trim());

    const history = await loadRecentHistory(admin, conversationId, 12);
    // Die zuletzt eingefügte User-Nachricht ist bereits Teil von `history`;
    // entferne sie, damit sie nicht doppelt im Prompt landet.
    const priorHistory = history.slice(0, -1);

    // ── Richtlinien des Mandanten (P2-5, PEP) ───────────────────────
    //
    // Vor dem Modellaufruf: Danach ist das Geld ausgegeben und die Antwort
    // erzeugt. Der Nachrichtentext verlaesst diesen Prozess nicht — an den
    // PDP gehen nur Signalnamen (siehe _shared/pdp/botmessage.ts).
    const verdict = await enforceBotMessage(admin, {
      tenant_id: tenantId,
      bot_id: bot.id,
      channel: 'bot-chat',
      message,
      history_length: priorHistory.length,
      capability_keys: Object.keys(bot.capabilities ?? {}),
    });

    if (!verdict.allowed) {
      // Der Sperrgrund geht in den Pruefpfad, NICHT an den Absender: Er ist
      // Kunde des Mandanten, nicht der Mandant. Ihm die Regel zu nennen,
      // gaebe interne Richtlinien an einen Dritten preis.
      await insertMessage(admin, bot, conversationId, 'assistant', verdict.safe_reply!, {
        metadata: {
          channel: 'chat', policy_blocked: true,
          policy_decision: verdict.decision, policy_reasons: verdict.reasons,
          policy_signals: verdict.signals,
        },
      });
      return jsonResponse({
        ok: true,
        conversation_id: conversationId,
        reply: verdict.safe_reply,
        run_id: null,
        policy_blocked: true,
      });
    }

    const restaurantTurn = await runRestaurantConversationTurn(
      admin,
      bot,
      conversationId,
      message,
      priorHistory,
      { channel: 'chat', contact: contactLabel },
    );
    if (restaurantTurn) {
      await insertMessage(admin, bot, conversationId, 'assistant', restaurantTurn.reply, {
        runId: restaurantTurn.runId,
        inputTokens: restaurantTurn.inputTokens,
        outputTokens: restaurantTurn.outputTokens,
        costUsd: restaurantTurn.costUsd,
        metadata: restaurantTurn.metadata,
      });
      return jsonResponse({
        ok: true,
        conversation_id: conversationId,
        reply: restaurantTurn.reply,
        run_id: restaurantTurn.runId,
        ...(restaurantTurn.orderId ? { order_id: restaurantTurn.orderId } : {}),
      });
    }

    const prompt = buildBotPrompt({ persona: bot.persona, config: bot.config, history: priorHistory, userMessage: message });

    const ai = await runAiTool(admin, tenantId, null, 'bot_reply', prompt, {
      metadata: { bot_id: bot.id, conversation_id: conversationId, channel: 'chat' },
    });

    await insertMessage(admin, bot, conversationId, 'assistant', ai.output, {
      runId: ai.runId,
      inputTokens: ai.inputTokens,
      outputTokens: ai.outputTokens,
      costUsd: ai.costUsd,
      metadata: { duration_ms: ai.durationMs },
    });

    return jsonResponse({
      ok: true,
      conversation_id: conversationId,
      reply: ai.output,
      run_id: ai.runId,
      origin_unrestricted: !origin.restricted,
    });
  } catch (e) {
    if (e instanceof BotError)      return jsonError(e.status, e.code, e.message);
    if (e instanceof AiInvokeError) return jsonError(e.status, e.code, e.message, undefined, e.details);
    if (e instanceof EntitlementError) return jsonError(403, e.code, e.message);
    // Interne Fehlertexte (Tabellen, Constraints) gehen ins Log, nicht an
    // einen anonymen Aufrufer.
    console.error(JSON.stringify({ level: 'error', scope: 'bot_chat_failed', error: (e as Error)?.message }));
    return jsonError(500, 'INTERNAL', 'Die Nachricht konnte gerade nicht verarbeitet werden.');
  }
});
