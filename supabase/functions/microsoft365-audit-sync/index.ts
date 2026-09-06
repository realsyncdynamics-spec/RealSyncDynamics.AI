// microsoft365-audit-sync — holt Microsoft-365-Prueferereignisse und bewertet
// sie nachgelagert (Plan P2-2, Durchsetzbarkeits-Klasse C).
//
// POST /functions/v1/microsoft365-audit-sync   (verify_jwt = false, eigener
//   Bearer-Check gegen SUPABASE_SERVICE_ROLE_KEY — der Aufrufer ist pg_cron)
//   { connection_id? }   // ohne Angabe: alle verbundenen Anbindungen
//
// pg_cron-Beispiel (stuendlich):
//   SELECT cron.schedule('m365-audit-hourly', '17 * * * *',
//     $$ SELECT net.http_post(
//          url := '<projekt>/functions/v1/microsoft365-audit-sync',
//          headers := jsonb_build_object('Authorization',
//                       'Bearer ' || current_setting('app.service_role_key'))
//        ) $$);
//
// ⚠️ Ein registrierter Cron-Job ist noch kein laufender: Der Decay-Worker aus
// RFC-003 ist seit dem 2026-08-12 registriert und in allen Laeufen an einem
// fehlenden Vault-Geheimnis gescheitert (CLAUDE.md §5). Wer diesen Job
// einrichtet, prueft `cron.job_run_details.status`, nicht `cron.job`.
//
// WAS DIESER JOB TUT
//   1. Anbindung laden, Geheimnis entsiegeln, Graph-Token holen
//   2. Je Strom ab dem gespeicherten Zeiger abholen (begrenzte Seitenzahl)
//   3. Jedes Ereignis auf Merkmale reduzieren (K6) und vom PDP bewerten lassen
//   4. Ehrlich speichern: `block` wird zu `react` mit Vermerk der Herabstufung
//   5. In `enforce` einen Vorgang anlegen; in `shadow` nur protokollieren
//   6. Zeiger und Verbindungsstatus fortschreiben
//
// WARUM DIE BEWERTUNG NICHT HIER STEHT: Sie steht in
// `_shared/pdp/m365event.ts`. Ein zweiter Ort mit derselben Logik ist der
// Fragmentierungsbefund (§1.4 des Plans) — dieselbe Ueberlegung wie beim
// Bot-PEP, den drei Kanaele benutzen.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse } from '../_shared/gateway.ts';
import { importSecretKey, open } from '../_shared/secretBox.ts';
import { sha256Hex } from '../_shared/hash.ts';
import { fetchGraphToken, graphCollect } from '../_shared/m365/graph.ts';
import {
  evaluateM365Event,
  normalizeActivity,
  type M365EventFacts,
} from '../_shared/pdp/m365event.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** Wie weit zurueck ein erster Lauf greift. */
const FIRST_RUN_LOOKBACK_HOURS = 24;

/** Obergrenze je Lauf und Strom — die Edge Function hat ein Zeitlimit. */
const MAX_PAGES = 5;

interface Connection {
  id: string;
  tenant_id: string;
  azure_tenant_id: string;
  client_id: string;
  credentials_enc: string | null;
  streams: string[];
  primary_domain: string | null;
}

// deno-lint-ignore no-explicit-any
type Admin = any;

async function loadSealKey(admin: Admin): Promise<CryptoKey | null> {
  let b64 = Deno.env.get('INTEGRATION_CREDENTIALS_KEY') ?? null;
  if (!b64) {
    try {
      const { data } = await admin.rpc('get_app_secret', {
        secret_name: 'integration_credentials_key',
      });
      if (typeof data === 'string' && data.length > 0) b64 = data;
    } catch { /* Vault optional — env ist der Primaerweg */ }
  }
  if (!b64) return null;
  try { return await importSecretKey(b64); } catch { return null; }
}

/** Graph-Pfad je Strom, ab dem Zeiger. */
function pathFor(stream: string, since: string): string {
  if (stream === 'sign_ins') {
    const f = encodeURIComponent(`createdDateTime gt ${since}`);
    return `/auditLogs/signIns?$filter=${f}&$top=100`;
  }
  const filter = encodeURIComponent(`activityDateTime gt ${since}`);
  return `/auditLogs/directoryAudits?$filter=${filter}&$top=100`;
}

