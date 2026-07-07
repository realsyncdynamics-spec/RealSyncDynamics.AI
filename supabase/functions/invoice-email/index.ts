// Invoice Email via Resend — sends PDF invoice when invoice.paid fires.
//
// POST /functions/v1/invoice-email
// Body: { stripe_invoice_id: string, tenant_id: string }
//
// 1. Fetches invoice metadata + PDF from invoices table
// 2. Fetches tenant + primary contact email
// 3. Renders HTML invoice summary email
// 4. Attaches PDF if available
// 5. Sends via Resend
// 6. Updates invoice_email_sent_at to prevent duplicate sends
//
// Idempotent. Graceful no-op if RESEND_API_KEY missing.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

interface InvoiceRow {
  stripe_invoice_id: string;
  stripe_customer_id: string | null;
  amount_due_cents: number;
  currency: string;
  status: string;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  billing_reason: string | null;
  created_at: string;
  invoice_email_sent_at: string | null;
}

interface TenantRow {
  tenant_id: string;
  name: string;
  billing_email: string | null;
}

interface SubscriptionRow {
  plan_key: string | null;
  stripe_customer_id: string;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  let body: { stripe_invoice_id?: string; tenant_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  const { stripe_invoice_id, tenant_id } = body;
  if (!stripe_invoice_id || !tenant_id) {
    return jsonError(400, 'BAD_REQUEST', 'stripe_invoice_id and tenant_id required');
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Fetch invoice
  const { data: invoice, error: invErr } = await supa
    .from('stripe_invoices')
    .select('*')
    .eq('stripe_invoice_id', stripe_invoice_id)
    .eq('tenant_id', tenant_id)
    .maybeSingle();

  if (invErr || !invoice) {
    return jsonError(404, 'NOT_FOUND', `invoice ${stripe_invoice_id} not found`);
  }

  const inv = invoice as InvoiceRow;

  // Skip if already sent
  if (inv.invoice_email_sent_at) {
    return jsonResponse({
      ok: true,
      skipped: 'already_sent',
      sent_at: inv.invoice_email_sent_at,
    });
  }

  // Fetch tenant for billing email
  const { data: tenantRow, error: tenantErr } = await supa
    .from('public.tenants')
    .select('id as tenant_id, name, billing_email')
    .eq('id', tenant_id)
    .maybeSingle();

  if (tenantErr || !tenantRow) {
    return jsonError(404, 'NOT_FOUND', `tenant ${tenant_id} not found`);
  }

  const tenant = tenantRow as TenantRow;
  const recipientEmail = tenant.billing_email || inv.stripe_customer_id;
  if (!recipientEmail) {
    return jsonError(400, 'NO_EMAIL', 'no billing email or customer id for invoice');
  }

  // Get Resend API key
  const apiKey = await getResendKey(supa);
  if (!apiKey) {
    return jsonResponse({
      ok: true,
      skipped: 'no_api_key',
      hint: 'set RESEND_API_KEY env or vault.resend_api_key',
    });
  }

  // Render email HTML
  const html = renderInvoiceEmail(tenant.name, inv);
  const subject = `Invoice ${inv.stripe_invoice_id.slice(-8).toUpperCase()} — RealSyncDynamics.AI`;
  const fromAddr = Deno.env.get('INVOICE_EMAIL_FROM') ?? 'billing@realsyncdynamicsai.de';
  const fromName = 'RealSync Dynamics Billing';

  // Prepare email payload
  const emailPayload = {
    from: `${fromName} <${fromAddr}>`,
    to: [recipientEmail],
    subject,
    html,
    reply_to: 'kontakt@realsyncdynamicsai.de',
    tags: [{ name: 'category', value: 'invoice' }],
  };

  // Send email via Resend
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(emailPayload),
  });

  if (!resp.ok) {
    const err = await resp.text();
    return jsonError(502, 'RESEND_FAILED', err.slice(0, 500));
  }

  const sent = await resp.json();

  // Mark as sent
  await supa
    .from('stripe_invoices')
    .update({ invoice_email_sent_at: new Date().toISOString() })
    .eq('stripe_invoice_id', stripe_invoice_id);

  return jsonResponse({
    ok: true,
    sent_id: sent.id,
    to: recipientEmail,
    invoice_id: stripe_invoice_id,
  });
});

