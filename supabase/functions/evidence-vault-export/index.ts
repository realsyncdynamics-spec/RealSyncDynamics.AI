// evidence-vault-export — Aufsichtsbehoerden-tauglicher Audit-Bundle-Export.
//
// POST /functions/v1/evidence-vault-export
// Headers:
//   x-rsd-tenant-key: <tenant uuid>
// Body (alle optional):
//   { from?: ISO-8601, to?: ISO-8601, ai_system_id?: uuid }
//
// Response (200):
//   { ok: true, bundle: { ... } }
//
// Bundle-Struktur:
//   - tenant_id, exported_at, range, count
//   - events[]: chain_index, event_hash (hex), prev_hash (hex), signature
//   - tip: hash + signature der hoechsten chain_index
//   - verifier: Algorithmus + Reproduzierungs-Anleitung
//
// Signatur-Algorithmus:
//   signature = HMAC-SHA256(SIGNING_KEY, event_hash_hex || ':' || chain_index)
//
// Der Signing-Key kommt aus EVIDENCE_VAULT_SIGNING_KEY env. In Production
// pro Tenant via tenant_signing_keys-Tabelle (Folge-PR). Aktuell global.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-rsd-tenant-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ExportRequestBody {
  from?: string;
  to?: string;
  ai_system_id?: string;
}

// ─── Crypto-Helpers ──────────────────────────────────────────────────────────

async function hmacSha256Hex(keyBytes: Uint8Array, data: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuffer = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    new TextEncoder().encode(data),
  );
  return [...new Uint8Array(sigBuffer)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Postgres bytea kommt aus supabase-js als '\xDEADBEEF' string (PG-hex format).
function pgHexToCleanHex(s: string | null | undefined): string | null {
  if (!s) return null;
  return s.startsWith('\\x') ? s.slice(2) : s;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonError(405, 'BAD_METHOD', 'POST only');

  const tenantKey = req.headers.get('x-rsd-tenant-key');
  if (!tenantKey) return jsonError(401, 'UNAUTHORIZED', 'missing x-rsd-tenant-key');

  const tenantId = tenantKey.match(/^[0-9a-f-]{36}$/i) ? tenantKey : null;
  if (!tenantId) {
    return jsonError(401, 'UNAUTHORIZED', 'invalid tenant key (expected uuid in this PR)');
  }

  let body: ExportRequestBody;
  try {
    body = (await req.json().catch(() => ({}))) as ExportRequestBody;
  } catch {
    return jsonError(400, 'BAD_JSON', 'request body must be valid JSON or empty');
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Defaults: letzte 90 Tage wenn keine Range explizit
  const to = body.to ? new Date(body.to) : new Date();
  const from = body.from
    ? new Date(body.from)
    : new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Lade Events + Hashes als hex via encode()
  let q = admin
    .from('ai_evidence_events')
    .select(
      `id, tenant_id, ai_system_id, policy_id, event_type, event_summary,
       risk_level, evidence, created_at, chain_index,
       event_hash_hex:event_hash, prev_hash_hex:prev_hash`,
    )
    .eq('tenant_id', tenantId)
    .gte('created_at', from.toISOString())
    .lte('created_at', to.toISOString())
    .order('chain_index', { ascending: true });

  if (body.ai_system_id) {
    q = q.eq('ai_system_id', body.ai_system_id);
  }

  const { data: rows, error } = await q;
  if (error) {
    return jsonError(500, 'QUERY_FAILED', error.message);
  }

  // SIGNING-KEY laden
  const signingKeyText = Deno.env.get('EVIDENCE_VAULT_SIGNING_KEY');
  if (!signingKeyText) {
    return jsonError(500, 'CONFIG', 'EVIDENCE_VAULT_SIGNING_KEY not set');
  }
  const signingKey = new TextEncoder().encode(signingKeyText);

  const enriched: Array<Record<string, unknown>> = [];
  for (const r of rows ?? []) {
    // Cast: .select-aliasing liefert die Strings direkt im Hex-Format,
    // supabase-js kann bytea als '\xHEX' liefern, je nach driver. Wir
    // normalisieren beide.
    const eventHashHex = pgHexToCleanHex((r as Record<string, unknown>).event_hash_hex as string);
    const prevHashHex = pgHexToCleanHex((r as Record<string, unknown>).prev_hash_hex as string);

    if (!eventHashHex) {
      // Sollte nicht vorkommen — Trigger setzt event_hash. Defensiv ueberspringen.
      continue;
    }

    const signature = await hmacSha256Hex(
      signingKey,
      `${eventHashHex}:${(r as Record<string, unknown>).chain_index}`,
    );

    enriched.push({
      id: (r as Record<string, unknown>).id,
      ai_system_id: (r as Record<string, unknown>).ai_system_id,
      policy_id: (r as Record<string, unknown>).policy_id,
      event_type: (r as Record<string, unknown>).event_type,
      event_summary: (r as Record<string, unknown>).event_summary,
      risk_level: (r as Record<string, unknown>).risk_level,
      evidence: (r as Record<string, unknown>).evidence,
      created_at: (r as Record<string, unknown>).created_at,
      chain_index: (r as Record<string, unknown>).chain_index,
      prev_hash: prevHashHex,
      event_hash: eventHashHex,
      signature,
    });
  }

  const tip = enriched.length > 0 ? enriched[enriched.length - 1] : null;

  const bundle = {
    tenant_id: tenantId,
    exported_at: new Date().toISOString(),
    range: { from: from.toISOString(), to: to.toISOString() },
    count: enriched.length,
    events: enriched,
    tip: tip
      ? {
          chain_index: tip.chain_index,
          event_hash: tip.event_hash,
          signature: tip.signature,
        }
      : null,
    verifier: {
      algorithm: 'sha256-chain + hmac-sha256',
      hash_payload:
        "SHA256( prev_hash || id || created_at || event_type || event_summary || evidence_jsonb )",
      signature_payload: 'HMAC-SHA256( SIGNING_KEY, event_hash_hex + ":" + chain_index )',
      instructions: [
        '1. Iteriere events in chain_index-Reihenfolge.',
        '2. Pro Event: re-compute event_hash, vergleiche mit feldwert.',
        '3. prev_hash[i] muss event_hash[i-1] sein (oder null fuer i=1).',
        '4. signature = HMAC-SHA256(KEY, event_hash + ":" + chain_index) — mit dem Tenant-Key out-of-band verifizieren.',
        '5. tip ist der schaerfste Anchor — eine eigene Signatur des tips reicht zum Beweis dass kein Event NACH tip-Erzeugung manipuliert wurde.',
      ],
      key_handover:
        'Signing-Key wird out-of-band ausgehaendigt (DPA-Anhang). Aufsichtsbehoerden-Verifier braucht Key + Bundle.',
    },
  };

  return new Response(JSON.stringify({ ok: true, bundle }), {
    status: 200,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
});

function jsonError(status: number, code: string, message: string): Response {
  return new Response(
    JSON.stringify({ ok: false, error: { code, message } }),
    { status, headers: { ...corsHeaders, 'content-type': 'application/json' } },
  );
}
