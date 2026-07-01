// provenance — Herkunftsnachweis-API (register / append / verify).
//
// POST /functions/v1/provenance
// Auth: Authorization: Bearer <user JWT>
// Body: {
//   op: 'register' | 'append' | 'verify',
//   tenant_id: string,
//   asset_ref: string,
//   content_sha256?: string,   // register/append: Pflicht; verify: optional (Gegenprobe)
//   action?: 'registered' | 'updated' | 'licensed' | 'audited',
//   issuer?: string
// }
//
// Ablauf:
//   1. JWT prüfen → userId
//   2. Tenant-Mitgliedschaft prüfen (memberships)
//   3. Feature-Gate: provenance.advanced
//   4. op ausführen (service_role) + Audit-Log
//
// Die Hash-/Claim-Serialisierung ist BIT-IDENTISCH zu src/lib/provenance
// (canonicalClaimBytes/claimHash) — dasselbe Input ⇒ derselbe event_hash,
// in Deno wie im Browser. Damit kann der Client jede Kette selbst re-verifizieren.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { gateFeature, EntitlementError } from '../_shared/entitlements.ts';
import { audit } from '../_shared/auditLog.ts';

type Action = 'registered' | 'updated' | 'licensed' | 'audited';
const ACTIONS: Action[] = ['registered', 'updated', 'licensed', 'audited'];

interface Claim {
  assetRef: string;
  contentSha256: string;
  issuer: string;
  action: Action;
  timestamp: string;
  prevHash: string | null;
}

// ── Kanonik + Hashing (identisch zu src/lib/provenance/canonicalClaim.ts) ─────
function normalizeHex(hex: string): string {
  return hex.trim().toLowerCase().replace(/^0x/, '');
}
function canonicalClaimBytes(c: Claim): Uint8Array {
  const ordered = {
    assetRef: c.assetRef,
    contentSha256: normalizeHex(c.contentSha256),
    issuer: c.issuer,
    action: c.action,
    timestamp: c.timestamp,
    prevHash: c.prevHash === null ? null : normalizeHex(c.prevHash),
  };
  return new TextEncoder().encode(JSON.stringify(ordered));
}
function bufToHex(buf: Uint8Array): string {
  let out = '';
  for (let i = 0; i < buf.length; i++) out += buf[i].toString(16).padStart(2, '0');
  return out;
}
async function sha256Hex(bytes: Uint8Array): Promise<string> {
  return bufToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
}
function claimHash(c: Claim): Promise<string> {
  return sha256Hex(canonicalClaimBytes(c));
}

// ── Optionale HMAC-Signatur über den event_hash ──────────────────────────────
async function signHash(eventHash: string): Promise<{ signature: string | null; keyId: string | null }> {
  const secret = Deno.env.get('PROVENANCE_SIGNING_SECRET');
  if (!secret) return { signature: null, keyId: null };
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(eventHash));
  return { signature: bufToHex(new Uint8Array(sig)), keyId: Deno.env.get('PROVENANCE_SIGNING_KEY_ID') ?? 'rsd-hmac-1' };
}

// ── Trust-Score (Spiegel von src/lib/provenance/trustScore.ts) ───────────────
function computeTrust(input: {
  signatureValid: boolean;
  custodyState: 'intact' | 'tampered' | 'unverifiable';
  metadataIntegrity: boolean;
  ownershipConsistency: boolean;
}): { trustScore: number; riskLabels: string[]; escalationTriggered: boolean } {
  const risk = new Set<string>();
  let score = 100;
  if (!input.signatureValid) { score -= 40; risk.add('signature_gap'); }
  if (input.custodyState === 'tampered') { score -= 30; risk.add('signature_gap'); }
  else if (input.custodyState === 'unverifiable') { score -= 20; risk.add('unverifiable_source'); }
  if (!input.metadataIntegrity) { score -= 15; risk.add('unverifiable_source'); }
  if (!input.ownershipConsistency) { score -= 15; risk.add('disputed_ownership'); }
  const trustScore = Math.max(0, Math.min(100, score));
  return {
    trustScore,
    riskLabels: [...risk],
    escalationTriggered: trustScore < 50 || input.custodyState === 'tampered' || risk.has('disputed_ownership'),
  };
}

