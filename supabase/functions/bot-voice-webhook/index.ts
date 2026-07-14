// bot-voice-webhook — Telefonie-Webhook für Konversations-Bots.
//
// Unterstützt zwei Modi:
//
//  A) Twilio (application/x-www-form-urlencoded)
//     Antwortet mit TwiML. Beim ersten Hit (kein SpeechResult) wird der
//     Greeting gesprochen und per <Gather input="speech"> auf Spracheingabe
//     gewartet; das action-Attribut zeigt zurück auf diesen Webhook. Bei
//     Folge-Hits (SpeechResult vorhanden) wird die Bot-Antwort gesprochen und
//     erneut gesammelt. CallSid dient als conversation_ref.
//     Beim Status-Callback (CallStatus=completed, CallDuration gesetzt) werden
//     Minuten auf limit.bot_voice_minutes_monthly gebucht.
//
//  B) Generisch (application/json)
//     Body: { tenant_id, bot_id, message, conversation_ref?, event?, duration_seconds? }
//     Antwortet mit JSON { ok, reply, conversation_id }. event='hangup' mit
//     duration_seconds bucht Minuten.
//
// Tenant/Bot werden via Query-Parameter (?tenant_id=…&bot_id=…) ODER im Body
// übergeben. verify_jwt = false.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { gateFeature, EntitlementError } from '../_shared/entitlements.ts';
import { recordUsage } from '../_shared/usage.ts';
import { runAiTool, AiInvokeError } from '../_shared/ai.ts';
import {
  resolveBot, upsertConversation, insertMessage, loadRecentHistory,
  buildBotPrompt, BotError, type BotRow,
} from '../_shared/bots.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function twiml(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<Response>${body}</Response>`, {
    status: 200,
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
}

/** TwiML, das den Text spricht und erneut auf Spracheingabe wartet. */
function speakAndGather(actionUrl: string, text: string): Response {
  return twiml(
    `<Gather input="speech" language="de-DE" speechTimeout="auto" method="POST" action="${xmlEscape(actionUrl)}">` +
    `<Say language="de-DE">${xmlEscape(text)}</Say>` +
    `</Gather>` +
    `<Say language="de-DE">Ich habe nichts gehört. Auf Wiederhören.</Say>`,
  );
}

/** Generiert eine Bot-Antwort und persistiert User- + Assistant-Nachricht. */
async function replyForVoice(
  admin: ReturnType<typeof createClient>,
  bot: BotRow,
  conversationId: string,
  userText: string,
): Promise<string> {
  await insertMessage(admin, bot, conversationId, 'user', userText, { metadata: { channel: 'voice' } });
  const history = await loadRecentHistory(admin, conversationId, 12);
  const prior = history.slice(0, -1);
  const prompt = buildBotPrompt({ persona: bot.persona, history: prior, userMessage: userText });
  const ai = await runAiTool(admin, bot.tenant_id, null, 'bot_reply', prompt, {
    metadata: { bot_id: bot.id, conversation_id: conversationId, channel: 'voice' },
  });
  await insertMessage(admin, bot, conversationId, 'assistant', ai.output, {
    runId: ai.runId, inputTokens: ai.inputTokens, outputTokens: ai.outputTokens, costUsd: ai.costUsd,
    metadata: { channel: 'voice', duration_ms: ai.durationMs },
  });
  return ai.output;
}

