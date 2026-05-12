// Daily Digest Email an den Founder.
//
// GET /functions/v1/daily-digest   (verify_jwt = false)
// Optional ?email=… overrides FOUNDER_EMAIL env var.
//
// Sammelt:
//   - last 24h audits, leads, pageviews
//   - Totals: tenants, active subs, outreach
// Rendert HTML-Email + sendet via Resend.
// Idempotent ist nicht nötig — Daily-Cron einmal/Tag.
//
// pg_cron-Setup:
//   SELECT cron.schedule('daily-digest', '0 8 * * *',
//     $$ SELECT net.http_get('https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/daily-digest') $$);

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supa = createClient(SUPABASE_URL, SRK);

  const url = new URL(req.url);
  const recipient = url.searchParams.get('email') ?? Deno.env.get('FOUNDER_EMAIL') ?? 'kontakt@realsyncdynamicsai.de';

  // Sammle KPIs in einem einzigen SQL-Roundtrip
  const { data: kpis, error } = await supa.rpc('admin_system_health_anonymous_for_digest').single();
  // Fallback wenn die spezielle RPC nicht existiert: direkte Counts
  const stats = (kpis as Record<string, unknown> | null) ?? await fetchStatsDirect(supa);

  const apiKey = await getResendKey(supa);
  if (!apiKey) {
    return json({ ok: true, skipped: 'no_api_key', stats });
  }

  const html = renderEmail(stats);
  const fromAddr = Deno.env.get('DIGEST_EMAIL_FROM') ?? 'team@realsyncdynamicsai.de';
  const subject = `Daily Digest · ${new Date().toLocaleDateString('de-DE')}`;

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `RealSync Ops <${fromAddr}>`,
      to: [recipient],
      subject, html,
      tags: [{ name: 'category', value: 'daily_digest' }],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    return jsonError(502, 'RESEND_FAILED', err.slice(0, 500));
  }

  const sent = await resp.json();
  return json({ ok: true, sent_id: sent.id, to: recipient, stats });
});

async function fetchStatsDirect(supa: ReturnType<typeof createClient>) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [audits24h, leads24h, pageviews24h, auditsUnsent, subs, tenants, outreach, totalAudits, totalLeads] = await Promise.all([
    supa.from('gdpr_audits').select('*', { count: 'exact', head: true }).gte('created_at', oneDayAgo),
    supa.from('sales_leads').select('*', { count: 'exact', head: true }).gte('created_at', oneDayAgo),
    supa.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', oneDayAgo).eq('is_bot', false),
    supa.from('gdpr_audits').select('*', { count: 'exact', head: true }).is('email_sent_at', null).gte('created_at', oneDayAgo),
    supa.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supa.from('tenants').select('*', { count: 'exact', head: true }),
    supa.from('outreach_contacts').select('*', { count: 'exact', head: true }),
    supa.from('gdpr_audits').select('*', { count: 'exact', head: true }),
    supa.from('sales_leads').select('*', { count: 'exact', head: true }),
  ]);
  return {
    last_24h: {
      audits: audits24h.count ?? 0,
      leads: leads24h.count ?? 0,
      pageviews: pageviews24h.count ?? 0,
      audits_unsent_email: auditsUnsent.count ?? 0,
    },
    totals: {
      audits: totalAudits.count ?? 0,
      leads: totalLeads.count ?? 0,
      tenants: tenants.count ?? 0,
      subscriptions: subs.count ?? 0,
      outreach_contacts: outreach.count ?? 0,
    },
  };
}

async function getResendKey(supa: ReturnType<typeof createClient>): Promise<string | null> {
  const env = Deno.env.get('RESEND_API_KEY');
  if (env && env.startsWith('re_')) return env;
  try {
    const { data } = await supa.rpc('get_app_secret', { secret_name: 'resend_api_key' });
    if (typeof data === 'string' && data.startsWith('re_')) return data;
  } catch { /* RPC may not exist */ }
  return null;
}

