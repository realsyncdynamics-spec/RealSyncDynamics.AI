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
//     Zugriffskontrolle (fail-closed):
//       1. X-Twilio-Signature gegen TWILIO_AUTH_TOKEN über TWILIO_WEBHOOK_URL
//          (die bei Twilio hinterlegte öffentliche URL dieser Function).
//          Fehlt eines davon, wird jeder Aufruf abgewiesen.
//       2. Tenant und Bot kommen ausschließlich aus voice_number_bindings
//          über die angerufene Nummer (`To`). tenant_id/bot_id in Query oder
//          Body werden ignoriert — die kontrolliert der Aufrufer.
//
//  B) Generisch (application/json) — Test-/Integrationskanal für Mitglieder
//     Body: { tenant_id, bot_id, message, conversation_ref?, event?, duration_seconds? }
//     Verlangt ein Supabase-User-JWT; der Aufrufer muss Mitglied von
//     tenant_id sein (memberships). Antwortet mit JSON { ok, reply, conversation_id }.
//     event='hangup' mit duration_seconds bucht Minuten.
//
// verify_jwt = false (config.toml): Twilio ruft ohne JWT; Modus B prüft das
// JWT selbst.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { gateFeature, EntitlementError } from '../_shared/entitlements.ts';
import { recordUsage } from '../_shared/usage.ts';
import { runAiTool, AiInvokeError } from '../_shared/ai.ts';
import { enforceBotMessage } from '../_shared/pdp/botmessage.ts';
import { requireAuthAndTenant } from '../_shared/auth.ts';
import { verifyTwilioSignature } from '../_shared/twilio-signature.ts';
import { resolveVoiceNumberBinding } from '../_shared/voice-number-binding.ts';
import { runRestaurantConversationTurn } from '../_shared/restaurant-conversation.ts';
import {
  resolveBot, upsertConversation, insertMessage, loadRecentHistory,
  buildBotPrompt, BotError, type BotRow,
} from '../_shared/bots.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
// Öffentliche URL dieser Function, exakt wie bei Twilio hinterlegt (ohne
// Query). req.url ist hinter dem Supabase-Gateway nicht die signierte URL.
const TWILIO_WEBHOOK_URL = Deno.env.get('TWILIO_WEBHOOK_URL');

