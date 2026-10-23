// Beispieldaten für Beta-Mandanten laden/entfernen (WP-4,
// docs/claude/BETA_V5_WORKPLAN.md).
// POST /functions/v1/beta-sample-data
// Auth: Required (verify_jwt = Plattform-Default, kein config.toml-Eintrag)
// Body: { action: 'load' | 'remove', tenantId?: string }
//
// ── Warum es diese Function gibt ──────────────────────────────────────────
//
// Ein leerer Mandant zeigt ehrliche Leerzustände. Wer die Plattform erst
// sehen will, bevor er eigene Systeme erfasst, lädt hier fünf klar markierte
// Beispiel-Einträge in `governance_assets` — und entfernt sie wieder. Keine
// Demo-Zahlen im Frontend: Score, Inventar und Risikoverteilung rechnen auf
// echten Zeilen, die nur eben als Beispiel gekennzeichnet sind
// (`metadata.sample = true`, Name mit Präfix „[Beispiel] “).
//
// Schreibrechte auf `governance_assets` hat nur service_role (RLS), deshalb
// eine Edge Function und kein direkter Insert aus dem Browser.
//
// ── Regeln ────────────────────────────────────────────────────────────────
//
// 1. Mandant nur aus dem authentifizierten Principal (memberships). Ein
//    `tenantId` im Body wird nur als Auswahl unter den eigenen
//    Mitgliedschaften akzeptiert, nie ungeprüft.
// 2. Nur owner/admin — die Einträge ändern den Governance-Score des Mandanten.
// 3. `load` ist idempotent (`alreadyLoaded`). `remove` löscht ausschliesslich
//    Zeilen mit `metadata.sample = true` dieses Mandanten — nie echte Daten.
// 4. Jede Aktion wird in `governance_events` protokolliert, soweit die
//    Tabelle das zulässt; ein Protokollfehler bricht die Aktion nicht ab.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import {
  SAMPLE_ASSETS,
  SAMPLE_FLAG,
  decideLoad,
  parseAction,
  toInsertRow,
} from './logic.ts';

const ALLOWED_ROLES = new Set(['owner', 'admin']);

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonError(401, 'UNAUTHORIZED', 'Authorization header required');

  let body: { tenantId?: unknown; action?: unknown } = {};
  try {
    const text = await req.text();
    if (text.trim()) body = JSON.parse(text);
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }
  const action = parseAction(body.action);
  if (!action) return jsonError(400, 'BAD_REQUEST', "action must be 'load' or 'remove'");

  const supabase = createClient(SUPABASE_URL, SRK);
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return jsonError(401, 'UNAUTHORIZED', 'Invalid token');

  // Mandant aus dem Principal: eigene Mitgliedschaften, nie ein fremder Mandant.
  const { data: memberships, error: memberError } = await supabase
    .from('memberships').select('tenant_id, role').eq('user_id', user.id).limit(20);
  if (memberError) return jsonError(500, 'INTERNAL_ERROR', 'Failed to resolve tenant');
  if (!memberships || memberships.length === 0) {
    return jsonError(400, 'TENANT_NOT_FOUND', 'No tenant found for this user');
  }

  const requested = typeof body.tenantId === 'string' ? body.tenantId : null;
  let membership: { tenant_id: string; role: string } | undefined;
  if (requested) {
    membership = memberships.find((m) => m.tenant_id === requested);
    if (!membership) return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');
  } else if (memberships.length > 1) {
    return jsonError(400, 'TENANT_AMBIGUOUS', 'Multiple tenants — tenantId required');
  } else {
    membership = memberships[0];
  }
  if (!ALLOWED_ROLES.has(membership.role)) {
    return jsonError(403, 'FORBIDDEN', 'Only owner or admin can manage sample data');
  }
  const tenantId = membership.tenant_id;

  try {
    // Bestand: nur markierte Zeilen dieses Mandanten.
    const { data: existing, error: existingErr } = await supabase
      .from('governance_assets')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq(`metadata->>${SAMPLE_FLAG}`, 'true');
    if (existingErr) throw existingErr;
    const existingIds = (existing ?? []).map((r) => r.id as string);

    if (action === 'remove') {
      if (existingIds.length === 0) {
        return jsonResponse({ ok: true, action, removed: 0 });
      }
      const { error: delErr } = await supabase
        .from('governance_assets')
        .delete()
        .eq('tenant_id', tenantId)
        .eq(`metadata->>${SAMPLE_FLAG}`, 'true')
        .in('id', existingIds);
      if (delErr) throw delErr;
      await logEvent(supabase, tenantId, user.id, 'sample_data.removed', { count: existingIds.length });
      return jsonResponse({ ok: true, action, removed: existingIds.length });
    }

    const decision = decideLoad(existingIds.length);
    if (decision.kind === 'already') {
      return jsonResponse({ ok: true, action, loaded: 0, alreadyLoaded: true, count: decision.count });
    }

    const rows = SAMPLE_ASSETS.map((a) => toInsertRow(a, tenantId));
    const { data: inserted, error: insErr } = await supabase
      .from('governance_assets')
      .insert(rows)
      .select('id');
    if (insErr) throw insErr;
    const count = inserted?.length ?? rows.length;
    await logEvent(supabase, tenantId, user.id, 'sample_data.loaded', { count });
    return jsonResponse({ ok: true, action, loaded: count, alreadyLoaded: false, count });
  } catch (err) {
    console.error('beta-sample-data failed:', err);
    return jsonError(500, 'INTERNAL_ERROR', 'Sample data operation failed');
  }
});

/** Best-effort-Protokoll; Schemaunterschiede dürfen die Aktion nicht kippen. */
async function logEvent(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  tenantId: string,
  userId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    // Spalten laut 20260512000000_governance_events.sql; `event_source`
    // muss aus der CHECK-Liste stammen ('manual' = vom Nutzer ausgelöst).
    const { error } = await supabase.from('governance_events').insert({
      tenant_id: tenantId,
      event_type: eventType,
      event_source: 'manual',
      title: eventType === 'sample_data.loaded' ? 'Beispieldaten geladen' : 'Beispieldaten entfernt',
      summary: `Ausgelöst über beta-sample-data (Nutzer ${userId}).`,
      risk_level: 'info',
      payload: { ...payload, source: 'beta-sample-data', actor_id: userId },
    });
    if (error) console.warn('governance_events insert failed:', error.message);
  } catch (e) {
    console.warn('governance_events insert threw:', (e as Error)?.message);
  }
}
