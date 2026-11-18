// Signierte Workspace-Requests (HMAC-SHA256) — rein, ohne Deno-/jsr-Importe,
// aus Vitest testbar.
//
// Der Ingest-Schlüssel (x-rsd-tenant-key) bestimmt weiter den Mandanten. Die
// Signatur kommt dazu und nutzt ein zweites Geheimnis, das nie übertragen wird
// (Supabase Vault, siehe Migration 20261116040000).
//
// Absender:
//   signing_string = "v1:" + endpoint + ":" + timestamp + ":" + nonce + ":" + raw_body
//   signature      = hex( HMAC_SHA256( signing_secret, signing_string ) )
// Header:
//   x-rsd-timestamp   Unix-Sekunden (10 Ziffern), höchstens ±300 s Abweichung
//   x-rsd-nonce       16–128 Zeichen [A-Za-z0-9_-], je Request neu
//   x-rsd-signature   64 Hex-Zeichen
//
// `endpoint` ist der Function-Name. Eine Signatur für workspace-events passt
// damit nicht auf workspace-execute.
//
// Fail closed: fehlende oder falsche Signatur 401, Replay 409, Limit 429,
// jeder Fehler beim Nachschlagen oder Anmelden 503.

export const WORKSPACE_MAX_SKEW_SECONDS = 300;

export type WorkspaceEndpoint = 'workspace-events' | 'workspace-execute';

const TIMESTAMP = /^[0-9]{10}$/;
const NONCE = /^[A-Za-z0-9_-]{16,128}$/;
const SIGNATURE = /^[0-9a-f]{64}$/;

export interface SignatureHeaders {
  timestamp: number;
  nonce: string;
  signature: string;
}

/** Hat der Absender irgendeinen Signatur-Header mitgeschickt? */
export function signaturePresented(headers: Headers): boolean {
  return headers.has('x-rsd-timestamp') || headers.has('x-rsd-nonce') || headers.has('x-rsd-signature');
}

/** Liest die drei Header. null = unvollständig oder falsches Format. */
export function parseSignatureHeaders(headers: Headers): SignatureHeaders | null {
  const ts = headers.get('x-rsd-timestamp')?.trim() ?? '';
  const nonce = headers.get('x-rsd-nonce')?.trim() ?? '';
  const signature = (headers.get('x-rsd-signature')?.trim() ?? '').toLowerCase();
  if (!TIMESTAMP.test(ts) || !NONCE.test(nonce) || !SIGNATURE.test(signature)) return null;
  return { timestamp: Number(ts), nonce, signature };
}

