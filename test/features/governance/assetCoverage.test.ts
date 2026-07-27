import { describe, it, expect } from 'vitest';
import { computeAssetCoverage } from '../../../src/features/governance/assetCoverage';
import type { DbGovernanceAsset, DbAssetControlMapping } from '../../../src/features/governance/governanceApi';

function makeAsset(overrides: Partial<DbGovernanceAsset> = {}): DbGovernanceAsset {
  return {
    id: 'asset-1',
    tenant_id: 'tenant-1',
    asset_type: 'ai_system',
    name: 'Test Asset',
    description: null,
    owner_email: null,
    vendor: null,
    system_url: null,
    data_types: [],
    risk_score: 50,
    ai_act_class: 'limited',
    status: 'active',
    metadata: {},
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeMapping(overrides: Partial<DbAssetControlMapping> = {}): DbAssetControlMapping {
  return {
    id: 'mapping-1',
    asset_id: 'asset-1',
    control_id: 'control-1',
    status: 'not_started',
    evidence_id: null,
    notes: null,
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('computeAssetCoverage', () => {
  it('excludes assets with no mappings', () => {
    const assets = [makeAsset({ id: 'a1' }), makeAsset({ id: 'a2' })];
    const mappings = [makeMapping({ id: 'm1', asset_id: 'a1' })];

    const result = computeAssetCoverage(assets, mappings);

    expect(result).toHaveLength(1);
    expect(result[0].asset.id).toBe('a1');
  });

  it('computes coverage percent from implemented mappings', () => {
    const assets = [makeAsset({ id: 'a1' })];
    const mappings = [
      makeMapping({ id: 'm1', asset_id: 'a1', status: 'implemented' }),
      makeMapping({ id: 'm2', asset_id: 'a1', status: 'implemented' }),
      makeMapping({ id: 'm3', asset_id: 'a1', status: 'gap' }),
      makeMapping({ id: 'm4', asset_id: 'a1', status: 'not_started' }),
    ];

    const result = computeAssetCoverage(assets, mappings);

    expect(result[0].total).toBe(4);
    expect(result[0].implemented).toBe(2);
    expect(result[0].gaps).toBe(1);
    expect(result[0].coveragePercent).toBe(50);
  });

  it('returns 0 coverage percent when no mappings are implemented', () => {
    const assets = [makeAsset({ id: 'a1' })];
    const mappings = [makeMapping({ id: 'm1', asset_id: 'a1', status: 'gap' })];

    const result = computeAssetCoverage(assets, mappings);

    expect(result[0].coveragePercent).toBe(0);
  });

  it('returns 100 coverage percent when all mappings are implemented', () => {
    const assets = [makeAsset({ id: 'a1' })];
    const mappings = [
      makeMapping({ id: 'm1', asset_id: 'a1', status: 'implemented' }),
      makeMapping({ id: 'm2', asset_id: 'a1', status: 'implemented' }),
    ];

    const result = computeAssetCoverage(assets, mappings);

    expect(result[0].coveragePercent).toBe(100);
  });

  it('scopes mappings to their own asset', () => {
    const assets = [makeAsset({ id: 'a1' }), makeAsset({ id: 'a2' })];
    const mappings = [
      makeMapping({ id: 'm1', asset_id: 'a1', status: 'implemented' }),
      makeMapping({ id: 'm2', asset_id: 'a2', status: 'gap' }),
    ];

    const result = computeAssetCoverage(assets, mappings);
    const a1 = result.find((r) => r.asset.id === 'a1')!;
    const a2 = result.find((r) => r.asset.id === 'a2')!;

    expect(a1.mappings).toHaveLength(1);
    expect(a1.coveragePercent).toBe(100);
    expect(a2.mappings).toHaveLength(1);
    expect(a2.coveragePercent).toBe(0);
  });

  it('returns empty array when there are no assets', () => {
    const result = computeAssetCoverage([], []);
    expect(result).toEqual([]);
  });
});
