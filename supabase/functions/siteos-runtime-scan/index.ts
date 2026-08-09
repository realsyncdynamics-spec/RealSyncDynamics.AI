// siteos-runtime-scan — die acht Runtime-Analysen gegen eine Live-Site.
//
// POST /functions/v1/siteos-runtime-scan
// Auth: Authorization: Bearer <user JWT>
// Body:
//   {
//     tenant_id: string,
//     url: string,
//     blueprint_id?: string,   // verankert den Scan an einer Version
//     trigger?: 'deploy' | 'cron' | 'manual' | 'agent'
//   }
//
// Analysiert DSGVO, EU AI Act, TDDDG, Barrierefreiheit, Sicherheit,
// Performance, SEO und Inhalt. Ist ein `blueprint_id` angegeben, wird die
// statische Blueprint-Analyse mitgeführt (scope='combined') — Struktur- und
// Auslieferungsfehler stehen dann in einem Bericht.
//
// Der HTML-Body wird für die Analyse gelesen, aber NICHT gespeichert
// (Art. 5 Abs. 1 lit. c DSGVO). Persistiert werden nur die abgeleiteten
// Signale und die Befunde.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError, methodNotAllowed } from '../_shared/gateway.ts';
import { audit } from '../_shared/auditLog.ts';
import {
  analyzeBlueprint,
  analyzeObservation,
  computeScores,
  planAgentTasks,
  type RuntimeFinding,
  type SiteBlueprint,
  type SiteObservation,
} from '../../../packages/siteos-core/src/index.ts';