export function workspaceSigningString(
  endpoint: WorkspaceEndpoint, timestamp: number, nonce: string, rawBody: string,
): string {
  return `v1:${endpoint}:${timestamp}:${nonce}:${rawBody}`;
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

/** Vergleich ohne frühen Abbruch: die Laufzeit verrät nichts über die Signatur. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isTimestampFresh(timestampSeconds: number, nowMs: number): boolean {
  return Math.abs(nowMs / 1000 - timestampSeconds) <= WORKSPACE_MAX_SKEW_SECONDS;
}

/** Ergebnis von `claim_workspace_request`, bereits auf Fälle abgebildet. */
export type ClaimResult = 'claimed' | 'replay' | 'rate_limited' | 'skew' | 'failed';

/** Fehlertext der Datenbankfunktion auf einen Fall abbilden (unbekannt = failed). */
export function mapClaimRpcError(message: string | undefined): Exclude<ClaimResult, 'claimed' | 'replay'> {
  if (message?.includes('workspace_rate_limited')) return 'rate_limited';
  if (message?.includes('workspace_timestamp_skew')) return 'skew';
  return 'failed';
}

export interface SignatureDeps {
  /** Signatur-Geheimnis des Schlüssels. `secret: null` = nicht eingerichtet. */
  loadSecret: () => Promise<{ secret: string | null; failed: boolean }>;
  /** Meldet Nonce und Zeitstempel an (einmalig, mit Limit). */
  claim: (nonce: string, signedAtIso: string) => Promise<ClaimResult>;
}

export type SignatureCheck =
  | { ok: true; signed: boolean }
  | { ok: false; status: 401 | 409 | 429 | 503; code: string; message: string };

/**
 * Prüft die Signatur eines Workspace-Requests.
 *
 * `required`: true verlangt immer eine Signatur (workspace-execute, oder
 * workspace-events mit WORKSPACE_EVENTS_REQUIRE_SIGNATURE=true).
 * Ist für den Schlüssel ein Geheimnis eingerichtet, ist die Signatur für
 * diesen Schlüssel ebenfalls Pflicht — unabhängig von `required`.
 * Schickt der Absender Signatur-Header, obwohl nichts eingerichtet ist, wird
 * abgelehnt: er verlässt sich sonst auf einen Schutz, den es nicht gibt.
 *
 * Reihenfolge: Format → Zeitfenster → Signatur → Nonce anmelden. Die Nonce
 * wird erst nach gültiger Signatur verbraucht, damit Unbefugte weder Nonces
 * belegen noch das Limit eines Schlüssels aufbrauchen können.
 */
export async function checkWorkspaceSignature(
  headers: Headers,
  rawBody: string,
  endpoint: WorkspaceEndpoint,
  required: boolean,
  deps: SignatureDeps,
  nowMs: number = Date.now(),
): Promise<SignatureCheck> {
  let loaded: Awaited<ReturnType<SignatureDeps['loadSecret']>>;
  try {
    loaded = await deps.loadSecret();
  } catch {
    loaded = { secret: null, failed: true };
  }
  if (loaded.failed) {
    return { ok: false, status: 503, code: 'SIGNATURE_LOOKUP_FAILED', message: 'signature verification unavailable' };
  }

  const presented = signaturePresented(headers);
  if (!loaded.secret) {
    if (required || presented) {
      return { ok: false, status: 401, code: 'SIGNATURE_NOT_CONFIGURED', message: 'no signing secret configured for this ingest key' };
    }
    return { ok: true, signed: false };
  }

  const invalid: SignatureCheck = { ok: false, status: 401, code: 'SIGNATURE_INVALID', message: 'missing or invalid request signature' };
  const parsed = parseSignatureHeaders(headers);
  if (!parsed) return invalid;
  if (!isTimestampFresh(parsed.timestamp, nowMs)) return invalid;
  const expected = await hmacSha256Hex(
    loaded.secret, workspaceSigningString(endpoint, parsed.timestamp, parsed.nonce, rawBody),
  );
  if (!timingSafeEqualHex(expected, parsed.signature)) return invalid;

  let claimed: ClaimResult;
  try {
    claimed = await deps.claim(parsed.nonce, new Date(parsed.timestamp * 1000).toISOString());
  } catch {
    claimed = 'failed';
  }
  switch (claimed) {
    case 'claimed': return { ok: true, signed: true };
    case 'replay': return { ok: false, status: 409, code: 'REPLAY', message: 'nonce already used; sign the retry with a new nonce' };
    case 'rate_limited': return { ok: false, status: 429, code: 'RATE_LIMITED', message: 'too many signed requests for this key' };
    case 'skew': return invalid;
    default: return { ok: false, status: 503, code: 'SIGNATURE_CLAIM_FAILED', message: 'signature verification unavailable' };
  }
}

/** Minimaler Ausschnitt von `supabase.rpc`, damit dieses Modul ohne Client-Import auskommt. */
export type WorkspaceRpc = (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;

/** Verdrahtet die beiden Datenbankfunktionen aus Migration 20261116040000. */
export function signatureDepsFromRpc(rpc: WorkspaceRpc, ingestKeyId: string): SignatureDeps {
  return {
    async loadSecret() {
      const { data, error } = await rpc('workspace_signing_secret', { p_ingest_key_id: ingestKeyId });
      if (error) return { secret: null, failed: true };
      return { secret: typeof data === 'string' && data.length > 0 ? data : null, failed: false };
    },
    async claim(nonce, signedAtIso) {
      const { data, error } = await rpc('claim_workspace_request', {
        p_ingest_key_id: ingestKeyId, p_nonce: nonce, p_signed_at: signedAtIso,
      });
      if (error) return mapClaimRpcError(error.message);
      if (data === true) return 'claimed';
      if (data === false) return 'replay';
      return 'failed';
    },
  };
}