function renderEmail(stats: any): string {
  const last = stats.last_24h ?? {};
  const tot = stats.totals ?? {};
  const today = new Date().toLocaleDateString('de-DE');
  return `<!doctype html>
<html lang="de"><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;color:#18181b;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="padding:24px 8px;">
  <tr><td align="center">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;">
      <tr><td style="padding:32px 32px 16px;border-bottom:1px solid #e4e4e7;">
        <div style="font-size:11px;color:#71717a;letter-spacing:0.2em;text-transform:uppercase;font-weight:700;">RealSyncDynamics.AI · Daily Ops</div>
        <h1 style="margin:8px 0 4px;font-size:24px;">Daily Digest · ${today}</h1>
      </td></tr>
      <tr><td style="padding:24px 32px;">
        <h2 style="margin:0 0 12px;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;color:#52525b;">Letzte 24 Stunden</h2>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 24px;">
          <tr>
            <td style="padding:12px;background:#fafafa;border:1px solid #e4e4e7;width:25%;text-align:center;">
              <div style="font-size:11px;color:#71717a;text-transform:uppercase;">Audits</div>
              <div style="font-size:32px;font-weight:800;color:#0284c7;">${last.audits ?? 0}</div>
            </td>
            <td style="padding:12px;background:#fafafa;border:1px solid #e4e4e7;width:25%;text-align:center;">
              <div style="font-size:11px;color:#71717a;text-transform:uppercase;">Leads</div>
              <div style="font-size:32px;font-weight:800;color:#16a34a;">${last.leads ?? 0}</div>
            </td>
            <td style="padding:12px;background:#fafafa;border:1px solid #e4e4e7;width:25%;text-align:center;">
              <div style="font-size:11px;color:#71717a;text-transform:uppercase;">Pageviews</div>
              <div style="font-size:32px;font-weight:800;color:#7c3aed;">${last.pageviews ?? 0}</div>
            </td>
            <td style="padding:12px;background:${(last.audits_unsent_email ?? 0) > 5 ? '#fef3c7' : '#fafafa'};border:1px solid ${(last.audits_unsent_email ?? 0) > 5 ? '#fbbf24' : '#e4e4e7'};width:25%;text-align:center;">
              <div style="font-size:11px;color:#71717a;text-transform:uppercase;">Email Pending</div>
              <div style="font-size:32px;font-weight:800;color:${(last.audits_unsent_email ?? 0) > 5 ? '#d97706' : '#52525b'};">${last.audits_unsent_email ?? 0}</div>
            </td>
          </tr>
        </table>

        <h2 style="margin:0 0 12px;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;color:#52525b;">Total seit Launch</h2>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 24px;">
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;font-size:14px;">Tenants</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;font-size:14px;text-align:right;font-weight:700;">${tot.tenants ?? 0}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;font-size:14px;">Aktive Subscriptions</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;font-size:14px;text-align:right;font-weight:700;color:${(tot.subscriptions ?? 0) > 0 ? '#16a34a' : '#71717a'};">${tot.subscriptions ?? 0} ${(tot.subscriptions ?? 0) === 0 ? '(noch keine zahlenden Customer)' : ''}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;font-size:14px;">Outreach-Kontakte</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;font-size:14px;text-align:right;font-weight:700;">${tot.outreach_contacts ?? 0}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;font-size:14px;">Audits gesamt</td>
            <td style="padding:8px 12px;font-size:14px;text-align:right;font-weight:700;">${tot.audits ?? 0}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;font-size:14px;">Leads gesamt</td>
            <td style="padding:8px 12px;font-size:14px;text-align:right;font-weight:700;">${tot.leads ?? 0}</td>
          </tr>
        </table>

        <div style="margin:24px 0 0;text-align:center;">
          <a href="https://RealSyncDynamicsAI.de/admin/system" style="display:inline-block;padding:12px 28px;background:#0284c7;color:#fff;text-decoration:none;font-weight:700;font-size:14px;">Health Dashboard öffnen →</a>
        </div>
      </td></tr>
      <tr><td style="padding:24px 32px;border-top:1px solid #e4e4e7;font-size:11px;color:#71717a;line-height:1.6;">
        <p style="margin:0;">RealSync Dynamics · automatischer Daily-Digest · pg_cron 08:00 UTC</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}
function jsonError(status: number, code: string, message: string): Response {
  return json({ ok: false, error: { code, message } }, status);
}
