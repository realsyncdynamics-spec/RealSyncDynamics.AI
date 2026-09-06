/**
 * browser-agent-x07 — Beobachtung des ausgelieferten Browser-Zustands
 *
 * Modell: Artifact „Organisationsmodell für ein hierarchisches Multi-Agent-System"
 * v0.2, §02 (Sonderrolle), §03 (Ticketfluss), §09 (Anbindung).
 * Entscheid: ADR 0011 D1/D4/D5.
 *
 * Cron-Schedule (pg_cron; Muster wie audit-monitor-cron):
 *   SELECT cron.schedule(
 *     'browser-agent-x07-hourly',
 *     '0 * * * *',
 *     $$ SELECT net.http_post(
 *       url := 'https://<projekt>.supabase.co/functions/v1/browser-agent-x07',
 *       headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
 *     ) $$
 *   );
 *
 * ── Was diese Function tut ─────────────────────────────────────────────────
 * 1. Ruft für jede beobachtete Route den Playwright-Dienst auf (`/observe`)
 * 2. Leitet daraus Befunde ab (findings.ts — reine Abbildung, getestet)
 * 3. Eröffnet je Befund höchstens ein offenes Ticket in `agent_tickets`
 * 4. Schließt Tickets, deren Befund verschwunden ist (Verifikation, §03)
 *
 * ── Was sie ausdrücklich NICHT tut ─────────────────────────────────────────
 *
 * Sie behebt nichts. X07 meldet (§02). Und sie entscheidet nicht über
 * Autonomie: Ob ein Ticket ohne Freigabe zu einem Deploy führt, prüft die
 * Policy Engine serverseitig aus `severity` und `category` (ADR 0011 D1).
 *
 * ── Zwei belegte Abweichungen vom Modell ───────────────────────────────────
 *
 * a) §09 nennt eine „Playwright-basierte Edge Function". Edge Functions laufen
 *    in einem Deno-Isolat ohne Browser. Der Browser läuft deshalb im Dienst
 *    `services/playwright-scanner` (Endpunkt `/observe`), diese Function ruft
 *    ihn auf — dasselbe Muster wie `cookie-scan-deep` und `audit-monitor-cron`.
 *
 * b) §09 sagt „schreibt Rohbefunde in `runtime_events`". Das geht im
 *    Platform-Scope nicht: `runtime_events.tenant_id` ist NOT NULL mit
 *    Fremdschlüssel auf `tenants` (20260602100000, Zeile 178). X07 beobachtet
 *    die eigene Plattform, also ohne Tenant. Die Rohbefunde stehen deshalb in
 *    `agent_tickets.evidence` (jsonb) — dort, wo sie zum Befund gehören. Ein
 *    Platzhalter-Tenant nur zur Erfüllung eines Fremdschlüssels wäre eine
 *    erfundene Mandantenzeile in einem Mandantensystem.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse } from '../_shared/gateway.ts';
import { deriveFindings, isTicketOfRoute, ticketCode, type Finding, type ObserveResult } from './findings.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PW_URL = Deno.env.get('PLAYWRIGHT_SCANNER_URL') ?? '';
const PW_KEY = Deno.env.get('PLAYWRIGHT_SCANNER_KEY') ?? '';
const BASE_URL = Deno.env.get('X07_BASE_URL') ?? 'https://realsyncdynamicsai.de';

/** Der Agent-Schlüssel aus dem Modell (§06) — Platform-Scope, tenant_id IS NULL. */
const AGENT_KEY = 'browser-agent-x07';

interface WatchedRoute {
  path: string;
  /** Elemente, die auf dieser Route sichtbar sein müssen. */
  expectVisible: string[];
}

/**
 * Beobachtete Routen.
 *
 * Bewusst eine Konstante und keine Tabelle: Solange niemand sie pflegt, wäre
 * eine Tabelle nur eine leere Tabelle — und ein Agent, der nichts beobachtet,
 * sieht aus wie einer, der nichts findet. Wird die Liste länger als ein
 * Codereview verträgt, gehört sie in `agent_*`-Konfiguration; das ist dann
 * eine eigene Entscheidung.
 */
const WATCHED_ROUTES: WatchedRoute[] = [
  { path: '/', expectVisible: [] },
  { path: '/pricing', expectVisible: [] },
  { path: '/audit', expectVisible: [] },
];

interface TicketRow {
  id: string;
  ticket_code: string;
  status: string;
}

