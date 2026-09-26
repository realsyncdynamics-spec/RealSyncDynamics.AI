// @vitest-environment node
/**
 * Residency-Klassen und Ableitungsregel (Invarianten) + Routing-Kandidaten
 * auf den fuenf echten Registry-Dateien.
 *
 * Routing-Zulaessigkeit ist eine reine Funktion aus Fakten + Policy. Sie wird
 * nie gespeichert (siehe Schema/Migration) und ist fail-closed.
 */
import { describe, expect, it } from 'vitest';

import { loadRegistry } from '../../scripts/registry/lib.ts';
import type { DeploymentFile, RegionFact, ResidencyClass } from '../../supabase/functions/_shared/registry/types.ts';
import {
  EFTA, EU27, RESIDENCY_CLASSES, regionSatisfies, residencyEligibility, routeCandidates, stricterResidency,
} from '../../supabase/functions/_shared/registry/residency.ts';
import { readJson, REAL_REGISTRY, VALID } from './helpers.ts';

const SRC = [{ url: 'https://example.com/x', captured_at: '2026-09-20' }];
const region = (scope: RegionFact['scope'], codes: string[], status: RegionFact['status'] = 'claimed', sources = SRC): RegionFact => ({
  scope, country_codes: codes, provider_region_code: null, locality: null, status, sources, captured_at: '2026-09-20',
});

const REAL: DeploymentFile[] = loadRegistry(REAL_REGISTRY).files.filter((f) => f.kind === 'deployment').map((f) => f.data as DeploymentFile);
const byId = (id: string) => REAL.find((d) => d.deployment_id === id)!;

describe('Residency-Klassen', () => {
  it('genau vier Klassen, von streng nach offen', () => {
    expect(RESIDENCY_CLASSES).toEqual(['DE_ONLY', 'EU_ONLY', 'EU_EFTA', 'GLOBAL_ALLOWED']);
    expect(EU27.size).toBe(27);
    expect([...EFTA].sort()).toEqual(['CH', 'IS', 'LI', 'NO']);
    for (const c of EFTA) expect(EU27.has(c)).toBe(false);
  });

  it('Ableitungstabelle', () => {
    const t: Array<[RegionFact, Record<ResidencyClass, boolean>]> = [
      [region('country', ['DE']), { DE_ONLY: true, EU_ONLY: true, EU_EFTA: true, GLOBAL_ALLOWED: true }],
      [region('country', ['FR']), { DE_ONLY: false, EU_ONLY: true, EU_EFTA: true, GLOBAL_ALLOWED: true }],
      [region('country', ['DE', 'FR']), { DE_ONLY: false, EU_ONLY: true, EU_EFTA: true, GLOBAL_ALLOWED: true }],
      [region('country', ['CH']), { DE_ONLY: false, EU_ONLY: false, EU_EFTA: true, GLOBAL_ALLOWED: true }],
      [region('country', ['DE', 'CH']), { DE_ONLY: false, EU_ONLY: false, EU_EFTA: true, GLOBAL_ALLOWED: true }],
      [region('country', ['US']), { DE_ONLY: false, EU_ONLY: false, EU_EFTA: false, GLOBAL_ALLOWED: true }],
      [region('country', ['GB']), { DE_ONLY: false, EU_ONLY: false, EU_EFTA: false, GLOBAL_ALLOWED: true }],
      [region('eu', []), { DE_ONLY: false, EU_ONLY: true, EU_EFTA: true, GLOBAL_ALLOWED: true }],
      [region('eu_efta', []), { DE_ONLY: false, EU_ONLY: false, EU_EFTA: true, GLOBAL_ALLOWED: true }],
      [region('europe', []), { DE_ONLY: false, EU_ONLY: false, EU_EFTA: false, GLOBAL_ALLOWED: true }],
      [region('global', []), { DE_ONLY: false, EU_ONLY: false, EU_EFTA: false, GLOBAL_ALLOWED: true }],
      [region('unknown', [], 'unknown', []), { DE_ONLY: false, EU_ONLY: false, EU_EFTA: false, GLOBAL_ALLOWED: true }],
      // Behauptete Region ohne Quelle zaehlt nicht.
      [region('country', ['DE'], 'claimed', []), { DE_ONLY: false, EU_ONLY: false, EU_EFTA: false, GLOBAL_ALLOWED: true }],
    ];
    for (const [r, want] of t) {
      const got = Object.fromEntries(RESIDENCY_CLASSES.map((c) => [c, regionSatisfies(r, c).ok]));
      expect({ r: `${r.scope}:${r.country_codes.join(',')}:${r.sources.length}`, got }).toEqual({ r: `${r.scope}:${r.country_codes.join(',')}:${r.sources.length}`, got: want });
    }
  });

  it('Monotonie: DE_ONLY => EU_ONLY => EU_EFTA => GLOBAL_ALLOWED (alle Kombinationen)', () => {
    const codes = ['DE', 'FR', 'AT', 'CH', 'NO', 'US', 'GB', 'CN'];
    const scopes: RegionFact['scope'][] = ['country', 'eu', 'eu_efta', 'europe', 'global'];
    for (const scope of scopes) {
      for (let mask = 0; mask < 1 << codes.length; mask++) {
        const cs = codes.filter((_, i) => mask & (1 << i));
        if (scope === 'country' && cs.length === 0) continue;
        const r = region(scope, scope === 'country' ? cs : []);
        const ok = RESIDENCY_CLASSES.map((c) => regionSatisfies(r, c).ok);
        for (let i = 0; i < ok.length - 1; i++) if (ok[i]) expect(ok[i + 1]).toBe(true);
      }
    }
  });

  it('externe Inferenz-Weitergabe schliesst jede Klasse ausser GLOBAL_ALLOWED aus', () => {
    const d = structuredClone(readJson(VALID, 'deployments/example-deployment-a.json')) as DeploymentFile;
    d.external_inference_egress = { value: true, status: 'claimed', sources: SRC, captured_at: '2026-09-20' };
    for (const c of ['DE_ONLY', 'EU_ONLY', 'EU_EFTA'] as const) {
      expect(residencyEligibility(d, c).reasons).toContain('EXTERNAL_INFERENCE_EGRESS');
    }
    expect(residencyEligibility(d, 'GLOBAL_ALLOWED').eligible).toBe(true);
  });

  it('EU-Region begruendet nie einen Drittstaaten-Ausschluss (Bedingung bleibt)', () => {
    for (const d of REAL) {
      const el = residencyEligibility(d, 'EU_EFTA');
      if (d.jurisdiction.third_country_access.status !== 'no_access_claimed') {
        expect(el.conditions).toContain('THIRD_COUNTRY_ACCESS_NOT_EXCLUDED');
      }
    }
  });

  it('stricterResidency waehlt die strengere Klasse', () => {
    expect(stricterResidency('EU_EFTA', 'DE_ONLY')).toBe('DE_ONLY');
    expect(stricterResidency('GLOBAL_ALLOWED', 'EU_ONLY')).toBe('EU_ONLY');
  });
});