/**
 * Alle Textfelder eines Ereignisses, zusammengefuegt — **nur** fuer die lokale
 * Signalerkennung. Dieser String verlaesst den Prozess nicht; er geht in
 * `M365EventFacts.raw_text` und wird dort ausschliesslich von `detectSignals`
 * gelesen. Siehe die Injektionsgrenze in `_shared/pdp/m365event.ts`.
 */
function collectText(ev: Record<string, unknown>): string {
  const parts: string[] = [];
  const walk = (v: unknown, depth: number) => {
    if (depth > 4) return;
    if (typeof v === 'string') { parts.push(v); return; }
    if (Array.isArray(v)) { for (const x of v) walk(x, depth + 1); return; }
    if (v && typeof v === 'object') {
      for (const x of Object.values(v as Record<string, unknown>)) walk(x, depth + 1);
    }
  };
  walk(ev, 0);
  return parts.join(' ').slice(0, 20_000);
}

/** Der Handelnde — als Pseudonym, nie im Klartext. */
async function actorOf(
  ev: Record<string, unknown>,
  stream: string,
  primaryDomain: string | null,
): Promise<{ ref: string | null; external: boolean }> {
  let upn: string | null = null;
  if (stream === 'sign_ins') {
    const v = ev.userPrincipalName;
    if (typeof v === 'string') upn = v;
  } else {
    const init = ev.initiatedBy as Record<string, unknown> | undefined;
    const u = init?.user as Record<string, unknown> | undefined;
    const a = init?.app as Record<string, unknown> | undefined;
    const cand = u?.userPrincipalName ?? a?.displayName;
    if (typeof cand === 'string') upn = cand;
  }
  if (!upn) return { ref: null, external: false };

  const lower = upn.toLowerCase();
  const domain = lower.includes('@') ? lower.split('@').pop() ?? '' : '';
  // Ohne bekannte Hauptdomaene wird niemand als „extern" ausgewiesen: Eine
  // erfundene Zuordnung waere schlechter als keine. Die Hauptdomaene stammt
  // aus Graph, nicht aus einer Eingabe (siehe fetchPrimaryDomain).
  const external = primaryDomain ? domain !== primaryDomain : false;
  return { ref: await sha256Hex(lower), external };
}

function occurredAt(ev: Record<string, unknown>, stream: string): string | null {
  const v = stream === 'sign_ins' ? ev.createdDateTime : ev.activityDateTime;
  return typeof v === 'string' ? v : null;
}

function resultOf(ev: Record<string, unknown>, stream: string): 'success' | 'failure' | 'unknown' {
  if (stream === 'sign_ins') {
    const s = ev.status as Record<string, unknown> | undefined;
    const code = s?.errorCode;
    if (typeof code === 'number') return code === 0 ? 'success' : 'failure';
    return 'unknown';
  }
  const r = ev.result;
  if (r === 'success') return 'success';
  if (r === 'failure') return 'failure';
  return 'unknown';
}

/**
 * Die Reaktion: ein Ereignis und ein Vorgang, die einen Menschen erreichen.
 *
 * `governance_incidents.event_id` ist NOT NULL — deshalb entsteht zuerst ein
 * `governance_events`-Eintrag. Dessen `event_source` kennt `microsoft365`
 * seit der Migration 20260905100000.
 *
 * WARUM `risk_level` FEST 'high' IST: `governance_incidents` laesst nur 'high'
 * und 'critical' zu. Eine Reaktion entsteht in Klasse C nur, wenn eine Regel
 * sperren wollte — das ist per Definition der schwere Fall.
 */
