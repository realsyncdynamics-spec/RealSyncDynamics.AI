// mfa-recovery-redeem — Lockout-Escape (ADR 0006).
//
// Nutzer hat sein TOTP-Gerät verloren: er ist via Magic-Link/OAuth auf AAL1
// eingeloggt, kann aber AAL2 nicht erreichen. Mit einem gültigen Recovery-Code
// entfernen wir hier (service-role) seine TOTP-Faktoren, sodass er sich neu
// einschreiben kann. Der Code wird einmalig verbraucht.
//
// POST /functions/v1/mfa-recovery-redeem
// Authorization: Bearer <user JWT>   (verify_jwt=true, Default)
// Body: { code: string }
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse } from '../_shared/gateway.ts';

async function sha256Hex(input: string): Promise<string> {
  const norm = input.replace(/[\s-]+/g, '').toUpperCase();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(norm));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405);

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonResponse({ error: 'missing_authorization' }, 401);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonResponse({ error: 'invalid_token' }, 401);
  const user = userResp.user;

  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  try {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return jsonResponse({ error: 'invalid_json' }, 400); }
    const code = body.code as string | undefined;
    if (!code || typeof code !== 'string') return jsonResponse({ error: 'missing_code' }, 400);

    const codeHash = await sha256Hex(code);

    // Passenden, unbenutzten Code des Nutzers finden.
    const { data: row } = await admin
      .from('mfa_recovery_codes')
      .select('id')
      .eq('user_id', user.id)
      .eq('code_hash', codeHash)
      .is('used_at', null)
      .maybeSingle();

    if (!row) return jsonResponse({ error: 'invalid_code' }, 401);

    // Code verbrauchen.
    await admin.from('mfa_recovery_codes').update({ used_at: new Date().toISOString() }).eq('id', row.id);

    // TOTP-Faktoren des Nutzers entfernen → Neu-Enrollment nötig.
    // deno-lint-ignore no-explicit-any
    const { data: factors } = await (admin as any).auth.admin.mfa.listFactors({ userId: user.id });
    const list = factors?.factors ?? [];
    for (const f of list) {
      // deno-lint-ignore no-explicit-any
      await (admin as any).auth.admin.mfa.deleteFactor({ userId: user.id, id: f.id });
    }

    return jsonResponse({ ok: true, removed_factors: list.length });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});