if (!TWILIO_AUTH_TOKEN || !TWILIO_WEBHOOK_URL) {
  console.error(JSON.stringify({
    level: 'warn',
    scope: 'bot_voice_webhook_startup',
    msg: 'TWILIO_AUTH_TOKEN or TWILIO_WEBHOOK_URL not set — Twilio requests are rejected (fail-closed).',
  }));
}

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
  contact: string | null = null,
): Promise<string> {
  await insertMessage(admin, bot, conversationId, 'user', userText, { metadata: { channel: 'voice' } });
  const history = await loadRecentHistory(admin, conversationId, 12);
  const prior = history.slice(0, -1);

  // ── Richtlinien des Mandanten (P2-5, PEP) ──────────────────────────
  //
  // Derselbe Aufruf wie in bot-chat und whatsapp-webhook. Im Sprachkanal
  // wiegt die Schranke am schwersten: `userText` ist ein Transkript, das
  // ungeprueft an das Modell ginge, und die Antwort wird vorgelesen —
  // gesagt ist gesagt.
  //
  // ACHTUNG, ZWEITE SCHRANKE: `apps/agent-runtime/src/voice-policy.ts`
  // entscheidet weiterhin eigenstaendig ueber Sprachkanal-WERKZEUGE
  // (Einwilligung, Kill-Switch, Rate-Limit) und ist dort inhaltlich reicher
  // als der PDP. Sie bleibt erste Schranke; dieser PEP liegt darueber und
  // ersetzt sie nicht.
  const verdict = await enforceBotMessage(admin, {
    tenant_id: bot.tenant_id,
    bot_id: bot.id,
    channel: 'bot-voice',
    message: userText,
    history_length: prior.length,
    capability_keys: Object.keys(bot.capabilities ?? {}),
  });

  if (!verdict.allowed) {
    await insertMessage(admin, bot, conversationId, 'assistant', verdict.safe_reply!, {
      metadata: {
        channel: 'voice', policy_blocked: true,
        policy_decision: verdict.decision, policy_reasons: verdict.reasons,
        policy_signals: verdict.signals,
      },
    });
    // Der Anrufer hoert den neutralen Satz — die Begruendung bleibt im
    // Pruefpfad. Stille waere hier das Schlechteste: Sie klingt wie ein
    // technischer Ausfall und ruft einen zweiten Anruf hervor.
    return verdict.safe_reply!;
  }

  const restaurantTurn = await runRestaurantConversationTurn(
    admin,
    bot,
    conversationId,
    userText,
    prior,
    { channel: 'voice', contact },
  );
  if (restaurantTurn) {
    await insertMessage(admin, bot, conversationId, 'assistant', restaurantTurn.reply, {
      runId: restaurantTurn.runId,
      inputTokens: restaurantTurn.inputTokens,
      outputTokens: restaurantTurn.outputTokens,
      costUsd: restaurantTurn.costUsd,
      metadata: restaurantTurn.metadata,
    });
    return restaurantTurn.reply;
  }

  const prompt = buildBotPrompt({ persona: bot.persona, config: bot.config, history: prior, userMessage: userText });
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

  try {
    // ── Modus A: Twilio (form-encoded) ──────────────────────────────────────
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(await req.text());
      const signedUrl = TWILIO_WEBHOOK_URL ? `${TWILIO_WEBHOOK_URL}${url.search}` : null;
      const signed = await verifyTwilioSignature(
        TWILIO_AUTH_TOKEN, signedUrl, params.entries(), req.headers.get('x-twilio-signature'),
      );
      if (!signed) {
        console.error(JSON.stringify({
          level: 'warn', scope: 'bot_voice_webhook_signature',
          configured: Boolean(TWILIO_AUTH_TOKEN && TWILIO_WEBHOOK_URL),
        }));
        return new Response('forbidden', { status: 403 });
      }

      const binding = await resolveVoiceNumberBinding(admin, params.get('To'), 'twilio');
      if (!binding) {
        return twiml('<Say language="de-DE">Diese Rufnummer ist derzeit nicht vergeben.</Say>');
      }
      const tenantId = binding.tenant_id;
      const callSid = params.get('CallSid') ?? '';
      const from = params.get('From') ?? '';
      const speech = (params.get('SpeechResult') ?? '').trim();
      const callStatus = params.get('CallStatus') ?? '';
      const callDuration = Number(params.get('CallDuration') ?? 0);

      const bot = await resolveBot(admin, binding.tenant_id, binding.bot_id);

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

      // Folge-Hits laufen wieder über die signierte URL; der Tenant wird dort
      // erneut aus der Nummer aufgelöst, nicht aus Parametern.
      const actionUrl = TWILIO_WEBHOOK_URL!;
      const conversationId = await upsertConversation(admin, bot, {
        channel: 'voice', externalRef: callSid || from || null, contactLabel: from || null,
      });

      // Kein SpeechResult → Begrüßung + erste Sammlung.
      if (!speech) {
        const greeting = bot.greeting?.trim() || `Hallo, hier ist ${bot.name}. Wie kann ich Ihnen helfen?`;
        return speakAndGather(actionUrl, greeting);
      }

      // SpeechResult vorhanden → Antwort generieren + erneut sammeln.
      const reply = await replyForVoice(admin, bot, conversationId, speech, from || null);
      return speakAndGather(actionUrl, reply);
    }

    // ── Modus B: Generisch (JSON) ───────────────────────────────────────────
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, 'BAD_REQUEST', 'invalid json body');
    }

    const auth = await requireAuthAndTenant(req, typeof body.tenant_id === 'string' ? body.tenant_id : null);
    if (auth instanceof Response) return auth;
    const tenantId = auth.tenantId;
    const botId = String(body.bot_id ?? '');
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

    const reply = await replyForVoice(admin, bot, conversationId, message, body.from ? String(body.from) : null);
    return jsonResponse({ ok: true, conversation_id: conversationId, reply });
  } catch (e) {
    if (e instanceof BotError)      return jsonError(e.status, e.code, e.message);
    if (e instanceof AiInvokeError) return jsonError(e.status, e.code, e.message, undefined, e.details);
    if (e instanceof EntitlementError) return jsonError(403, e.code, e.message);
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});
