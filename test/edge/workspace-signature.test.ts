/**
 * Signierte Workspace-Requests (`_shared/workspaceSignature.ts`): HMAC,
 * Zeitfenster, Nonce-Anmeldung, Pflicht-Regeln. Rein, ohne Netz/Datenbank.
 */
import { describe, expect, it } from 'vitest';
import {
  checkWorkspaceSignature,
  hmacSha256Hex,
  mapClaimRpcError,
  parseSignatureHeaders,
  signatureDepsFromRpc,
  signaturePresented,
  timingSafeEqualHex,
  workspaceSigningString,
  type ClaimResult,
  type SignatureDeps,
  type WorkspaceEndpoint,
} from '../../supabase/functions/_shared/workspaceSignature';

const SECRET = 'workspace-test-secret-0123456789abcdef';
const NOW = 1_794_800_000_000;
const TS = NOW / 1000;
const BODY = JSON.stringify({ schema_version: '1.0', event_id: 'evt-1' });

async function signedHeaders(opts: {
  body?: string; endpoint?: WorkspaceEndpoint; ts?: number; nonce?: string; secret?: string; signature?: string;
} = {}): Promise<Headers> {
  const ts = opts.ts ?? TS;
  const nonce = opts.nonce ?? 'nonce-0123456789abcdef';
  const signature = opts.signature ?? await hmacSha256Hex(
    opts.secret ?? SECRET,
    workspaceSigningString(opts.endpoint ?? 'workspace-events', ts, nonce, opts.body ?? BODY),
  );
  return new Headers({ 'x-rsd-timestamp': String(ts), 'x-rsd-nonce': nonce, 'x-rsd-signature': signature });
}

function deps(over: { secret?: string | null; failed?: boolean; claim?: ClaimResult } = {}) {
  const calls = { claim: [] as Array<{ nonce: string; signedAt: string }> };
  const d: SignatureDeps = {
    loadSecret: async () => ({ secret: over.secret === undefined ? SECRET : over.secret, failed: over.failed ?? false }),
    claim: async (nonce, signedAt) => { calls.claim.push({ nonce, signedAt }); return over.claim ?? 'claimed'; },
  };
  return { d, calls };
}

const check = (headers: Headers, d: SignatureDeps, o: { body?: string; endpoint?: WorkspaceEndpoint; required?: boolean; now?: number } = {}) =>
  checkWorkspaceSignature(headers, o.body ?? BODY, o.endpoint ?? 'workspace-events', o.required ?? false, d, o.now ?? NOW);

describe('HMAC', () => {
  it('stimmt mit dem RFC-4231-Testvektor (Fall 2) überein', async () => {
    expect(await hmacSha256Hex('Jefe', 'what do ya want for nothing?'))
      .toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
  });
  it('vergleicht ohne Längen-Fehlalarm', () => {
    expect(timingSafeEqualHex('abcd', 'abcd')).toBe(true);
    expect(timingSafeEqualHex('abcd', 'abce')).toBe(false);
    expect(timingSafeEqualHex('abcd', 'abc')).toBe(false);
  });
  it('bindet Endpunkt, Zeitstempel, Nonce und Body in den Signaturtext', () => {
    expect(workspaceSigningString('workspace-execute', 1, 'n', '{}')).toBe('v1:workspace-execute:1:n:{}');
  });
});

describe('Header', () => {
  it('liest gültige Header und normalisiert die Signatur auf Kleinbuchstaben', () => {
    const h = new Headers({ 'x-rsd-timestamp': String(TS), 'x-rsd-nonce': 'n'.repeat(16), 'x-rsd-signature': 'AB'.repeat(32) });
    expect(parseSignatureHeaders(h)).toEqual({ timestamp: TS, nonce: 'n'.repeat(16), signature: 'ab'.repeat(32) });
  });
  it.each([
    ['Zeitstempel in Millisekunden', { 'x-rsd-timestamp': String(NOW) }],
    ['Nonce zu kurz', { 'x-rsd-nonce': 'kurz' }],
    ['Nonce mit Sonderzeichen', { 'x-rsd-nonce': 'nonce:with:colons:0000' }],
    ['Signatur kein Hex', { 'x-rsd-signature': 'z'.repeat(64) }],
    ['Signatur zu kurz', { 'x-rsd-signature': 'ab' }],
  ])('lehnt ab: %s', (_n, over) => {
    const h = new Headers({ 'x-rsd-timestamp': String(TS), 'x-rsd-nonce': 'n'.repeat(16), 'x-rsd-signature': 'a'.repeat(64), ...over });
    expect(parseSignatureHeaders(h)).toBeNull();
  });
  it('erkennt, ob überhaupt signiert wurde', () => {
    expect(signaturePresented(new Headers())).toBe(false);
    expect(signaturePresented(new Headers({ 'x-rsd-nonce': 'x' }))).toBe(true);
  });
});

