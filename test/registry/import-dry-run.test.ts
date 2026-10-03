// @vitest-environment node
/**
 * Import-Pfad (Trockenlauf): Registry-Dateien -> Tabellenzeilen. Schreibt nichts.
 */
import { describe, expect, it } from 'vitest';

import { buildImportPlan, FORBIDDEN_COLUMNS } from '../../scripts/registry/import-dry-run.ts';
import { NEGATIVE, REAL_REGISTRY, SCHEMA_DIR } from './helpers.ts';
import { join } from 'node:path';

describe('registry:import:dry-run', () => {
  it('baut aus den fuenf Dateien einen Plan ohne verbotene Spalten', async () => {
    const plan = await buildImportPlan(REAL_REGISTRY, SCHEMA_DIR);
    expect(plan.ok).toBe(true);
    expect(plan.tables.registry_vendors).toHaveLength(5);
    expect(plan.tables.registry_deployments).toHaveLength(5);
    for (const rows of Object.values(plan.tables)) {
      for (const row of rows) for (const c of FORBIDDEN_COLUMNS) expect(row).not.toHaveProperty(c);
    }
    for (const v of plan.tables.registry_vendors) expect(v.source_sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('STACKIT: Kategorie statt Modellpreis (GPT-OSS 120B = plus)', async () => {
    const plan = await buildImportPlan(REAL_REGISTRY, SCHEMA_DIR);
    const dep = plan.tables.registry_deployments.find((d) => d.deployment_id === 'stackit-ai-model-serving-eu01')!;
    expect(dep.pricing_scheme).toBe('category');
    const models = plan.tables.registry_models.filter((m) => m.deployment_id === 'stackit-ai-model-serving-eu01');
    expect(models.every((m) => m.price === null && typeof m.price_category === 'string')).toBe(true);
    expect(models.find((m) => m.model_id === 'gpt-oss-120b')!.price_category).toBe('plus');
  });

  it('Zertifikate tragen immer scope und applies_to_sku; kein Zertifikat wird vererbt', async () => {
    const plan = await buildImportPlan(REAL_REGISTRY, SCHEMA_DIR);
    for (const c of plan.tables.registry_certifications) {
      expect(typeof c.scope).toBe('string');
      expect(Array.isArray(c.applies_to_sku)).toBe(true);
    }
    const attributed = plan.tables.registry_certifications.filter((c) => (c.applies_to_sku as string[]).length > 0).map((c) => c.cert_id).sort();
    expect(attributed).toEqual(['ionos-ai-model-hub-bsi-c5', 'stackit-ai-model-serving-c5-type2']);
  });

  it('bricht ab, wenn ein Gate rot ist', async () => {
    const plan = await buildImportPlan(join(NEGATIVE, 'invalid-json'), SCHEMA_DIR);
    expect(plan.ok).toBe(false);
    expect(plan.tables.registry_vendors).toHaveLength(0);
  });
});