async function react(
  admin: Admin,
  conn: Connection,
  facts: M365EventFacts,
  reasons: string[],
  signals: string[],
  downgradedFrom: string | null,
): Promise<string | null> {
  try {
    const { data: gev, error: gerr } = await admin.from('governance_events').insert({
      tenant_id: conn.tenant_id,
      event_type: facts.activity_kind,
      event_source: 'microsoft365',
      title: `Microsoft 365: ${facts.activity_kind}`,
      summary: downgradedFrom
        ? `Richtlinie entschied „${downgradedFrom}" — nachgelagert festgestellt, nicht verhinderbar.`
        : 'Nachgelagert festgestelltes Ereignis mit Richtlinienbezug.',
      risk_level: 'high',
      // Bewusst KEIN policy_action: Die Spalte kennt nur allow/log/warn/block/
      // require_approval. Dort 'block' einzutragen behauptete eine Sperre, die
      // es nicht gab — genau die Unehrlichkeit, die P2-2 vermeiden soll.
      payload: {
        connection_id: conn.id,
        graph_id: facts.graph_id,
        stream: facts.stream,
        activity_kind: facts.activity_kind,
        actor_external: facts.actor_external,
        result: facts.result,
        // Nur Signalnamen — der Rohtext bleibt im Quellsystem (K6).
        signals,
        reasons,
        downgraded_from: downgradedFrom,
        enforcement_class: 'C',
      },
    }).select('id').single();

    if (gerr || !gev) {
      console.error('[m365-sync] governance_event insert failed', gerr?.message);
      return null;
    }

    const { data: inc, error: ierr } = await admin.from('governance_incidents').insert({
      tenant_id: conn.tenant_id,
      event_id: gev.id,
      risk_level: 'high',
      escalation_source: 'policy',
      status: 'open',
      priority: 'high',
      summary: downgradedFrom
        ? `Microsoft 365 (${facts.activity_kind}): Richtlinie wollte „${downgradedFrom}" — `
          + 'die Anbindung ist nachgelagert und konnte es nicht verhindern.'
        : `Microsoft 365 (${facts.activity_kind}): Richtlinienbefund.`,
      description: { reasons, downgraded_from: downgradedFrom, enforcement_class: 'C' },
    }).select('id').single();

    if (ierr || !inc) {
      console.error('[m365-sync] incident insert failed', ierr?.message);
      return null;
    }
    return inc.id as string;
  } catch (e) {
    console.error('[m365-sync] react failed', e);
    return null;
  }
}

