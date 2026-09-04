// whatsapp-webhook — WhatsApp-Business-Kanal für Konversations-Bots.
//
// Meta WhatsApp Business Cloud API:
//
//  GET  /functions/v1/whatsapp-webhook
//       Verifizierungs-Handshake beim Einrichten des Webhooks in der Meta App:
//       hub.mode=subscribe + hub.verify_token (WHATSAPP_VERIFY_TOKEN) →
//       hub.challenge wird zurückgegeben.
//
//  POST /functions/v1/whatsapp-webhook
//       Eingehende Nachrichten. Signaturprüfung über X-Hub-Signature-256
//       (HMAC-SHA256 mit WHATSAPP_APP_SECRET über den Roh-Body). Ablauf je
//       Textnachricht:
//         1. whatsapp_channels: phone_number_id → (tenant_id, bot_id)
//         2. resolveBot (Tenant-Zugehörigkeit + enabled)
//         3. Feature-Gate bots.whatsapp
//         4. Quota limit.bot_messages_monthly (gleiches Kontingent wie Chat)
//         5. Konversation (external_ref = Absender-WA-ID) + Nachricht persistieren;
//            neue Konversation → limit.whatsapp_conversations_monthly buchen
//         6. Richtlinienpruefung durch den PDP (P2-5, evaluateBotPolicy) —
//            derselbe PEP wie Web-Chat und Telefonie, damit dieselbe Regel
//            in jedem Kanal dasselbe bedeutet
//         7. Antwort via runAiTool('bot_reply'), Versand über die Graph API
//
// WICHTIG: Auf POST immer 200 OK zurückgeben — sonst wiederholt Meta die
// Zustellung. Secrets dürfen NICHT in Logs erscheinen. verify_jwt = false
// (config.toml): Meta ruft ohne Supabase-JWT auf; die Zugriffskontrolle
// läuft über Signatur + phone_number_id-Mapping.
//
// EU-AI-Act-Bezug (Art. 50 Transparenz): Antworten laufen über dieselbe
// bot_reply-Pipeline wie der Website-Chat — jede Antwort landet mit Run-ID
// im Prüfpfad (bot_messages + ai_tool_runs). DSGVO: Es wird nur gespeichert,
// was für den Gesprächsverlauf nötig ist (WA-ID, Anzeigename, Text).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { gateFeature, EntitlementError } from '../_shared/entitlements.ts';
import { consumeUsage, recordUsage, UsageError } from '../_shared/usage.ts';
import { runAiTool } from '../_shared/ai.ts';
import { audit } from '../_shared/auditLog.ts';
import { enforceBotMessage } from '../_shared/pdp/botmessage.ts';
import {
  resolveBot, upsertConversation, insertMessage, loadRecentHistory,
  buildBotPrompt, type BotRow,
} from '../_shared/bots.ts';
import { extractInboundTextMessages, buildGraphTextMessage } from '../_shared/whatsapp.ts';
import { evaluateBotPolicy } from '../_shared/bots-pep.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN');
const APP_SECRET = Deno.env.get('WHATSAPP_APP_SECRET');
const ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
const GRAPH_BASE = Deno.env.get('WHATSAPP_GRAPH_BASE') ?? 'https://graph.facebook.com/v20.0';

if (!APP_SECRET) {
  // Ohne App-Secret ist der Webhook spoofbar — beim Start laut warnen.
  console.error(JSON.stringify({
    level: 'warn',
    scope: 'whatsapp_webhook_startup',
    msg: 'WHATSAPP_APP_SECRET not set — webhook signature is not verified. Configure the Meta app secret.',
  }));
}

// --- Signaturprüfung (X-Hub-Signature-256) --------------------------------

async function verifySignature(rawBody: string, header: string | null): Promise<boolean> {
  if (!APP_SECRET) return true; // nicht konfiguriert → Warnung beim Start, kein Blockieren
  if (!header || !header.startsWith('sha256=')) return false;
  const expectedHex = header.slice('sha256='.length).toLowerCase();

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(APP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const actualHex = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, '0')).join('');

  // Konstante Vergleichszeit — kein frühes Abbrechen auf ungleichen Bytes.
  if (actualHex.length !== expectedHex.length) return false;
  let diff = 0;
  for (let i = 0; i < actualHex.length; i++) diff |= actualHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  return diff === 0;
}

// --- Graph API ------------------------------------------------------------