describe('checkWorkspaceSignature · Geheimnis eingerichtet', () => {
  it('akzeptiert eine gültige Signatur und meldet Nonce und Zeitstempel an', async () => {
    const { d, calls } = deps();
    expect(await check(await signedHeaders(), d)).toEqual({ ok: true, signed: true });
    expect(calls.claim).toEqual([{ nonce: 'nonce-0123456789abcdef', signedAt: new Date(NOW).toISOString() }]);
  });

  it('verlangt die Signatur auch ohne required, sobald ein Geheimnis eingerichtet ist', async () => {
    const { d, calls } = deps();
    expect(await check(new Headers(), d, { required: false })).toMatchObject({ ok: false, status: 401, code: 'SIGNATURE_INVALID' });
    expect(calls.claim).toHaveLength(0);
  });

  it.each([
    ['veränderter Body', async () => ({ headers: await signedHeaders(), body: BODY.replace('evt-1', 'evt-2') })],
    ['falsches Geheimnis', async () => ({ headers: await signedHeaders({ secret: 'x'.repeat(40) }), body: BODY })],
    ['Signatur für anderen Endpunkt', async () => ({ headers: await signedHeaders({ endpoint: 'workspace-execute' }), body: BODY })],
    ['Signatur für andere Nonce', async () => {
      const sig = await hmacSha256Hex(SECRET, workspaceSigningString('workspace-events', TS, 'nonce-aaaaaaaaaaaaaaaa', BODY));
      return { headers: await signedHeaders({ nonce: 'nonce-bbbbbbbbbbbbbbbb', signature: sig }), body: BODY };
    }],
    ['Signatur für anderen Zeitstempel', async () => {
      const sig = await hmacSha256Hex(SECRET, workspaceSigningString('workspace-events', TS - 10, 'nonce-0123456789abcdef', BODY));
      return { headers: await signedHeaders({ signature: sig }), body: BODY };
    }],
    ['Zeitstempel 301 s alt', async () => ({ headers: await signedHeaders({ ts: TS - 301 }), body: BODY })],
    ['Zeitstempel 301 s in der Zukunft', async () => ({ headers: await signedHeaders({ ts: TS + 301 }), body: BODY })],
  ])('lehnt ab und verbraucht keine Nonce: %s', async (_n, make) => {
    const { headers, body } = await make();
    const { d, calls } = deps();
    expect(await check(headers, d, { body })).toMatchObject({ ok: false, status: 401, code: 'SIGNATURE_INVALID' });
    expect(calls.claim).toHaveLength(0);
  });

  it('akzeptiert die Fenstergrenze von genau 300 s', async () => {
    const { d } = deps();
    expect(await check(await signedHeaders({ ts: TS - 300 }), d)).toEqual({ ok: true, signed: true });
  });

  it.each([
    ['replay', 409, 'REPLAY'],
    ['rate_limited', 429, 'RATE_LIMITED'],
    ['skew', 401, 'SIGNATURE_INVALID'],
    ['failed', 503, 'SIGNATURE_CLAIM_FAILED'],
  ] as const)('bildet das Anmelde-Ergebnis %s auf %i ab', async (claim, status, code) => {
    const { d } = deps({ claim });
    expect(await check(await signedHeaders(), d)).toMatchObject({ ok: false, status, code });
  });

  it('lehnt ab, wenn die Anmeldung wirft (fail closed)', async () => {
    const d: SignatureDeps = {
      loadSecret: async () => ({ secret: SECRET, failed: false }),
      claim: async () => { throw new Error('db down'); },
    };
    expect(await check(await signedHeaders(), d)).toMatchObject({ ok: false, status: 503 });
  });
});

