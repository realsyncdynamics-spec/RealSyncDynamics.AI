/**
 * Ingest-API-Key-Prüfung (`_shared/ingestKeyAuth.ts`), genutzt von
 * telemetry-ai-event. Vorher galt dort die rohe Mandanten-UUID als
 * Schlüssel — wer eine UUID kannte, schrieb Ereignisse und unlöschbare
 * Nachweise in fremde Mandanten.
 */
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  authenticateIngestKey,
  checkTenantRef,
  presentedIngestKey,
  type IngestKeyRow,
} from '../../supabase/functions/_shared/ingestKeyAuth';

const TENANT = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const KEY = 'rsd_gov_AbCdEfGhIjKlMnOpQrStUvWxYz012345';
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

function headers(init: Record<string, string>): Headers {
  return new Headers(init);
}

function lookupFor(rows: Record<string, IngestKeyRow>, seen: string[] = []) {
  return async (hash: string) => {
    seen.push(hash);
    return { row: rows[hash] ?? null, failed: false };
  };
}

const ACTIVE: IngestKeyRow = { id: 'key-1', tenant_id: TENANT, allowed_sources: [], revoked_at: null };

describe('presentedIngestKey', () => {
  it('liest x-rsd-tenant-key vor Authorization: Bearer', () => {
    expect(presentedIngestKey(headers({ 'x-rsd-tenant-key': KEY, authorization: 'Bearer other' }))).toBe(KEY);
    expect(presentedIngestKey(headers({ authorization: `Bearer ${KEY}` }))).toBe(KEY);
    expect(presentedIngestKey(headers({}))).toBeNull();
    expect(presentedIngestKey(headers({ authorization: 'Basic abc' }))).toBeNull();
  });
});

describe('authenticateIngestKey', () => {
  it('gültiger Schlüssel: Mandant ausschließlich aus der Schlüsselzeile, Lookup nur per Hash', async () => {
    const seen: string[] = [];
    const r = await authenticateIngestKey(headers({ 'x-rsd-tenant-key': KEY }), lookupFor({ [sha(KEY)]: ACTIVE }, seen), 'sdk');
    expect(r).toEqual({ ok: true, tenantId: TENANT, keyId: 'key-1' });
    expect(seen).toEqual([sha(KEY)]);
    expect(seen.join()).not.toContain(KEY);
  });

  it('die rohe Mandanten-UUID ist kein Schlüssel — kein Lookup', async () => {
    const seen: string[] = [];
    const r = await authenticateIngestKey(headers({ 'x-rsd-tenant-key': TENANT }), lookupFor({}, seen), 'sdk');
    expect(r).toMatchObject({ ok: false, status: 401, code: 'TENANT_ID_IS_NOT_A_KEY' });
    expect(seen).toEqual([]);
  });

  it('fehlend, falsches Format, unbekannt, widerrufen → 401', async () => {
    const rows = { [sha(KEY)]: { ...ACTIVE, revoked_at: '2026-10-01T00:00:00Z' } };
    expect(await authenticateIngestKey(headers({}), lookupFor(rows), 'sdk')).toMatchObject({ status: 401 });
    expect(await authenticateIngestKey(headers({ 'x-rsd-tenant-key': 'rsd_gov_short' }), lookupFor(rows), 'sdk'))
      .toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    expect(await authenticateIngestKey(headers({ 'x-rsd-tenant-key': 'sk_live_AbCdEfGhIjKlMnOpQrSt' }), lookupFor(rows), 'sdk'))
      .toMatchObject({ status: 401 });
    expect(await authenticateIngestKey(headers({ 'x-rsd-tenant-key': `${KEY}x` }), lookupFor(rows), 'sdk'))
      .toMatchObject({ status: 401, message: 'unknown ingest key' });
    expect(await authenticateIngestKey(headers({ 'x-rsd-tenant-key': KEY }), lookupFor(rows), 'sdk'))
      .toMatchObject({ status: 401, message: 'ingest key revoked' });
  });

  it('Schlüssel ohne Mandant → 403 (fail closed)', async () => {
    const r = await authenticateIngestKey(headers({ 'x-rsd-tenant-key': KEY }), lookupFor({ [sha(KEY)]: { ...ACTIVE, tenant_id: null } }), 'sdk');
    expect(r).toMatchObject({ ok: false, status: 403, code: 'KEY_WITHOUT_TENANT' });
  });

  it('Quellen-Einschränkung: leer = alle; sonst muss die Quelle enthalten sein', async () => {
    const restricted = { [sha(KEY)]: { ...ACTIVE, allowed_sources: ['website_scanner'] } };
    expect(await authenticateIngestKey(headers({ 'x-rsd-tenant-key': KEY }), lookupFor(restricted), 'sdk'))
      .toMatchObject({ ok: false, status: 403, code: 'SOURCE_NOT_ALLOWED' });
    const allowed = { [sha(KEY)]: { ...ACTIVE, allowed_sources: ['website_scanner', 'sdk'] } };
    expect(await authenticateIngestKey(headers({ 'x-rsd-tenant-key': KEY }), lookupFor(allowed), 'sdk'))
      .toMatchObject({ ok: true });
  });

  it('Lookup-Fehler oder Ausnahme → 503, nie Durchlass', async () => {
    expect(await authenticateIngestKey(headers({ 'x-rsd-tenant-key': KEY }), async () => ({ row: ACTIVE, failed: true }), 'sdk'))
      .toMatchObject({ ok: false, status: 503 });
    expect(await authenticateIngestKey(headers({ 'x-rsd-tenant-key': KEY }), async () => { throw new Error('db down'); }, 'sdk'))
      .toMatchObject({ ok: false, status: 503 });
  });
});

describe('checkTenantRef', () => {
  const lookup = (tenantId: string | null, found = true) => async () => ({ found, tenantId, failed: false });
  const ID = '33333333-3333-4333-8333-333333333333';

  it('ohne ID keine Prüfung', async () => {
    expect(await checkTenantRef(undefined, TENANT, lookup(OTHER), 'ai_system_id', false)).toBeNull();
  });

  it('eigener Mandant: ok; fremd oder unbekannt: 403 ohne Unterscheidung', async () => {
    expect(await checkTenantRef(ID, TENANT, lookup(TENANT), 'ai_system_id', false)).toBeNull();
    const fremd = await checkTenantRef(ID, TENANT, lookup(OTHER), 'ai_system_id', false);
    const unbekannt = await checkTenantRef(ID, TENANT, lookup(null, false), 'ai_system_id', false);
    expect(fremd).toMatchObject({ status: 403, code: 'NOT_IN_TENANT' });
    expect(unbekannt).toEqual(fremd);
  });

  it('globale Zeilen (ohne Mandant) nur mit allowGlobal', async () => {
    expect(await checkTenantRef(ID, TENANT, lookup(null), 'policy_id', true)).toBeNull();
    expect(await checkTenantRef(ID, TENANT, lookup(null), 'ai_system_id', false)).toMatchObject({ status: 403 });
  });

  it('keine UUID → 400; Lookup-Fehler → 503', async () => {
    expect(await checkTenantRef('x', TENANT, lookup(TENANT), 'ai_system_id', false)).toMatchObject({ status: 400 });
    expect(await checkTenantRef(ID, TENANT, async () => ({ found: false, tenantId: null, failed: true }), 'ai_system_id', false))
      .toMatchObject({ status: 503 });
  });
});
