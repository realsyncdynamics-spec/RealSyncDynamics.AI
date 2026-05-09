/**
 * audit-monitor-cron — Täglicher Compliance-Monitoring-Cron-Job
 *
 * Cron-Schedule (pg_cron, im Supabase SQL-Editor einrichten):
 *   SELECT cron.schedule(
 *     'audit-monitor-daily',
 *     '0 3 * * *',
 *     $$ SELECT net.http_post(
 *       url := 'https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/audit-monitor-cron',
 *       headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
 *     ) $$
 *   );
 *
 * Was dieser Job tut:
 * 1. Holt alle aktiven Monitoring-Domains aus monitored_domains
 * 2. Scannt jede Domain (fetch für Starter/Growth, Playwright für Agency/Enterprise)
 * 3. Drift-Detection gegen letzten Scan
 * 4. E-Mail-Alert via Resend bei neuen kritischen Findings
 * 5. Persistiert in audit_monitor_results
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_KEY   = Deno.env.get('RESEND_API_KEY') ?? '';
const PW_URL       = Deno.env.get('PLAYWRIGHT_SCANNER_URL') ?? '';
const PW_KEY       = Deno.env.get('PLAYWRIGHT_SCANNER_KEY') ?? '';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface MonitoredDomain {
  id: string; tenant_id: string; domain: string;
  tier: 'starter' | 'growth' | 'agency' | 'enterprise';
  last_scan_at: string | null; last_risk_score: number | null;
  last_trackers: string[]; alert_email: string | null; active: boolean;
}
interface ScanResult {
  domain: string; risk_score: number; trackers: string[];
  cookie_count: number; consent_manager_detected: boolean;
  issues: Array<{ id: string; risk: string; issue: string }>;
  scanned_at: string; scan_type: 'fetch' | 'playwright';
}
interface DriftReport {
  has_drift: boolean; new_trackers: string[]; removed_trackers: string[];
  score_delta: number; new_critical_issues: Array<{ id: string; risk: string; issue: string }>;
}

// ---------------------------------------------------------------------------
// Scan: fetch (Starter / Growth)
// ---------------------------------------------------------------------------
async function scanWithFetch(domain: string): Promise<ScanResult> {
  const url = domain.startsWith('http') ? domain : `https://${domain}`;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data, error } = await supabase.functions.invoke('cookie-scan', {
    body: { url, includeDetails: true },
  });
  if (error) throw new Error(`cookie-scan: ${error.message}`);
  return {
    domain, scan_type: 'fetch',
    risk_score: data?.riskScore ?? 50,
    trackers: (data?.trackers ?? []).map((t: { tracker: string }) => t.tracker),
    cookie_count: data?.cookieCount ?? 0,
    consent_manager_detected: data?.consentManager?.detected ?? false,
    issues: data?.issues ?? [],
    scanned_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Scan: Playwright (Agency / Enterprise)
// ---------------------------------------------------------------------------
async function scanWithPlaywright(domain: string): Promise<ScanResult> {
  if (!PW_URL) return scanWithFetch(domain);
  const url = domain.startsWith('http') ? domain : `https://${domain}`;
  const resp = await fetch(`${PW_URL}/scan/full`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(PW_KEY ? { 'x-api-key': PW_KEY } : {}) },
    body: JSON.stringify({ url }),
  });
  if (!resp.ok) { console.warn(`[monitor] PW failed ${resp.status}, fallback`); return scanWithFetch(domain); }
  const d = await resp.json();
  const trackers: string[] = d.trackers_detected ?? [];
  const critical = ['google_analytics','meta_pixel','tiktok_pixel'];
  const score = Math.max(0, 100 - trackers.filter(t => critical.includes(t)).length * 20);
  return {
    domain, scan_type: 'playwright', risk_score: score,
    trackers, cookie_count: d.cookie_count ?? 0,
    consent_manager_detected: d.consent_manager?.detected ?? false,
    issues: trackers.map(t => ({ id: `tracker-${t}`, risk: critical.includes(t) ? 'critical' : 'high', issue: `Tracker: ${t}` })),
    scanned_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Drift Detection
// ---------------------------------------------------------------------------
function detectDrift(curr: ScanResult, prev: MonitoredDomain): DriftReport {
  const prevT = prev.last_trackers ?? [];
  const newT = curr.trackers.filter(t => !prevT.includes(t));
  const removedT = prevT.filter(t => !curr.trackers.includes(t));
  const delta = (prev.last_risk_score ?? 100) - curr.risk_score;
  const newCrit = curr.issues.filter(i => i.risk === 'critical' && newT.some(t => i.id.includes(t)));
  return { has_drift: newT.length > 0 || removedT.length > 0 || Math.abs(delta) > 10,
    new_trackers: newT, removed_trackers: removedT, score_delta: delta, new_critical_issues: newCrit };
}

// ---------------------------------------------------------------------------
// E-Mail Alert
// ---------------------------------------------------------------------------
async function sendAlert(domain: MonitoredDomain, drift: DriftReport, scan: ScanResult) {
  if (!domain.alert_email || !RESEND_KEY) return;
  if (!drift.has_drift && drift.new_critical_issues.length === 0) return;
  const subject = drift.new_critical_issues.length > 0
    ? `⚠️ Kritisch: ${domain.domain}` : `📊 Drift: ${domain.domain}`;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'RealSyncDynamics <monitor@realsyncdynamicsai.de>',
      to: [domain.alert_email], subject,
      html: `<div style="font-family:sans-serif;max-width:600px">
        <h2>Compliance-Alert</h2>
        <p><b>Domain:</b> ${domain.domain}</p>
        <p><b>Risk-Score:</b> ${scan.risk_score}/100 (Δ ${drift.score_delta > 0 ? '-' : '+'}${Math.abs(drift.score_delta)})</p>
        ${drift.new_trackers.length > 0 ? `<h3 style="color:#dc2626">Neue Tracker</h3><ul>${drift.new_trackers.map(t=>`<li>${t}</li>`).join('')}</ul>` : ''}
        ${drift.removed_trackers.length > 0 ? `<h3 style="color:#16a34a">Entfernte Tracker</h3><ul>${drift.removed_trackers.map(t=>`<li>${t}</li>`).join('')}</ul>` : ''}
        <p><a href="https://realsyncdynamicsai.de/dashboard" style="background:#1a1a2e;color:white;padding:10px 20px;text-decoration:none">Dashboard öffnen</a></p>
      </div>`,
    }),
  });
  console.log(`[monitor] alert → ${domain.alert_email}`);
}

// ---------------------------------------------------------------------------
// shouldScan heute?
// ---------------------------------------------------------------------------
function shouldScan(d: MonitoredDomain): boolean {
  if (!d.last_scan_at) return true;
  const hrs = (Date.now() - new Date(d.last_scan_at).getTime()) / 36e5;
  return d.tier === 'starter' ? hrs >= 720 : hrs >= 20; // starter=30d, rest=täglich
}

// ---------------------------------------------------------------------------
// Main Handler
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const t0 = Date.now();
  const log: Array<{ domain: string; ok: boolean; drift: boolean; alerted: boolean; err?: string }> = [];

  try {
    const { data: domains, error: dbErr } = await supabase
      .from('monitored_domains').select('*').eq('active', true)
      .order('last_scan_at', { ascending: true, nullsFirst: true });
    if (dbErr) throw dbErr;
    if (!domains?.length) return new Response(
      JSON.stringify({ ok: true, message: 'no domains', ms: Date.now()-t0 }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    );

    console.log(`[monitor] ${domains.length} domains to check`);

    for (const d of domains as MonitoredDomain[]) {
      if (!shouldScan(d)) { console.log(`[monitor] skip ${d.domain}`); continue; }
      console.log(`[monitor] scan ${d.domain} (tier=${d.tier})`);
      try {
        const scan = ['agency','enterprise'].includes(d.tier) && PW_URL
          ? await scanWithPlaywright(d.domain)
          : await scanWithFetch(d.domain);

        const drift = d.last_scan_at ? detectDrift(scan, d) : { has_drift: false, new_trackers: [], removed_trackers: [], score_delta: 0, new_critical_issues: [] };
        let alerted = false;
        if (drift.has_drift || drift.new_critical_issues.length > 0) {
          await sendAlert(d, drift, scan);
          alerted = true;
        }

        await supabase.from('monitored_domains').update({
          last_scan_at: scan.scanned_at, last_risk_score: scan.risk_score, last_trackers: scan.trackers,
        }).eq('id', d.id);

        await supabase.from('audit_monitor_results').insert({
          monitored_domain_id: d.id, tenant_id: d.tenant_id, domain: d.domain,
          risk_score: scan.risk_score, trackers: scan.trackers,
          cookie_count: scan.cookie_count, consent_manager_detected: scan.consent_manager_detected,
          drift_detected: drift.has_drift, new_trackers: drift.new_trackers,
          removed_trackers: drift.removed_trackers, score_delta: drift.score_delta,
          raw_result: scan, scan_type: scan.scan_type, scanned_at: scan.scanned_at,
        });

        log.push({ domain: d.domain, ok: true, drift: drift.has_drift, alerted });
        console.log(`[monitor] ✓ ${d.domain} score=${scan.risk_score} drift=${drift.has_drift}`);
      } catch (err) {
        console.error(`[monitor] ✗ ${d.domain}`, err);
        log.push({ domain: d.domain, ok: false, drift: false, alerted: false, err: String(err) });
      }
      await new Promise(r => setTimeout(r, 2000));
    }

    return new Response(JSON.stringify({
      ok: true, ms: Date.now()-t0, timestamp: new Date().toISOString(),
      scanned: log.filter(r=>r.ok).length, drifts: log.filter(r=>r.drift).length,
      alerts: log.filter(r=>r.alerted).length, errors: log.filter(r=>!r.ok).length, log,
    }), { headers: { ...CORS, 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
