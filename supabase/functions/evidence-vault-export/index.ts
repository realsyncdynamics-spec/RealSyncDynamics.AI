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
import { applyPolicy, sumHits, type RedactionPolicy } from '../_shared/redact.ts';

// Diese Funktion exportiert fuer Aufsichtsbehoerden / externe Auditoren.
// Empfaenger sind Dritte — Klartext-PII darf nicht raus. Policy hart.
const REDACTION_POLICY: RedactionPolicy = 'always';

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
  const totalHits = {
    email: 0, phone_de: 0, phone_intl: 0, iban: 0, credit_card: 0,
    german_tax_id: 0, german_ssn: 0, date_of_birth: 0, ipv4: 0, ipv6: 0,
  };
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

    // PII-Redaction: Bundle geht an Dritte. event_summary + evidence
    // werden geschwaerzt, IDs/Hashes/Zeitstempel bleiben strukturell.
    // event_hash + chain stehen ueber Klartext — die Chain bleibt
    // verifizierbar (Hash war vor Redaction berechnet).
    const rec = r as Record<string, unknown>;
    const { redacted: summaryR, hits: summaryHits } = applyPolicy(
      rec.event_summary, REDACTION_POLICY);
    const { redacted: evidenceR, hits: evidenceHits } = applyPolicy(
      rec.evidence, REDACTION_POLICY);
    for (const k of Object.keys(totalHits) as Array<keyof typeof totalHits>) {
      totalHits[k] += summaryHits[k] + evidenceHits[k];
    }

    enriched.push({
      id: rec.id,
      ai_system_id: rec.ai_system_id,
      policy_id: rec.policy_id,
      event_type: rec.event_type,
      event_summary: summaryR,
      risk_level: rec.risk_level,
      evidence: evidenceR,
      created_at: rec.created_at,
      chain_index: rec.chain_index,
      prev_hash: prevHashHex,
      event_hash: eventHashHex,
      signature,
    });
  }

  const tip = enriched.length > 0 ? enriched[enriched.length - 1] : null;

  const hitsTotal = Object.values(totalHits).reduce((a, b) => a + b, 0);

  const bundle = {
    tenant_id: tenantId,
    exported_at: new Date().toISOString(),
    range: { from: from.toISOString(), to: to.toISOString() },
    count: enriched.length,
    redaction: {
      policy: REDACTION_POLICY,
      hits_total: hitsTotal,
      hits_by_category: totalHits,
      note: 'event_summary + evidence wurden PII-redactiert. event_hash und chain_index sind ueber Klartext berechnet — Verifikation funktioniert nur out-of-band gegen den Originalspeicher des Tenants.',
    },
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
        '6. event_summary und evidence sind PII-redactiert. Zur Hash-Verifikation muss der Original-Klartext aus dem Tenant-Speicher gezogen werden (out-of-band).',
      ],
      key_handover:
        'Signing-Key wird out-of-band ausgehaendigt (DPA-Anhang). Aufsichtsbehoerden-Verifier braucht Key + Bundle.',
    },
  };

  // Audit-Log: jedes Bundle wird in pii_redaction_log protokolliert.
  await admin.from('pii_redaction_log').insert({
    tenant_id: tenantId,
    function_name: 'evidence-vault-export',
    policy_applied: REDACTION_POLICY,
    correlation_id: `${from.toISOString()}..${to.toISOString()}`,
    hits_total: hitsTotal,
    hits_by_category: totalHits,
    payload_bytes: JSON.stringify(bundle).length,
  });

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
