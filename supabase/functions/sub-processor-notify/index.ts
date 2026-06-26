// Sub-Processor-Change-Notify — täglich 08:00 UTC vom pg_cron-Job aufgerufen.
//
// Holt pending changes (notify_at <= now, notified_at IS NULL), iteriert
// über alle aktiven Subscriptions, sendet 30-Tage-Vorab-Notice via Resend,
// loggt jede Notification append-only, marked Change als notified.
//
// Pflicht nach Art. 28 Abs. 2 DSGVO + Audit-Trail-fähig.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse } from '../_shared/gateway.ts';

interface Change {
  id: string;
  change_type: string;
  processor_name: string;
  description: string;
  effective_from: string;
  notify_at: string;
}

interface Subscription {
  id: string;
  email: string;
  unsub_token: string;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
  const FROM = Deno.env.get('RESEND_FROM') ?? 'RealSync Dynamics <hello@realsyncdynamicsai.de>';
  const SITE = Deno.env.get('PUBLIC_SITE_URL') ?? 'https://RealSyncDynamicsAI.de';

  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  // 1. Pending changes
  const { data: changes, error: chgErr } = await admin.rpc('sub_processor_changes_pending');
  if (chgErr) return jsonResponse({ ok: false, error: chgErr.message }, 500);

  const pending = (changes ?? []) as Change[];
  if (pending.length === 0) {
    return jsonResponse({ ok: true, message: 'no pending changes', notifications: 0 });
  }

  // 2. Aktive Subscriptions (verified, not unsubscribed)
  const { data: subsRaw, error: subErr } = await admin
    .from('sub_processor_subscriptions')
    .select('id, email, unsub_token')
    .is('unsubscribed_at', null);
  if (subErr) return jsonResponse({ ok: false, error: subErr.message }, 500);

  const subs = (subsRaw ?? []) as Subscription[];
  if (subs.length === 0) {
    // Keine Subscribers — Changes als notified markieren, damit nicht in nächstem Run wiederholt
    for (const c of pending) {
      await admin.rpc('sub_processor_change_mark_notified', { p_id: c.id });
    }
    return jsonResponse({ ok: true, message: 'no subscribers, changes marked notified', notifications: 0 });
  }

  // 3. Pro Change × Subscription Notification-Mail senden, Audit-Trail loggen
  let totalSent = 0;
  let totalFailed = 0;

  for (const change of pending) {
    for (const sub of subs) {
      // Idempotent: skip wenn schon notified
      const { data: existing } = await admin
        .from('sub_processor_notifications')
        .select('id')
        .eq('change_id', change.id)
        .eq('subscription_id', sub.id)
        .maybeSingle();
      if (existing) continue;

      const subject = `[RealSync Dynamics] Sub-Processor-Änderung: ${change.processor_name}`;
      const html = renderChangeEmail({
        change,
        unsubUrl: `${SITE}/api/sp-unsubscribe?token=${sub.unsub_token}`,
        site: SITE,
      });

      let messageId: string | null = null;
      let errorMsg: string | null = null;

      if (RESEND_KEY) {
        try {
          const resp = await fetch('https://api.resend.com/emails', {
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
                'List-Unsubscribe': `<${SITE}/api/sp-unsubscribe?token=${sub.unsub_token}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
              },
            }),
          });
          if (!resp.ok) {
            const txt = await resp.text();
            errorMsg = `resend ${resp.status}: ${txt.slice(0, 300)}`;
          } else {
            const json = await resp.json();
            messageId = (json.id as string) ?? null;
          }
        } catch (e) {
          errorMsg = e instanceof Error ? e.message : String(e);
        }
      } else {
        errorMsg = 'RESEND_API_KEY missing — no-op';
      }

      // Audit-Trail-Eintrag
      await admin.from('sub_processor_notifications').insert({
        change_id: change.id,
        subscription_id: sub.id,
        email: sub.email,
        resend_message_id: messageId,
        error_message: errorMsg,
      });

      if (errorMsg && !errorMsg.includes('no-op')) {
        totalFailed++;
      } else {
        totalSent++;
      }
    }

    // Marked als notified, sobald über alle Subs iteriert
    await admin.rpc('sub_processor_change_mark_notified', { p_id: change.id });
  }

  return jsonResponse({
    ok: true,
    changes_processed: pending.length,
    subscriptions: subs.length,
    notifications_sent: totalSent,
    notifications_failed: totalFailed,
  });
});

interface EmailCtx {
  change: Change;
  unsubUrl: string;
  site: string;
}

function renderChangeEmail(ctx: EmailCtx): string {
  const c = ctx.change;
  const effectiveDate = new Date(c.effective_from).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
  const typeLabel = {
    added: 'Neuer Sub-Processor',
    removed: 'Sub-Processor entfernt',
    replaced: 'Sub-Processor ersetzt',
    region_changed: 'Region geändert',
    purpose_changed: 'Verarbeitungs-Zweck geändert',
  }[c.change_type] ?? c.change_type;

  return `<!doctype html>
<html lang="de">
<body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f9fafb;margin:0;padding:24px;color:#374151;line-height:1.6">
  <div style="max-width:560px;margin:0 auto;background:#fff;padding:32px 28px;border:1px solid #e5e7eb">
    <h1 style="font-size:22px;color:#0f172a;font-weight:700;margin:0 0 16px">
      Sub-Processor-Änderung — 30 Tage Vorab-Notice
    </h1>
    <p style="margin:0 0 16px">Gemäß Art. 28 Abs. 2 DSGVO informieren wir dich über eine geplante Änderung in unserer Sub-Processor-Liste:</p>

    <div style="padding:16px;background:#f3f4f6;border-left:4px solid #6366f1;margin:0 0 24px">
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px">${typeLabel}</div>
      <div style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 6px">${c.processor_name}</div>
      <div style="font-size:14px;color:#374151;margin:0 0 12px">${c.description}</div>
      <div style="font-size:13px;color:#6b7280">Wirksam ab: <strong style="color:#0f172a">${effectiveDate}</strong></div>
    </div>

    <p style="margin:0 0 24px">Falls du der Änderung widersprechen möchtest, kannst du das innerhalb der 30-Tage-Frist mit Antwort auf diese Email tun. Bei Widerspruch besprechen wir alternative Lösungen oder eine fristgerechte Vertrags-Kündigung.</p>

    <a href="${ctx.site}/legal/sub-processors" style="display:inline-block;padding:12px 20px;background:#6366f1;color:#fff;text-decoration:none;font-weight:600;border-radius:0">Volle Sub-Processor-Liste ansehen</a>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px" />
    <p style="font-size:11px;color:#9ca3af;margin:0 0 8px">RealSync Dynamics · Schwarzburger Str. 31, 98724 Neuhaus am Rennweg · Made in Germany · EU-Hosted</p>
    <p style="font-size:11px;color:#9ca3af;margin:0">
      <a href="${ctx.unsubUrl}" style="color:#9ca3af;text-decoration:underline">Sub-Processor-Notifications abbestellen</a>
    </p>
  </div>
</body>
</html>`;
}