interface CustodyRow {
  seq: number; action: Action; actor: string; content_sha256: string;
  event_ts: string; prev_hash: string | null; event_hash: string; signature: string | null;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED', 'POST only');

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const op = String(body.op ?? '');
  const tenantId = String(body.tenant_id ?? '');
  const assetRef = String(body.asset_ref ?? '');
  if (!['register', 'append', 'verify'].includes(op)) return jsonError(400, 'BAD_REQUEST', 'op must be register|append|verify');
  if (!tenantId || !assetRef) return jsonError(400, 'BAD_REQUEST', 'tenant_id and asset_ref required');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // 1. Verify caller
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } }, auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  const userId = userResp.user.id;
  const userEmail = userResp.user.email ?? null;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // 2. Tenant membership
  const { data: member } = await admin
    .from('memberships').select('user_id').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  if (!member) return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');

  // 3. Feature gate
  try {
    await gateFeature(admin, tenantId, 'provenance.advanced');
  } catch (e) {
    if (e instanceof EntitlementError) return jsonError(402, 'PAYMENT_REQUIRED', e.message);
    return jsonError(500, 'INTERNAL', 'entitlement check failed');
  }

  const issuer = String(body.issuer ?? `tenant:${tenantId}`);
  const nowIso = new Date().toISOString();

  try {
    if (op === 'register' || op === 'append') {
      const contentSha = String(body.content_sha256 ?? '');
      if (!/^[0-9a-fA-F]{64}$/.test(normalizeHex(contentSha))) {
        return jsonError(400, 'BAD_REQUEST', 'content_sha256 must be a 64-char hex digest');
      }
      const action: Action = ACTIONS.includes(body.action as Action) ? (body.action as Action) : (op === 'register' ? 'registered' : 'updated');

      // Load existing manifest (if any)
      const { data: manifest } = await admin
        .from('provenance_manifests').select('id, latest_hash').eq('tenant_id', tenantId).eq('asset_ref', assetRef).maybeSingle();

      if (op === 'register' && manifest) return jsonError(409, 'CONFLICT', 'manifest already exists — use op:append');
      if (op === 'append' && !manifest) return jsonError(404, 'NOT_FOUND', 'no manifest — use op:register first');

      let manifestId = manifest?.id as string | undefined;
      let seq = 1;
      let prevHash: string | null = null;

      if (op === 'register') {
        const { data: created, error: insErr } = await admin
          .from('provenance_manifests')
          .insert({ tenant_id: tenantId, asset_ref: assetRef, content_sha256: normalizeHex(contentSha), issuer, latest_hash: 'pending', trust_score: 100, tamper_state: 'intact' })
          .select('id').single();
        if (insErr || !created) return jsonError(500, 'INTERNAL', 'could not create manifest');
        manifestId = created.id;
      } else {
        prevHash = manifest!.latest_hash;
        const { data: last } = await admin
          .from('provenance_custody_events').select('seq').eq('manifest_id', manifestId!).order('seq', { ascending: false }).limit(1).maybeSingle();
        seq = (last?.seq ?? 0) + 1;
      }

      const claim: Claim = { assetRef, contentSha256: normalizeHex(contentSha), issuer, action, timestamp: nowIso, prevHash };
      const eventHash = await claimHash(claim);
      const { signature, keyId } = await signHash(eventHash);

      const { error: evErr } = await admin.from('provenance_custody_events').insert({
        manifest_id: manifestId, tenant_id: tenantId, seq, action, actor: issuer,
        content_sha256: normalizeHex(contentSha), event_ts: nowIso, prev_hash: prevHash, event_hash: eventHash, signature,
      });
      if (evErr) return jsonError(500, 'INTERNAL', 'could not append custody event');

      await admin.from('provenance_manifests').update({
        content_sha256: normalizeHex(contentSha), latest_hash: eventHash, signature, signing_key_id: keyId, updated_at: nowIso,
      }).eq('id', manifestId!);

      await audit(admin, {
        tenant_id: tenantId, actor_user_id: userId, actor_email: userEmail,
        action: `provenance.${op}`, target_type: 'provenance_manifest', target_id: assetRef,
        payload: { seq, action, event_hash: eventHash, signed: signature !== null },
      });

      return jsonResponse({ ok: true, manifest_id: manifestId, seq, event_hash: eventHash, signed: signature !== null });
    }

    // op === 'verify'
    const { data: manifest } = await admin
      .from('provenance_manifests').select('id, content_sha256, issuer').eq('tenant_id', tenantId).eq('asset_ref', assetRef).maybeSingle();
    if (!manifest) return jsonError(404, 'NOT_FOUND', 'no manifest for this asset');

    const { data: events } = await admin
      .from('provenance_custody_events').select('seq, action, actor, content_sha256, event_ts, prev_hash, event_hash, signature')
      .eq('manifest_id', manifest.id).order('seq', { ascending: true });
    const rows = (events ?? []) as CustodyRow[];

    // Re-verify chain + signatures
    let custodyState: 'intact' | 'tampered' | 'unverifiable' = rows.length === 0 ? 'unverifiable' : 'intact';
    let brokenAtSeq: number | null = null;
    let expectedPrev: string | null = null;
    let signaturesOk = true;

    for (let i = 0; i < rows.length && custodyState === 'intact'; i++) {
      const ev = rows[i];
      if (ev.seq !== rows[0].seq + i || normalizeHex(ev.prev_hash ?? '') !== normalizeHex(expectedPrev ?? '')) {
        custodyState = 'tampered'; brokenAtSeq = ev.seq; break;
      }
      const recomputed = await claimHash({
        assetRef, contentSha256: ev.content_sha256, issuer: ev.actor, action: ev.action, timestamp: ev.event_ts, prevHash: ev.prev_hash,
      });
      if (recomputed !== ev.event_hash) { custodyState = 'tampered'; brokenAtSeq = ev.seq; break; }
      if (ev.signature) {
        const { signature } = await signHash(ev.event_hash);
        if (signature && signature !== ev.signature) signaturesOk = false;
      }
      expectedPrev = ev.event_hash;
    }

    const providedDigest = body.content_sha256 ? normalizeHex(String(body.content_sha256)) : null;
    const metadataIntegrity = providedDigest === null || providedDigest === normalizeHex(manifest.content_sha256);
    const ownershipConsistency = rows.every((r) => r.actor === rows[0]?.actor);

    const trust = computeTrust({
      signatureValid: custodyState === 'intact' && signaturesOk,
      custodyState, metadataIntegrity, ownershipConsistency,
    });

    await admin.from('provenance_manifests').update({
      trust_score: trust.trustScore, tamper_state: custodyState, updated_at: nowIso,
    }).eq('id', manifest.id);

    await audit(admin, {
      tenant_id: tenantId, actor_user_id: userId, actor_email: userEmail,
      action: 'provenance.verify', target_type: 'provenance_manifest', target_id: assetRef,
      payload: { custodyState, trustScore: trust.trustScore, events: rows.length },
    });

    return jsonResponse({
      ok: true, asset_ref: assetRef,
      tamper_state: custodyState, broken_at_seq: brokenAtSeq,
      trust: { assetId: assetRef, trustScore: trust.trustScore, riskLabels: trust.riskLabels, escalationTriggered: trust.escalationTriggered, evaluatedAt: nowIso },
      custody: rows.map((r) => ({ seq: r.seq, action: r.action, actor: r.actor, timestamp: r.event_ts, event_hash: r.event_hash, signed: r.signature !== null })),
      evidence_components: { metadataIntegrity, ownershipConsistency, provenanceContinuity: custodyState === 'intact' },
    });
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', scope: 'provenance_failed', op, error: (e as Error)?.message ?? String(e) }));
    return jsonError(500, 'INTERNAL', 'provenance operation failed');
  }
});
