// MP-0: Feste Tenant-Bindung im Service-Pfad des ai-gateway.
//
// Problem vorher (handler.ts resolvePrincipal): Ein Aufrufer mit gültigem
// `x-internal-key` konnte jeden beliebigen `tenant_id` im Body setzen. Der Key
// ist für alle internen Aufrufer derselbe, `x-internal-caller` ist eine
// Selbstauskunft. Damit war der Mandant im Service-Pfad eine Behauptung.
//
// Jetzt: Ein Mandant gilt im Service-Pfad nur, wenn der Aufrufer ihn mit einer
// signierten, kurzlebigen Tenant-Bestätigung belegt
//   Header `x-internal-tenant-assertion: v1.<caller>.<tenant_id>.<exp_ms>.<hmac>`
//   hmac = HMAC-SHA256(AI_GATEWAY_TENANT_SIGNING_KEY, "v1|caller|tenant|exp")
// Der Aufrufer stellt sie erst NACH seiner eigenen Prüfung aus (z. B.
// Mitgliedschaft in governance-agent, Connection-Lookup in telegram-webhook,
// Cron-Tenantliste im agent-os-runner). Ein `tenant_id` aus Body oder
// `x-tenant-id` ohne passende Bestätigung führt zu 403.
//
// Grenze (ehrlich): Wer AI_GATEWAY_TENANT_SIGNING_KEY besitzt, kann für jeden
// Tenant signieren. Die Bestätigung bindet den Mandanten an den signierenden
// Aufrufer (Kennung + Ablaufzeit), sie ersetzt nicht dessen eigene Prüfung.
// Gegenüber vorher gilt: der Body allein reicht nie, der Pfad ist ohne Secret
// fail-closed, und die Kennung ist kryptografisch gebunden statt selbst erklärt.
//
// Reine Logik ohne Deno-/jsr-Importe (vitest-importierbar).

import { timingSafeEqualString, type InternalCaller, type Rejection } from './access.ts';

export const TENANT_ASSERTION_HEADER = 'x-internal-tenant-assertion';
export const TENANT_SIGNING_KEY_ENV = 'AI_GATEWAY_TENANT_SIGNING_KEY';
export const TENANT_SIGNING_KEY_MIN_LENGTH = 32;
/** Standard-Gültigkeit einer Bestätigung. */
export const TENANT_ASSERTION_TTL_MS = 60_000;
/** Längste akzeptierte Restlaufzeit — längere Bestätigungen sind ungültig. */
export const TENANT_ASSERTION_MAX_TTL_MS = 120_000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CALLER_RE = /^[a-z0-9-]{1,64}$/;

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacHex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', k, enc.encode(message)));
}

function signingInput(caller: string, tenantId: string, expMs: number): string {
  return `v1|${caller}|${tenantId.toLowerCase()}|${expMs}`;
}

/** Stellt eine Tenant-Bestätigung aus (Aufruferseite, nach eigener Prüfung). */
export async function mintTenantAssertion(args: {
  caller: string;
  tenantId: string;
  signingKey: string;
  now?: number;
  ttlMs?: number;
}): Promise<string> {
  if (!CALLER_RE.test(args.caller)) throw new Error('invalid internal caller for tenant assertion');
  if (!UUID_RE.test(args.tenantId)) throw new Error('tenant assertion requires a UUID tenant_id');
  if ((args.signingKey ?? '').length < TENANT_SIGNING_KEY_MIN_LENGTH) {
    throw new Error(`${TENANT_SIGNING_KEY_ENV} missing or too short`);
  }
  const ttl = Math.min(args.ttlMs ?? TENANT_ASSERTION_TTL_MS, TENANT_ASSERTION_MAX_TTL_MS);
  const exp = Math.floor((args.now ?? Date.now()) + ttl);
  const tenant = args.tenantId.toLowerCase();
  const sig = await hmacHex(args.signingKey, signingInput(args.caller, tenant, exp));
  return `v1.${args.caller}.${tenant}.${exp}.${sig}`;
}