describe('Residency auf den echten Registry-Dateien', () => {
  const eligible = (c: ResidencyClass) => REAL.filter((d) => residencyEligibility(d, c).eligible).map((d) => d.deployment_id).sort();

  it('DE_ONLY: nur IONOS (DE) und STACKIT (eu01 Germany South)', () => {
    expect(eligible('DE_ONLY')).toEqual(['ionos-ai-model-hub-de', 'stackit-ai-model-serving-eu01']);
  });
  it('EU_ONLY: zusaetzlich Scaleway (Paris) und OVHcloud (Gravelines) – nicht Mistral EU (EU+EFTA)', () => {
    expect(eligible('EU_ONLY')).toEqual(['ionos-ai-model-hub-de', 'ovhcloud-ai-endpoints-gra', 'scaleway-generative-apis-fr-par', 'stackit-ai-model-serving-eu01']);
    expect(residencyEligibility(byId('mistral-la-plateforme-eu'), 'EU_ONLY').reasons).toEqual(['REGION_OUTSIDE_RESIDENCY']);
  });
  it('EU_EFTA: zusaetzlich Mistral EU', () => {
    expect(eligible('EU_EFTA')).toEqual([...eligible('EU_ONLY'), 'mistral-la-plateforme-eu'].sort());
  });
});