const FETCH_TIMEOUT_MS = 15_000;
const MAX_HTML_BYTES = 2_000_000;
const VALID_TRIGGERS = new Set(['deploy', 'cron', 'manual', 'agent']);

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return methodNotAllowed();

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  const tenantId = String(body.tenant_id ?? '').trim();
  const rawUrl = String(body.url ?? '').trim();
  if (!tenantId) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  if (!rawUrl) return jsonError(400, 'BAD_REQUEST', 'url required');

  const urlCheck = validateTargetUrl(rawUrl);
  if (!urlCheck.ok) return jsonError(400, 'BAD_REQUEST', urlCheck.reason);
  const target = urlCheck.url;

  const triggerInput = String(body.trigger ?? 'manual');
  const trigger = VALID_TRIGGERS.has(triggerInput) ? triggerInput : 'manual';

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  const userId = userResp.user.id;
  const userEmail = userResp.user.email ?? null;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: member } = await admin
    .from('memberships').select('user_id')
    .eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  if (!member) return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');

  // Optionaler Blueprint-Bezug. Die Abfrage ist tenant-gefiltert, damit ein
  // fremder Blueprint nicht über die ID adressierbar ist.
  let blueprint: SiteBlueprint | null = null;
  let blueprintId: string | null = null;
  if (typeof body.blueprint_id === 'string' && body.blueprint_id.trim() !== '') {
    const { data: row } = await admin
      .from('siteos_blueprints').select('id, blueprint')
      .eq('tenant_id', tenantId).eq('id', body.blueprint_id.trim())
      .maybeSingle<{ id: string; blueprint: SiteBlueprint }>();
    if (!row) return jsonError(404, 'NOT_FOUND', 'blueprint not found for this tenant');
    blueprint = row.blueprint;
    blueprintId = row.id;
  }

  const observedAt = new Date().toISOString();

  let observation: SiteObservation;
  try {
    observation = await observe(target);
  } catch (e) {
    const message = (e as Error)?.message ?? String(e);
    // Ein nicht erreichbares Ziel ist ein Ergebnis, kein Serverfehler —
    // es wird als fehlgeschlagener Scan protokolliert und bleibt sichtbar.
    const { data: failed } = await admin.from('siteos_runtime_scans').insert({
      tenant_id: tenantId, blueprint_id: blueprintId, url: target.toString(),
      trigger, scope: blueprint ? 'combined' : 'live', status: 'failed',
      findings: [], finding_count: 0, error_message: message.slice(0, 500),
      observed_at: observedAt,
    }).select('id').single();

    return jsonError(502, 'TARGET_UNREACHABLE', `target could not be fetched: ${message}`, undefined, {
      scan_id: failed?.id ?? null,
    });
  }

  try {
    const expectsAiDisclosure = blueprint?.pages.some((p) => p.blocks.some((b) => b.aiGenerated)) ?? false;
    const findings: RuntimeFinding[] = [
      ...analyzeObservation(observation, {
        expectsAiDisclosure,
        expectedLang: blueprint?.locales.default,
      }),
      ...(blueprint ? analyzeBlueprint(blueprint) : []),
    ];

    const scores = computeScores(findings);

    const { data: scan, error: scanErr } = await admin.from('siteos_runtime_scans').insert({
      tenant_id: tenantId,
      blueprint_id: blueprintId,
      url: target.toString(),
      trigger,
      scope: blueprint ? 'combined' : 'live',
      status: 'completed',
      findings,
      finding_count: findings.length,
      severity_max: scores.severityMax,
      // Ohne HTML-Body — nur die abgeleiteten Signale.
      observation: {
        status_code: observation.statusCode,
        headers: observation.headers,
        ttfb_ms: Math.round(observation.ttfbMs),
        transfer_bytes: observation.transferBytes,
        third_party_hosts: observation.thirdPartyHosts,
        cookies_before_consent: observation.cookiesBeforeConsent,
      },
      observed_at: observedAt,
    }).select('id').single();

    if (scanErr || !scan) {
      console.error(JSON.stringify({ level: 'error', scope: 'siteos_scan_insert_failed', error: scanErr?.message }));
      return jsonError(500, 'INTERNAL', 'could not persist scan');
    }

    await admin.from('siteos_scores').insert({
      tenant_id: tenantId, scan_id: scan.id, blueprint_id: blueprintId,
      health: scores.health, risk: scores.risk, compliance: scores.compliance,
      performance: scores.performance, ai_risk: scores.aiRisk, dimensions: scores.dimensions,
    });

    const tasks = planAgentTasks(findings);
    if (tasks.length > 0) {
      await admin.from('siteos_agent_runs').insert(tasks.map((task) => ({
        tenant_id: tenantId, blueprint_id: blueprintId, scan_id: scan.id,
        agent: task.agent,
        status: task.requiresApproval ? 'awaiting_approval' : 'queued',
        finding_codes: task.findingCodes, severity_max: task.severityMax,
        requires_approval: task.requiresApproval,
      })));
    }

    // Kritische Befunde gehören in die Governance-Runtime, nicht nur in ein
    // Dashboard — dort hängen Fristen (72h nach Art. 33 DSGVO) und der
    // Incident-Dispatch daran.
    if (scores.severityMax === 'critical') {
      const critical = findings.filter((f) => f.severity === 'critical');
      try {
        const { error: incidentErr } = await admin.from('incidents').insert({
          tenant_id: tenantId,
          title: `SiteOS: kritischer Befund auf ${target.hostname}`,
          description: critical.map((f) => `${f.code}: ${f.title} (${f.reference})`).join('\n'),
          severity: 'critical',
          status: 'open',
          detected_at: observedAt,
          timeline: [{
            at: observedAt,
            event: 'siteos.runtime-scan',
            scan_id: scan.id,
            url: target.toString(),
            codes: critical.map((f) => f.code),
          }],
        });
        if (incidentErr) throw new Error(incidentErr.message);
      } catch (incidentErr) {
        // Das Scan-Ergebnis darf an der Incident-Anlage nicht scheitern —
        // der Fehlschlag wird aber protokolliert, nicht verschluckt.
        console.error(JSON.stringify({
          level: 'warn', scope: 'siteos_incident_dispatch_failed', scan_id: scan.id,
          error: (incidentErr as Error)?.message ?? String(incidentErr),
        }));
      }
    }

    await audit(admin, {
      tenant_id: tenantId, actor_user_id: userId, actor_email: userEmail,
      action: 'siteos.scan.complete', target_type: 'siteos_runtime_scan', target_id: scan.id,
      payload: {
        url: target.toString(), trigger, finding_count: findings.length,
        severity_max: scores.severityMax, health: scores.health, compliance: scores.compliance,
      },
    });

    return jsonResponse({
      ok: true,
      scan_id: scan.id,
      blueprint_id: blueprintId,
      url: target.toString(),
      findings,
      scores,
      agent_tasks: tasks,
    });
  } catch (e) {
    console.error(JSON.stringify({
      level: 'error', scope: 'siteos_runtime_scan_failed',
      error: (e as Error)?.message ?? String(e),
    }));
    return jsonError(500, 'INTERNAL', 'siteos-runtime-scan failed');
  }
});

// ─────────────────────────────────────────────────────────────────────
// Zielprüfung — SSRF-Schutz
// ─────────────────────────────────────────────────────────────────────

