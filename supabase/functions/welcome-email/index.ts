// Welcome-Email Edge Function via Resend.
//
// POST /functions/v1/welcome-email
// Body: { user_id: uuid }
// Sends via _shared/mailer.ts (vault-first Resend key).
// Idempotent. Graceful no-op if resend_api_key missing from vault and env.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { sendResendEmail } from '../_shared/mailer.ts';

interface UserRow {
  id: string;
  email: string;
  raw_user_meta_data: Record<string, unknown> | null;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  welcome_email_sent_at: string | null;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req); if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  let body: { user_id?: string };
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const userId = body.user_id;
  if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return jsonError(400, 'BAD_ID', 'valid user_id uuid required');
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: userResp, error: userErr } = await supa.auth.admin.getUserById(userId);
  if (userErr || !userResp.user) return jsonError(404, 'NOT_FOUND', 'user not found');
  const user = userResp.user as UserRow;

  const { data: profile } = await supa.from('profiles').select('*').eq('id', userId).maybeSingle();
  const p = (profile ?? null) as ProfileRow | null;

  if (p?.welcome_email_sent_at) {
    return jsonResponse({ ok: true, skipped: 'already_sent', sent_at: p.welcome_email_sent_at });
  }

  const meta = user.raw_user_meta_data ?? {};
  const displayName = (typeof meta.full_name === 'string' && meta.full_name)
    || (typeof meta.name === 'string' && meta.name)
    || p?.display_name
    || null;

  const html = renderEmail(displayName, user.email);
  const fromAddr = Deno.env.get('WELCOME_EMAIL_FROM') ?? 'noreply@realsyncdynamicsai.de';
  const fromName = 'RealSyncDynamics.AI';

  const sent = await sendResendEmail(supa, {
    to: user.email,
    subject: 'Willkommen bei RealSyncDynamics.AI',
    html,
    from: `${fromName} <${fromAddr}>`,
    tags: [{ name: 'category', value: 'welcome' }],
  });

  if (sent.skipped === 'no_api_key') {
    return jsonResponse({
      ok: true,
      skipped: 'no_api_key',
      hint: 'provision vault.resend_api_key via vault-set-secret (see docs/runbooks/resend-production-email.md)',
    });
  }

  if (!sent.ok) {
    return jsonError(502, 'RESEND_FAILED', sent.error ?? 'resend rejected');
  }

  await supa.from('profiles').update({ welcome_email_sent_at: new Date().toISOString() }).eq('id', userId);

  return jsonResponse({ ok: true, sent_id: sent.id, to: user.email, source: sent.source });
});

function renderEmail(displayName: string | null, email: string): string {
  const greeting = displayName ? `Hallo ${escapeHtml(displayName)},` : 'Hallo,';
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Willkommen</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;color:#18181b;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="padding:24px 8px;">
  <tr><td align="center">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;">
      <tr><td style="padding:32px 32px 24px 32px;border-bottom:1px solid #e4e4e7;">
        <div style="font-size:11px;color:#71717a;letter-spacing:0.2em;text-transform:uppercase;font-weight:700;">RealSyncDynamics.AI</div>
        <h1 style="margin:8px 0 4px 0;font-size:24px;color:#18181b;">Willkommen!</h1>
        <div style="font-size:14px;color:#52525b;">DSGVO-konforme KI für regulierte Branchen</div>
      </td></tr>
      <tr><td style="padding:24px 32px;">
        <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;">${greeting}</p>
        <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;">
          Schön, dass Du Dich für RealSyncDynamics.AI registriert hast. Hier sind Deine ersten 3 Schritte:
        </p>
        <ol style="margin:0 0 24px 0;padding-left:20px;font-size:15px;line-height:1.8;color:#18181b;">
          <li><strong>Tenant-Setup</strong> — Lege Deine Workspace-Identität fest (Name, Branche, AVV-Vertragspartner)</li>
          <li><strong>EU-Datenresidenz aktivieren</strong> — Toggle in Settings, falls sensitive Daten verarbeitet werden</li>
          <li><strong>Erstes AI-Tool aufrufen</strong> — Audit-Log läuft ab dem ersten Call</li>
        </ol>
        <div style="margin:24px 0 0 0;text-align:center;">
          <a href="https://RealSyncDynamicsAI.de/dashboard" style="display:inline-block;padding:12px 28px;background:#0284c7;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;">
            Zum Dashboard →
          </a>
        </div>
        <p style="margin:24px 0 0 0;font-size:13px;line-height:1.6;color:#52525b;">
          Bei Fragen einfach auf diese Email antworten — Du erreichst direkt unseren Founder.
        </p>
      </td></tr>
      <tr><td style="padding:24px 32px;border-top:1px solid #e4e4e7;font-size:12px;color:#71717a;line-height:1.6;">
        <p style="margin:0 0 8px 0;">Account: ${escapeHtml(email)} · <a href="https://RealSyncDynamicsAI.de/settings/account" style="color:#0284c7;">Einstellungen</a> · <a href="https://RealSyncDynamicsAI.de/legal/privacy" style="color:#0284c7;">Datenschutz</a></p>
        <p style="margin:0;">RealSync Dynamics · Made in Germany · EU-Hosted (Frankfurt)</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>')
    .replace(/"/g, '"').replace(/'/g, '&#39;');
}
