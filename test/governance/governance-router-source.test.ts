import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SRC = readFileSync('supabase/functions/governance-router/index.ts', 'utf8');
const TOML = readFileSync('supabase/config.toml', 'utf8');
const VIEW = readFileSync('src/features/governance/GovernanceRouterView.tsx', 'utf8');

describe('governance-router — Auth- und Datengrenzen', () => {
  it('tenant_id kommt aus dem Key, nie aus dem Body', () => {
    expect(SRC).toContain('tenant_id: tenantId');
    expect(SRC).toMatch(/const tenantId = keyOrErr\.tenant_id/);
    expect(SRC).not.toMatch(/body\.tenant_id/);
    expect(SRC).toContain("token.startsWith('rsd_gov_')");
  });

  it('schreibt keinen Prompt in ai_tool_runs.metadata', () => {
    const meta = SRC.slice(SRC.indexOf('metadata: {'));
    const block = meta.slice(0, meta.indexOf('},') + 2);
    expect(block).toContain('feature: TOOL_KEY');
    expect(block).not.toMatch(/prompt|input:|messages/);
    expect(SRC).toContain('Kein Prompt');
  });

  it('verify_jwt ist aus — Cursor hat kein Supabase-JWT', () => {
    expect(TOML).toMatch(/\[functions\.governance-router\]\s*\nverify_jwt = false/);
  });

  it('hängt den PDP an den Key-Tenant, nicht an null', () => {
    expect(SRC).toContain('tenant_id: tenantId');
    expect(SRC).toContain("from '../_shared/pdp/decide.ts'");
    expect(SRC).not.toMatch(/tenant_id:\s*null/);
  });

  it('Fail-open bei PDP-Fehler bleibt dokumentiert', () => {
    expect(SRC).toContain('fail open');
    expect(SRC).toContain('AI_GATEWAY_ENFORCEMENT');
  });

  it('UI nennt den OpenAI-Base-URL-Pfad', () => {
    expect(VIEW).toContain('/functions/v1/governance-router/v1');
    expect(VIEW).toContain('rsd_gov_');
  });
});