async function sendWhatsAppText(phoneNumberId: string, to: string, text: string): Promise<void> {
  if (!ACCESS_TOKEN) {
    console.error(JSON.stringify({ level: 'error', scope: 'whatsapp_send', msg: 'WHATSAPP_ACCESS_TOKEN not set' }));
    return;
  }
  try {
    const res = await fetch(`${GRAPH_BASE}/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify(buildGraphTextMessage(to, text)),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      // Nur Statuscode + Meta-Fehlertext loggen — niemals Tokens.
      console.error(JSON.stringify({
        level: 'warn', scope: 'whatsapp_send_failed', status: res.status,
        error: (err as { error?: { message?: string } })?.error?.message,
      }));
    }
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', scope: 'whatsapp_send_exception', msg: (e as Error)?.message }));
  }
}

// --- Kanal-Auflösung ------------------------------------------------------

interface WhatsAppChannelRow {
  id: string;
  tenant_id: string;
  bot_id: string;
  phone_number_id: string;
  greeting: string | null;
  is_active: boolean;
}

async function resolveChannel(
  admin: ReturnType<typeof createClient>,
  phoneNumberId: string,
): Promise<WhatsAppChannelRow | null> {
  const { data, error } = await admin
    .from('whatsapp_channels')
    .select('id, tenant_id, bot_id, phone_number_id, greeting, is_active')
    .eq('phone_number_id', phoneNumberId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) {
    console.error(JSON.stringify({ level: 'error', scope: 'whatsapp_channel_lookup', error: error.message }));
    return null;
  }
  return (data as WhatsAppChannelRow | null) ?? null;
}

// --- Nachrichtenverarbeitung ----------------------------------------------

async function handleInbound(
  admin: ReturnType<typeof createClient>,
  channel: WhatsAppChannelRow,
  bot: BotRow,
  msg: { from: string; waMessageId: string; text: string; contactName: string | null },
): Promise<void> {
  // Dedupe: Meta stellt bei langsamen Antworten erneut zu. Eine bereits
  // persistierte wa_message_id wird nicht noch einmal beantwortet.
  const { data: dupe } = await admin
    .from('bot_messages')
    .select('id')
    .eq('tenant_id', bot.tenant_id)
    .contains('metadata', { wa_message_id: msg.waMessageId })
    .limit(1)
    .maybeSingle();
  if (dupe) return;

  // Monats-Quota (gemeinsames Kontingent mit dem Website-Chat) — vor dem AI-Aufruf.
  try {
    await consumeUsage(admin, bot.tenant_id, 'limit.bot_messages_monthly', 1, {
      bot_id: bot.id, channel: 'whatsapp',
    });
  } catch (e) {
    if (e instanceof UsageError && e.code === 'QUOTA_EXCEEDED') {
      await sendWhatsAppText(
        channel.phone_number_id,
        msg.from,
        'Dieser Assistent hat sein monatliches Kontingent erreicht. Bitte versuchen Sie es später erneut.',
      );
      return;
    }
    throw e;
  }

  // Konversation je Absender; neue Konversation zählt auf das
  // WhatsApp-Konversationskontingent (Metas Abrechnungseinheit).
  const { data: existing } = await admin
    .from('bot_conversations')
    .select('id')
    .eq('bot_id', bot.id)
    .eq('external_ref', msg.from)
    .maybeSingle();

  const conversationId = await upsertConversation(admin, bot, {
    channel: 'whatsapp', externalRef: msg.from, contactLabel: msg.contactName ?? msg.from,
  });
  if (!existing) {
    // recordUsage ist non-throwing-by-Konvention: die Konversation läuft bereits.
    await recordUsage(admin, bot.tenant_id, 'limit.whatsapp_conversations_monthly', 1, {
      bot_id: bot.id, conversation_id: conversationId,
    });
  }

  await insertMessage(admin, bot, conversationId, 'user', msg.text, {
    metadata: { channel: 'whatsapp', wa_message_id: msg.waMessageId },
  });

  // P2-5 — Richtlinienpruefung vor dem Modellaufruf. Weder der
  // Nachrichtentext noch die WhatsApp-ID des Absenders verlassen den
  // Prozess; an den PDP gehen nur Merkmale (_shared/pdp/botmessage.ts).
  //
  // Der Kanal ist Enforcement-Klasse A, und hier zeigt sich, warum das
  // zaehlt: Eine gesendete WhatsApp-Nachricht ist nicht zurueckholbar.
  // Deshalb ist das Ausfallverhalten fail-closed (BOT_PDP_FAILURE_MODE).
  const policy = await evaluateBotPolicy(admin, {
    tenantId: bot.tenant_id, botId: bot.id, conversationId,
    channel: 'whatsapp', message: msg.text,
  });
  if (!policy.mayAnswer) {
    await insertMessage(admin, bot, conversationId, 'assistant', policy.refusal!, {
      metadata: { channel: 'whatsapp', refused: true, wa_message_id: msg.waMessageId, ...policy.trail },
    });
    await sendWhatsAppText(channel.phone_number_id, msg.from, policy.refusal!);
    await audit(admin, {
      tenant_id: bot.tenant_id,
      actor_user_id: '00000000-0000-0000-0000-000000000000',
      actor_email: null,
      action: 'whatsapp.message_refused',
      target_type: 'bot_conversation',
      target_id: conversationId,
      payload: {
        source: 'whatsapp', bot_id: bot.id, wa_message_id: msg.waMessageId, ...policy.trail,
      },
    });
    return;
  }

  const history = await loadRecentHistory(admin, conversationId, 12);
  const prior = history.slice(0, -1);

  // ── Richtlinien des Mandanten (P2-5, PEP) ──────────────────────────
  //
  // Derselbe Aufruf wie in bot-chat und bot-voice-webhook — das ist der
  // Punkt von P2-5. Vor dem Modellaufruf und vor `sendWhatsAppText`: Eine
  // einmal versendete WhatsApp-Nachricht ist nicht zurueckholbar.
  const verdict = await enforceBotMessage(admin, {
    tenant_id: bot.tenant_id,
    bot_id: bot.id,
    channel: 'bot-whatsapp',
    message: msg.text,
    history_length: prior.length,
    capability_keys: Object.keys(bot.capabilities ?? {}),
  });

  if (!verdict.allowed) {
    // Der Absender bekommt eine neutrale Antwort, der Pruefpfad die
    // Begruendung. Antwortlos zu bleiben waere hier schlechter: Der Kunde
    // haelt den Kanal dann fuer defekt.
    await insertMessage(admin, bot, conversationId, 'assistant', verdict.safe_reply!, {
      metadata: {
        channel: 'whatsapp', policy_blocked: true,
        policy_decision: verdict.decision, policy_reasons: verdict.reasons,
        policy_signals: verdict.signals,
      },
    });
    await sendWhatsAppText(channel.phone_number_id, msg.from, verdict.safe_reply!);
    await audit(admin, {
      tenant_id: bot.tenant_id,
      actor_user_id: '00000000-0000-0000-0000-000000000000',
      actor_email: null,
      action: 'whatsapp.message_blocked_by_policy',
      target_type: 'bot_conversation',
      target_id: conversationId,
      payload: {
        bot_id: bot.id, decision: verdict.decision,
        reasons: verdict.reasons, signals: verdict.signals,
      },
    });
    return;
  }

  const prompt = buildBotPrompt({ persona: bot.persona, history: prior, userMessage: msg.text });

  const ai = await runAiTool(admin, bot.tenant_id, null, 'bot_reply', prompt, {
    metadata: { bot_id: bot.id, conversation_id: conversationId, channel: 'whatsapp' },
  });

  await insertMessage(admin, bot, conversationId, 'assistant', ai.output, {
    runId: ai.runId, inputTokens: ai.inputTokens, outputTokens: ai.outputTokens, costUsd: ai.costUsd,
    metadata: { channel: 'whatsapp', duration_ms: ai.durationMs, ...policy.trail },
  });

  await sendWhatsAppText(channel.phone_number_id, msg.from, ai.output);

  await audit(admin, {
    tenant_id: bot.tenant_id,
    actor_user_id: '00000000-0000-0000-0000-000000000000',
    actor_email: null,
    action: 'whatsapp.message_answered',
    target_type: 'bot_conversation',
    target_id: conversationId,
    payload: { source: 'whatsapp', bot_id: bot.id, wa_message_id: msg.waMessageId, run_id: ai.runId },
  });
}

// --- Main Handler ---------------------------------------------------------

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // Verifizierungs-Handshake beim Einrichten des Webhooks.
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge') ?? '';
    if (mode === 'subscribe' && VERIFY_TOKEN && token === VERIFY_TOKEN) {
      return new Response(challenge, { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  if (req.method !== 'POST') return new Response('OK', { status: 200 });

  // Auf POST immer 200 zurückgeben — Meta darf nicht retrien.
  try {
    const rawBody = await req.text();

    const validSignature = await verifySignature(rawBody, req.headers.get('x-hub-signature-256'));
    if (!validSignature) {
      // Stille Ablehnung — kein Detail nach außen; 200 verhindert Meta-Retries.
      console.error(JSON.stringify({ level: 'warn', scope: 'whatsapp_webhook', msg: 'invalid signature' }));
      return new Response('OK', { status: 200 });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response('OK', { status: 200 });
    }

    const inbound = extractInboundTextMessages(payload);
    if (inbound.length === 0) return new Response('OK', { status: 200 });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    for (const msg of inbound) {
      const channel = await resolveChannel(admin, msg.phoneNumberId);
      if (!channel) {
        console.error(JSON.stringify({
          level: 'warn', scope: 'whatsapp_webhook',
          msg: 'no active channel for phone_number_id', phone_number_id: msg.phoneNumberId,
        }));
        continue;
      }

      let bot: BotRow;
      try {
        bot = await resolveBot(admin, channel.tenant_id, channel.bot_id);
      } catch {
        continue; // Bot deaktiviert oder gelöscht — still überspringen, Meta nicht retrien lassen.
      }

      // Feature-Gate: WhatsApp-Kanal muss im Plan enthalten sein.
      try {
        await gateFeature(admin, channel.tenant_id, 'bots.whatsapp');
      } catch (e) {
        if (e instanceof EntitlementError) {
          console.error(JSON.stringify({
            level: 'warn', scope: 'whatsapp_webhook', msg: 'entitlement missing',
            tenant_id: channel.tenant_id, code: e.code,
          }));
          continue;
        }
        throw e;
      }

      await handleInbound(admin, channel, bot, msg);
    }

    return new Response('OK', { status: 200 });
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', scope: 'whatsapp_webhook_unhandled', error: (e as Error)?.message }));
    return new Response('OK', { status: 200 });
  }
});
