/**
 * governance-ingest: Caller-Evidence wird serverseitig in die Mandanten-Kette
 * gehängt — Aufrufer-Hashes landen nie in den Kettenspalten.
 *
 * Kettenkopf ist die jüngste Zeile mit content_hash (append_governance_evidence).
 * Ein API-Key-Halter darf ihn nicht setzen; seine content_hash/previous_hash
 * bleiben unter metadata.client_*. Der Server hasht den Snapshot nach
 * EVIDENCE_HASH_METHOD und hängt per Compare-and-Swap an.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  appendCallerEvidence,
  chainedEvidenceRow,
  EvidenceChainBusyError,
  EVIDENCE_APPEND_ATTEMPTS,
  MAX_CALLER_EVIDENCE,
  type ChainStore,
} from '../../supabase/functions/governance-ingest/evidence';
import { EVIDENCE_HASH_METHOD, evidenceContentHash } from '../../supabase/functions/_shared/evidence-hash';

const T = 't-1';

/** In-memory chain mirroring append_governance_evidence: CAS on the tenant head. */
function memChain(opts: { moveHeadTimes?: number } = {}) {
  const rows: Array<Record<string, unknown>> = [];
  let moves = opts.moveHeadTimes ?? 0;
  const head = (tenantId: string) =>
    ([...rows].reverse().find((r) => r.tenant_id === tenantId && r.content_hash)?.content_hash as string | undefined) ?? null;
  const store: ChainStore = {
    async latestHead(tenantId) { return head(tenantId); },
    async append(row, expected) {
      if (moves > 0) {
        moves--;
        rows.push({ tenant_id: row.tenant_id, content_hash: `concurrent-${moves}`, previous_hash: head(row.tenant_id as string) });
      }
      if (row.previous_hash !== expected) throw new Error('row.previous_hash must equal expected');
      if (head(row.tenant_id as string) !== expected) return 'conflict';
      rows.push(row);
      return { id: row.id as string };
    },
  };
  return { rows, store, head };
}

const ctx = (evidenceId: string) => ({ tenantId: T, eventId: 'e-1', assetId: null, evidenceId });

describe('chainedEvidenceRow', () => {
  it('Kettenspalten kommen vom Server, nie vom Aufrufer', async () => {
    const row = await chainedEvidenceRow(
      { evidence_type: 'log', title: 'x', content_hash: 'sha256:forged', previous_hash: 'forged' },
      { ...ctx('ev-1'), previousHash: 'h0' },
    );
    expect(row.previous_hash).toBe('h0');
    expect(row.content_hash).not.toBe('sha256:forged');
    const meta = row.metadata as Record<string, unknown>;
    expect(meta.client_content_hash).toBe('sha256:forged');
    expect(meta.client_previous_hash).toBe('forged');
  });

  it('content_hash = sha256(JCS(metadata.snapshot)), Snapshot enthält previous_hash', async () => {
    const row = await chainedEvidenceRow({ evidence_type: 'log', title: 'x' }, { ...ctx('ev-1'), previousHash: 'h0' });
    const meta = row.metadata as Record<string, unknown>;
    const snapshot = meta.snapshot as Record<string, unknown>;
    expect(meta.hash_method).toBe(EVIDENCE_HASH_METHOD);
    expect(snapshot.previous_hash).toBe('h0');
    expect(row.content_hash).toBe(await evidenceContentHash(snapshot));
  });

  it('reservierte metadata-Schlüssel des Aufrufers werden verworfen', async () => {
    const row = await chainedEvidenceRow(
      { evidence_type: 'log', title: 'x', metadata: { a: 1, client_content_hash: 'spoof', snapshot: 'spoof', hash_method: 'spoof', source: 'spoof' } },
      { ...ctx('ev-1'), previousHash: null },
    );
    const meta = row.metadata as Record<string, unknown>;
    expect(meta.a).toBe(1);
    expect(meta.client_content_hash).toBeUndefined();
    expect(meta.source).toBe('governance-ingest');
    expect(meta.hash_method).toBe(EVIDENCE_HASH_METHOD);
    expect(typeof meta.snapshot).toBe('object');
  });
});

describe('appendCallerEvidence', () => {
  it('hängt nacheinander an: jede Zeile zeigt auf den Hash der vorherigen', async () => {
    const { rows, store } = memChain();
    await appendCallerEvidence(store, { evidence_type: 'log', title: 'a' }, ctx('ev-1'));
    await appendCallerEvidence(store, { evidence_type: 'log', title: 'b' }, ctx('ev-2'));
    expect(rows[0].previous_hash).toBeNull();
    expect(rows[1].previous_hash).toBe(rows[0].content_hash);
  });

  it('bewegter Kettenkopf → neu lesen, neu hashen, an den neuen Kopf anhängen', async () => {
    const { rows, store } = memChain({ moveHeadTimes: 2 });
    const r = await appendCallerEvidence(store, { evidence_type: 'log', title: 'a' }, ctx('ev-1'));
    expect(r.id).toBe('ev-1');
    const mine = rows.find((x) => x.id === 'ev-1')!;
    const idx = rows.indexOf(mine);
    expect(mine.previous_hash).toBe(rows[idx - 1].content_hash);
    const snapshot = (mine.metadata as Record<string, unknown>).snapshot as Record<string, unknown>;
    expect(mine.content_hash).toBe(await evidenceContentHash(snapshot));
  });

  it('Kopf bewegt sich dauerhaft → EvidenceChainBusyError, nichts angehängt', async () => {
    const { rows, store } = memChain({ moveHeadTimes: EVIDENCE_APPEND_ATTEMPTS });
    await expect(appendCallerEvidence(store, { evidence_type: 'log', title: 'a' }, ctx('ev-1')))
      .rejects.toBeInstanceOf(EvidenceChainBusyError);
    expect(rows.some((x) => x.id === 'ev-1')).toBe(false);
  });
});

describe('governance-ingest: Verdrahtung', () => {
  const src = readFileSync('supabase/functions/governance-ingest/index.ts', 'utf8');

  it('Caller-Evidence läuft über appendCallerEvidence und append_governance_evidence', () => {
    expect(src).toContain('appendCallerEvidence(chain, e, {');
    expect(src).toContain("admin.rpc('append_governance_evidence'");
    expect(src).not.toMatch(/content_hash:\s*e\.content_hash/);
    expect(src).not.toMatch(/previous_hash:\s*e\.previous_hash/);
  });

  it('Kopf-Abfrage in derselben Reihenfolge wie die RPC', () => {
    expect(src).toMatch(/\.not\('content_hash', 'is', null\)\s*\.order\('created_at', \{ ascending: false \}\)\s*\.order\('id', \{ ascending: false \}\)/);
  });

  it('Obergrenze je Request; Fehler nach Teilschreiben melden den Teilstand statt Retry zu signalisieren', () => {
    expect(MAX_CALLER_EVIDENCE).toBe(50);
    expect(src).toContain("'EVIDENCE_TOO_MANY'");
    expect(src).not.toMatch(/jsonError\(503/);
    expect(src).toMatch(/partial: true,\s*event_ids: insertedEvents!\.map\(\(e\) => e\.id\),\s*evidence_ids: insertedEvidence\.map\(\(e\) => e\.id\)/);
    expect(src).toContain("err instanceof EvidenceChainBusyError ? 'EVIDENCE_CHAIN_CONFLICT' : 'EVIDENCE_INSERT_FAILED'");
  });
});
