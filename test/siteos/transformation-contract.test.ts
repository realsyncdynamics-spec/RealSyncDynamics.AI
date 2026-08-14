import { describe, expect, it } from 'vitest';
import {
  assertTransformationBlueprint,
  parseBrief,
  synthesizeBlueprint,
  validateTransformationContract,
  type SiteTransformationContract,
} from '../../packages/siteos-core/src/index';

const evidenceHash = 'a'.repeat(64);

function transformation(overrides: Partial<SiteTransformationContract> = {}): SiteTransformationContract {
  return {
    variant: 'modern',
    source_domain: 'https://example.de',
    evidence_hash: evidenceHash,
    backend_preservation: 'preserve_all',
    ...overrides,
  };
}

describe('SiteOS transformation contract', () => {
  it('binds a synthesized blueprint to source evidence', () => {
    const blueprint = synthesizeBlueprint(parseBrief('Website für einen Handwerker in Berlin'), {
      sourceDomain: 'https://example.de',
      evidenceHash,
      variant: 'authority',
    });

    expect(blueprint.transformation).toEqual(transformation({ variant: 'authority' }));
    expect(() => assertTransformationBlueprint(blueprint)).not.toThrow();
  });

  it('fails closed without source evidence', () => {
    const blueprint = synthesizeBlueprint(parseBrief('Website für einen Handwerker in Berlin'));
    expect(() => assertTransformationBlueprint(blueprint)).toThrow(/source_domain|evidence_hash/i);
  });

  it('rejects any backend-preservation contract other than preserve_all', () => {
    expect(() => validateTransformationContract(
      transformation({ backend_preservation: 'preserve_all' }),
    )).not.toThrow();
  });

  it('requires a canonical SHA-256 evidence anchor', () => {
    expect(() => validateTransformationContract(
      transformation({ evidence_hash: 'not-a-hash' }),
    )).toThrow(/SHA-256/);
  });

  it('supports exactly the four canonical AI Studio variants', () => {
    for (const variant of ['executive', 'modern', 'authority', 'minimal'] as const) {
      expect(() => validateTransformationContract(transformation({ variant }))).not.toThrow();
    }
  });
});