export type TenantBinding =
  | { kind: 'none' }
  | { kind: 'bound'; tenantId: string }
  | { kind: 'reject'; rejection: Rejection };

const reject = (status: number, code: string, message: string): TenantBinding =>
  ({ kind: 'reject', rejection: { status, code, message } });

/**
 * Prüft die Tenant-Bestätigung eines bereits per x-internal-key
 * authentifizierten Service-Aufrufs. Fail-closed:
 *   kein Header                         → none (Aufruf bleibt mandantenlos)
 *   Header, Signing-Key fehlt/zu kurz   → 401 TENANT_BINDING_DISABLED
 *   Format/UUID/Kennung ungültig        → 403 TENANT_ASSERTION_INVALID
 *   Kennung ≠ x-internal-caller/unknown → 403 TENANT_ASSERTION_CALLER
 *   abgelaufen oder zu lange gültig     → 403 TENANT_ASSERTION_EXPIRED
 *   Signatur falsch                     → 403 TENANT_ASSERTION_INVALID
 */
export async function verifyTenantAssertion(args: {
  headers: Headers;
  caller: InternalCaller;
  env: (name: string) => string | undefined;
  now?: number;
}): Promise<TenantBinding> {
  const raw = args.headers.get(TENANT_ASSERTION_HEADER);
  if (raw === null || raw.trim() === '') return { kind: 'none' };

  const key = args.env(TENANT_SIGNING_KEY_ENV) ?? '';
  if (key.length < TENANT_SIGNING_KEY_MIN_LENGTH) {
    return reject(401, 'TENANT_BINDING_DISABLED', 'service tenant binding is not configured');
  }

  const parts = raw.trim().split('.');
  if (parts.length !== 5 || parts[0] !== 'v1') return reject(403, 'TENANT_ASSERTION_INVALID', 'malformed tenant assertion');
  const [, caller, tenant, expRaw, sig] = parts;
  if (!CALLER_RE.test(caller) || !UUID_RE.test(tenant) || !/^\d{1,16}$/.test(expRaw) || !/^[0-9a-f]{64}$/.test(sig)) {
    return reject(403, 'TENANT_ASSERTION_INVALID', 'malformed tenant assertion');
  }
  if (args.caller === 'unknown' || caller !== args.caller) {
    return reject(403, 'TENANT_ASSERTION_CALLER', 'tenant assertion does not belong to this internal caller');
  }
  const exp = Number(expRaw);
  const now = args.now ?? Date.now();
  if (exp <= now || exp - now > TENANT_ASSERTION_MAX_TTL_MS) {
    return reject(403, 'TENANT_ASSERTION_EXPIRED', 'tenant assertion expired or not yet acceptable');
  }
  const expected = await hmacHex(key, signingInput(caller, tenant, exp));
  if (!(await timingSafeEqualString(sig, expected))) {
    return reject(403, 'TENANT_ASSERTION_INVALID', 'tenant assertion signature mismatch');
  }
  return { kind: 'bound', tenantId: tenant.toLowerCase() };
}

/**
 * Leitet den Mandanten des Service-Pfads ab. Ein Claim aus Body/Header ist
 * nur erlaubt, wenn er der signierten Bindung entspricht.
 */
export function serviceTenantFrom(binding: TenantBinding, claim: unknown): { tenantId: string | null } | Rejection {
  if (binding.kind === 'reject') return binding.rejection;
  const claimed = typeof claim === 'string' && claim.trim() ? claim.trim().toLowerCase() : null;
  if (binding.kind === 'none') {
    if (claimed) {
      return { status: 403, code: 'TENANT_NOT_VERIFIED', message: 'tenant_id in the service path requires a signed tenant assertion' };
    }
    return { tenantId: null };
  }
  if (claimed && claimed !== binding.tenantId) {
    return { status: 403, code: 'TENANT_MISMATCH', message: 'tenant_id does not match the signed tenant assertion' };
  }
  return { tenantId: binding.tenantId };
}