/**
 * Diese Function ruft eine vom Aufrufer bestimmte URL ab. Ohne Schranke
 * wäre sie ein Werkzeug, um aus dem Supabase-Netz heraus interne Dienste
 * anzusprechen. Erlaubt sind daher nur http/https auf öffentliche Hosts;
 * Adressliterale aus privaten Bereichen und Nicht-Standard-Ports werden
 * abgelehnt.
 *
 * Hinweis: Das schließt DNS-Rebinding nicht aus — dafür müsste der Host
 * vor dem Abruf aufgelöst und die Verbindung an die geprüfte IP gebunden
 * werden. Der Filter senkt die Angriffsfläche, ersetzt aber keine
 * Netzsegmentierung.
 */
function validateTargetUrl(raw: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'url is not parseable' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'only http and https targets are allowed' };
  }

  if (url.port !== '' && url.port !== '80' && url.port !== '443') {
    return { ok: false, reason: 'only default ports are allowed' };
  }

  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    return { ok: false, reason: 'internal hostnames are not allowed' };
  }
  if (isPrivateAddressLiteral(host)) {
    return { ok: false, reason: 'private address literals are not allowed' };
  }

  return { ok: true, url };
}

function isPrivateAddressLiteral(host: string): boolean {
  // IPv6-Literale kommen in URL.hostname in eckigen Klammern an.
  if (host.startsWith('[')) {
    const inner = host.slice(1, -1);
    return inner === '::1' || inner.startsWith('fc') || inner.startsWith('fd') || inner.startsWith('fe80');
  }

  const parts = host.split('.');
  if (parts.length !== 4) return false;
  const octets = parts.map((p) => Number(p));
  if (octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) return false;

  const [a, b] = octets;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true; // Link-local, u. a. Cloud-Metadaten
  return false;
}

// ─────────────────────────────────────────────────────────────────────
// Beobachtung
// ─────────────────────────────────────────────────────────────────────

async function observe(url: URL): Promise<SiteObservation> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const startedAt = performance.now();

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'RealSyncSiteOS-Scanner/1.0 (+https://realsyncdynamics.ai)' },
    });
    const ttfbMs = performance.now() - startedAt;

    const headers: Record<string, string> = {};
    for (const [key, value] of response.headers) headers[key.toLowerCase()] = value;

    const raw = await response.text();
    const html = raw.length > MAX_HTML_BYTES ? raw.slice(0, MAX_HTML_BYTES) : raw;

    return {
      url: url.toString(),
      observedAt: new Date().toISOString(),
      statusCode: response.status,
      headers,
      html,
      cookiesBeforeConsent: parseSetCookies(response.headers, url.hostname),
      thirdPartyHosts: extractThirdPartyHosts(html, url.hostname),
      ttfbMs,
      transferBytes: new TextEncoder().encode(raw).length,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Cookies aus der Antwort auf den nackten Abruf. Da kein Consent-Dialog
 * bedient wurde, ist jedes hier gesetzte Cookie per Definition vor der
 * Einwilligung gesetzt.
 */
function parseSetCookies(headers: Headers, host: string): { name: string; host: string }[] {
  // `getSetCookie` liefert die Header einzeln; ältere Runtimes fassen sie
  // zu einem String zusammen — beide Formen werden bedient.
  const values = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : (headers.get('set-cookie') ?? '').split(/,(?=\s*[^=;,]+=)/).filter((s) => s.trim() !== '');

  const cookies: { name: string; host: string }[] = [];
  for (const value of values) {
    const name = value.split('=')[0]?.trim();
    if (name) cookies.push({ name, host });
  }
  return cookies;
}

/**
 * Fremd-Hosts aus src/href-Attributen. Nur Sub-Ressourcen zählen —
 * ausgehende Links im Fließtext kontaktieren keinen Drittanbieter und
 * dürfen deshalb keinen Befund auslösen.
 */
function extractThirdPartyHosts(html: string, ownHost: string): string[] {
  const hosts = new Set<string>();
  const pattern = /<(?:script|img|iframe|link|source|video|audio)\b[^>]*?\b(?:src|href)\s*=\s*["'](https?:\/\/[^"']+)["']/gi;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    try {
      const host = new URL(match[1]).hostname.toLowerCase();
      if (host !== ownHost.toLowerCase() && !host.endsWith(`.${ownHost.toLowerCase()}`)) hosts.add(host);
    } catch {
      // Nicht parsebare URL — kein Befund, kein Abbruch.
    }
  }

  return [...hosts].sort();
}
