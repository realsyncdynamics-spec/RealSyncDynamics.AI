// Script: Telegram Webhook registrieren.
//
// Verwendung:
//   deno run --allow-env --allow-net scripts/setup-telegram-webhook.ts
//   TELEGRAM_BOT_TOKEN=<token> PUBLIC_APP_URL=https://... deno run ...
//
// Liest Token und App-URL aus ENV — niemals im Klartext ausgeben.

const BOT_TOKEN  = Deno.env.get('TELEGRAM_BOT_TOKEN');
const APP_URL    = Deno.env.get('PUBLIC_APP_URL') ?? Deno.env.get('APP_BASE_URL');
const SECRET     = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
// Supabase Function URL wenn gesetzt, sonst Standard-Pfad
const WEBHOOK_URL = Deno.env.get('TELEGRAM_WEBHOOK_FUNCTION_URL') ??
  (APP_URL ? `${APP_URL}/functions/v1/telegram-webhook` : null);

if (!BOT_TOKEN) {
  console.error('Fehler: TELEGRAM_BOT_TOKEN nicht gesetzt.');
  Deno.exit(1);
}
if (!WEBHOOK_URL) {
  console.error('Fehler: PUBLIC_APP_URL oder TELEGRAM_WEBHOOK_FUNCTION_URL nicht gesetzt.');
  Deno.exit(1);
}

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function setWebhook(): Promise<void> {
  console.log(`Setze Webhook auf: ${WEBHOOK_URL}`);
  const body: Record<string, unknown> = {
    url:             WEBHOOK_URL,
    allowed_updates: ['message'],
    drop_pending_updates: true,
  };
  if (SECRET) {
    body.secret_token = SECRET;
    console.log('Webhook-Secret gesetzt (Wert wird nicht ausgegeben).');
  }

  const res = await fetch(`${TELEGRAM_API}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.ok) {
    console.log(`✓ Webhook gesetzt: ${data.description ?? 'ok'}`);
  } else {
    console.error(`✗ Fehler: ${data.description}`);
    Deno.exit(1);
  }
}

async function getWebhookInfo(): Promise<void> {
  const res  = await fetch(`${TELEGRAM_API}/getWebhookInfo`);
  const data = await res.json();
  if (!data.ok) {
    console.error(`getWebhookInfo Fehler: ${data.description}`);
    return;
  }
  const info = data.result;
  console.log('\n— Webhook Info ——————————————————————');
  console.log(`URL:            ${info.url || '(leer)'}`);
  console.log(`Pending:        ${info.pending_update_count ?? 0}`);
  console.log(`Letzter Fehler: ${info.last_error_message ?? '-'}`);
  console.log(`Has Secret:     ${info.has_custom_certificate ?? false}`);
  console.log('——————————————————————————————————————');
}

await setWebhook();
await getWebhookInfo();
