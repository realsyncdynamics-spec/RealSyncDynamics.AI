// Telegram Webhook Endpoint — empfängt Telegram Bot Updates.
//
// POST /functions/v1/telegram-webhook
//
// Telegram ruft diesen Endpoint für jede Nachricht/Command auf.
// Der Endpoint:
//  1. Verifiziert das optionale Webhook-Secret (X-Telegram-Bot-Api-Secret-Token)
//  2. Extrahiert command, text, chat_id, user_id, username
//  3. Sucht die Workspace-Verknüpfung aus telegram_connections
//  4. Routet an den passenden Agenten
//  5. Antwortet via Telegram sendMessage API
//
// WICHTIG: Immer 200 OK zurückgeben — sonst versucht Telegram Retries.
// Secrets dürfen NICHT in Logs erscheinen.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sha256Hex, randomToken } from '../_shared/hash.ts';
import { AiGatewayEdgeClient } from '../_shared/aiGateway/edgeClient.ts';

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SRK               = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BOT_TOKEN         = Deno.env.get('TELEGRAM_BOT_TOKEN');
const WEBHOOK_SECRET    = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
const APP_BASE_URL      = Deno.env.get('PUBLIC_APP_URL') ?? Deno.env.get('APP_BASE_URL') ?? 'https://app.realsyncdynamicsai.de';

// --- Types ----------------------------------------------------------------

interface TelegramUser {
  id:         number;
  username?:  string;
  first_name?: string;
}

interface TelegramChat {
  id:   number;
  type: string;
}

interface TelegramMessage {
  message_id: number;
  from?:      TelegramUser;
  chat:       TelegramChat;
  text?:      string;
  entities?:  Array<{ type: string; offset: number; length: number }>;
}

interface TelegramUpdate {
  update_id: number;
  message?:  TelegramMessage;
}

// --- Telegram API Client --------------------------------------------------

async function sendMessage(
  chatId: number | string,
  text: string,
  parseMode: 'HTML' | 'Markdown' = 'HTML',
): Promise<void> {
  if (!BOT_TOKEN) {
    console.error(JSON.stringify({ level: 'error', scope: 'telegram_send', msg: 'TELEGRAM_BOT_TOKEN not set' }));
    return;
  }
  // Telegram max message length is 4096 characters
  const safeText = text.length > 4000 ? text.slice(0, 3997) + '…' : text;
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id:                  chatId,
        text:                     safeText,
        parse_mode:               parseMode,
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      // Log error code only — no tokens in output
      console.error(JSON.stringify({ level: 'warn', scope: 'telegram_send_failed', status: res.status, description: err?.description }));
    }
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', scope: 'telegram_send_exception', msg: (e as Error)?.message }));
  }
}

// --- Command Parsing ------------------------------------------------------

function extractCommand(msg: TelegramMessage): string | null {
  if (!msg.text) return null;
  const cmdEntity = msg.entities?.find((e) => e.type === 'bot_command' && e.offset === 0);
  if (!cmdEntity) return null;
  const raw = msg.text.slice(0, cmdEntity.length);
  // Strip @BotName suffix: /start@MyBot → /start
  return raw.split('@')[0].toLowerCase();
}

// --- Agent Routing --------------------------------------------------------

async function routeToAgent(
  admin: ReturnType<typeof createClient>,
  tenantId: string,
  userId: string,
  command: string,
  text: string,
): Promise<string> {
  const supabaseUrl = SUPABASE_URL;
  const apiKey = SRK;

  const gatewayClient = new AiGatewayEdgeClient({ supabaseUrl, apiKey });

  // Map command to intent/feature for the gateway
  const featureMap: Record<string, string> = {
    '/audit':      'compliance_audit',
    '/risks':      'risk_assessment',
    '/evidence':   'evidence_vault',
    '/compliance': 'compliance_overview',
    '/status':     'governance_status',
    '/assistant':  'general_assistant',
  };

  const feature  = featureMap[command] ?? 'general_assistant';
  const userText = command === '/assistant'
    ? text.replace(/^\/assistant\s*/i, '').trim() || 'Hilf mir mit meinem Workspace.'
    : `Zeige mir: ${feature.replace('_', ' ')} für meinen Workspace.`;

  try {
    const result = await gatewayClient.generate({
      feature,
      task_type:     'chat',
      model_profile: 'balanced',
      input:         userText,
      context:       { tenant_id: tenantId, source: 'telegram', command },
    });
    return result.output as string ?? 'Keine Antwort erhalten.';
  } catch (e) {
    console.error(JSON.stringify({ level: 'warn', scope: 'agent_route_failed', feature, error: (e as Error)?.message }));
    // Fallback: Direct link to app
    const linkMap: Record<string, string> = {
      '/audit':      `${APP_BASE_URL}/app/websites`,
      '/risks':      `${APP_BASE_URL}/app/risks`,
      '/evidence':   `${APP_BASE_URL}/app/evidence`,
      '/compliance': `${APP_BASE_URL}/app/compliance`,
      '/status':     `${APP_BASE_URL}/app`,
    };
    const link = linkMap[command] ?? `${APP_BASE_URL}/app`;
    return `Hier geht es weiter: <a href="${link}">${link}</a>`;
  }
}