async function observeRoute(route: WatchedRoute): Promise<ObserveResult> {
  const resp = await fetch(`${PW_URL}/observe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(PW_KEY ? { Authorization: `Bearer ${PW_KEY}` } : {}),
    },
    body: JSON.stringify({
      url: `${BASE_URL}${route.path}`,
      options: {
        viewports: [
          { label: 'desktop', width: 1280, height: 900 },
          { label: 'mobile', width: 390, height: 844 },
        ],
        ...(route.expectVisible.length > 0 ? { expect_visible: route.expectVisible } : {}),
      },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`observe ${route.path} → HTTP ${resp.status}: ${text.slice(0, 200)}`);
  }
  return await resp.json() as ObserveResult;
}

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  // Cron-only: Diese Function startet echte Browser-Läufe und schreibt in den
  // Prüfpfad. Ohne diese Prüfung könnte jeder Aufrufer beides auslösen.
  const authHeader = req.headers.get('Authorization') ?? '';
  if (authHeader !== `Bearer ${SERVICE_KEY}`) {
    return jsonResponse({ ok: false, error: 'cron only' }, 401);
  }

  if (!PW_URL) {
    return jsonResponse(
      { ok: false, error: 'PLAYWRIGHT_SCANNER_URL not configured. Deploy playwright-scanner first.' },
      503,
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Ohne Agenten-Zeile kein Ticket: `agent_tickets.source_agent_id` ist NOT NULL
  // mit ON DELETE RESTRICT — ein Befund ohne Melder hat keine Herkunft. Die Zeile
  // legt die Seed-Migration 20260904011000 an.
  const { data: agent, error: agentErr } = await supabase
    .from('agents')
    .select('id, status')
    .eq('agent_key', AGENT_KEY)
    .is('tenant_id', null)
    .maybeSingle();

  if (agentErr) {
    return jsonResponse({ ok: false, error: `agent lookup failed: ${agentErr.message}` }, 500);
  }
  if (!agent) {
    return jsonResponse(
      { ok: false, error: `agent '${AGENT_KEY}' not registered in platform scope — run migration 20260904011000` },
      503,
    );
  }
  if (agent.status !== 'active') {
    return jsonResponse({ ok: true, skipped: `agent status is '${agent.status}'`, tickets: [] });
  }

  const opened: string[] = [];
  const reopened: string[] = [];
  const closed: string[] = [];
  const failures: Array<{ route: string; error: string }> = [];
  const seenCodes = new Set<string>();

  for (const route of WATCHED_ROUTES) {
    let observation: ObserveResult;
    try {
      observation = await observeRoute(route);
    } catch (err) {
      // Eine Route, die nicht beobachtet werden kann, darf den Lauf nicht
      // beenden — sonst verdeckt die erste kaputte Route alle weiteren.
      failures.push({ route: route.path, error: err instanceof Error ? err.message : String(err) });
      continue;
    }

    const findings: Finding[] = deriveFindings(route.path, observation);

    for (const finding of findings) {
      const code = ticketCode(route.path, finding.code);
      seenCodes.add(code);

      const { data: existing } = await supabase
        .from('agent_tickets')
        .select('id, ticket_code, status')
        .eq('ticket_code', code)
        .maybeSingle<TicketRow>();

      const evidence = {
        ...finding.evidence,
        observed_at: observation.meta.observed_at,
        final_url: observation.meta.final_url,
        http_status: observation.meta.http_status,
        observer_version: observation.meta.observer_version,
      };

      if (!existing) {
        const { error } = await supabase.from('agent_tickets').insert({
          tenant_id: null,
          ticket_code: code,
          source_agent_id: agent.id,
          category: finding.category,
          severity: finding.severity,
          status: 'open',
          evidence,
          visibility: 'internal',
        });
        if (error) failures.push({ route: route.path, error: `insert ${code}: ${error.message}` });
        else opened.push(code);
      } else if (existing.status === 'closed') {
        // Derselbe Befund ist zurück. Ein zweites Ticket wäre nicht möglich
        // (ticket_code ist UNIQUE) und auch nicht richtig — die Geschichte
        // gehört an denselben Vorgang.
        const { error } = await supabase
          .from('agent_tickets')
          .update({ status: 'reopened', evidence, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) failures.push({ route: route.path, error: `reopen ${code}: ${error.message}` });
        else reopened.push(code);
      } else {
        // Ticket ist offen und bleibt offen; nur die Belege werden frisch.
        await supabase
          .from('agent_tickets')
          .update({ evidence, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      }
    }
  }

  // ── Verifikation (§03): Was nicht mehr gefunden wird, wird geschlossen ────
  //
  // Nur für Routen, die in diesem Lauf tatsächlich beobachtet werden konnten.
  // Sonst schlösse ein Ausfall des Playwright-Dienstes reihenweise Tickets,
  // deren Fehler unverändert bestehen.
  const observedRoutes = WATCHED_ROUTES
    .filter((r) => !failures.some((f) => f.route === r.path))
    .map((r) => r.path);

  if (observedRoutes.length > 0) {
    const { data: openTickets } = await supabase
      .from('agent_tickets')
      .select('id, ticket_code, status')
      .is('tenant_id', null)
      .eq('source_agent_id', agent.id)
      .in('status', ['open', 'reopened', 'verifying']);

    for (const t of (openTickets ?? []) as TicketRow[]) {
      if (seenCodes.has(t.ticket_code)) continue;
      const belongsToObservedRoute = observedRoutes.some((path) => isTicketOfRoute(t.ticket_code, path));
      if (!belongsToObservedRoute) continue;
      const { error } = await supabase
        .from('agent_tickets')
        .update({ status: 'closed', updated_at: new Date().toISOString() })
        .eq('id', t.id);
      if (!error) closed.push(t.ticket_code);
    }
  }

  return jsonResponse({
    ok: failures.length === 0,
    agent: AGENT_KEY,
    base_url: BASE_URL,
    routes_observed: observedRoutes.length,
    opened,
    reopened,
    closed,
    failures,
  });
});
