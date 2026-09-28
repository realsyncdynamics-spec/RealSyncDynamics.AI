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
 * 2. Scannt jede fällige Domain — Takt aus `monitoring.daily` / `monitoring.monthly`,
 *    Playwright statt fetch bei `monitoring.browser_scan` (alles aus dem Abo)
 * 3. Drift-Detection gegen letzten Scan
 * 4. E-Mail-Alert via Resend bei neuen kritischen Findings
 * 5. Persistiert in audit_monitor_results
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse } from '../_shared/gateway.ts';
import { loadEntitlementsForTenant, hasFeature, type Entitlements } from '../_shared/entitlements.ts';
import { erlaubteKadenz, KADENZ_ABSTAND_MS, type Kadenz } from '../_shared/monitoring-cadence.ts';

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
  /** Kopie des Plan-Namens beim Anlegen — nicht maßgeblich, siehe monitorEntitlements(). */
  tier: string | null;
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
// Was steht diesem Tenant zu? — Takt, Scan-Art, Alarm
// ---------------------------------------------------------------------------
// Alle drei hängen am Abo, nicht an `monitored_domains.tier`. Diese Spalte ist
// eine Kopie des Plan-Namens aus dem Moment, in dem die Domain angelegt wurde,
// und sagt nach einem Planwechsel nichts mehr. Bis 2026-09-28 entschieden hier
// zwei Plan-Name-Vergleiche (`tier === 'starter'`, `['agency','enterprise']
// .includes(tier)`) — Zielarchitektur §10 verlangt Berechtigungen, damit der
// Umbau auf BASE + MODULE + SCALE eine Katalogänderung bleibt.
//
// Eine Verhaltensänderung ist damit verbunden, freigegeben am 2026-09-28:
// Free bekam bisher den täglichen Takt, weil „alles außer Starter" täglich lief.
// Der Katalog sagt Free kein Monitoring zu; jetzt gilt der Katalog. Gemessen
// trifft das niemanden — `monitored_domains` war zu dem Zeitpunkt leer.
interface MonitorEntitlements {
  /** `null` = der Plan enthält kein Monitoring. */
  cadence: Kadenz | null;
  browserScan: boolean;
  alerts: boolean;
}

function monitorEntitlements(ent: Entitlements): MonitorEntitlements {
  // Welche Kadenz ein Plan trägt, entscheidet genau eine Regel — dieselbe,
  // mit der `governance-monitoring-scheduler` drosselt. Eine zweite Auslegung
  // hier wäre die Drift, die `_shared/monitoring-cadence.ts` verhindern soll.
  return {
    cadence: erlaubteKadenz(hasFeature(ent, 'monitoring.daily'), hasFeature(ent, 'monitoring.monthly')),
    browserScan: hasFeature(ent, 'monitoring.browser_scan'),
    alerts: hasFeature(ent, 'alerts.email'),
  };
}

// Der Cron läuft einmal täglich. Startet ein Lauf ein paar Minuten früher als
// der letzte geendet hat, darf die Domain den Tag nicht auslassen — deshalb
// gilt eine Domain 4 Stunden vor Ablauf der Kadenz als fällig. (Vorher fest
// 20 h für täglich und 720 h für monatlich; täglich bleibt bei 20 h, monatlich
// wird um diese 4 h früher fällig.)
const FAELLIG_TOLERANZ_MS = 4 * 3_600_000;

function isDue(d: MonitoredDomain, cadence: Kadenz): boolean {
  if (!d.last_scan_at) return true;
  const elapsed = Date.now() - new Date(d.last_scan_at).getTime();
  return elapsed >= KADENZ_ABSTAND_MS[cadence] - FAELLIG_TOLERANZ_MS;
}

// ---------------------------------------------------------------------------
// Main Handler
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  // AP9 Welle 3: `verify_jwt = false` — bis hier konnte jeder Aufrufer alle
  // überwachten Domains scannen lassen (Playwright-Kosten, Resend-Versand).
  // Der Kopf dieser Datei verlangt seit jeher den Service-Role-Bearer aus dem
  // Cron; jetzt wird er auch geprüft. In Produktion ist derzeit kein Cron-Job
  // für diese Function registriert (gemessen 2026-09-01, `cron.job`).
  const authHeader = req.headers.get('Authorization') ?? '';
  if (authHeader !== `Bearer ${SERVICE_KEY}`) {
    return jsonResponse({ ok: false, error: 'cron only' }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const t0 = Date.now();
  const log: Array<{ domain: string; ok: boolean; drift: boolean; alerted: boolean; err?: string }> = [];

  try {
    const { data: domains, error: dbErr } = await supabase
      .from('monitored_domains').select('*').eq('active', true)
      .order('last_scan_at', { ascending: true, nullsFirst: true });
    if (dbErr) throw dbErr;
    if (!domains?.length) return jsonResponse({ ok: true, message: 'no domains', ms: Date.now()-t0 });

    console.log(`[monitor] ${domains.length} domains to check`);

    // Einmal je Tenant und Lauf — mehrere Domains eines Mandanten teilen sich
    // denselben Abo-Stand. `null` = nicht ladbar.
    const entCache = new Map<string, MonitorEntitlements | null>();
    const entitlementsFor = async (tenantId: string): Promise<MonitorEntitlements | null> => {
      if (entCache.has(tenantId)) return entCache.get(tenantId)!;
      let me: MonitorEntitlements | null = null;
      try {
        me = monitorEntitlements(await loadEntitlementsForTenant(supabase, tenantId));
      } catch (err) {
        console.warn(`[monitor] entitlements for ${tenantId} unavailable:`, err);
      }
      entCache.set(tenantId, me);
      return me;
    };

    for (const d of domains as MonitoredDomain[]) {
      const me = await entitlementsFor(d.tenant_id);
      // Fail closed: Ohne Abo-Stand weder scannen (Playwright kostet) noch
      // alarmieren. Als Fehler im Protokoll, nicht als stilles Überspringen —
      // sonst sähe ein dauerhaft kaputter RPC aus wie „nichts fällig".
      if (!me) {
        log.push({ domain: d.domain, ok: false, drift: false, alerted: false, err: 'entitlements unavailable' });
        continue;
      }
      if (me.cadence === null) { console.log(`[monitor] skip ${d.domain}: plan has no monitoring`); continue; }
      if (!isDue(d, me.cadence)) { console.log(`[monitor] skip ${d.domain}`); continue; }
      const useBrowser = me.browserScan && PW_URL !== '';
      console.log(`[monitor] scan ${d.domain} (${me.cadence}, ${useBrowser ? 'playwright' : 'fetch'})`);
      try {
        const scan = useBrowser
          ? await scanWithPlaywright(d.domain)
          : await scanWithFetch(d.domain);

        const drift = d.last_scan_at ? detectDrift(scan, d) : { has_drift: false, new_trackers: [], removed_trackers: [], score_delta: 0, new_critical_issues: [] };
        let alerted = false;
        if (drift.has_drift || drift.new_critical_issues.length > 0) {
          if (me.alerts) {
            await sendAlert(d, drift, scan);
            alerted = true;
          } else {
            console.log(`[monitor] alert suppressed for ${d.domain}: alerts.email not in plan`);
          }
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

    return jsonResponse({
      ok: true, ms: Date.now()-t0, timestamp: new Date().toISOString(),
      scanned: log.filter(r=>r.ok).length, drifts: log.filter(r=>r.drift).length,
      alerts: log.filter(r=>r.alerted).length, errors: log.filter(r=>!r.ok).length, log,
    });

  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
});