describe('checkWorkspaceSignature · kein Geheimnis eingerichtet', () => {
  it('lässt unsignierte Requests durch, wenn keine Signatur verlangt ist', async () => {
    const { d, calls } = deps({ secret: null });
    expect(await check(new Headers(), d, { required: false })).toEqual({ ok: true, signed: false });
    expect(calls.claim).toHaveLength(0);
  });
  it('lehnt ab, wenn eine Signatur verlangt ist', async () => {
    const { d } = deps({ secret: null });
    expect(await check(new Headers(), d, { required: true })).toMatchObject({ ok: false, status: 401, code: 'SIGNATURE_NOT_CONFIGURED' });
  });
  it('lehnt ab, wenn der Absender signiert, aber nichts eingerichtet ist', async () => {
    const { d } = deps({ secret: null });
    expect(await check(await signedHeaders(), d, { required: false })).toMatchObject({ ok: false, status: 401, code: 'SIGNATURE_NOT_CONFIGURED' });
  });
});

describe('checkWorkspaceSignature · Nachschlagen scheitert', () => {
  it('lehnt mit 503 ab, statt unsigniert durchzulassen', async () => {
    const { d } = deps({ secret: null, failed: true });
    expect(await check(new Headers(), d, { required: false })).toMatchObject({ ok: false, status: 503, code: 'SIGNATURE_LOOKUP_FAILED' });
  });
  it('lehnt mit 503 ab, wenn das Nachschlagen wirft', async () => {
    const d: SignatureDeps = { loadSecret: async () => { throw new Error('x'); }, claim: async () => 'claimed' };
    expect(await check(new Headers(), d)).toMatchObject({ ok: false, status: 503 });
  });
});

describe('Datenbank-Verdrahtung', () => {
  it('ruft beide Funktionen mit dem Schlüssel aus der Authentisierung auf', async () => {
    const seen: Array<[string, Record<string, unknown>]> = [];
    const d = signatureDepsFromRpc(async (fn, args) => {
      seen.push([fn, args]);
      return fn === 'workspace_signing_secret' ? { data: SECRET, error: null } : { data: true, error: null };
    }, 'key-1');
    expect(await d.loadSecret()).toEqual({ secret: SECRET, failed: false });
    expect(await d.claim('nonce-0123456789abcdef', '2026-11-16T00:00:00.000Z')).toBe('claimed');
    expect(seen).toEqual([
      ['workspace_signing_secret', { p_ingest_key_id: 'key-1' }],
      ['claim_workspace_request', { p_ingest_key_id: 'key-1', p_nonce: 'nonce-0123456789abcdef', p_signed_at: '2026-11-16T00:00:00.000Z' }],
    ]);
  });
  it('unterscheidet „nicht eingerichtet“ (null) von einem Fehler', async () => {
    const none = signatureDepsFromRpc(async () => ({ data: null, error: null }), 'k');
    expect(await none.loadSecret()).toEqual({ secret: null, failed: false });
    const broken = signatureDepsFromRpc(async () => ({ data: null, error: { message: 'workspace_signing_misconfigured' } }), 'k');
    expect(await broken.loadSecret()).toEqual({ secret: null, failed: true });
  });
  it('bildet Anmelde-Antworten ab', async () => {
    const claim = (data: unknown, message?: string) =>
      signatureDepsFromRpc(async () => ({ data, error: message ? { message } : null }), 'k').claim('n', 't');
    expect(await claim(false)).toBe('replay');
    expect(await claim(null)).toBe('failed');
    expect(await claim(null, 'workspace_rate_limited')).toBe('rate_limited');
    expect(await claim(null, 'workspace_timestamp_skew')).toBe('skew');
    expect(await claim(null, 'connection reset')).toBe('failed');
    expect(mapClaimRpcError(undefined)).toBe('failed');
  });
});
