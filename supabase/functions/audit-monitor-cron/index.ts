/**
 * audit-monitor-cron — täglicher Re-Scan der monitored_domains.
 *
 * Auth: Bearer == CRON_AUDIT_MONITOR_KEY (Function Secret). pg_cron schickt
 * ihn über Vault `cron_audit_monitor_key` (dispatch_cron_function, Job
 * `audit-monitor-daily`, 04:00 UTC, Migration 20261009230000). Fail-closed:
 * leerer Key → 500 (keine Arbeit), falscher/fehlender Bearer → 401
 * "cron only". Der inbound Authorization wird nie mit
 * SUPABASE_SERVICE_ROLE_KEY verglichen; service_role dient nur dem
 * DB-Zugriff nach der Prüfung.
 *
 *   SELECT cron.schedule('audit-monitor-daily', '0 4 * * *',
 *     $$ SELECT public.dispatch_cron_function('audit-monitor-cron',
 *          'cron_audit_monitor_key', jsonb_build_object('trigger','cron')) $$);
 *
 * Plan-Gate (tenant_entitlements, nicht die Client-Spalte `tier`):
 *   monitoring.daily → täglich, monitoring.monthly → monatlich, sonst kein
 *   Dauerbetrieb (Free = Einmal-Scan); höchstens limit.domains Domains je
 *   Tenant; Drift-Mail nur mit alerts.email + monitoring.drift.
 * Jeder Lauf (auch ohne Delta, auch Fehler) → governance_evidence
 * (append_governance_evidence, Hash-Chain je Tenant).
 *
 * Logik: handler.ts / logic.ts / repo.ts, Tests: test/edge/audit-monitor-cron.test.ts.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { jsonError } from '../_shared/gateway.ts';
import { loadEntitlementsForTenant, hasFeature } from '../_shared/entitlements.ts';
import { handleAuditMonitor, type Alerter, type Scanner } from './handler.ts';
import { createSupabaseRepo } from './repo.ts';
import { checkCronAuth, normalizeCookieScan, planViewFrom } from './logic.ts';

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/** Die Entitlements, an denen der Dauerbetrieb hängt (ausgewertet in planViewFrom). */
const PLAN_KEYS = ['monitoring.daily', 'monitoring.monthly', 'monitoring.drift', 'alerts.email'] as const;

Deno.serve(async (req) => {
  try {
    const CRON_KEY = Deno.env.get('CRON_AUDIT_MONITOR_KEY') ?? '';
    const pre = checkCronAuth(CRON_KEY, req.headers.get('Authorization'));
    if (!pre.ok && req.method !== 'OPTIONS') return jsonError(pre.status, pre.code, pre.message);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!SUPABASE_URL || !SERVICE_KEY) return jsonError(500, 'CONFIG_MISSING', 'supabase env missing');
    const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? '';

    const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // Bestehender Scanner: Edge Function cookie-scan (fetch-basiert).
    const scanner: Scanner = async (d) => {
      const url = /^https?:\/\//i.test(d.domain) ? d.domain : `https://${d.domain}`;
      const { data, error } = await db.functions.invoke('cookie-scan', { body: { url, includeDetails: true } });
      if (error) throw new Error(`cookie-scan: ${error.message}`);
      return normalizeCookieScan(d.domain, data, new Date().toISOString());
    };

    // Bestehender Benachrichtigungsweg (Resend, wie zuvor in dieser Function).
    // Rendert aus dem gespeicherten Outbox-Payload; die Alert-ID ist der
    // Idempotency-Key, damit eine Wiederholung nach erfolgreichem Versand
    // (Markieren gescheitert) bei Resend nicht doppelt zustellt.
    const alerter: Alerter = async (a) => {
      if (!RESEND_KEY || !a.recipient) return 'not_configured';
      const p = a.payload;
      const li = (xs: string[]) => xs.map((t) => `<li>${esc(t)}</li>`).join('');
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        // Hängt Resend, zählt der Versuch als gescheitert (Outbox wiederholt) statt den Lauf zu blockieren.
        signal: AbortSignal.timeout(10_000),
        headers: {
          Authorization: `Bearer ${RESEND_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `audit-monitor-alert/${a.id}`,
        },
        body: JSON.stringify({
          from: 'RealSyncDynamics <monitor@realsyncdynamicsai.de>',
          to: [a.recipient],
          subject: p.critical ? `Kritisch: ${a.domain}` : `Drift: ${a.domain}`,
          html: `<div style="font-family:sans-serif;max-width:600px">
            <h2>Täglicher Re-Scan: Änderung erkannt</h2>
            <p><b>Domain:</b> ${esc(a.domain)}</p>
            <p><b>Risk-Score:</b> ${p.risk_score}/100 (Δ ${-p.score_delta} gegenüber dem letzten Lauf)</p>
            ${p.new_trackers.length ? `<h3>Neue Tracker</h3><ul>${li(p.new_trackers)}</ul>` : ''}
            ${p.removed_trackers.length ? `<h3>Entfernte Tracker</h3><ul>${li(p.removed_trackers)}</ul>` : ''}
            <p><a href="https://realsyncdynamicsai.de/dashboard">Dashboard öffnen</a></p></div>`,
        }),
      });
      if (!resp.ok) throw new Error(`resend ${resp.status}`);
      return 'sent';
    };

    return await handleAuditMonitor(req, {
      cronKey: CRON_KEY,
      repo: createSupabaseRepo(db),
      scanner,
      plan: async (tenantId) => {
        const ent = await loadEntitlementsForTenant(db, tenantId);
        return planViewFrom({
          has: (k) => (PLAN_KEYS as readonly string[]).includes(k) && hasFeature(ent, k),
          limit: (k) => (ent.byKey[k] ? ent.byKey[k].value : null),
        });
      },
      alerter,
      pauseMs: 2000,
    });
  } catch (e) {
    console.error('[audit-monitor-cron] unhandled', e);
    return jsonError(500, 'INTERNAL', 'internal error');
  }
});
