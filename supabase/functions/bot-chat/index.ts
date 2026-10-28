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
//   0. Rate-Limit je IP-Hash (DB-Zähler, vor jedem Bot-Lookup)
//   1. Bot auflösen (tenant + enabled)            resolveBot
//      Origin-Prüfung (nur Zusatzhürde, falls config.allowed_origins gesetzt)
//      Rate-Limit je IP+Bot und je Bot
//   2. Feature-Gate                               bots.enabled
//   3. Bestehenden Verlauf lesend laden, Bot-PEP pruefen (ohne Speichern)
//   4. Nur bei erlaubter Nachricht: Monats-Quota pruefen + zaehlen
//   5. Konversation/Nachricht speichern, KI aufrufen — vorher wird der
//      Höchstbetrag atomar gegen das Tages-/Monatsbudget des Mandanten
//      reserviert (bot-budget.ts). Ablehnung → 429, kein KI-Aufruf.
//   6. Antwort persistieren + zurueckgeben
//
// verify_jwt = false (config.toml). Zugriff über (tenant_id, bot_id).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError, methodNotAllowed } from '../_shared/gateway.ts';
import { gateFeature, EntitlementError } from '../_shared/entitlements.ts';
import { consumeUsage, UsageError } from '../_shared/usage.ts';
import { runAiTool, AiInvokeError } from '../_shared/ai.ts';
import {
  resolveBot, findExistingConversationId, upsertConversation, insertMessage, loadRecentHistory,
  buildBotPrompt, BotError,
} from '../_shared/bots.ts';
import { enforceBotMessage } from '../_shared/pdp/botmessage.ts';
import { runRestaurantConversationTurn } from '../_shared/restaurant-conversation.ts';
import {
  checkBotRateLimit, checkIpRateLimit, clientIpFromHeaders, createBotAiBudgetGuard,
  hashClientIp, originAllowed,
} from '../_shared/bot-budget.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MAX_MESSAGE_CHARS = 4000;
// Schlüssel für den IP-Hash. Eigenes Secret bevorzugt; sonst serverseitig
// aus dem Service-Role-Key abgeleitet (verlässt die Function nie).
const RATE_LIMIT_SECRET = Deno.env.get('BOT_RATE_LIMIT_SALT') || SERVICE_ROLE;

function rateLimited(scope: string): Response {
  const status = scope === 'unavailable' ? 503 : 429;
  const code = scope === 'unavailable' ? 'RATE_LIMIT_UNAVAILABLE' : 'RATE_LIMITED';
  const res = jsonError(status, code, 'Zu viele Anfragen. Bitte kurz warten und erneut versuchen.');
  if (status === 429) res.headers.set('Retry-After', '60');
  return res;
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

  const tenantId = String(body.tenant_id ?? '');
  const botId = String(body.bot_id ?? '');
  const message = typeof body.message === 'string' ? body.message : '';
  const conversationRef = body.conversation_ref ? String(body.conversation_ref) : null;
  const contactLabel = body.contact_label ? String(body.contact_label) : null;

  if (!message.trim()) return jsonError(400, 'BAD_REQUEST', 'message required');
  if (message.length > MAX_MESSAGE_CHARS) {
    return jsonError(400, 'BAD_REQUEST', `message too long (>${MAX_MESSAGE_CHARS} chars)`);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // Rate-Limit vor jedem weiteren DB-Zugriff. Fail-closed: Ist der Zähler
  // nicht erreichbar, wird die Anfrage abgelehnt.
  const ipHash = await hashClientIp(clientIpFromHeaders(req.headers), RATE_LIMIT_SECRET, new Date());
  const ipDecision = await checkIpRateLimit(admin, ipHash);
  if (!ipDecision.allowed) return rateLimited(ipDecision.scope);

  try {
    const bot = await resolveBot(admin, tenantId, botId);

    if (!originAllowed(req.headers.get('origin'), bot.config)) {
      return jsonError(403, 'ORIGIN_NOT_ALLOWED', 'origin not allowed for this bot');
    }
    const botDecision = await checkBotRateLimit(admin, ipHash, bot.id);
    if (!botDecision.allowed) return rateLimited(botDecision.scope);

    // Feature-Gate: Tenant-Plan muss Bots freigeschaltet haben.
    try {
      await gateFeature(admin, tenantId, 'bots.enabled');
    } catch (e) {
      if (e instanceof EntitlementError) return jsonError(403, e.code, e.message);
      throw e;
    }

    // Read-only lookup first: denied requests must not create or modify
    // conversation rows, bot messages or contact labels.
    const existingConversationId = await findExistingConversationId(
      admin, bot, conversationRef,
    );
    const priorHistory = existingConversationId
      ? await loadRecentHistory(admin, existingConversationId, 12)
      : [];

    // Shared Bot-PEP decides before ANY conversation persistence, quota
    // consumption or inference. The PDP sees signal names, not raw text.
    const verdict = await enforceBotMessage(admin, {
      tenant_id: tenantId,
      bot_id: bot.id,
      channel: 'bot-chat',
      message,
      history_length: priorHistory.length,
      capability_keys: Object.keys(bot.capabilities ?? {}),
    });

    if (!verdict.allowed) {
      // Do not persist refused user text or a synthetic assistant message.
      // Existing conversation IDs may be returned without modifying state.
      return jsonResponse({
        ok: true,
        conversation_id: existingConversationId,
        reply: verdict.safe_reply,
        run_id: null,
        policy_blocked: true,
      });
    }

    // Billable quota and storage only after the content is permitted.
    try {
      await consumeUsage(admin, tenantId, 'limit.bot_messages_monthly', 1, { bot_id: bot.id });
    } catch (e) {
      if (e instanceof UsageError) {
        return jsonError(e.code === 'QUOTA_EXCEEDED' ? 402 : 500, e.code, e.message, undefined, e.details);
      }
      throw e;
    }

    const conversationId = await upsertConversation(admin, bot, {
      channel: 'chat', externalRef: conversationRef, contactLabel,
    });
    await insertMessage(admin, bot, conversationId, 'user', message.trim());

    const aiBudget = createBotAiBudgetGuard(admin, { tenantId, botId: bot.id, channel: 'chat' });

    const restaurantTurn = await runRestaurantConversationTurn(
      admin,
      bot,
      conversationId,
      message,
      priorHistory,
      { channel: 'chat', contact: contactLabel, aiBudget },
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
      budget: aiBudget,
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
    });
  } catch (e) {
    if (e instanceof BotError)      return jsonError(e.status, e.code, e.message);
    if (e instanceof AiInvokeError) {
      // Budget erschöpft: neutrale Meldung, keine internen Zahlen an Besucher.
      if (e.code === 'BOT_BUDGET_EXCEEDED') {
        return jsonError(429, e.code, 'Der Assistent ist gerade nicht verfügbar. Bitte später erneut versuchen.');
      }
      return jsonError(e.status, e.code, e.message, undefined, e.details);
    }
    if (e instanceof EntitlementError) return jsonError(403, e.code, e.message);
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});
