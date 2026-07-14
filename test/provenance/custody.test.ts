import { describe, it, expect } from 'vitest';
import { claimHash } from '../../src/lib/provenance/canonicalClaim';
import { verifyCustodyChain, type CustodyEvent } from '../../src/lib/provenance/custody';

/** Baut eine gültige, korrekt verkettete Custody-Kette für Tests. */
async function buildChain(steps: Array<Partial<CustodyEvent>>): Promise<CustodyEvent[]> {
  const events: CustodyEvent[] = [];
  let prevHash: string | null = null;
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const claim = {
      assetRef: s.assetRef ?? 'AST-1',
      contentSha256: s.contentSha256 ?? 'a'.repeat(64),
      issuer: s.issuer ?? 'tenant:acme',
      action: s.action ?? ('registered' as const),
      timestamp: s.timestamp ?? `2026-07-01T10:0${i}:00.000Z`,
      prevHash,
    };
    const eventHash = await claimHash(claim);
    events.push({ seq: i + 1, ...claim, eventHash });
    prevHash = eventHash;
  }
  return events;
}

describe('verifyCustodyChain', () => {
  it('meldet unverifiable bei leerer Kette', async () => {
    const r = await verifyCustodyChain([]);
    expect(r.state).toBe('unverifiable');
    expect(r.verifiedCount).toBe(0);
  });

  it('verifiziert eine intakte, mehrstufige Kette', async () => {
    const chain = await buildChain([
      { action: 'registered' },
      { action: 'updated' },
      { action: 'audited' },
    ]);
    const r = await verifyCustodyChain(chain);
    expect(r.state).toBe('intact');
    expect(r.verifiedCount).toBe(3);
    expect(r.brokenAtSeq).toBeNull();
  });

  it('erkennt Reihenfolge unabhängig von Input-Sortierung', async () => {
    const chain = await buildChain([{ action: 'registered' }, { action: 'updated' }]);
    const r = await verifyCustodyChain([chain[1], chain[0]]);
    expect(r.state).toBe('intact');
  });

  it('erkennt Manipulation am Inhalt (Hash-Mismatch)', async () => {
    const chain = await buildChain([{ action: 'registered' }, { action: 'updated' }]);
    chain[1] = { ...chain[1], contentSha256: 'c'.repeat(64) }; // nachträglich verändert
    const r = await verifyCustodyChain(chain);
    expect(r.state).toBe('tampered');
    expect(r.brokenAtSeq).toBe(2);
  });

  it('erkennt gebrochene Verkettung (prevHash passt nicht)', async () => {
    const chain = await buildChain([{ action: 'registered' }, { action: 'updated' }]);
    chain[1] = { ...chain[1], prevHash: 'd'.repeat(64) };
    const r = await verifyCustodyChain(chain);
    expect(r.state).toBe('tampered');
    expect(r.brokenAtSeq).toBe(2);
  });

  it('erkennt einen manipulierten Kettenanfang (prevHash != null)', async () => {
    const chain = await buildChain([{ action: 'registered' }]);
    chain[0] = { ...chain[0], prevHash: 'e'.repeat(64) };
    const r = await verifyCustodyChain(chain);
    expect(r.state).toBe('tampered');
    expect(r.brokenAtSeq).toBe(1);
  });

  it('erkennt eine seq-Lücke', async () => {
    const chain = await buildChain([{ action: 'registered' }, { action: 'updated' }]);
    chain[1] = { ...chain[1], seq: 5 };
    const r = await verifyCustodyChain(chain);
    expect(r.state).toBe('tampered');
  });
});