async function syncConnection(
  admin: Admin,
  key: CryptoKey,
  conn: Connection,
): Promise<Record<string, unknown>> {
  const summary = {
    connection_id: conn.id,
    fetched: 0,
    stored: 0,
    reacted: 0,
    downgraded: 0,
    errors: [] as string[],
  };

  if (!conn.credentials_enc) {
    summary.errors.push('kein Geheimnis hinterlegt');
    return summary;
  }

  let secret: string;
  try {
    const opened = await open(key, conn.credentials_enc) as { client_secret?: string };
    secret = String(opened?.client_secret ?? '');
    if (!secret) throw new Error('leer');
  } catch {
    await admin.from('m365_connections')
      .update({ status: 'error', last_error: 'Siegel konnte nicht geoeffnet werden' })
      .eq('id', conn.id);
    summary.errors.push('Siegel konnte nicht geoeffnet werden');
    return summary;
  }

  let token: string;
  try {
    const t = await fetchGraphToken({
      azure_tenant_id: conn.azure_tenant_id,
      client_id: conn.client_id,
      client_secret: secret,
    });
    token = t.access_token;
  } catch (e) {
    const detail = (e as Error)?.message ?? 'unbekannt';
    await admin.from('m365_connections')
      .update({ status: 'error', last_error: detail })
      .eq('id', conn.id);
    summary.errors.push(detail);
    return summary;
  }

  for (const stream of conn.streams) {
    if (stream !== 'directory_audits' && stream !== 'sign_ins') continue;

    const { data: state } = await admin
      .from('m365_sync_state')
      .select('id, watermark_at, events_seen')
      .eq('connection_id', conn.id)
      .eq('stream', stream)
      .maybeSingle();

    const since = state?.watermark_at
      ?? new Date(Date.now() - FIRST_RUN_LOOKBACK_HOURS * 3600_000).toISOString();

    let events: Record<string, unknown>[] = [];
    try {
      events = await graphCollect(token, pathFor(stream, since), MAX_PAGES);
    } catch (e) {
      const detail = (e as Error)?.message ?? 'unbekannt';
      summary.errors.push(`${stream}: ${detail}`);
      // Der Zeiger bleibt stehen, wenn die Abholung scheitert — sonst gingen
      // die Ereignisse dieses Fensters verloren, ohne dass es jemand merkt.
      await admin.from('m365_sync_state').upsert({
        tenant_id: conn.tenant_id,
        connection_id: conn.id,
        stream,
        last_run_at: new Date().toISOString(),
        last_error: detail,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'connection_id,stream' });
      continue;
    }

    summary.fetched += events.length;
    let newest = since;

    for (const ev of events) {
      const graphId = typeof ev.id === 'string' ? ev.id : null;
      const at = occurredAt(ev, stream);
      if (!graphId || !at) continue;
      if (at > newest) newest = at;

      const actor = await actorOf(ev, stream, conn.primary_domain);
      const targets = ev.targetResources;
      const facts: M365EventFacts = {
        tenant_id: conn.tenant_id,
        connection_id: conn.id,
        graph_id: graphId,
        stream,
        occurred_at: at,
        activity_kind: normalizeActivity(
          typeof ev.activityDisplayName === 'string' ? ev.activityDisplayName : null,
          typeof ev.category === 'string' ? ev.category : null,
        ),
        result: resultOf(ev, stream),
        actor_ref: actor.ref,
        actor_external: actor.external,
        target_count: Array.isArray(targets) ? targets.length : 0,
        raw_text: collectText(ev),
      };

      const verdict = await evaluateM365Event(admin, facts);

      let incidentId: string | null = null;
      if (verdict.react) {
        incidentId = await react(
          admin, conn, facts, verdict.reasons, verdict.signals, verdict.downgraded_from,
        );
      }

      // `upsert` mit `ignoreDuplicates`: Derselbe Lauf zweimal ausgefuehrt darf
      // keine zweite Bewertung desselben Vorgangs erzeugen. Die Eindeutigkeit
      // liegt auf (tenant_id, graph_id) und traegt die Idempotenz des ganzen
      // Abholpfads.
      const { error: insErr } = await admin.from('m365_audit_events').upsert({
        tenant_id: conn.tenant_id,
        connection_id: conn.id,
        graph_id: graphId,
        stream,
        occurred_at: at,
        activity_kind: facts.activity_kind,
        result: facts.result,
        actor_ref: facts.actor_ref,
        actor_external: facts.actor_external,
        target_count: facts.target_count,
        signals: verdict.signals,
        classification: verdict.classification,
        verdict: verdict.verdict,
        verdict_downgraded_from: verdict.downgraded_from,
        pdp_status: verdict.pdp_status,
        reasons: verdict.reasons,
        matched_policy_ids: verdict.matched_policy_ids,
        incident_id: incidentId,
      }, { onConflict: 'tenant_id,graph_id', ignoreDuplicates: true });

      if (insErr) {
        summary.errors.push(`speichern: ${insErr.message}`);
        continue;
      }
      summary.stored += 1;
      if (incidentId) summary.reacted += 1;
      if (verdict.downgraded_from) summary.downgraded += 1;
    }

    await admin.from('m365_sync_state').upsert({
      tenant_id: conn.tenant_id,
      connection_id: conn.id,
      stream,
      watermark_at: newest,
      last_run_at: new Date().toISOString(),
      last_error: null,
      events_seen: (state?.events_seen ?? 0) + events.length,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'connection_id,stream' });
  }

  await admin.from('m365_connections').update({
    status: summary.errors.length > 0 ? 'error' : 'connected',
    last_error: summary.errors.length > 0 ? summary.errors.join('; ').slice(0, 500) : null,
    last_sync_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', conn.id);

  return summary;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;

  // Eigener Bearer-Check, weil verify_jwt fuer diese Function aus ist: Der
  // Aufrufer ist pg_cron, nicht ein Browser mit Supabase-JWT.
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!SERVICE_KEY || authHeader !== `Bearer ${SERVICE_KEY}`) {
    return jsonResponse({ ok: false, error: 'cron only' }, 401);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* ohne Body: alle Anbindungen */ }

  const key = await loadSealKey(admin);
  if (!key) {
    return jsonResponse({ ok: false, error: 'Zugangsdaten-Siegel nicht konfiguriert' }, 503);
  }

  let query = admin
    .from('m365_connections')
    .select('id, tenant_id, azure_tenant_id, client_id, credentials_enc, streams, primary_domain')
    .in('status', ['connected', 'pending']);
  if (typeof body.connection_id === 'string') {
    query = query.eq('id', body.connection_id);
  }

  const { data: conns, error } = await query;
  if (error) return jsonResponse({ ok: false, error: error.message }, 500);

  const results: Record<string, unknown>[] = [];
  for (const c of (conns ?? []) as Connection[]) {
    results.push(await syncConnection(admin, key, c));
  }

  return jsonResponse({ ok: true, connections: results.length, results });
});
