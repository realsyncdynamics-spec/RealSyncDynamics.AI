// evidence-anchor — signierte Prüfpunkte der Evidence-Kette (P1-6).
//
// POST /functions/v1/evidence-anchor   (verify_jwt = true)
//   { op: 'create',  tenant_id }                  → neuen Anker setzen
//   { op: 'list',    tenant_id, limit? }          → Anker ansehen
//   { op: 'verify',  tenant_id, from?, to? }      → Kette nachrechnen
//   { op: 'export',  tenant_id, anchor_id, note? }→ Anker als exportiert vermerken
//
// WOZU: Die Evidence-Kette in `ai_evidence_events` ist seit Migration
// 20260901090000 append-only. Das verhindert versehentliches Umschreiben,
// aber nicht absichtliches durch jemanden mit service_role. Ein Anker
// hält fest: „Zum Zeitpunkt T endete die Kette bei Index N mit Hash H."
// Wird die Historie später verändert, passt der nachgerechnete Hash nicht
// mehr — die Manipulation wird ERKENNBAR.
//
// EHRLICHE GRENZE, auch gegenüber Kunden so zu formulieren: Solange der
// Anker nur in dieser Datenbank liegt, könnte derselbe Angreifer, der die
// Kette umschreibt, auch ihn neu schreiben. Der Beweiswert entsteht erst
// durch den EXPORT — beim Kunden, beim Prüfer, oder bei einem
// Zeitstempeldienst Dritter (Klasse C, eigene Integration, nicht gebaut).
// Deshalb führt die Tabelle `exported_at` und `op: 'export'` vermerkt es.
//
// Sicherheitsrelevanz: owner/admin-gated. Die Signatur nutzt denselben
// Ed25519-Schlüssel wie der Herkunftsnachweis; fehlt er, entsteht der
// Anker trotzdem — unsigniert und als solcher erkennbar. Ein unsignierter
// Anker ist immer noch besser als keiner: Er bindet den Kettenzustand an
// einen Zeitpunkt in einer Tabelle, die nicht mehr änderbar ist.
//
// EU AI Act Art. 12 (Aufzeichnungspflichten), DSGVO Art. 5 Abs. 2
// (Rechenschaftspflicht).

