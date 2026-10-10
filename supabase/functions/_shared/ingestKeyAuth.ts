// Ingest-API-Key-Prüfung (rein, ohne Deno-/jsr-Importe — aus Vitest testbar).
//
// Schlüssel stammen aus governance_ingest_keys (angelegt über governance-keys,
// nur owner/admin, Klartext nur einmal bei der Erzeugung). Gespeichert ist nur
// der SHA-256-Hash; der Mandant kommt ausschließlich aus der Schlüsselzeile —
// nie aus Header, Body oder URL.
//
// Fail closed: fehlender/ungültiger/unbekannter/widerrufener Schlüssel → 401,
// Schlüssel ohne Mandant oder ohne die nötige Quelle → 403, Lookup-Fehler → 503.

import { sha256Hex } from './hash.ts';

export const INGEST_KEY_PREFIX = 'rsd_gov_';

const KEY_PATTERN = /^rsd_gov_[A-Za-z0-9_-]{16,128}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface IngestKeyRow {
  id: string;
  tenant_id: string | null;
  allowed_sources: string[] | null;
  revoked_at: string | null;
}

/** Sucht den Schlüssel per Hash; `failed` = Datenbankfehler (nicht „unbekannt“). */
export type IngestKeyLookup = (keyHash: string) => Promise<{ row: IngestKeyRow | null; failed: boolean }>;

export type IngestKeyAuth =
  | { ok: true; tenantId: string; keyId: string }
  | { ok: false; status: 401 | 403 | 503; code: string; message: string };

/** Schlüssel aus `x-rsd-tenant-key` oder `Authorization: Bearer …`. */
export function presentedIngestKey(headers: Headers): string | null {
  const header = headers.get('x-rsd-tenant-key')?.trim();
  if (header) return header;
  const authorization = headers.get('authorization')?.trim() ?? '';
  if (authorization.startsWith('Bearer ')) return authorization.slice('Bearer '.length).trim() || null;
  return null;
}

/**
 * Prüft einen Ingest-Schlüssel. `requiredSource`: ist `allowed_sources` des
 * Schlüssels nicht leer, muss diese Quelle enthalten sein.
 */
export async function authenticateIngestKey(
  headers: Headers,
  lookup: IngestKeyLookup,
  requiredSource: string,
): Promise<IngestKeyAuth> {
  const key = presentedIngestKey(headers);
  if (!key) {
    return { ok: false, status: 401, code: 'UNAUTHORIZED', message: 'missing ingest key (x-rsd-tenant-key)' };
  }
  if (UUID_PATTERN.test(key)) {
    return {
      ok: false,
      status: 401,
      code: 'TENANT_ID_IS_NOT_A_KEY',
      message: 'a tenant id is not a key — create an ingest key (rsd_gov_…) under API keys',
    };
  }
  if (!KEY_PATTERN.test(key)) {
    return { ok: false, status: 401, code: 'UNAUTHORIZED', message: 'invalid ingest key' };
  }

  let result: Awaited<ReturnType<IngestKeyLookup>>;
  try {
    result = await lookup(await sha256Hex(key));
  } catch {
    result = { row: null, failed: true };
  }
  if (result.failed) {
    return { ok: false, status: 503, code: 'KEY_LOOKUP_FAILED', message: 'key verification unavailable' };
  }
  const row = result.row;
  if (!row) return { ok: false, status: 401, code: 'UNAUTHORIZED', message: 'unknown ingest key' };
  if (row.revoked_at) return { ok: false, status: 401, code: 'UNAUTHORIZED', message: 'ingest key revoked' };
  if (!row.tenant_id) {
    return { ok: false, status: 403, code: 'KEY_WITHOUT_TENANT', message: 'ingest key is not bound to a tenant' };
  }
  const sources = row.allowed_sources ?? [];
  if (sources.length > 0 && !sources.includes(requiredSource)) {
    return {
      ok: false,
      status: 403,
      code: 'SOURCE_NOT_ALLOWED',
      message: `ingest key does not allow source ${requiredSource}`,
    };
  }
  return { ok: true, tenantId: row.tenant_id, keyId: row.id };
}

/** Ergebnis einer Zuordnungsabfrage: Zeile gefunden? zu welchem Mandanten? */
export type TenantRefLookup = (id: string) => Promise<{ found: boolean; tenantId: string | null; failed: boolean }>;

export interface RefCheckError {
  status: 400 | 403 | 503;
  code: string;
  message: string;
}

/**
 * Vom Client genannte IDs müssen zum Mandanten des Schlüssels gehören — sonst
 * landeten Ereignisse und Nachweise mit Verweisen auf fremde Systeme/Policies
 * in der Kette. Unbekannt und fremd sind bewusst nicht unterscheidbar.
 * `allowGlobal`: Zeilen ohne Mandant (globale Vorgaben) sind zulässig.
 */
export async function checkTenantRef(
  id: string | undefined,
  tenantId: string,
  lookup: TenantRefLookup,
  label: string,
  allowGlobal: boolean,
): Promise<RefCheckError | null> {
  if (id === undefined || id === null) return null;
  if (typeof id !== 'string' || !UUID_PATTERN.test(id)) {
    return { status: 400, code: 'VALIDATION', message: `${label} must be a uuid` };
  }
  let result: Awaited<ReturnType<TenantRefLookup>>;
  try {
    result = await lookup(id);
  } catch {
    result = { found: false, tenantId: null, failed: true };
  }
  if (result.failed) return { status: 503, code: 'REF_LOOKUP_FAILED', message: `${label} could not be verified` };
  const belongs = result.found && (result.tenantId === tenantId || (allowGlobal && result.tenantId === null));
  if (!belongs) return { status: 403, code: 'NOT_IN_TENANT', message: `${label} not found in this tenant` };
  return null;
}
