// Provenance-Core (Deno) — geteilte Custody-Append-Logik.
//
// Single Source für das Anhängen eines Custody-Events an die Herkunftskette
// eines Assets: Manifest anlegen/laden → Claim kanonisieren + hashen →
// signieren (Ed25519 bevorzugt, HMAC-Legacy-Fallback) → Event einfügen →
// Manifest aktualisieren. Wird u.a. von `evidence-vault` (Auto-Erfassung bei
// Snapshot) genutzt.
//
// Kanonisierung/Hashing sind BIT-IDENTISCH zu src/lib/provenance/* und zur
// Edge-Function `provenance` — bei Änderungen alle Stellen anpassen.

export type ProvenanceAction = 'registered' | 'updated' | 'licensed' | 'audited';
export type SignatureAlg = 'ed25519' | 'hmac-sha256';

interface Claim {
  assetRef: string;
  contentSha256: string;
  issuer: string;
  action: ProvenanceAction;
  timestamp: string;
  prevHash: string | null;
}

function normalizeHex(hex: string): string {
  return hex.trim().toLowerCase().replace(/^0x/, '');
}
function bufToHex(buf: Uint8Array): string {
  let out = '';
  for (let i = 0; i < buf.length; i++) out += buf[i].toString(16).padStart(2, '0');
  return out;
}
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.trim());
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
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
async function sha256Hex(bytes: Uint8Array): Promise<string> {
  return bufToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
}
function claimHash(c: Claim): Promise<string> {
  return sha256Hex(canonicalClaimBytes(c));
}

// ── Signatur: Ed25519 bevorzugt, HMAC als Legacy-Fallback ────────────────────
let _edPriv: CryptoKey | null | undefined;
async function edPrivateKey(): Promise<CryptoKey | null> {
  if (_edPriv !== undefined) return _edPriv;
  const b64 = Deno.env.get('PROVENANCE_ED25519_PRIVATE_KEY');
  _edPriv = b64 ? await crypto.subtle.importKey('pkcs8', b64ToBytes(b64), { name: 'Ed25519' }, false, ['sign']) : null;
  return _edPriv;
}
function edKeyId(): string { return Deno.env.get('PROVENANCE_ED25519_KEY_ID') ?? 'rsd-ed25519-1'; }

async function signHmac(eventHash: string): Promise<{ signature: string | null; keyId: string | null }> {
  const secret = Deno.env.get('PROVENANCE_SIGNING_SECRET');
  if (!secret) return { signature: null, keyId: null };
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(eventHash));
  return { signature: bufToHex(new Uint8Array(sig)), keyId: Deno.env.get('PROVENANCE_SIGNING_KEY_ID') ?? 'rsd-hmac-1' };
}

async function signEvent(eventHash: string): Promise<{ signature: string | null; keyId: string | null; alg: SignatureAlg | null }> {
  const priv = await edPrivateKey();
  if (priv) {
    const sig = await crypto.subtle.sign({ name: 'Ed25519' }, priv, new TextEncoder().encode(eventHash));
    return { signature: bufToHex(new Uint8Array(sig)), keyId: edKeyId(), alg: 'ed25519' };
  }
  const hmac = await signHmac(eventHash);
  return { signature: hmac.signature, keyId: hmac.keyId, alg: hmac.signature ? 'hmac-sha256' : null };
}

export interface AppendResult {
  manifestId: string;
  seq: number;
  eventHash: string;
  signed: boolean;
  alg: SignatureAlg | null;
  created: boolean;
}

/**
 * Hängt ein Custody-Event an die Kette eines Assets an (legt das Manifest bei
 * Bedarf an). Das erste Event eines Assets ist stets 'registered'.
 */
interface SupabaseAdminClient {
  from(table: string): {
    select(columns: string): {
      eq(col: string, val: unknown): {
        eq(col2: string, val2: unknown): { maybeSingle(): Promise<{ data: unknown; error: unknown }> };
        maybeSingle(): Promise<{ data: unknown; error: unknown }>;
        order(col: string, opts?: Record<string, unknown>): { limit(n: number): { maybeSingle(): Promise<{ data: unknown; error: unknown }> } };
      };
    };
    insert(obj: Record<string, unknown>): { select(columns?: string): { single(): Promise<{ data: unknown; error: unknown }> } };
  };
}

export async function appendCustodyEvent(admin: SupabaseAdminClient, args: {
  tenantId: string;
  assetRef: string;
  contentSha256: string;
  action: ProvenanceAction;
  issuer: string;
  timestamp?: string;
}): Promise<AppendResult> {
  const nowIso = args.timestamp ?? new Date().toISOString();
  const contentSha = normalizeHex(args.contentSha256);

  const { data: manifest } = await admin
    .from('provenance_manifests').select('id, latest_hash')
    .eq('tenant_id', args.tenantId).eq('asset_ref', args.assetRef).maybeSingle();

  let manifestId: string;
  let seq = 1;
  let prevHash: string | null = null;
  let created = false;
  let action: ProvenanceAction = args.action;

  if (!manifest) {
    const { data: ins, error: insErr } = await admin
      .from('provenance_manifests')
      .insert({ tenant_id: args.tenantId, asset_ref: args.assetRef, content_sha256: contentSha, issuer: args.issuer, latest_hash: 'pending', trust_score: 100, tamper_state: 'intact' })
      .select('id').single();
    if (insErr || !ins) throw new Error('could not create provenance manifest');
    manifestId = (ins as { id: string }).id;
    created = true;
    action = 'registered';
  } else {
    manifestId = (manifest as { id: string }).id;
    prevHash = (manifest as { latest_hash: string | null }).latest_hash;
    const { data: lastEv } = await admin
      .from('provenance_custody_events').select('seq').eq('manifest_id', manifestId).order('seq', { ascending: false }).limit(1).maybeSingle();
    seq = ((lastEv as unknown as { seq: number } | null)?.seq ?? 0) + 1;
  }

  const claim: Claim = { assetRef: args.assetRef, contentSha256: contentSha, issuer: args.issuer, action, timestamp: nowIso, prevHash };
  const eventHash = await claimHash(claim);
  const { signature, keyId, alg } = await signEvent(eventHash);

  const { error: evErr } = await admin.from('provenance_custody_events').insert({
    manifest_id: manifestId, tenant_id: args.tenantId, seq, action, actor: args.issuer,
    content_sha256: contentSha, event_ts: nowIso, prev_hash: prevHash, event_hash: eventHash, signature, signature_alg: alg,
  });
  if (evErr) throw new Error('could not append custody event');

  await admin.from('provenance_manifests').update({
    content_sha256: contentSha, latest_hash: eventHash, signature, signing_key_id: keyId, signature_alg: alg, updated_at: nowIso,
  }).eq('id', manifestId);

  return { manifestId, seq, eventHash, signed: signature !== null, alg, created };
}