import { requireAuthAndTenant } from '../_shared/auth.ts';
import { buildCorsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { audit } from '../_shared/auditLog.ts';

const corsHeaders = buildCorsHeaders('POST, OPTIONS');

/** Kanonische Form des Ankers — genau das wird signiert. */
function canonicalAnchor(a: {
  tenant_id: string;
  chain_index: number;
  chain_hash_hex: string;
  event_count: number;
  created_at: string;
}): string {
  // Feste Reihenfolge, NUL-getrennt wie in _shared/crypto.ts — eine
  // Umsortierung darf die Signatur nicht still gültig lassen.
  return [
    a.tenant_id,
    String(a.chain_index),
    a.chain_hash_hex,
    String(a.event_count),
    a.created_at,
  ].join('\x00');
}

function bufToHex(buf: Uint8Array): string {
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Signiert die kanonische Ankerform. Gibt null zurück, wenn kein
 * Schlüssel konfiguriert ist — dann bleibt der Anker unsigniert, statt
 * dass die Funktion scheitert oder eine Signatur vortäuscht.
 */
async function signAnchor(canonical: string): Promise<
  { signature: string; alg: 'ed25519'; keyId: string } | null
> {
  const b64 = Deno.env.get('PROVENANCE_ED25519_PRIVATE_KEY');
  if (!b64) return null;
  try {
    const jwk = JSON.parse(atob(b64));
    const key = await crypto.subtle.importKey(
      'jwk', jwk, { name: 'Ed25519' }, false, ['sign'],
    );
    const sig = await crypto.subtle.sign(
      'Ed25519', key, new TextEncoder().encode(canonical),
    );
    return {
      signature: bufToHex(new Uint8Array(sig)),
      alg: 'ed25519',
      keyId: Deno.env.get('PROVENANCE_ED25519_KEY_ID') ?? 'rsd-ed25519-1',
    };
  } catch (e) {
    console.error('[evidence-anchor] signing failed', e);
    return null;
  }
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only', corsHeaders);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json', corsHeaders);
  }

  const op = String(body.op ?? '');
  if (!['create', 'list', 'verify', 'export'].includes(op)) {
    return jsonError(400, 'BAD_REQUEST', `unknown op: ${op}`, corsHeaders);
  }

  // Anker setzen und exportieren sind privilegierte Handlungen am
  // Prüfpfad; Ansehen und Nachrechnen darf jedes Mitglied.
  const roles = (op === 'create' || op === 'export') ? ['owner', 'admin'] : undefined;
  const auth = await requireAuthAndTenant(req, body.tenant_id as string, roles);
  if (auth instanceof Response) return auth;
  const { admin, user, tenantId } = auth;

  try {
    if (op === 'list') {
      const limit = Math.min(Number(body.limit) || 50, 200);
      const { data, error } = await admin
        .from('evidence_anchors')
        .select('id, chain_index, chain_hash, event_count, signature, signature_alg, signing_key_id, exported_at, export_note, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) return jsonError(500, 'INTERNAL', error.message, corsHeaders);
      return jsonResponse({ ok: true, anchors: data ?? [] }, 200, corsHeaders);
    }

    if (op === 'verify') {
      const { data, error } = await admin.rpc('ai_evidence_verify_chain', {
        p_tenant_id: tenantId,
        p_from: Number(body.from) || 1,
        p_to: body.to === undefined ? null : Number(body.to),
      });
      if (error) return jsonError(500, 'INTERNAL', error.message, corsHeaders);
      const rows = (data ?? []) as Array<{ hash_ok: boolean; link_ok: boolean | null; chain_index: number }>;
      const broken = rows.filter((r) => r.hash_ok === false || r.link_ok === false);
      return jsonResponse({
        ok: true,
        checked: rows.length,
        intact: broken.length === 0,
        // Bei einem Bruch ist der ERSTE der interessante — ab dort weicht
        // die Kette ab, alles danach ist Folgefehler.
        first_broken_index: broken.length > 0 ? broken[0].chain_index : null,
        broken_count: broken.length,
      }, 200, corsHeaders);
    }

    if (op === 'export') {
      const anchorId = body.anchor_id as string;
      if (!anchorId) return jsonError(400, 'BAD_REQUEST', 'anchor_id required', corsHeaders);
      const { data: row } = await admin
        .from('evidence_anchors')
        .select('id, tenant_id, exported_at')
        .eq('id', anchorId).maybeSingle();
      if (!row || row.tenant_id !== tenantId) {
        return jsonError(404, 'NOT_FOUND', 'anchor not found', corsHeaders);
      }
      if (row.exported_at) {
        return jsonError(409, 'ALREADY_EXPORTED', 'Anker ist bereits als exportiert vermerkt', corsHeaders);
      }
      const { error } = await admin
        .from('evidence_anchors')
        .update({
          exported_at: new Date().toISOString(),
          export_note: (body.note as string | undefined)?.slice(0, 500) ?? null,
        })
        .eq('id', anchorId);
      if (error) return jsonError(500, 'INTERNAL', error.message, corsHeaders);

      await audit(admin, {
        tenant_id: tenantId, actor_user_id: user.id, actor_email: user.email ?? null,
        action: 'evidence_anchor.export', target_type: 'evidence_anchor',
        target_id: anchorId, payload: {},
      });
      return jsonResponse({ ok: true }, 200, corsHeaders);
    }

    // op === 'create'
    const { data: tip, error: tipErr } = await admin
      .from('ai_evidence_events')
      .select('chain_index, event_hash')
      .eq('tenant_id', tenantId)
      .not('event_hash', 'is', null)
      .order('chain_index', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (tipErr) return jsonError(500, 'INTERNAL', tipErr.message, corsHeaders);
    if (!tip) {
      return jsonError(409, 'EMPTY_CHAIN',
        'Für diesen Mandanten existiert noch keine Evidence — es gibt nichts zu verankern.',
        corsHeaders);
    }

    const { count } = await admin
      .from('ai_evidence_events')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    // Supabase liefert bytea als \x-Hex-String zurück.
    const chainHashHex = String(tip.event_hash).replace(/^\\x/, '');
    const createdAt = new Date().toISOString();
    const canonical = canonicalAnchor({
      tenant_id: tenantId,
      chain_index: tip.chain_index,
      chain_hash_hex: chainHashHex,
      event_count: count ?? 0,
      created_at: createdAt,
    });
    const signed = await signAnchor(canonical);

    const { data: anchor, error: insErr } = await admin
      .from('evidence_anchors')
      .insert({
        tenant_id: tenantId,
        chain_index: tip.chain_index,
        chain_hash: tip.event_hash,
        event_count: count ?? 0,
        signature: signed?.signature ?? null,
        signature_alg: signed?.alg ?? null,
        signing_key_id: signed?.keyId ?? null,
        created_at: createdAt,
      })
      .select('id, chain_index, event_count, signature_alg, created_at')
      .maybeSingle();
    if (insErr) {
      // UNIQUE(tenant_id, chain_index): Ein Anker auf denselben Stand
      // bringt nichts Neues — das ist kein Fehler, sondern der Hinweis,
      // dass seit dem letzten Anker keine Evidence dazugekommen ist.
      if ((insErr.message ?? '').includes('duplicate')) {
        return jsonError(409, 'UNCHANGED_CHAIN',
          'Seit dem letzten Anker ist keine neue Evidence hinzugekommen.',
          corsHeaders);
      }
      return jsonError(500, 'INTERNAL', insErr.message, corsHeaders);
    }

    await audit(admin, {
      tenant_id: tenantId, actor_user_id: user.id, actor_email: user.email ?? null,
      action: 'evidence_anchor.create', target_type: 'evidence_anchor',
      target_id: anchor?.id ?? null,
      payload: { chain_index: tip.chain_index, signed: Boolean(signed) },
    });

    return jsonResponse({
      ok: true,
      anchor,
      canonical,
      signed: Boolean(signed),
      // Der Hinweis gehört in die Antwort, nicht nur in die Doku: Ein
      // Anker, der die Plattform nie verlässt, beweist wenig.
      note: signed
        ? 'Anker signiert. Beweiswert entsteht durch den Export — bitte außerhalb der Plattform aufbewahren.'
        : 'Anker unsigniert (PROVENANCE_ED25519_PRIVATE_KEY nicht gesetzt). Er bindet den Kettenzustand dennoch an einen Zeitpunkt.',
    }, 200, corsHeaders);
  } catch (e) {
    return jsonError(500, 'INTERNAL', (e as Error).message, corsHeaders);
  }
});
