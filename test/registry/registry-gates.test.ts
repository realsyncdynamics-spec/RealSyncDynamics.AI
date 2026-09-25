// @vitest-environment node
/**
 * Registry-Gates: parse, schema, referential-integrity, evidence, policy-invariants.
 *
 * Laeuft im unit-Job (npm test). Jede Gate-Regel hat einen gruenen Fall
 * (gueltiges Fixture, leeres Verzeichnis, die fuenf echten Registry-Dateien)
 * und mindestens einen roten Fall (gezielte Mutation des gueltigen Fixtures).
 */
import { afterAll, describe, expect, it } from 'vitest';
import { join } from 'node:path';

import { GATES, runAllGates, runGate, type GateName } from '../../scripts/registry/lib.ts';
import { cleanup, emptyRegistry, mutated, NEGATIVE, readJson, REAL_REGISTRY, SCHEMA_DIR, VALID, withExtraFile } from './helpers.ts';

afterAll(cleanup);

async function codes(gate: GateName, dir: string): Promise<string[]> {
  const r = await runGate(gate, dir, SCHEMA_DIR);
  return r.issues.map((i) => i.code);
}

describe('Registry-Gates – gruen', () => {
  it('die fuenf echten Registry-Dateien bestehen alle Gates', async () => {
    const results = await runAllGates(REAL_REGISTRY, SCHEMA_DIR);
    for (const r of results) expect({ gate: r.gate, issues: r.issues }).toEqual({ gate: r.gate, issues: [] });
    expect(results[0]!.counts).toEqual({ vendor: 5, deployment: 5, assessment: 0 });
  });

  it('enthaelt genau die beauftragten Anbieter-Deployments', async () => {
    const { loadRegistry } = await import('../../scripts/registry/lib.ts');
    const ids = loadRegistry(REAL_REGISTRY).files.filter((f) => f.kind === 'deployment').map((f) => (f.data as { deployment_id: string }).deployment_id).sort();
    expect(ids).toEqual([
      'ionos-ai-model-hub-de',
      'mistral-la-plateforme-eu',
      'ovhcloud-ai-endpoints-gra',
      'scaleway-generative-apis-fr-par',
      'stackit-ai-model-serving-eu01',
    ]);
  });

  it('leeres Verzeichnis ist gruen', async () => {
    const results = await runAllGates(emptyRegistry(), SCHEMA_DIR);
    expect(results.map((r) => r.gate)).toEqual([...GATES]);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it('gueltiges Fixture (inkl. Assessment-Snapshot) ist gruen', async () => {
    const results = await runAllGates(VALID, SCHEMA_DIR);
    for (const r of results) expect(r.issues).toEqual([]);
  });
});

describe('Gate parse – rot', () => {
  it('ungueltiges JSON', async () => {
    expect(await codes('parse', join(NEGATIVE, 'invalid-json'))).toEqual(['INVALID_JSON']);
  });
  it('YAML ist (noch) nicht freigegeben', async () => {
    expect(await codes('parse', join(NEGATIVE, 'unsupported-yaml'))).toEqual(['UNSUPPORTED_EXTENSION']);
  });
  it('leere Datei', async () => {
    expect(await codes('parse', withExtraFile('vendors/empty-vendor.json', ''))).toEqual(['EMPTY_FILE']);
  });
  it('Folge-Gates melden die fehlende Voraussetzung statt still gruen zu sein', async () => {
    for (const g of ['schema', 'referential-integrity', 'evidence', 'policy-invariants'] as const) {
      const r = await runGate(g, join(NEGATIVE, 'invalid-json'), SCHEMA_DIR);
      expect(r.ok).toBe(false);
    }
  });
});

describe('Gate schema (Draft 2020-12) – rot', () => {
  const dep = 'deployments/example-deployment-a.json';
  const cases: Array<[string, string, (d: any) => void]> = [
    ['Immunitaets-Flag cloud_act_safe', dep, (d) => { d.cloud_act_safe = true; }],
    ['gespeicherte Routing-Zulaessigkeit', dep, (d) => { d.routing_allowed = true; }],
    ['gespeichertes Ergebnis', dep, (d) => { d.result = 'PASS'; }],
    ['unbekannter Region-Scope', dep, (d) => { d.inference_region.scope = 'eu-ish'; }],
    ['verified ohne verification-Nachweis', dep, (d) => { d.external_inference_egress.status = 'verified'; }],
    ['unknown mit Wert', dep, (d) => { d.external_inference_egress.status = 'unknown'; }],
    ['scope=country ohne Laendercode', dep, (d) => { d.inference_region.country_codes = []; }],
    ['Kategorie-Preis mit Modellpreis', dep, (d) => { d.models[0].price = { input_per_1m: 1, output_per_1m: 1, status: 'claimed', sources: d.pricing.sources, captured_at: '2026-09-20' }; }],
    ['/models_available als primaeres Inventar', dep, (d) => { d.connector.connector_type = 'pharia_os'; d.connector.inventory_endpoint = { kind: 'settings_endpoint', path_or_url: '/models_available' }; }],
    ['Zertifikat ohne applies_to_sku', dep, (d) => { delete d.certifications[0].applies_to_sku; }],
    ['Zertifikat ohne Quelle', dep, (d) => { d.certifications[0].sources = []; }],
    ['Siegel awarded ohne SKU', dep, (d) => { d.jurisdiction.eu_commission_seal.applies_to_sku = []; }],
    ['Kontrollwechsel none ohne Quelle', 'vendors/example-vendor-a.json', (d) => { d.control_change = { ...d.control_change, status: 'none', verification_status: 'claimed' }; }],
    ['Assessment mit UI-Farbe', 'assessments/example-assessment-a.json', (d) => { d.status_color = 'green'; }],
    ['Assessment mit unbekanntem Ergebnis', 'assessments/example-assessment-a.json', (d) => { d.result = 'OK'; }],
    ['Risikoklasse ausserhalb der Liste', 'assessments/example-assessment-a.json', (d) => { d.inputs.use_case_risk_class = 'unacceptable'; }],
  ];
  for (const [name, file, fn] of cases) {
    it(name, async () => {
      expect(await codes('schema', await mutated(file, fn))).toContain('SCHEMA');
    });
  }
});

describe('Gate referential-integrity – rot', () => {
  const dep = 'deployments/example-deployment-a.json';
  const cases: Array<[string, string, (d: any) => void, string, { rename?: string }?]> = [
    ['Vendor existiert nicht', dep, (d) => { d.vendor_id = 'missing-vendor'; }, 'VENDOR_NOT_FOUND'],
    ['Betreiber existiert nicht', dep, (d) => { d.infrastructure_operator.vendor_id = 'missing-host'; }, 'HOST_VENDOR_NOT_FOUND'],
    ['doppelte model_id', dep, (d) => { d.models.push({ ...d.models[0] }); }, 'DUPLICATE_MODEL_ID'],
    ['price_category ohne Kategorie', dep, (d) => { d.models[0].price_category.value = 'premium'; }, 'PRICE_CATEGORY_NOT_FOUND'],
    ['Claim verweist auf fehlendes Modell', dep, (d) => { d.claims[0].subject.model_ids = ['ghost-model']; }, 'CLAIM_MODEL_NOT_FOUND'],
    ['Claim gehoert zu anderem Deployment', dep, (d) => { d.claims[0].subject.deployment_id = 'example-deployment-b'; }, 'CLAIM_DEPLOYMENT_MISMATCH'],
    ['doppelte claim_id', dep, (d) => { d.claims.push({ ...d.claims[0] }); }, 'DUPLICATE_CLAIM_ID'],
    ['Zertifikat fuer fremde SKU', dep, (d) => { d.certifications[0].applies_to_sku = ['example-product-b']; }, 'CERT_SKU_UNKNOWN'],
    ['Siegel fuer fremde SKU', dep, (d) => { d.jurisdiction.eu_commission_seal.applies_to_sku = ['other-product']; }, 'SEAL_SKU_UNKNOWN'],
    ['captured_at in der Zukunft', dep, (d) => { d.inference_region.captured_at = '2099-01-01'; }, 'CAPTURED_AT_IN_FUTURE'],
    ['valid_until vor valid_from', dep, (d) => { d.jurisdiction.eu_commission_seal.valid_until = '2025-01-01'; }, 'VALIDITY_RANGE_INVERTED'],
    ['Dateiname passt nicht zur ID', dep, () => {}, 'FILENAME_ID_MISMATCH', { rename: 'deployments/renamed.json' }],
    ['Assessment auf fehlendes Deployment', 'assessments/example-assessment-a.json', (d) => { d.deployment_id = 'ghost'; d.inputs.deployment_id = 'ghost'; }, 'ASSESSMENT_DEPLOYMENT_NOT_FOUND'],
    ['Assessment auf fehlendes Modell', 'assessments/example-assessment-a.json', (d) => { d.model_id = 'ghost-model'; }, 'ASSESSMENT_MODEL_NOT_FOUND'],
    ['Assessment-Evidenz auf fehlenden Claim', 'assessments/example-assessment-a.json', (d) => { d.inputs.evidence[0].ref = 'claim:ghost'; d.inputs.relied_on[0] = 'claim:ghost'; }, 'EVIDENCE_CLAIM_NOT_FOUND'],
    ['Assessment mit fremder SKU', 'assessments/example-assessment-a.json', (d) => { d.inputs.product_sku = 'example-product-b'; }, 'ASSESSMENT_SKU_MISMATCH'],
  ];
  for (const [name, file, fn, code, opts] of cases) {
    it(name, async () => {
      expect(await codes('referential-integrity', await mutated(file, fn, opts ?? {}))).toContain(code);
    });
  }
  it('doppelte vendor_id in zwei Dateien', async () => {
    const dir = withExtraFile('vendors/example-vendor-a-copy.json', JSON.stringify(readJson(VALID, 'vendors/example-vendor-a.json')));
    const c = await codes('referential-integrity', dir);
    expect(c).toContain('DUPLICATE_VENDOR_ID');
  });
});

describe('Gate evidence – rot', () => {
  const dep = 'deployments/example-deployment-a.json';
  const asm = 'assessments/example-assessment-a.json';
  it('claimed-Faehigkeit ohne Quelle', async () => {
    expect(await codes('evidence', await mutated(dep, (d) => { d.capabilities.tools.sources = []; }))).toContain('UNSOURCED_CLAIM');
  });
  it('claimed-Drittstaatenaussage ohne Quelle', async () => {
    expect(await codes('evidence', await mutated(dep, (d) => { d.jurisdiction.third_country_access.sources = []; }))).toContain('UNSOURCED_CLAIM');
  });
  it('claimed-Governance-Claim ohne Quelle', async () => {
    expect(await codes('evidence', await mutated(dep, (d) => { d.claims[0].sources = []; }))).toContain('UNSOURCED_CLAIM');
  });
  it('PASS aus einem unbelegten (unknown) Claim', async () => {
    const dir = await mutated(asm, (d) => { d.inputs.evidence[0].status = 'unknown'; d.inputs.evidence[0].source_count = 0; });
    expect(await codes('evidence', dir)).toContain('EVIDENCE_UNBACKED_POSITIVE_RESULT');
  });
  it('CONDITIONAL aus einem Claim ohne Quelle', async () => {
    const dir = await mutated(asm, (d) => { d.result = 'CONDITIONAL'; d.inputs.evidence[1].source_count = 0; });
    expect(await codes('evidence', dir)).toContain('EVIDENCE_UNBACKED_POSITIVE_RESULT');
  });
  it('FAIL/UNKNOWN aus unbelegten Claims bleibt zulaessig', async () => {
    const dir = await mutated(asm, (d) => { d.result = 'UNKNOWN'; d.inputs.evidence[0].status = 'unknown'; d.inputs.evidence[0].source_count = 0; });
    expect(await codes('evidence', dir)).toEqual([]);
  });
  it('relied_on ohne Evidenzeintrag', async () => {
    expect(await codes('evidence', await mutated(asm, (d) => { d.inputs.relied_on.push('fact:missing'); }))).toContain('EVIDENCE_RELIED_ON_MISSING');
  });
  it('inputs_hash passt nicht zu inputs', async () => {
    expect(await codes('evidence', await mutated(asm, (d) => { d.inputs.intended_purpose = 'geaendert'; }, { keepHash: true }))).toContain('INPUTS_HASH_MISMATCH');
  });
  it('Snapshot stellt Evidenz besser dar als die Registry', async () => {
    expect(await codes('evidence', await mutated(asm, (d) => { d.inputs.evidence[0].source_count = 3; }))).toContain('EVIDENCE_OVERSTATED');
  });
});

describe('Gate policy-invariants – rot', () => {
  const asm = 'assessments/example-assessment-a.json';
  const cases: Array<[string, (d: any) => void, string]> = [
    ['(a) strict_eu_sovereignty + externe Inferenz-Weitergabe -> kein PASS', (d) => { d.inputs.facts.external_inference_egress.value = true; }, 'INV_A_EGRESS_STRICT_PASS'],
    ['(a) strict_eu_sovereignty + unbelegte Weitergabe -> kein PASS', (d) => { d.inputs.facts.external_inference_egress = { value: null, status: 'unknown', sources: [], captured_at: '2026-09-20' }; }, 'INV_A_EGRESS_UNKNOWN_STRICT_PASS'],
    ['(b) veraltete relied-on Evidenz -> kein PASS', (d) => { d.inputs.evidence[0].freshness = 'stale'; }, 'INV_B_STALE_EVIDENCE_PASS'],
    ['(b) als fresh markierte, aber veraltete Evidenz', (d) => { d.inputs.evidence[0].captured_at = '2026-01-01'; }, 'INV_B_FRESHNESS_MISLABELLED'],
    ['(c) not_assessed + AI-Act-Konformitaetsaussage', (d) => { d.derived.ai_act_conformity = 'conformant'; }, 'INV_C_AI_ACT_WITHOUT_RISK_CLASS'],
    ['(d) SEAL-3 wird nie SEAL-4', (d) => { d.derived.seal_level = 'SEAL-4'; }, 'INV_D_SEAL_ESCALATION'],
    ['(d) SEAL-3 ist nie full_supply_chain_sovereignty', (d) => { d.derived.sovereignty_assurance = 'full_supply_chain_sovereignty'; }, 'INV_D_FULL_SUPPLY_CHAIN_WITHOUT_SEAL4'],
    ['(d) assurance_target full_supply_chain_sovereignty ohne SEAL-4 -> kein PASS', (d) => { d.assurance_target = 'full_supply_chain_sovereignty'; d.inputs.assurance_target = 'full_supply_chain_sovereignty'; }, 'INV_D_FULL_SUPPLY_CHAIN_WITHOUT_SEAL4'],
    ['(d) Siegel einer anderen SKU zaehlt nicht', (d) => { d.inputs.facts.eu_commission_seal.applies_to_sku = ['example-product-b']; }, 'INV_D_SEAL_ESCALATION'],
    ['(e) Drittstaaten-Ausschluss nie aus EU-Region', (d) => { d.inputs.facts.third_country_access = { status: 'unknown', requires_subprocessor_review: true, verification_status: 'unknown', sources: [], captured_at: '2026-09-20' }; }, 'INV_E_THIRD_COUNTRY_FROM_REGION'],
    ['Snapshot-Felder weichen von inputs ab', (d) => { d.rule_version = 'registry-invariants@0.2.0'; }, 'SNAPSHOT_FIELD_MISMATCH'],
  ];
  for (const [name, fn, code] of cases) {
    it(name, async () => {
      expect(await codes('policy-invariants', await mutated(asm, fn))).toContain(code);
    });
  }

  it('abgeleitete Werte werden nie in Fakten gespeichert (auch nicht in Claim-Werten)', async () => {
    const dir = await mutated('deployments/example-deployment-a.json', (d) => { d.claims[0].value = { routing_allowed: true }; });
    expect(await codes('policy-invariants', dir)).toContain('DERIVED_VALUE_STORED');
  });

  it('unbekannte Region ist ausserhalb GLOBAL_ALLOWED nie zulaessig (fail-closed, Datenebene)', async () => {
    // example-deployment-b: Region unknown, Weitergabe true – das Gate bleibt gruen,
    // weil die Ableitung beides ausschliesst.
    expect(await codes('policy-invariants', VALID)).toEqual([]);
  });
});
