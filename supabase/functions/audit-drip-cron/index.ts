// Audit-Email-Drip-Cron — täglich 09:00 UTC.
//
// Holt fällige Drip-Rows (Tag 3 / 14 / 30 nach Audit-Erstellung), sendet
// pro Step die zugehörige Email via Resend, advanced den Drip-State.
// Bei Fehler bleibt next_send_at gleich → automatischer Retry am nächsten Tag.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface DueRow {
  id: string;
  audit_id: string;
  email: string;
  current_step: number;
  unsubscribe_token: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
  const FROM = Deno.env.get('RESEND_FROM') ?? 'RealSync Dynamics <hello@realsyncdynamicsai.de>';
  const SITE = Deno.env.get('PUBLIC_SITE_URL') ?? 'https://realsyncdynamicsai.de';

  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  const { data: due, error } = await admin.rpc('audit_email_drip_due', { p_limit: 50 });
  if (error) {
    return json({ ok: false, error: error.message }, 500);
  }

  const rows = (due ?? []) as DueRow[];
  if (rows.length === 0) {
    return json({ ok: true, sent: 0, message: 'no due drips' });
  }

  const sent: string[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const row of rows) {
    const stepToSend = row.current_step; // 0→sende step1, 1→sende step2, 2→sende step3
    const tpl = templateFor(stepToSend, { email: row.email, audit_id: row.audit_id, unsubscribe_token: row.unsubscribe_token, site: SITE });
    if (!tpl) {
      // Skip — kein Template für diesen Step
      continue;
    }

    try {
      if (!RESEND_KEY) {
        // No-op falls kein API-Key (Pre-Launch-Phase) — Drip-State trotzdem advancen
        // damit wir nicht stuck sind. In Production nach Resend-Setup wird real gesendet.
        await admin.rpc('audit_email_drip_advance', { p_id: row.id });
        sent.push(row.id);
        continue;
      }

      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM,
          to: [row.email],
          subject: tpl.subject,
          html: tpl.html,
          headers: {
            'List-Unsubscribe': `<${SITE}/api/drip-unsubscribe?token=${row.unsubscribe_token}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        }),
      });

      if (!resp.ok) {
        const txt = await resp.text();
        await admin.rpc('audit_email_drip_advance', { p_id: row.id, p_error: `resend ${resp.status}: ${txt.slice(0, 200)}` });
        failed.push({ id: row.id, error: `resend ${resp.status}` });
        continue;
      }

      await admin.rpc('audit_email_drip_advance', { p_id: row.id });
      sent.push(row.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await admin.rpc('audit_email_drip_advance', { p_id: row.id, p_error: msg.slice(0, 200) });
      failed.push({ id: row.id, error: msg });
    }
  }

  return json({ ok: true, sent: sent.length, failed: failed.length, total_due: rows.length });
});

interface TemplateContext {
  email: string;
  audit_id: string;
  unsubscribe_token: string;
  site: string;
}

function templateFor(step: number, ctx: TemplateContext): { subject: string; html: string } | null {
  const unsubscribe = `${ctx.site}/api/drip-unsubscribe?token=${ctx.unsubscribe_token}`;
  const auditUrl = `${ctx.site}/audit/share/${ctx.audit_id}`;

  if (step === 0) {
    // Tag 3 — Welcome + Methodology Walkthrough
    return {
      subject: 'Wie eure DSGVO-Audit-Ergebnisse zustande kommen',
      html: emailWrap(`
        <h1 style="font-size:22px;color:#0f172a;font-weight:700;margin:0 0 16px">Hallo,</h1>
        <p style="margin:0 0 16px">vor 3 Tagen hast du einen DSGVO-Audit-Report bei uns abgerufen. Damit du genau einschätzen kannst, was die Ergebnisse bedeuten:</p>
        <ul style="margin:0 0 16px;padding-left:20px;color:#374151">
          <li><strong>Wie wir prüfen:</strong> versionierte JSON-Regeln, kein LLM-Endurteil</li>
          <li><strong>Confidence-Indikator:</strong> High/Medium/Low pro Finding</li>
          <li><strong>Static-Limits:</strong> Server-Side-Tracking erkennen wir nicht — explizit dokumentiert</li>
        </ul>
        <p style="margin:0 0 24px"><a href="${ctx.site}/legal/methodology" style="color:#6366f1;text-decoration:underline">Volle Methodik einsehen</a></p>
        <a href="${auditUrl}" style="display:inline-block;padding:12px 20px;background:#6366f1;color:#fff;text-decoration:none;font-weight:600;border-radius:0">Deinen Report ansehen</a>
        <p style="margin:32px 0 8px;font-size:13px;color:#6b7280">Brauchst du Walkthrough? <a href="${ctx.site}/contact-sales?source=drip-step1" style="color:#6366f1">15-Min-Call buchen</a></p>
      `, unsubscribe),
    };
  }

  if (step === 1) {
    // Tag 14 — Re-Audit + Score-Drift
    return {
      subject: 'Re-Audit empfohlen — hat sich was geändert?',
      html: emailWrap(`
        <h1 style="font-size:22px;color:#0f172a;font-weight:700;margin:0 0 16px">In den letzten 14 Tagen…</h1>
        <p style="margin:0 0 16px">…haben sich auf vielen Sites Tracker-Sets geändert (Google-Tag-Manager-Templates, neue Marketing-Tags, A/B-Tests). Score-Drift ist die Regel, nicht die Ausnahme.</p>
        <p style="margin:0 0 24px"><strong>Empfehlung:</strong> Re-Audit deiner Site, Vergleich mit dem Stand vor 14 Tagen. Score-Differenz wird automatisch hervorgehoben.</p>
        <a href="${ctx.site}/audit?source=drip-step2&email=${encodeURIComponent(ctx.email)}" style="display:inline-block;padding:12px 20px;background:#6366f1;color:#fff;text-decoration:none;font-weight:600;border-radius:0">Re-Audit starten</a>
        <p style="margin:32px 0 8px;font-size:13px;color:#6b7280">Möchtest du wöchentliche Re-Audits + Alerts? <a href="${ctx.site}/cookie-consent-sdk" style="color:#6366f1">Pro-Tier ansehen (49 €/M)</a></p>
      `, unsubscribe),
    };
  }

  if (step === 2) {
    // Tag 30 — Pricing-Upsell
    return {
      subject: 'Audit-Pro: tieferer Compliance-Scan vor Aufsichts-Prüfung',
      html: emailWrap(`
        <h1 style="font-size:22px;color:#0f172a;font-weight:700;margin:0 0 16px">Wenn der Self-Service-Audit nicht reicht…</h1>
        <p style="margin:0 0 16px">…bieten wir <strong>Audit-Pro</strong> an: manueller Compliance-Tiefenscan mit signiertem PDF, druckfertig für BaFin-Sonderprüfung oder DSB-Audit.</p>
        <ul style="margin:0 0 16px;padding-left:20px;color:#374151">
          <li>Vollständige Sub-Processor-Identifikation (auch Server-Side-Tracking)</li>
          <li>Schrems-II-Risiko-Bewertung</li>
          <li>Schriftliche Maßnahmen-Liste mit Priorisierung</li>
          <li>Innerhalb 5 Werktagen</li>
        </ul>
        <p style="margin:0 0 24px"><strong>Einmalkauf 499 €</strong></p>
        <a href="${ctx.site}/audit-pro" style="display:inline-block;padding:12px 20px;background:#6366f1;color:#fff;text-decoration:none;font-weight:600;border-radius:0">Audit-Pro buchen</a>
        <p style="margin:32px 0 8px;font-size:13px;color:#6b7280">Lieber Strategie-Call vorher? <a href="${ctx.site}/contact-sales?source=drip-step3" style="color:#6366f1">15 Min mit Founder</a></p>
      `, unsubscribe),
    };
  }

  return null;
}

function emailWrap(body: string, unsubscribe: string): string {
  return `<!doctype html>
<html lang="de">
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;color:#374151;line-height:1.6">
  <div style="max-width:560px;margin:0 auto;background:#fff;padding:32px 28px;border:1px solid #e5e7eb">
    ${body}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px" />
    <p style="font-size:11px;color:#9ca3af;margin:0 0 8px">RealSync Dynamics · Schwarzburger Str. 31, 98724 Neuhaus am Rennweg · Made in Germany · EU-Hosted</p>
    <p style="font-size:11px;color:#9ca3af;margin:0">
      <a href="${unsubscribe}" style="color:#9ca3af;text-decoration:underline">Drip-Sequenz abbestellen</a>
    </p>
  </div>
</body>
</html>`;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
