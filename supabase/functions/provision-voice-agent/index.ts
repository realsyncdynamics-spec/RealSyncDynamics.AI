// provision-voice-agent — stellt je Mandant einen ElevenLabs-Voice-Agenten aus
// der Vorlage bereit bzw. sperrt ihn, sobald `bots.voice` entfällt.
//
// Aufrufer (intern, nie der Browser):
//   * stripe-webhook nach einem Abo-Ereignis: { tenant_id }
//   * Reconcile ohne Body (pg_cron, sobald der Vault-Eintrag gesetzt ist):
//       SELECT cron.schedule('voice-agent-reconcile', '*/15 * * * *',
//         $$ SELECT public.dispatch_cron_function('provision-voice-agent',
//              'voice_provision_key', jsonb_build_object('trigger','cron')) $$);
//     holt pending / failed (< MAX_PROVISION_ATTEMPTS) / hängende Zeilen ab.
//
// Auth: Bearer == VOICE_PROVISION_KEY (Vault voice_provision_key, Env-Fallback).
// Fail-closed: kein Secret → 500, falscher Bearer → 401. verify_jwt = false
// (config.toml), weil der Aufrufer kein User-JWT hat.
//
// Secrets (Vault zuerst, dann Env):
//   VOICE_PROVISION_KEY                 voice_provision_key
//   ELEVENLABS_API_KEY                  elevenlabs_api_key
//   ELEVENLABS_VOICE_TEMPLATE_AGENT_ID  (Env; keine Geheimnis-Eigenschaft)
//   ELEVENLABS_API_BASE                 (Env; Default EU-Residenz)
//   VOICE_AVG_CALL_MINUTES              (Env; Default 3, für das Tageslimit)
//   VOICE_PROVISIONING_ENABLED          (Env; nur 'true' schaltet scharf)
//
// Logik: handler.ts, getestet in test/edge/provision-voice-agent.test.ts.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { timingSafeEqual } from '../_shared/timingSafeEqual.ts';
import { DEFAULT_AVG_CALL_MINUTES } from '../_shared/voice-agent-provisioning.ts';
import { ELEVENLABS_EU_BASE, createElevenLabsClient } from './elevenlabs.ts';
import { handleProvisionVoiceAgent } from './handler.ts';
import { createSupabaseRepo } from './repo.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

async function getSecret(envVar: string, vaultName: string): Promise<string | undefined> {
  try {
    const { data } = await admin.rpc('get_app_secret', { secret_name: vaultName });
    if (typeof data === 'string' && data.length > 0) return data;
  } catch { /* Vault-RPC fehlt oder leer → Env */ }
  return Deno.env.get(envVar) || undefined;
}

Deno.serve(async (req) => {
  const [provisionKey, apiKey] = await Promise.all([
    getSecret('VOICE_PROVISION_KEY', 'voice_provision_key'),
    getSecret('ELEVENLABS_API_KEY', 'elevenlabs_api_key'),
  ]);

  let body: unknown = null;
  if (req.method === 'POST') {
    const text = await req.text();
    if (text) {
      try { body = JSON.parse(text); } catch {
        return Response.json({ error: 'invalid JSON' }, { status: 400 });
      }
    }
  }

  const avg = Number(Deno.env.get('VOICE_AVG_CALL_MINUTES') ?? DEFAULT_AVG_CALL_MINUTES);
  const res = await handleProvisionVoiceAgent(
    { method: req.method, authorization: req.headers.get('authorization'), body },
    {
      provisionKey,
      enabled: Deno.env.get('VOICE_PROVISIONING_ENABLED') === 'true',
      templateAgentId: Deno.env.get('ELEVENLABS_VOICE_TEMPLATE_AGENT_ID') || undefined,
      avgCallMinutes: avg,
      repo: createSupabaseRepo(admin),
      provider: apiKey
        ? createElevenLabsClient(apiKey, Deno.env.get('ELEVENLABS_API_BASE') || ELEVENLABS_EU_BASE)
        : null,
      now: () => new Date(),
      uuid: () => crypto.randomUUID(),
      timingSafeEqual,
    },
  );

  if (res.status >= 500) {
    console.error(JSON.stringify({ level: 'error', scope: 'provision_voice_agent', ...res.body }));
  }
  return Response.json(res.body, { status: res.status });
});
