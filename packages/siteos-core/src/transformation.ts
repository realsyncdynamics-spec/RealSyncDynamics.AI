import type { SiteBlueprint, SiteTransformationContract } from './types.ts';

export const TRANSFORMATION_VARIANTS = ['executive', 'modern', 'authority', 'minimal'] as const;

export function validateTransformationContract(
  contract: SiteTransformationContract,
): void {
  if (!TRANSFORMATION_VARIANTS.includes(contract.variant)) {
    throw new Error(`Invalid transformation variant: ${String(contract.variant)}`);
  }
  if (!contract.source_domain.trim()) {
    throw new Error('Transformation contract requires source_domain');
  }
  if (!/^[a-f0-9]{64}$/i.test(contract.evidence_hash)) {
    throw new Error('Transformation contract requires a SHA-256 evidence_hash');
  }
  if (contract.backend_preservation !== 'preserve_all') {
    throw new Error('backend_preservation must be preserve_all');
  }
}

/**
 * Publish/render gate for AI Studio transformations.
 * Fails closed if the blueprint is not bound to verified source evidence.
 */
export function assertTransformationBlueprint(blueprint: SiteBlueprint): void {
  validateTransformationContract(blueprint.transformation);
}
