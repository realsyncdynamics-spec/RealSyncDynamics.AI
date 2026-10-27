// bot-voice-enforcer — von pg_cron (jede Minute) aufgerufen.
//
// Beendet beim Anbieter (Twilio, Status=completed) jeden offenen Anruf, dessen
// reservierte Dauer abzüglich Vorlauf erreicht ist — unabhängig davon, ob
// noch ein Gesprächsschritt eintrifft (Gate 1, PR #2044). Logik in
// _shared/bot-voice-enforcement.ts (ohne Deno-Imports, Vitest-geprüft).
//
// Budget: rechnet weder ab noch gibt frei. Abrechnung über den Twilio-
// Status-Callback (gemessen) oder den Aufräumjob (geschätzt zum Höchstbetrag).
//
// Auth: Bearer == CRON_BOT_VOICE_ENFORCER_KEY (Function Secret). pg_cron
// sendet Vault `cron_bot_voice_enforcer_key` über dispatch_cron_function.
// verify_jwt = false. Fail-closed: fehlendes Secret → 500 CRON_KEY_MISSING,
// falscher/fehlender Bearer → 401. Inbound nie gegen
// SUPABASE_SERVICE_ROLE_KEY vergleichen (Runbook cron-vault-secrets).
//
// Secrets (nur Namen): CRON_BOT_VOICE_ENFORCER_KEY, TWILIO_AUTH_TOKEN,
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { timingSafeEqual } from '../_shared/timingSafeEqual.ts';
import { enforceOverdueCalls } from '../_shared/bot-voice-enforcement.ts';
import type { RpcAdmin } from '../_shared/bot-budget.ts';

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED', 'POST only');

  const CRON_KEY = Deno.env.get('CRON_BOT_VOICE_ENFORCER_KEY') ?? '';
  if (!CRON_KEY) {
    return jsonError(500, 'CRON_KEY_MISSING', 'CRON_BOT_VOICE_ENFORCER_KEY not configured');
  }
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!timingSafeEqual(authHeader, `Bearer ${CRON_KEY}`)) {
    return jsonError(401, 'UNAUTHORIZED', 'cron only');
  }

  const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') ?? '';
  if (!TWILIO_AUTH_TOKEN) {
    // Ohne Token kein Anbieteraufruf möglich — laut melden, nichts ändern.
    return jsonError(500, 'TWILIO_NOT_CONFIGURED', 'TWILIO_AUTH_TOKEN not configured');
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  try {
    const summary = await enforceOverdueCalls({
      rpc: admin as unknown as RpcAdmin,
      authToken: TWILIO_AUTH_TOKEN,
    });
    if (summary.checked > 0) {
      console.log(JSON.stringify({ level: 'info', scope: 'bot_voice_enforcer', ...summary }));
    }
    return jsonResponse({ ok: true, ...summary });
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', scope: 'bot_voice_enforcer', error: (e as Error).message }));
    return jsonError(500, 'INTERNAL', 'enforcement run failed');
  }
});