async function getResendKey(
  supa: ReturnType<typeof createClient>
): Promise<string | null> {
  const env = Deno.env.get('RESEND_API_KEY');
  if (env && env.startsWith('re_')) return env;
  try {
    const { data } = await supa.rpc('get_app_secret', {
      secret_name: 'resend_api_key',
    });
    if (typeof data === 'string' && data.startsWith('re_')) return data;
  } catch {
    /* RPC may not exist; fall through */
  }
  return null;
}

function renderInvoiceEmail(tenantName: string, inv: InvoiceRow): string {
  const amountEuro = (inv.amount_due_cents / 100).toFixed(2);
  const createdDate = new Date(inv.created_at).toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const invoiceLinkHtml = inv.hosted_invoice_url
    ? `<p style="margin:16px 0 0 0;text-align:center;">
         <a href="${escapeHtml(inv.hosted_invoice_url)}" style="display:inline-block;padding:10px 24px;background:#0284c7;color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;">
           Rechnung anzeigen →
         </a>
       </p>`
    : '';

  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rechnung</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;color:#18181b;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="padding:24px 8px;">
  <tr><td align="center">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;">
      <tr><td style="padding:32px 32px 24px 32px;border-bottom:1px solid #e4e4e7;">
        <div style="font-size:11px;color:#71717a;letter-spacing:0.2em;text-transform:uppercase;font-weight:700;">RealSyncDynamics.AI</div>
        <h1 style="margin:8px 0 4px 0;font-size:24px;color:#18181b;">Rechnung eingegangen</h1>
        <div style="font-size:14px;color:#52525b;">Zahlungsbestätigung für Ihren Workspace</div>
      </td></tr>
      <tr><td style="padding:24px 32px;">
        <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;">
          Hallo ${escapeHtml(tenantName)},
        </p>
        <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;">
          vielen Dank für Ihre Zahlung. Hier ist eine Zusammenfassung Ihrer Rechnung:
        </p>

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:24px 0;border:1px solid #e4e4e7;">
          <tr style="background:#f9fafb;">
            <td style="padding:12px 16px;font-weight:700;font-size:13px;color:#52525b;">Rechnungsnummer</td>
            <td style="padding:12px 16px;text-align:right;font-family:monospace;font-size:13px;">${escapeHtml(inv.stripe_invoice_id.slice(-12))}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;font-weight:700;font-size:13px;color:#52525b;">Betrag</td>
            <td style="padding:12px 16px;text-align:right;font-size:16px;font-weight:700;color:#18181b;">${amountEuro} ${inv.currency.toUpperCase()}</td>
          </tr>
          <tr style="background:#f9fafb;">
            <td style="padding:12px 16px;font-weight:700;font-size:13px;color:#52525b;">Datum</td>
            <td style="padding:12px 16px;text-align:right;font-size:13px;">${createdDate}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;font-weight:700;font-size:13px;color:#52525b;">Status</td>
            <td style="padding:12px 16px;text-align:right;"><span style="display:inline-block;padding:4px 8px;background:#dcfce7;color:#166534;font-size:12px;font-weight:700;border-radius:3px;">Bezahlt</span></td>
          </tr>
        </table>

        <p style="margin:24px 0 0 0;font-size:14px;line-height:1.6;color:#52525b;">
          Alle Rechnungen und Zahlungsinformationen finden Sie jederzeit im <strong>Abrechnung-Dashboard</strong> unter Ihrem Workspace.
        </p>

        ${invoiceLinkHtml}

        <p style="margin:24px 0 0 0;font-size:13px;line-height:1.6;color:#52525b;">
          Bei Fragen zu Ihrer Rechnung wenden Sie sich gerne an <a href="mailto:kontakt@realsyncdynamicsai.de" style="color:#0284c7;">kontakt@realsyncdynamicsai.de</a>.
        </p>
      </td></tr>
      <tr><td style="padding:24px 32px;border-top:1px solid #e4e4e7;font-size:12px;color:#71717a;line-height:1.6;">
        <p style="margin:0 0 8px 0;">
          <a href="https://RealSyncDynamicsAI.de/app/billing" style="color:#0284c7;">Abrechnungsdashboard</a> ·
          <a href="https://RealSyncDynamicsAI.de/legal/privacy" style="color:#0284c7;">Datenschutz</a> ·
          <a href="https://RealSyncDynamicsAI.de/legal/terms" style="color:#0284c7;">Bedingungen</a>
        </p>
        <p style="margin:0;">RealSync Dynamics · Made in Germany · EU-Hosted (Frankfurt)</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