describe('routeCandidates – Fallback nur innerhalb der erlaubten Residency', () => {
  it('DE_ONLY + tools: nur IONOS- und STACKIT-Modelle mit belegtem Tool-Calling', () => {
    const r = routeCandidates(REAL, { residency: 'DE_ONLY', required_capabilities: ['chat', 'tools'] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect([...new Set(r.candidates.map((c) => c.deployment_id))].sort()).toEqual(['ionos-ai-model-hub-de', 'stackit-ai-model-serving-eu01']);
    // Kein Kandidat ausserhalb Deutschlands – auch nicht als Fallback.
    expect(r.candidates.every((c) => ['ionos-cloud', 'schwarz-digits-cloud'].includes(c.vendor_id))).toBe(true);
  });

  it('DE_ONLY + json_schema_strict: kein belegter Anbieter -> NO_COMPLIANT_PROVIDER_AVAILABLE', () => {
    const r = routeCandidates(REAL, { residency: 'DE_ONLY', required_capabilities: ['json_schema_strict'] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe('NO_COMPLIANT_PROVIDER_AVAILABLE');
    const attempted = new Set(r.attemptedProviders.map((a) => a.deployment_id));
    expect(attempted.size).toBe(5);
    for (const a of r.attemptedProviders) expect(a.rejected_because.length).toBeGreaterThan(0);
    const scw = r.attemptedProviders.find((a) => a.deployment_id === 'scaleway-generative-apis-fr-par')!;
    expect(scw.rejected_because).toContain('REGION_OUTSIDE_RESIDENCY');
  });

  it('EU_ONLY + json_schema_strict: Scaleway-Modelle und OVH gpt-oss-120b', () => {
    const r = routeCandidates(REAL, { residency: 'EU_ONLY', required_capabilities: ['json_schema_strict'] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const keys = r.candidates.map((c) => `${c.deployment_id}/${c.model_id}`);
    expect(keys).toContain('ovhcloud-ai-endpoints-gra/gpt-oss-120b');
    expect(keys.filter((k) => k.startsWith('scaleway-')).length).toBe(6);
    expect(keys.some((k) => k.startsWith('mistral-'))).toBe(false);
  });

  it('EU_EFTA: Mistral EU ist residency-zulaessig, aber ohne belegte Modellverfuegbarkeit kein Kandidat', () => {
    const r = routeCandidates(REAL, { residency: 'EU_EFTA', allowed_vendors: ['mistral-ai'] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const mistral = r.attemptedProviders.filter((a) => a.vendor_id === 'mistral-ai');
    expect(mistral.map((a) => a.model_id).sort()).toEqual(['mistral-large-3', 'mistral-medium-3.5', 'mistral-small-4']);
    expect(mistral.every((a) => a.rejected_because.includes('MODEL_UNAVAILABLE'))).toBe(true);
    expect(mistral.some((a) => a.rejected_because.includes('REGION_OUTSIDE_RESIDENCY'))).toBe(false);
    // alle anderen Anbieter wurden wegen allowed_vendors gar nicht erst betrachtet
    expect(r.attemptedProviders.filter((a) => a.vendor_id !== 'mistral-ai').every((a) => a.rejected_because.includes('VENDOR_NOT_ALLOWED'))).toBe(true);
  });

  it('denied_vendors und allowed_vendors werden vor jedem Aufruf angewendet', () => {
    const r = routeCandidates(REAL, { residency: 'DE_ONLY', denied_vendors: ['ionos-cloud', 'schwarz-digits-cloud'] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.attemptedProviders.find((a) => a.deployment_id === 'ionos-ai-model-hub-de')!.rejected_because).toContain('VENDOR_DENIED');
    const r2 = routeCandidates(REAL, { residency: 'EU_ONLY', allowed_vendors: ['scaleway'] });
    expect(r2.ok && r2.candidates.every((c) => c.vendor_id === 'scaleway')).toBe(true);
  });

  it('Kontextlaenge und Sprache nur mit Beleg', () => {
    const r = routeCandidates(REAL, { residency: 'DE_ONLY', min_context_tokens: 200000 });
    expect(r.ok && r.candidates.map((c) => `${c.deployment_id}/${c.model_id}`).sort()).toEqual([
      'ionos-ai-model-hub-de/qwen3.5-397b-a17b',
      'ionos-ai-model-hub-de/qwen3.8-27b',
      'stackit-ai-model-serving-eu01/gemma-4-31b',
      'stackit-ai-model-serving-eu01/qwen3-vl-235b-a22b-instruct-fp8',
      'stackit-ai-model-serving-eu01/qwen3.8-27b',
    ]);
    const de = routeCandidates(REAL, { residency: 'DE_ONLY', required_languages: ['de'] });
    expect(de.ok && de.candidates.map((c) => `${c.deployment_id}/${c.model_id}`)).toEqual(['stackit-ai-model-serving-eu01/llama-3.3-70b-8bit']);
  });

  it('veraltete (deprecated) Modelle sind nie Kandidaten', () => {
    const r = routeCandidates(REAL, { residency: 'DE_ONLY' });
    expect(r.ok && r.candidates.some((c) => c.model_id === 'qwen3.6-27b')).toBe(false);
  });

  it('bevorzugte Reihenfolge bestimmt die Fallback-Kette, deterministisch', () => {
    const a = routeCandidates(REAL, { residency: 'DE_ONLY', required_capabilities: ['tools'], preferred_deployments: ['stackit-ai-model-serving-eu01'] });
    const b = routeCandidates(REAL, { residency: 'DE_ONLY', required_capabilities: ['tools'], preferred_deployments: ['stackit-ai-model-serving-eu01'] });
    expect(a).toEqual(b);
    expect(a.ok && a.candidates[0]!.deployment_id).toBe('stackit-ai-model-serving-eu01');
  });

  it('unbelegte Weitergabe ist Bedingung, kein Ausschluss', () => {
    const r = routeCandidates(REAL, { residency: 'DE_ONLY', allowed_vendors: ['schwarz-digits-cloud'] });
    expect(r.ok && r.candidates.every((c) => c.conditions.includes('EXTERNAL_INFERENCE_EGRESS_UNKNOWN'))).toBe(true);
  });
});
