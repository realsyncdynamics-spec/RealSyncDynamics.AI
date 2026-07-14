import { describe, it, expect, beforeAll } from 'vitest';

// Der geteilte Provenance-Core ist Deno-Code (nutzt Deno.env nur INNERHALB von
// Funktionen). Wir shimmen Deno.env (keine Signaturschlüssel) und treiben
// appendCustodyEvent gegen einen In-Memory-Fake des Supabase-Clients — so ist
// die Orchestrierung (Manifest anlegen vs. anhängen, seq, prev_hash-Verkettung)
// abgedeckt, obwohl es keinen Deno-Check in der CI gibt.

declare global {
  // eslint-disable-next-line no-var
  var Deno: { env: { get(k: string): string | undefined } };
}

globalThis.Deno = { env: { get: () => undefined } };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

/** Minimaler, chainbarer Fake des PostgREST-Query-Builders. */
function makeFakeAdmin() {
  const store: Record<string, Row[]> = { provenance_manifests: [], provenance_custody_events: [] };
  let idSeq = 0;

  function from(table: string) {
    const rows = store[table] ?? (store[table] = []);
    const filters: Array<[string, unknown]> = [];
    let op: 'select' | 'insert' | 'update' = 'select';
    let payload: Row | null = null;
    let orderCol: string | null = null;
    let orderAsc = true;

    const match = () => rows.filter((r) => filters.every(([c, v]) => r[c] === v));

    const applyThen = () => {
      if (op === 'insert') {
        const row = { id: `id-${++idSeq}`, ...payload };
        rows.push(row);
        return { data: row, error: null };
      }
      if (op === 'update') {
        for (const r of match()) Object.assign(r, payload);
        return { data: null, error: null };
      }
      return { data: match(), error: null };
    };

    const builder: Row = {
      select() { return builder; },
      insert(p: Row) { op = 'insert'; payload = p; return builder; },
      update(p: Row) { op = 'update'; payload = p; return builder; },
      eq(c: string, v: unknown) { filters.push([c, v]); return builder; },
      order(c: string, o?: { ascending?: boolean }) { orderCol = c; orderAsc = o?.ascending !== false; return builder; },
      limit() { return builder; },
      maybeSingle() {
        let rs = match();
        if (orderCol) rs = [...rs].sort((a, b) => (a[orderCol!] - b[orderCol!]) * (orderAsc ? 1 : -1));
        return Promise.resolve({ data: rs[0] ?? null, error: null });
      },
      single() { return Promise.resolve(applyThen()); },
      then(resolve: (v: unknown) => unknown) { return Promise.resolve(applyThen()).then(resolve); },
    };
    return builder;
  }

  return { from, store };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let appendCustodyEvent: any;
beforeAll(async () => {
  ({ appendCustodyEvent } = await import('../../supabase/functions/_shared/provenanceCore.ts'));
});

const DIGEST = 'a'.repeat(64);

describe('appendCustodyEvent (Provenance-Core)', () => {
  it('legt beim ersten Event das Manifest an (seq 1, action registered, prev_hash null)', async () => {
    const admin = makeFakeAdmin();
    const r = await appendCustodyEvent(admin, {
      tenantId: 't1', assetRef: 'AST-1', contentSha256: DIGEST, action: 'audited', issuer: 'tenant:t1', timestamp: '2026-07-02T10:00:00.000Z',
    });
    expect(r.created).toBe(true);
    expect(r.seq).toBe(1);
    const ev = admin.store.provenance_custody_events[0];
    expect(ev.action).toBe('registered'); // erstes Event immer registered
    expect(ev.prev_hash).toBeNull();
    expect(ev.event_hash).toBe(r.eventHash);
    const manifest = admin.store.provenance_manifests[0];
    expect(manifest.latest_hash).toBe(r.eventHash);
  });

  it('hängt Folge-Events an und verkettet prev_hash → vorheriger event_hash', async () => {
    const admin = makeFakeAdmin();
    const r1 = await appendCustodyEvent(admin, { tenantId: 't1', assetRef: 'AST-1', contentSha256: DIGEST, action: 'audited', issuer: 'tenant:t1', timestamp: '2026-07-02T10:00:00.000Z' });
    const r2 = await appendCustodyEvent(admin, { tenantId: 't1', assetRef: 'AST-1', contentSha256: 'b'.repeat(64), action: 'audited', issuer: 'tenant:t1', timestamp: '2026-07-02T10:05:00.000Z' });
    expect(r2.created).toBe(false);
    expect(r2.seq).toBe(2);
    const events = admin.store.provenance_custody_events;
    expect(events).toHaveLength(2);
    expect(events[1].prev_hash).toBe(r1.eventHash);
    expect(events[1].action).toBe('audited'); // Folge-Event behält die Aktion
    expect(r2.eventHash).not.toBe(r1.eventHash);
    // Manifest zeigt auf das jüngste Event.
    expect(admin.store.provenance_manifests[0].latest_hash).toBe(r2.eventHash);
  });

  it('trennt Ketten pro (tenant, asset)', async () => {
    const admin = makeFakeAdmin();
    await appendCustodyEvent(admin, { tenantId: 't1', assetRef: 'AST-1', contentSha256: DIGEST, action: 'audited', issuer: 'tenant:t1' });
    const other = await appendCustodyEvent(admin, { tenantId: 't1', assetRef: 'AST-2', contentSha256: DIGEST, action: 'audited', issuer: 'tenant:t1' });
    expect(other.created).toBe(true);
    expect(other.seq).toBe(1);
    expect(admin.store.provenance_manifests).toHaveLength(2);
  });

  it('signiert ohne Schlüssel nicht (signed=false, alg=null)', async () => {
    const admin = makeFakeAdmin();
    const r = await appendCustodyEvent(admin, { tenantId: 't1', assetRef: 'AST-1', contentSha256: DIGEST, action: 'audited', issuer: 'tenant:t1' });
    expect(r.signed).toBe(false);
    expect(r.alg).toBeNull();
  });
});
