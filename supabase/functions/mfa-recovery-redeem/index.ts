// mfa-recovery-redeem — Lockout-Escape (ADR 0006).
//
// Nutzer hat sein TOTP-Gerät verloren: er ist via Magic-Link/OAuth auf AAL1
// eingeloggt, kann aber AAL2 nicht erreichen. Mit einem gültigen Recovery-Code
// entfernen wir hier (service-role) seine TOTP-Faktoren, sodass er sich neu
// einschreiben kann. Der Code wird einmalig verbraucht.
import { corsHeaders } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';

async function sha256Hex(input: string): Promise<string> {
  const norm = input.replace(/[\s-]+/g, '').toUpperCase();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(norm));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const cors = corsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const { user, admin } = await requireUser(req);
    const { code } = (await req.json()) ?? {};
    if (!code || typeof code !== 'string') return json({ error: 'missing_code' }, 400);

    const codeHash = await sha256Hex(code);

    // Passenden, unbenutzten Code des Nutzers finden.
    const { data: row } = await admin
      .from('mfa_recovery_codes')
      .select('id')
      .eq('user_id', user.id)
      .eq('code_hash', codeHash)
      .is('used_at', null)
      .maybeSingle();

    if (!row) return json({ error: 'invalid_code' }, 401);

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

    return json({ ok: true, removed_factors: list.length });
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: String(e) }, 500);
  }
});
