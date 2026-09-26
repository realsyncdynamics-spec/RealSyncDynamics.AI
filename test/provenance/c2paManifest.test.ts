import { describe, it, expect } from 'vitest';
import {
  buildC2paManifestDefinition, mapAction, isSupportedFormat,
  C2PA_SUPPORTED_FORMATS, type C2paBuildInput,
} from '../../src/lib/provenance/c2paManifest';

const base: C2paBuildInput = {
  assetRef: 'AST-2026-0007',
  format: 'image/jpeg',
  contentSha256: 'AB'.repeat(32),
  latestHash: 'CD'.repeat(32),
  signatureAlg: 'ed25519',
  keyId: 'rsd-ed25519-1',
  events: [
    { seq: 2, action: 'updated', actor: 'tenant:t1', event_ts: '2026-07-02T10:05:00.000Z' },
    { seq: 1, action: 'registered', actor: 'tenant:t1', event_ts: '2026-07-02T10:00:00.000Z' },
  ],
};

describe('mapAction', () => {
  it('bildet Standard-Aktionen auf c2pa.* ab, Sonderfälle auf eigenen Namespace', () => {
    expect(mapAction('registered')).toBe('c2pa.created');
    expect(mapAction('updated')).toBe('c2pa.edited');
    expect(mapAction('licensed')).toBe('com.realsyncdynamics.licensed');
    expect(mapAction('audited')).toBe('com.realsyncdynamics.audited');
  });
});

describe('isSupportedFormat', () => {
  it('akzeptiert nur den C1-Bild-Scope', () => {
    expect(isSupportedFormat('image/jpeg')).toBe(true);
    expect(isSupportedFormat('image/png')).toBe(true);
    expect(isSupportedFormat('application/pdf')).toBe(false);
    expect(isSupportedFormat('video/mp4')).toBe(false);
    expect([...C2PA_SUPPORTED_FORMATS]).toEqual(['image/jpeg', 'image/png']);
  });
});

describe('buildC2paManifestDefinition', () => {
  it('erzeugt claim_generator + Titel-Fallback auf asset_ref', () => {
    const def = buildC2paManifestDefinition(base);
    expect(def.claim_generator).toBe('RealSyncDynamics.AI/1.0');
    expect(def.claim_generator_info).toEqual([{ name: 'RealSyncDynamics.AI', version: '1.0' }]);
    expect(def.title).toBe('AST-2026-0007');
    expect(def.format).toBe('image/jpeg');
  });

  it('sortiert Events nach seq und bildet die c2pa.actions-Assertion', () => {
    const def = buildC2paManifestDefinition(base);
    const actions = def.assertions.find((a) => a.label === 'c2pa.actions')!.data.actions as Array<{ action: string; when: string }>;
    expect(actions.map((a) => a.action)).toEqual(['c2pa.created', 'c2pa.edited']);
    expect(actions[0].when).toBe('2026-07-02T10:00:00.000Z');
  });

  it('verknüpft über die custom-Assertion mit der internen Kette (lowercase Hashes)', () => {
    const def = buildC2paManifestDefinition(base);
    const rsd = def.assertions.find((a) => a.label === 'com.realsyncdynamics.provenance')!.data;
    expect(rsd.content_sha256).toBe('ab'.repeat(32));
    expect(rsd.latest_hash).toBe('cd'.repeat(32));
    expect(rsd.chain_length).toBe(2);
    expect(rsd.signature_alg).toBe('ed25519');
    expect(rsd.key_id).toBe('rsd-ed25519-1');
  });

  it('ist deterministisch (gleiche Eingabe ⇒ gleiche Definition)', () => {
    expect(buildC2paManifestDefinition(base)).toEqual(buildC2paManifestDefinition(base));
  });

  it('nutzt den übergebenen Titel, wenn vorhanden', () => {
    expect(buildC2paManifestDefinition({ ...base, title: '  Vertragsbild Q3  ' }).title).toBe('Vertragsbild Q3');
  });
});
