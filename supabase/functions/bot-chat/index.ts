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
//   1. Bot auflösen (tenant + enabled)            resolveBot
//   2. Feature-Gate                               bots.enabled
//   3. Monats-Quota prüfen + zählen               limit.bot_messages_monthly
//   4. Konversation upserten + User-Nachricht persistieren
//   5. Verlauf laden, Prompt bauen, AI aufrufen   runAiTool('bot_reply')
//   6. Antwort persistieren + zurückgeben
//
// verify_jwt = false (config.toml). Zugriff über (tenant_id, bot_id).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError, methodNotAllowed } from '../_shared/gateway.ts';
import { gateFeature, EntitlementError } from '../_shared/entitlements.ts';
import { consumeUsage, UsageError } from '../_shared/usage.ts';
import { runAiTool, AiInvokeError } from '../_shared/ai.ts';
import {
  resolveBot, upsertConversation, insertMessage, loadRecentHistory,
  buildBotPrompt, BotError,
} from '../_shared/bots.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MAX_MESSAGE_CHARS = 4000;

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

  try {
    const bot = await resolveBot(admin, tenantId, botId);

    // Feature-Gate: Tenant-Plan muss Bots freigeschaltet haben.
    try {
      await gateFeature(admin, tenantId, 'bots.enabled');
    } catch (e) {
      if (e instanceof EntitlementError) return jsonError(403, e.code, e.message);
      throw e;
    }

    // Monats-Quota prüfen + zählen (vor dem AI-Aufruf).
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

    const history = await loadRecentHistory(admin, conversationId, 12);
    // Die zuletzt eingefügte User-Nachricht ist bereits Teil von `history`;
    // entferne sie, damit sie nicht doppelt im Prompt landet.
    const priorHistory = history.slice(0, -1);

    const prompt = buildBotPrompt({ persona: bot.persona, history: priorHistory, userMessage: message });

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
    });
  } catch (e) {
    if (e instanceof BotError)      return jsonError(e.status, e.code, e.message);
    if (e instanceof AiInvokeError) return jsonError(e.status, e.code, e.message, undefined, e.details);
    if (e instanceof EntitlementError) return jsonError(403, e.code, e.message);
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});
