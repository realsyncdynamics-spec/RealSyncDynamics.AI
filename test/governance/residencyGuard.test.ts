import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  requireVerifiedAiResidency,
  ResidencyUnavailableError,
} from '../../supabase/functions/_shared/residencyGuard';

const aiTool = readFileSync('supabase/functions/_shared/ai.ts', 'utf8');
const router = readFileSync('supabase/functions/governance-router/index.ts', 'utf8');

describe('shared AI residency verifier – fail closed', () => {
  it.each(['cloud', 'eu_local'] as const)('accepts exactly the verified route %s', (data) => {
    expect(requireVerifiedAiResidency({ data, error: null })).toBe(data);
  });

  it.each([null, undefined, '', 'user_choice', 'enforce_eu_local', 'unexpected', false])(
    'blocks missing or unexpected RPC data (%s)',
    (data) => {
      expect(() => requireVerifiedAiResidency({ data, error: null }))
        .toThrow(ResidencyUnavailableError);
    },
  );

  it('rejects an RPC error even if stale data says cloud', () => {
    expect(() => requireVerifiedAiResidency({
      data: 'cloud', error: { code: 'PGRST301', message: 'service unavailable' },
    })).toThrowError(ResidencyUnavailableError);
  });

  it('provides the stable 503 denial code', () => {
    try {
      requireVerifiedAiResidency({ data: null, error: null });
      throw new Error('guard unexpectedly allowed');
    } catch (error) {
      expect(error).toBeInstanceOf(ResidencyUnavailableError);
      expect(error).toMatchObject({ status: 503, code: 'RESIDENCY_UNAVAILABLE' });
    }
  });

  it('all runAiTool providers inherit the guard before any provider call', () => {
    expect(aiTool).toContain('return requireVerifiedAiResidency(result)');
    expect(aiTool).toContain("throw new AiInvokeError(");
    expect(aiTool).toContain("'RESIDENCY_UNAVAILABLE'");
    expect(aiTool.indexOf('const residency = await resolveResidency('))
      .toBeLessThan(aiTool.indexOf('await callProvider('));
    expect(aiTool).not.toContain('defaulting to cloud');
  });

  it('API-key router validates residency before model enumeration and inference', () => {
    expect(router).toContain('return requireVerifiedAiResidency(result)');
    expect(router).toContain('error instanceof ResidencyUnavailableError');
    expect(router.indexOf('const ctx = await loadStage('))
      .toBeLessThan(router.indexOf('modelsResponseForStage(ctx.stage, ctx.allowCloud)'));
    expect(router).not.toContain('defaulting to cloud');
  });
});
