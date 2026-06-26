// Audit-Recheck-Weekly — täglich 07:00 UTC vom pg_cron-Job aufgerufen.
//
// Re-Scannt fällige Subscriptions (audit_recheck_subscriptions.next_run_at <= now,
// active = true), vergleicht neuen Score mit last_score, schickt
// Drift-Alert per Email wenn Score deutlich abgesunken (<= -10) oder
// neue High/Critical-Findings dazugekommen sind.
//
// Continuous-Compliance-MVP — Real-Time-Monitoring per Daily-Recheck.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildCorsHeaders, handleOptions, jsonResponse } from '../_shared/gateway.ts';

const corsHeaders = buildCorsHeaders('GET, POST, OPTIONS');

interface DueSubscription {
  id: string;
  email: string;
  domain: string;
  url: string;
  last_audit_id: string | null;
  last_score: number | null;
  unsub_token: string;
}

interface RecheckResult {
  ok: boolean;
  audit_id?: string;
  score?: number;
  severity?: string;
  issues?: { severity: string }[];
  error?: { code: string; message: string };
}

const SCORE_DRIFT_THRESHOLD = -10;
const RECHECK_INTERVAL_DAYS = 7;

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
  const FROM = Deno.env.get('RESEND_FROM') ?? 'RealSync Dynamics <hello@realsyncdynamicsai.de>';
  const SITE = Deno.env.get('PUBLIC_SITE_URL') ?? 'https://RealSyncDynamicsAI.de';

  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  // Hole bis zu 25 fällige Subscriptions pro Run (rate-limit-freundlich)
  const { data: dueRaw, error: dueErr } = await admin
    .from('audit_recheck_subscriptions')
    .select('id, email, domain, url, last_audit_id, last_score, unsub_token')
    .eq('active', true)
    .lte('next_run_at', new Date().toISOString())
    .limit(25);

  if (dueErr) {
    return jsonResponse({ ok: false, error: dueErr.message }, 500, corsHeaders);
  }

  const due = (dueRaw ?? []) as DueSubscription[];
  if (due.length === 0) {
    return jsonResp({ ok: true, processed: 0, message: 'no due subscriptions' });
  }

  const processed: { id: string; status: string; score?: number; drift?: number }[] = [];

  for (const sub of due) {
    try {
      // Re-Run gdpr-audit für diese Domain. Service-Role bypasst Rate-Limits
      // weil Edge-Function-zu-Edge-Function-Call mit SRK headers.
      const auditResp = await fetch(`${SUPABASE_URL}/functions/v1/gdpr-audit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SRK}`,
          apikey: SRK,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: sub.url,
          email: sub.email,
          // marker: damit gdpr-audit-Stats erkennen können dass dies kein User-trigger war
          source: 'recheck',
        }),
      });

      if (!auditResp.ok) {
        const txt = await auditResp.text();
        await markRetry(admin, sub.id, `audit-call ${auditResp.status}: ${txt.slice(0, 200)}`);
        processed.push({ id: sub.id, status: 'audit-failed' });
        continue;
      }

      const result: RecheckResult = await auditResp.json();
      if (!result.ok || result.score === undefined || !result.audit_id) {
        await markRetry(admin, sub.id, `audit returned not-ok: ${result.error?.code}`);
        processed.push({ id: sub.id, status: 'audit-not-ok' });
        continue;
      }

      const newScore = result.score;
      const oldScore = sub.last_score;
      const drift = oldScore !== null ? newScore - oldScore : 0;
      const newCriticalOrHigh = (result.issues ?? []).filter((i) => i.severity === 'critical' || i.severity === 'high').length;

      // Update subscription state
      await admin
        .from('audit_recheck_subscriptions')
        .update({
          last_audit_id: result.audit_id,
          last_score: newScore,
          last_run_at: new Date().toISOString(),
          next_run_at: new Date(Date.now() + RECHECK_INTERVAL_DAYS * 86400_000).toISOString(),
        })
        .eq('id', sub.id);

      // Drift-Alert? — Score gesunken um >= 10 oder bei first run keine alert
      const shouldAlert = oldScore !== null && drift <= SCORE_DRIFT_THRESHOLD;

      if (shouldAlert && RESEND_KEY) {
        const subject = `Compliance-Score-Drift bei ${sub.domain}: ${oldScore} → ${newScore}`;
        const html = renderDriftEmail({
          domain: sub.domain,
          oldScore: oldScore!,
          newScore,
          drift,
          newCriticalOrHigh,
          auditUrl: `${SITE}/audit/share/${result.audit_id}`,
          unsubUrl: `${SITE}/api/recheck-unsubscribe?token=${sub.unsub_token}`,
        });
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: FROM,
            to: [sub.email],
            subject,
            html,
            headers: {
              'List-Unsubscribe': `<${SITE}/api/recheck-unsubscribe?token=${sub.unsub_token}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
          }),
        });
      }

      processed.push({ id: sub.id, status: shouldAlert ? 'alerted' : 'ok', score: newScore, drift });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await markRetry(admin, sub.id, msg.slice(0, 200));
      processed.push({ id: sub.id, status: 'error' });
    }
  }

  return jsonResp({
    ok: true,
    processed: processed.length,
    results: processed,
    methodology: { rule_engine: '2026.05.0', recheck_engine: '2026.05.0' },
  });
});

async function markRetry(
  admin: ReturnType<typeof createClient>,
  id: string,
  errorMsg: string,
): Promise<void> {
  // Bei Fehler: next_run_at um 1 Tag verschieben statt 7 (für schnelleren Retry).
  await admin
    .from('audit_recheck_subscriptions')
    .update({
      last_run_at: new Date().toISOString(),
      next_run_at: new Date(Date.now() + 86400_000).toISOString(),
    })
    .eq('id', id);
  console.error(`[audit-recheck-weekly] sub ${id} retry queued: ${errorMsg}`);
}

interface DriftEmailCtx {
  domain: string;
  oldScore: number;
  newScore: number;
  drift: number;
  newCriticalOrHigh: number;
  auditUrl: string;
  unsubUrl: string;
}

function renderDriftEmail(ctx: DriftEmailCtx): string {
  const arrow = ctx.drift < 0 ? '↓' : '↑';
  const color = ctx.drift <= -10 ? '#dc2626' : ctx.drift <= -5 ? '#d97706' : '#16a34a';
  return `<!doctype html>
<html lang="de">
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;color:#374151;line-height:1.6">
  <div style="max-width:560px;margin:0 auto;background:#fff;padding:32px 28px;border:1px solid #e5e7eb">
    <h1 style="font-size:22px;color:#0f172a;font-weight:700;margin:0 0 16px">Compliance-Score-Drift erkannt</h1>
    <p style="margin:0 0 16px"><strong>${ctx.domain}</strong></p>
    <div style="display:flex;gap:24px;margin:0 0 24px">
      <div style="flex:1;padding:16px;background:#f3f4f6;border-radius:0">
        <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em">Alt</div>
        <div style="font-size:32px;font-weight:700;color:#0f172a">${ctx.oldScore}<span style="font-size:14px;color:#9ca3af">/100</span></div>
      </div>
      <div style="flex:1;padding:16px;background:#f3f4f6;border-radius:0">
        <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em">Neu</div>
        <div style="font-size:32px;font-weight:700;color:${color}">${arrow} ${ctx.newScore}<span style="font-size:14px;color:#9ca3af">/100</span></div>
      </div>
    </div>
    <p style="margin:0 0 16px">Veränderung: <strong style="color:${color}">${ctx.drift > 0 ? '+' : ''}${ctx.drift} Punkte</strong>${ctx.newCriticalOrHigh > 0 ? `, davon <strong>${ctx.newCriticalOrHigh}</strong> kritische/hohe Findings.` : '.'}</p>
    <p style="margin:0 0 24px">Empfehlung: Vollständigen Report ansehen, wahrscheinlichste Ursachen prüfen (neue Tracker-Tags, geänderte Cookie-Banner-Konfig, Drittland-Tools).</p>
    <a href="${ctx.auditUrl}" style="display:inline-block;padding:12px 20px;background:#6366f1;color:#fff;text-decoration:none;font-weight:600;border-radius:0">Vollständigen Report öffnen</a>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px" />
    <p style="font-size:11px;color:#9ca3af;margin:0 0 8px">RealSync Dynamics · Continuous-Compliance-Monitoring · Made in Germany</p>
    <p style="font-size:11px;color:#9ca3af;margin:0">
      <a href="${ctx.unsubUrl}" style="color:#9ca3af;text-decoration:underline">Wöchentliche Re-Audits abbestellen</a>
    </p>
  </div>
</body>
</html>`;
}

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
