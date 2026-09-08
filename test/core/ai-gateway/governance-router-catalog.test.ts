import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  expansionStageFromEntitlements,
  allowCloudFallback,
  quotaKeyForStage,
  resolveModelProfile,
  isProfileAllowed,
  modelsResponseForStage,
  processorsFor,
  nextExpansionHint,
  ART50_DISCLOSURE_DE,
  MODEL_ALIASES,
  type ExpansionStage,
} from '../../../src/core/ai-gateway/governanceRouterCatalog';

describe('expansionStageFromEntitlements', () => {
  it('observe ohne Automationen — auch mit hohem Kontingent', () => {
    expect(expansionStageFromEntitlements({ hasAutomations: false, aiCallsMonthly: 50_000 }))
      .toBe('observe');
    expect(expansionStageFromEntitlements({ hasAutomations: false, aiCallsMonthly: -1 }))
      .toBe('observe');
  });

  it('studio: Automationen, kein oder niedriges ai_calls (Starter)', () => {
    expect(expansionStageFromEntitlements({ hasAutomations: true, aiCallsMonthly: null }))
      .toBe('studio');
    expect(expansionStageFromEntitlements({ hasAutomations: true, aiCallsMonthly: 100 }))
      .toBe('studio');
  });

  it('scale ab 2000 (Growth)', () => {
    expect(expansionStageFromEntitlements({ hasAutomations: true, aiCallsMonthly: 2000 }))
      .toBe('scale');
  });

  it('agency ab 10000', () => {
    expect(expansionStageFromEntitlements({ hasAutomations: true, aiCallsMonthly: 10_000 }))
      .toBe('agency');
  });

  it('sovereign bei -1 (Enterprise) oder ≥ 50000 (Partner)', () => {
    expect(expansionStageFromEntitlements({ hasAutomations: true, aiCallsMonthly: -1 }))
      .toBe('sovereign');
    expect(expansionStageFromEntitlements({ hasAutomations: true, aiCallsMonthly: 50_000 }))
      .toBe('sovereign');
  });
});

describe('allowCloudFallback', () => {
  const cloudStages: ExpansionStage[] = ['scale', 'agency', 'sovereign'];

  it('EU-lokal sperrt Cloud auf jeder Stufe', () => {
    for (const stage of ['observe', 'studio', ...cloudStages] as ExpansionStage[]) {
      expect(allowCloudFallback(stage, 'eu_local'), stage).toBe(false);
    }
  });

  it('Cloud erst ab Scale, Residenz cloud', () => {
    expect(allowCloudFallback('observe', 'cloud')).toBe(false);
    expect(allowCloudFallback('studio', 'cloud')).toBe(false);
    for (const stage of cloudStages) {
      expect(allowCloudFallback(stage, 'cloud'), stage).toBe(true);
    }
  });
});

describe('quotaKeyForStage', () => {
  it('studio metert llm_queries, ab Scale ai_calls, observe keines', () => {
    expect(quotaKeyForStage('observe')).toBeNull();
    expect(quotaKeyForStage('studio')).toBe('limit.llm_queries_monthly');
    expect(quotaKeyForStage('scale')).toBe('limit.ai_calls_monthly');
    expect(quotaKeyForStage('agency')).toBe('limit.ai_calls_monthly');
    expect(quotaKeyForStage('sovereign')).toBe('limit.ai_calls_monthly');
  });
});

describe('Modell-Aliase', () => {
  it('mappt Cursor-Namen auf bestehende Profile', () => {
    expect(resolveModelProfile('gpt-4o-mini')).toBe('fast-local');
    expect(resolveModelProfile('gpt-4.1-mini')).toBe('fast-local');
    expect(resolveModelProfile('eu-local')).toBe('fast-local');
    expect(resolveModelProfile('gpt-4.1')).toBe('quality-local');
    expect(resolveModelProfile('gpt-4o')).toBe('cloud-fallback');
    expect(resolveModelProfile('claude-haiku-4-5')).toBe('cloud-fallback');
    expect(resolveModelProfile('fast-local')).toBe('fast-local');
  });

  it('unbekannte Namen bleiben null', () => {
    expect(resolveModelProfile('gpt-9000-ultra')).toBeNull();
    expect(resolveModelProfile(undefined)).toBeNull();
  });

  it('Studio ohne Cloud listet keine Cloud-Aliase', () => {
    const ids = modelsResponseForStage('studio', false, 0).data.map((d) => d.id);
    expect(ids).toContain('gpt-4o-mini');
    expect(ids).toContain('fast-local');
    expect(ids).not.toContain('gpt-4o');
    expect(ids).not.toContain('cloud-fallback');
    expect(ids).not.toContain('claude-haiku-4-5');
  });

  it('Scale mit Cloud listet Cloud-Aliase', () => {
    const ids = modelsResponseForStage('scale', true, 0).data.map((d) => d.id);
    expect(ids).toContain('gpt-4o');
    expect(ids).toContain('cloud-fallback');
  });

  it('Cloud-Profil ist auf Studio verboten', () => {
    expect(isProfileAllowed('cloud-fallback', 'studio', false)).toBe(false);
    expect(isProfileAllowed('fast-local', 'studio', false)).toBe(true);
    expect(isProfileAllowed('cloud-fallback', 'scale', true)).toBe(true);
  });
});

describe('Art. 50 und Auftragsverarbeiter', () => {
  it('Disclosure nennt Verordnung und speichert keine Prompts', () => {
    expect(ART50_DISCLOSURE_DE).toMatch(/Art\. 50/);
    expect(ART50_DISCLOSURE_DE).toMatch(/keine Prompt-Inhalte/);
  });

  it('EU-lokal listet keine US-Cloud-Verarbeiter', () => {
    const processors = processorsFor(false, 'eu_local');
    expect(processors.join(' ')).not.toMatch(/Anthropic|OpenAI/);
    expect(processors.join(' ')).toMatch(/EU-lokal/);
  });

  it('Expansion-Hinweis endet auf Sovereign', () => {
    expect(nextExpansionHint('observe')).toMatch(/Starter/);
    expect(nextExpansionHint('sovereign')).toBeNull();
  });
});

describe('Deno-Spiegel', () => {
  it('bleibt zum Node-Katalog deckungsgleich (Import-Suffix ausgenommen)', () => {
    const node = readFileSync('src/core/ai-gateway/governanceRouterCatalog.ts', 'utf8');
    const deno = readFileSync('supabase/functions/_shared/aiGateway/governanceRouterCatalog.ts', 'utf8');
    const normalize = (s: string) =>
      s
        .replace(/from '\.\/types\.ts'/g, "from './types'")
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
        .replace(/\s+/g, ' ')
        .trim();
    expect(normalize(deno).replace(/\s+/g, ' ').trim()).toBe(
      normalize(node).replace(/\s+/g, ' ').trim(),
    );
  });

  it('jedes Alias-Ziel ist ein bekanntes Profil', () => {
    const profiles = new Set(['fast-local', 'quality-local', 'strict-json', 'embed-default', 'cloud-fallback']);
    for (const [alias, profile] of Object.entries(MODEL_ALIASES)) {
      expect(profiles.has(profile), alias).toBe(true);
    }
  });
});
