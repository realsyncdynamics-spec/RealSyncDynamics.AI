import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  serializeSnapshotForHash,
  verifyAllChains,
  verifyChain,
  type SnapshotRecord,
} from '../../packages/evidence-chain/src/index';

async function hashHex(input: string): Promise<string> {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function snap(partial: Partial<SnapshotRecord> & Pick<SnapshotRecord, 'version' | 'event_hash'>): SnapshotRecord {
  return {
    subject_ref: 'asset:site:example',
    content_sha256: 'a'.repeat(64),
    retention_class: '7y',
    prev_hash: null,
    event_timestamp: '2026-09-18T04:00:00.000Z',
    ...partial,
  };
}

describe('evidence-chain', () => {
  it('accepts a genesis + linked successor', async () => {
    const genesisBase = snap({ version: 1, event_hash: 'pending', prev_hash: null });
    const h1 = await hashHex(serializeSnapshotForHash(genesisBase));
    const v1 = { ...genesisBase, event_hash: h1 };
    const v2base = snap({ version: 2, event_hash: 'pending', prev_hash: h1 });
    const h2 = await hashHex(serializeSnapshotForHash(v2base));
    const v2 = { ...v2base, event_hash: h2 };

    const report = await verifyChain([v2, v1], hashHex);
    expect(report.ok).toBe(true);
    expect(report.cryptoVerified).toBe(2);
    expect(report.legacy).toBe(0);
  });

  it('flags hash_mismatch when payload is altered', async () => {
    const genesisBase = snap({ version: 1, event_hash: 'pending' });
    const h1 = await hashHex(serializeSnapshotForHash(genesisBase));
    const broken = { ...genesisBase, event_hash: h1, content_sha256: 'b'.repeat(64) };
    const report = await verifyChain([broken], hashHex);
    expect(report.ok).toBe(false);
    expect(report.issues[0]?.kind).toBe('hash_mismatch');
  });

  it('flags broken_link when prev_hash does not match prior event_hash', async () => {
    const v1base = snap({ version: 1, event_hash: 'pending' });
    const h1 = await hashHex(serializeSnapshotForHash(v1base));
    const v1 = { ...v1base, event_hash: h1 };
    const v2base = snap({ version: 2, event_hash: 'pending', prev_hash: 'c'.repeat(64) });
    const h2 = await hashHex(serializeSnapshotForHash(v2base));
    const v2 = { ...v2base, event_hash: h2 };
    const report = await verifyChain([v1, v2], hashHex);
    expect(report.issues.some((i) => i.kind === 'broken_link')).toBe(true);
  });

  it('treats missing event_timestamp as legacy, not tamper', async () => {
    const row = snap({ version: 1, event_hash: 'd'.repeat(64), event_timestamp: null });
    const report = await verifyChain([row], hashHex);
    expect(report.ok).toBe(true);
    expect(report.legacy).toBe(1);
    expect(report.cryptoVerified).toBe(0);
  });

  it('groups subjects in verifyAllChains', async () => {
    const aBase = snap({ subject_ref: 'a', version: 1, event_hash: 'pending' });
    const ah = await hashHex(serializeSnapshotForHash(aBase));
    const bBase = snap({ subject_ref: 'b', version: 1, event_hash: 'pending' });
    const bh = await hashHex(serializeSnapshotForHash(bBase));
    const reports = await verifyAllChains(
      [
        { ...aBase, event_hash: ah },
        { ...bBase, event_hash: bh },
      ],
      hashHex,
    );
    expect(reports).toHaveLength(2);
    expect(reports.every((r) => r.ok)).toBe(true);
  });
});