/** Bucht Telefonie-Minuten (aufgerundet) auf das Monats-Kontingent. */
async function meterMinutes(
  admin: ReturnType<typeof createClient>,
  bot: BotRow,
  durationSeconds: number,
  ref: string | null,
): Promise<void> {
  const minutes = Math.max(1, Math.ceil(durationSeconds / 60));
  // recordUsage ist non-throwing-by-Konvention für bereits verbrauchte
  // Ressourcen — der Anruf ist gelaufen, wir verlieren die Nutzung nicht.
  await recordUsage(admin, bot.tenant_id, 'limit.bot_voice_minutes_monthly', minutes, {
    bot_id: bot.id, call_ref: ref, duration_seconds: durationSeconds,
  });
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED', 'POST only');

  const url = new URL(req.url);
  const contentType = req.headers.get('content-type') ?? '';
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // Query-Parameter als Fallback für tenant_id/bot_id (Twilio-Number-Mapping).
  const qTenant = url.searchParams.get('tenant_id');
  const qBot = url.searchParams.get('bot_id');

  try {
    // ── Modus A: Twilio (form-encoded) ──────────────────────────────────────
    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const tenantId = qTenant ?? String(form.get('tenant_id') ?? '');
      const botId = qBot ?? String(form.get('bot_id') ?? '');
      const callSid = String(form.get('CallSid') ?? '');
      const from = String(form.get('From') ?? '');
      const speech = String(form.get('SpeechResult') ?? '').trim();
      const callStatus = String(form.get('CallStatus') ?? '');
      const callDuration = Number(form.get('CallDuration') ?? 0);

      const bot = await resolveBot(admin, tenantId, botId);

      // Status-Callback am Anrufende → Minuten buchen, leeres TwiML zurück.
      if (callStatus === 'completed' && callDuration > 0) {
        await meterMinutes(admin, bot, callDuration, callSid || from || null);
        return twiml('');
      }

      try {
        await gateFeature(admin, tenantId, 'bots.voice');
      } catch (e) {
        if (e instanceof EntitlementError) {
          return twiml('<Say language="de-DE">Dieser Dienst ist derzeit nicht verfügbar.</Say>');
        }
        throw e;
      }

      const actionUrl = `${url.origin}${url.pathname}?tenant_id=${encodeURIComponent(tenantId)}&bot_id=${encodeURIComponent(botId)}`;
      const conversationId = await upsertConversation(admin, bot, {
        channel: 'voice', externalRef: callSid || from || null, contactLabel: from || null,
      });

      // Kein SpeechResult → Begrüßung + erste Sammlung.
      if (!speech) {
        const greeting = bot.greeting?.trim() || `Hallo, hier ist ${bot.name}. Wie kann ich Ihnen helfen?`;
        return speakAndGather(actionUrl, greeting);
      }

      // SpeechResult vorhanden → Antwort generieren + erneut sammeln.
      const reply = await replyForVoice(admin, bot, conversationId, speech);
      return speakAndGather(actionUrl, reply);
    }

    // ── Modus B: Generisch (JSON) ───────────────────────────────────────────
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, 'BAD_REQUEST', 'invalid json body');
    }

    const tenantId = qTenant ?? String(body.tenant_id ?? '');
    const botId = qBot ?? String(body.bot_id ?? '');
    const bot = await resolveBot(admin, tenantId, botId);

    const event = String(body.event ?? 'message');
    const conversationRef = body.conversation_ref ? String(body.conversation_ref) : null;

    if (event === 'hangup') {
      const durationSeconds = Number(body.duration_seconds ?? 0);
      if (durationSeconds > 0) await meterMinutes(admin, bot, durationSeconds, conversationRef);
      return jsonResponse({ ok: true, metered: durationSeconds > 0 });
    }

    try {
      await gateFeature(admin, tenantId, 'bots.voice');
    } catch (e) {
      if (e instanceof EntitlementError) return jsonError(403, e.code, e.message);
      throw e;
    }

    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const conversationId = await upsertConversation(admin, bot, {
      channel: 'voice', externalRef: conversationRef, contactLabel: body.from ? String(body.from) : null,
    });

    if (!message) {
      const greeting = bot.greeting?.trim() || `Hallo, hier ist ${bot.name}. Wie kann ich Ihnen helfen?`;
      return jsonResponse({ ok: true, conversation_id: conversationId, reply: greeting, greeting: true });
    }

    const reply = await replyForVoice(admin, bot, conversationId, message);
    return jsonResponse({ ok: true, conversation_id: conversationId, reply });
  } catch (e) {
    if (e instanceof BotError)      return jsonError(e.status, e.code, e.message);
    if (e instanceof AiInvokeError) return jsonError(e.status, e.code, e.message, undefined, e.details);
    if (e instanceof EntitlementError) return jsonError(403, e.code, e.message);
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});