// --- Audit Logging --------------------------------------------------------

async function logTelegramEvent(
  admin: ReturnType<typeof createClient>,
  params: {
    tenant_id:        string | null;
    user_id:          string | null;
    telegram_user_id: string;
    command:          string | null;
    intent:           string;
    outcome:          string;
  },
): Promise<void> {
  try {
    await admin.from('governance_admin_log').insert({
      tenant_id:    params.tenant_id ?? '00000000-0000-0000-0000-000000000000',
      actor_user_id: params.user_id ?? '00000000-0000-0000-0000-000000000000',
      actor_email:  null,
      action:       `telegram.${params.intent}`,
      target_type:  'telegram_connection',
      target_id:    params.telegram_user_id,
      payload: {
        source:           'telegram',
        command:          params.command,
        intent:           params.intent,
        outcome:          params.outcome,
      },
    });
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', scope: 'telegram_audit_failed', error: (e as Error)?.message }));
  }
}

// --- Command Handlers -----------------------------------------------------

async function handleStart(
  admin: ReturnType<typeof createClient>,
  chatId: number,
  telegramUserId: string,
  isConnected: boolean,
  tenantName: string | null,
): Promise<void> {
  if (isConnected) {
    await sendMessage(chatId,
      `<b>Willkommen zurück beim RealSync Agent Gateway!</b>\n\n` +
      `Verbunden mit: <b>${escapeHtml(tenantName ?? 'deinem Workspace')}</b>\n\n` +
      `Verfügbare Commands:\n` +
      `/status — Governance-Snapshot\n` +
      `/audit — Audit starten\n` +
      `/risks — Aktuelle Risiken\n` +
      `/evidence — Evidence Vault\n` +
      `/compliance — Compliance-Übersicht\n` +
      `/assistant — Frage stellen\n` +
      `/settings — Verbindungseinstellungen\n` +
      `/help — Hilfe`,
    );
  } else {
    await sendMessage(chatId,
      `<b>RealSync Agent Gateway</b>\n\n` +
      `Ich bin dein persönlicher Compliance- und Governance-Assistent.\n\n` +
      `Um loszulegen, verbinde diesen Chat mit deinem RealSync-Workspace:\n` +
      `/connect — Workspace verbinden\n\n` +
      `/help — Hilfe`,
    );
  }
}

async function handleHelp(chatId: number, isConnected: boolean): Promise<void> {
  const connectedCommands = isConnected
    ? `/status — Governance-Snapshot\n/audit — Audit starten\n/risks — Risiken\n/evidence — Evidence Vault\n/compliance — Compliance\n/assistant — KI-Assistent\n/settings — Einstellungen\n`
    : '';
  await sendMessage(chatId,
    `<b>RealSync Agent Gateway — Hilfe</b>\n\n` +
    `<b>Basis-Commands:</b>\n` +
    `/start — Starten\n` +
    `/help — Diese Hilfe\n` +
    `/connect — Workspace verbinden\n` +
    (connectedCommands ? `\n<b>Workspace-Commands:</b>\n${connectedCommands}` : `\n<i>Verbinde zuerst deinen Workspace mit /connect.</i>`),
  );
}

