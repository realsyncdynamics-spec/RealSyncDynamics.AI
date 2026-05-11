// Audit-Report Email-Sender via Resend.
//
// GET /functions/v1/audit-report-email?id=<audit_uuid>
//
// 1. Fetch gdpr_audits row by ID (service-role).
// 2. Render print-friendly HTML report (severity-coded score badge + issue list).
// 3. POST to Resend API with HTML.
// 4. UPDATE gdpr_audits SET email_sent_at = now() to prevent double-send.
//
// Idempotent: skips send if email_sent_at already set.
// Graceful: if RESEND_API_KEY missing, returns 200 with skipped=true.
//
// Auth: requires verify_jwt (caller must be authenticated). Frontend can call
// directly after submission, OR a background cron sweeps un-sent audits.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface Issue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  detail: string;
  paragraph_ref?: string;
}

interface AuditRow {
  id: string;
  url: string;
  domain: string;
  email: string;
  company: string | null;
  score: number;
  severity: string;
  issues: Issue[];
  email_sent_at: string | null;
  created_at: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return jsonError(400, 'BAD_ID', 'valid uuid required');
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: row, error } = await supa.from('gdpr_audits').select('*').eq('id', id).maybeSingle();
  if (error || !row) return jsonError(404, 'NOT_FOUND', 'audit not found');

  const audit = row as AuditRow;
  if (audit.email_sent_at) {
    return json({ ok: true, skipped: 'already_sent', sent_at: audit.email_sent_at });
  }

  const apiKey = await getResendKey(supa);
  if (!apiKey) {
    return json({ ok: true, skipped: 'no_api_key', hint: 'set RESEND_API_KEY env or vault.resend_api_key' });
  }

  const html = renderEmail(audit);
  const subject = `DSGVO-Audit: ${audit.domain} · Score ${audit.score}/100`;
  const fromAddr = Deno.env.get('AUDIT_EMAIL_FROM') ?? 'audit@realsyncdynamicsai.de';
  const fromName = 'RealSyncDynamics.AI';

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${fromName} <${fromAddr}>`,
      to: [audit.email],
      subject,
      html,
      reply_to: 'kontakt@realsyncdynamicsai.de',
      tags: [{ name: 'category', value: 'audit_report' }],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    return jsonError(502, 'RESEND_FAILED', err.slice(0, 500));
  }

  const sent = await resp.json();
  await supa.from('gdpr_audits').update({ email_sent_at: new Date().toISOString() }).eq('id', id);

  return json({ ok: true, sent_id: sent.id, to: audit.email });
});

async function getResendKey(supa: ReturnType<typeof createClient>): Promise<string | null> {
  const env = Deno.env.get('RESEND_API_KEY');
  if (env && env.startsWith('re_')) return env;
  try {
    const { data } = await supa.rpc('get_app_secret', { secret_name: 'resend_api_key' });
    if (typeof data === 'string' && data.startsWith('re_')) return data;
  } catch {
    /* RPC may not exist yet, fall through */
  }
  return null;
}

function renderEmail(a: AuditRow): string {
  const sevColor: Record<string, string> = {
    critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#65a30d', info: '#0284c7', pass: '#16a34a',
  };
  const scoreColor = a.score >= 80 ? '#16a34a' : a.score >= 60 ? '#d97706' : a.score >= 40 ? '#ea580c' : '#dc2626';
  const issuesHtml = (a.issues ?? []).slice(0, 20).map((iss) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #27272a;vertical-align:top;">
        <span style="display:inline-block;font-size:10px;font-weight:700;color:${sevColor[iss.severity] ?? '#71717a'};letter-spacing:0.1em;text-transform:uppercase;">${iss.severity}</span>
        <div style="font-weight:600;color:#18181b;margin-top:4px;">${escapeHtml(iss.title)}</div>
        <div style="font-size:14px;color:#52525b;margin-top:4px;line-height:1.5;">${escapeHtml(iss.detail)}</div>
        ${iss.paragraph_ref ? `<div style="font-size:11px;color:#a1a1aa;margin-top:6px;font-family:'JetBrains Mono',monospace;">${escapeHtml(iss.paragraph_ref)}</div>` : ''}
      </td>
    </tr>
  `).join('');

  const greeting = a.company ? `Hallo Team ${escapeHtml(a.company)},` : 'Hallo,';
  const siteUrl = (Deno.env.get('PUBLIC_SITE_URL') ?? 'https://realsyncdynamicsai.de').replace(/\/+$/, '');
  const auditUrl = `${siteUrl}/audit`;
  const contactUrl = `${siteUrl}/contact-sales?audit=${a.id}&source=audit_email`;

  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DSGVO-Audit Report</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;color:#18181b;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="padding:24px 8px;">
  <tr><td align="center">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;">
      <tr><td style="padding:32px 32px 24px 32px;border-bottom:1px solid #e4e4e7;">
        <div style="font-size:11px;color:#71717a;letter-spacing:0.2em;text-transform:uppercase;font-weight:700;">RealSyncDynamics.AI</div>
        <h1 style="margin:8px 0 4px 0;font-size:24px;color:#18181b;">DSGVO-Audit-Report</h1>
        <div style="font-size:14px;color:#52525b;">${escapeHtml(a.domain)}</div>
      </td></tr>
      <tr><td style="padding:24px 32px;">
        <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;">${greeting}</p>
        <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;">unser DSGVO-Heuristik-Scanner hat <strong>${escapeHtml(a.domain)}</strong> auf 19 typische Compliance-Fallen geprüft. Hier ist Dein Report.</p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 24px 0;background:#fafafa;border:1px solid #e4e4e7;">
          <tr>
            <td style="padding:24px 32px;text-align:center;">
              <div style="font-size:11px;color:#71717a;letter-spacing:0.15em;text-transform:uppercase;font-weight:700;">Score</div>
              <div style="font-size:48px;font-weight:800;color:${scoreColor};line-height:1;margin-top:6px;">${a.score}<span style="font-size:18px;color:#a1a1aa;">/100</span></div>
              <div style="font-size:13px;color:#52525b;margin-top:8px;">${(a.issues ?? []).length} Befunde</div>
            </td>
          </tr>
        </table>
        ${issuesHtml ? `<h2 style="margin:0 0 12px 0;font-size:14px;color:#18181b;letter-spacing:0.05em;text-transform:uppercase;">Befunde</h2><table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border:1px solid #e4e4e7;">${issuesHtml}</table>` : '<div style="padding:16px;background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;font-size:14px;">Keine Befunde — Deine Site ist sauber.</div>'}
        <div style="margin:32px 0 0 0;padding:20px 24px;background:#fafafa;border:1px solid #e4e4e7;">
          <div style="font-size:11px;color:#71717a;letter-spacing:0.15em;text-transform:uppercase;font-weight:700;margin-bottom:6px;">Weitere Unterstützung</div>
          <h3 style="margin:0 0 8px 0;font-size:16px;color:#18181b;">Wenn Sie Unterstützung bei Priorisierung oder technischer Umsetzung wünschen</h3>
          <p style="margin:0 0 14px 0;font-size:14px;color:#52525b;line-height:1.6;">Sie können einen Fix-Call buchen, ein DSGVO-Fix-Paket anfragen oder kontinuierliches Monitoring starten.</p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="padding-right:8px;"><a href="https://realsyncdynamicsai.de/contact-sales?intent=fix-call&source=audit_email&audit=${a.id}" style="display:inline-block;padding:10px 16px;background:#18181b;color:#ffffff;text-decoration:none;font-weight:600;font-size:13px;">Fix-Call buchen</a></td>
              <td style="padding-right:8px;"><a href="https://realsyncdynamicsai.de/fix-paket?source=audit_email&audit=${a.id}" style="display:inline-block;padding:10px 16px;background:#ffffff;color:#18181b;border:1px solid #18181b;text-decoration:none;font-weight:600;font-size:13px;">Fix-Paket anfragen</a></td>
              <td><a href="https://realsyncdynamicsai.de/contact-sales?intent=monitoring&source=audit_email&audit=${a.id}" style="display:inline-block;padding:10px 16px;background:#ffffff;color:#18181b;border:1px solid #18181b;text-decoration:none;font-weight:600;font-size:13px;">Monitoring anfragen</a></td>
            </tr>
          </table>
        </div>
        <div style="margin:24px 0 0 0;padding:20px 24px;background:#0a0a0b;color:#fafafa;">
          <div style="font-size:11px;color:#a1a1aa;letter-spacing:0.15em;text-transform:uppercase;font-weight:700;margin-bottom:6px;">Kontinuierliches Monitoring</div>
          <h3 style="margin:0 0 8px 0;font-size:16px;color:#ffffff;">Mit einem Monitoring-Plan bleiben Änderungen nachvollziehbar</h3>
          <p style="margin:0 0 14px 0;font-size:13px;color:#a1a1aa;line-height:1.6;">Änderungen an Tracking, externen Diensten und möglichen Compliance-Risiken können regelmäßig überprüft werden — mit nachvollziehbarer Audit-Historie.</p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="padding-right:8px;"><a href="${siteUrl}/pricing?plan=starter&audit_id=${a.id}" style="display:inline-block;padding:10px 18px;background:#ffffff;color:#0a0a0b;text-decoration:none;font-weight:700;font-size:13px;">Starter aktivieren</a></td>
              <td><a href="${siteUrl}/pricing?plan=growth&audit_id=${a.id}" style="display:inline-block;padding:10px 18px;background:#0284c7;color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;">Growth aktivieren</a></td>
            </tr>
          </table>
        </div>
      </td></tr>
      <tr><td style="padding:20px 32px;background:#fef3c7;border-top:1px solid #fcd34d;font-size:12px;color:#78350f;line-height:1.5;">
        <strong>Hinweis:</strong> Der Audit ersetzt keine individuelle Rechtsberatung und keine vollständige technische Prüfung.
      </td></tr>
      <tr><td style="padding:24px 32px;border-top:1px solid #e4e4e7;font-size:12px;color:#71717a;line-height:1.6;">
        <p style="margin:0 0 8px 0;">Automatisch generiert · <a href="${auditUrl}" style="color:#0284c7;">Andere URL prüfen</a> · <a href="https://realsyncdynamicsai.de/legal/privacy" style="color:#0284c7;">Datenschutz</a></p>
        <p style="margin:0;">RealSync Dynamics · Made in Germany · privacy@realsyncdynamicsai.de</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
function jsonError(status: number, code: string, message: string): Response {
  return json({ ok: false, error: { code, message } }, status);
}