async function handleConnect(
  admin: ReturnType<typeof createClient>,
  chatId: number,
  telegramUserId: string,
  telegramUsername: string | null,
  isConnected: boolean,
  tenantName: string | null,
): Promise<void> {
  if (isConnected) {
    await sendMessage(chatId,
      `<b>Workspace bereits verbunden</b>\n\n` +
      `Verbunden mit: <b>${escapeHtml(tenantName ?? 'deinem Workspace')}</b>\n\n` +
      `/status — Status anzeigen\n` +
      `/settings — Einstellungen`,
    );
    return;
  }

  // Token erzeugen und Hash speichern
  const token     = randomToken(32);
  const tokenHash = await sha256Hex(token);

  const { error } = await admin
    .from('telegram_connections')
    .upsert(
      {
        telegram_user_id:      telegramUserId,
        telegram_chat_id:      String(chatId),
        telegram_username:     telegramUsername,
        status:                'pending',
        connection_token_hash: tokenHash,
        connected_at:          null,
        updated_at:            new Date().toISOString(),
      },
      { onConflict: 'telegram_user_id' },
    );

  if (error) {
    console.error(JSON.stringify({ level: 'error', scope: 'telegram_connect_upsert', error: error.message }));
    await sendMessage(chatId, 'Fehler beim Erzeugen des Verbindungslinks. Bitte versuche es erneut.');
    return;
  }

  const connectUrl = `${APP_BASE_URL}/app/settings/integrations/telegram?token=${encodeURIComponent(token)}`;
  await sendMessage(chatId,
    `<b>Workspace verbinden</b>\n\n` +
    `Öffne diesen Link in deinem Browser und melde dich mit deinem RealSync-Account an:\n\n` +
    `<a href="${connectUrl}">Workspace verbinden →</a>\n\n` +
    `<i>Der Link ist 15 Minuten gültig.</i>`,
  );
}

async function handleStatus(
  admin: ReturnType<typeof createClient>,
  chatId: number,
  tenantId: string,
): Promise<void> {
  const appUrl = `${APP_BASE_URL}/app`;
  await sendMessage(chatId,
    `<b>Governance-Snapshot</b>\n\n` +
    `<a href="${appUrl}">Vollständige Übersicht öffnen →</a>\n\n` +
    `<i>Erweiterte Echtzeit-Daten sind im Workspace verfügbar.</i>`,
  );
}

async function handleSettings(
  chatId: number,
  telegramUserId: string,
  isConnected: boolean,
  tenantName: string | null,
): Promise<void> {
  const settingsUrl = `${APP_BASE_URL}/app/settings/integrations/telegram`;
  await sendMessage(chatId,
    `<b>Telegram-Einstellungen</b>\n\n` +
    `Status: ${isConnected ? `✓ Verbunden mit <b>${escapeHtml(tenantName ?? 'Workspace')}</b>` : '✗ Nicht verbunden'}\n\n` +
    `<a href="${settingsUrl}">Einstellungen öffnen →</a>`,
  );
}

async function handleUnknown(chatId: number, command: string | null): Promise<void> {
  await sendMessage(chatId,
    `Command <code>${escapeHtml(command ?? '?')}</code> nicht gefunden.\n\n/help — alle verfügbaren Commands`,
  );
}

// --- Utils ----------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// --- Main Handler ---------------------------------------------------------

Deno.serve(async (req) => {
  // Telegram erwartet immer 200 OK; wir fangen alle Fehler ab
  try {
    if (req.method !== 'POST') {
      return new Response('OK', { status: 200 });
    }

    // Webhook-Secret prüfen (optional aber empfohlen)
    if (WEBHOOK_SECRET) {
      const incomingSecret = req.headers.get('x-telegram-bot-api-secret-token');
      if (incomingSecret !== WEBHOOK_SECRET) {
        // Stille Ablehnung — kein Detail nach außen
        return new Response('OK', { status: 200 });
      }
    }

    if (!BOT_TOKEN) {
      console.error(JSON.stringify({ level: 'error', scope: 'telegram_webhook', msg: 'TELEGRAM_BOT_TOKEN missing' }));
      return new Response('OK', { status: 200 });
    }

    let update: TelegramUpdate;
    try {
      update = await req.json();
    } catch {
      return new Response('OK', { status: 200 });
    }

    const msg = update.message;
    if (!msg || !msg.from) {
      return new Response('OK', { status: 200 });
    }

    const chatId          = msg.chat.id;
    const telegramUserId  = String(msg.from.id);
    const telegramUsername = msg.from.username ?? null;
    const command         = extractCommand(msg);
    const text            = msg.text ?? '';

    const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

    // Verbindung suchen
    const { data: conn } = await admin
      .from('telegram_connections')
      .select('id, tenant_id, user_id, status')
      .eq('telegram_user_id', telegramUserId)
      .eq('status', 'connected')
      .maybeSingle();

    const isConnected = Boolean(conn);
    const tenantId    = conn?.tenant_id ?? null;
    const userId      = conn?.user_id   ?? null;

    // Tenant-Name laden
    let tenantName: string | null = null;
    if (tenantId) {
      const { data: tenant } = await admin
        .from('tenants')
        .select('name')
        .eq('id', tenantId)
        .maybeSingle();
      tenantName = tenant?.name ?? null;
    }

    // Keine destruktiven Aktionen ohne Auth
    const authRequired = new Set(['/status', '/audit', '/risks', '/evidence', '/compliance', '/assistant']);
    if (command && authRequired.has(command) && !isConnected) {
      await sendMessage(chatId,
        `<b>Workspace-Verknüpfung erforderlich</b>\n\n` +
        `Dieser Command ist nur für verbundene Workspaces verfügbar.\n` +
        `/connect — Workspace jetzt verbinden`,
      );
      await logTelegramEvent(admin, { tenant_id: null, user_id: null, telegram_user_id: telegramUserId, command, intent: 'unauthorized', outcome: 'blocked' });
      return new Response('OK', { status: 200 });
    }

    // Command-Routing
    switch (command) {
      case '/start':
        await handleStart(admin, chatId, telegramUserId, isConnected, tenantName);
        await logTelegramEvent(admin, { tenant_id: tenantId, user_id: userId, telegram_user_id: telegramUserId, command, intent: 'start', outcome: 'ok' });
        break;

      case '/help':
        await handleHelp(chatId, isConnected);
        await logTelegramEvent(admin, { tenant_id: tenantId, user_id: userId, telegram_user_id: telegramUserId, command, intent: 'help', outcome: 'ok' });
        break;

      case '/connect':
        await handleConnect(admin, chatId, telegramUserId, telegramUsername, isConnected, tenantName);
        await logTelegramEvent(admin, { tenant_id: tenantId, user_id: userId, telegram_user_id: telegramUserId, command, intent: 'connect_init', outcome: isConnected ? 'already_connected' : 'token_created' });
        break;

      case '/settings':
        await handleSettings(chatId, telegramUserId, isConnected, tenantName);
        await logTelegramEvent(admin, { tenant_id: tenantId, user_id: userId, telegram_user_id: telegramUserId, command, intent: 'settings', outcome: 'ok' });
        break;

      case '/status':
        await handleStatus(admin, chatId, tenantId!);
        await logTelegramEvent(admin, { tenant_id: tenantId, user_id: userId, telegram_user_id: telegramUserId, command, intent: 'status', outcome: 'ok' });
        break;

      case '/audit':
      case '/risks':
      case '/evidence':
      case '/compliance':
      case '/assistant': {
        const response = await routeToAgent(admin, tenantId!, userId!, command, text);
        await sendMessage(chatId, response);
        await logTelegramEvent(admin, { tenant_id: tenantId, user_id: userId, telegram_user_id: telegramUserId, command, intent: command.slice(1), outcome: 'routed' });
        break;
      }

      default:
        if (text && !command && isConnected) {
          // Freitext → Assistant
          const response = await routeToAgent(admin, tenantId!, userId!, '/assistant', text);
          await sendMessage(chatId, response);
          await logTelegramEvent(admin, { tenant_id: tenantId, user_id: userId, telegram_user_id: telegramUserId, command: null, intent: 'freetext', outcome: 'routed' });
        } else if (command) {
          await handleUnknown(chatId, command);
          await logTelegramEvent(admin, { tenant_id: tenantId, user_id: userId, telegram_user_id: telegramUserId, command, intent: 'unknown_command', outcome: 'help_shown' });
        }
    }

    return new Response('OK', { status: 200 });
  } catch (e) {
    // Immer 200 zurückgeben — Telegram darf nicht retrien
    console.error(JSON.stringify({ level: 'error', scope: 'telegram_webhook_unhandled', error: (e as Error)?.message }));
    return new Response('OK', { status: 200 });
  }
});
