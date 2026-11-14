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
    const meta = SRC.slice(SRC.indexOf('function runMetadata('));
    const block = meta.slice(0, meta.indexOf('\n}\n') + 3);
    expect(block).toContain('feature: TOOL_KEY');
    expect(block).not.toMatch(/prompt|input:|messages|content/);
    expect(SRC).toContain('Kein Prompt');
    // Beide Schreibpfade nutzen denselben Metadaten-Builder.
    expect(SRC.match(/metadata: runMetadata\(/g)?.length).toBe(2);
    expect(SRC).not.toMatch(/metadata: \{/);
  });

  it('verify_jwt ist aus — Cursor hat kein Supabase-JWT', () => {
    expect(TOML).toMatch(/\[functions\.governance-router\]\s*\nverify_jwt = false/);
  });

  it('hängt den PDP an den Key-Tenant, nicht an null', () => {
    expect(SRC).toContain('tenant_id: tenantId');
    expect(SRC).toContain("from '../_shared/pdp/decide.ts'");
    expect(SRC).not.toMatch(/tenant_id:\s*null/);
  });

  it('PDP-Fehler: enforce fail closed, shadow nur markiert', () => {
    expect(SRC).toContain('AI_GATEWAY_ENFORCEMENT');
    const pdp = SRC.slice(SRC.indexOf('async function pdpCheck('), SRC.indexOf('async function loadStage('));
    const catchBlock = pdp.slice(pdp.lastIndexOf('} catch (e) {'));
    expect(catchBlock).toMatch(/if \(mode === 'enforce'\)\s*\{[\s\S]*?err\(503, 'POLICY_UNAVAILABLE'/);
    // Kein bedingungsloses Fail-open mehr: der shadow-Pfad liegt hinter dem enforce-Return.
    expect(catchBlock.indexOf("'POLICY_UNAVAILABLE'")).toBeLessThan(catchBlock.indexOf('unavailable: true'));
    expect(SRC).toContain("pep.unavailable ? 'unavailable'");
  });

  it('Prüfpfad entsteht vor dem Provider-Aufruf, sonst 503 ohne Aufruf', () => {
    const chat = SRC.slice(SRC.indexOf('async function handleChat('));
    const open = chat.indexOf('await openRun(');
    const guard = chat.indexOf("err(503, 'AUDIT_UNAVAILABLE'");
    const provider = chat.indexOf('built.gateway.generate(');
    expect(open).toBeGreaterThan(-1);
    expect(guard).toBeGreaterThan(open);
    expect(provider).toBeGreaterThan(guard);
    expect(chat.slice(open, guard)).toContain('if (!runId)');
    expect(SRC).not.toContain('writeRun(');
  });

  it('offene Zeile startet pessimistisch und wird mandantengebunden abgeschlossen', () => {
    const open = SRC.slice(SRC.indexOf('async function openRun('), SRC.indexOf('async function closeRun('));
    expect(open).toContain("status: 'error'");
    expect(open).toContain('error_code: IN_FLIGHT');
    expect(open).toContain('tenant_id: tenantId');
    expect(open).toMatch(/return null;[\s\S]*return null;/);
    const close = SRC.slice(SRC.indexOf('async function closeRun('));
    expect(close).toContain(".eq('id', runId)");
    expect(close).toContain(".eq('tenant_id', tenantId)");
  });

  it('Kontingent-Buchung wird im Prüfpfad sichtbar', () => {
    const chat = SRC.slice(SRC.indexOf('async function handleChat('));
    expect(chat.indexOf('recordUsage(')).toBeLessThan(chat.indexOf("status: 'success'"));
    expect(chat).toContain('usageRecorded = false');
    expect(SRC).toContain('usage_recorded: row.usageRecorded');
  });

  it('Residency-RPC ist fail closed, auch bei Ausfall und unerwarteten Werten', () => {
    expect(SRC).toContain('requireVerifiedAiResidency(result)');
    expect(SRC).toContain('throw new ResidencyUnavailableError()');
    expect(SRC).toContain("error instanceof ResidencyUnavailableError");
    expect(SRC).not.toContain('defaulting to cloud');
  });

  it('UI nennt den OpenAI-Base-URL-Pfad', () => {
    expect(VIEW).toContain('/functions/v1/governance-router/v1');
    expect(VIEW).toContain('rsd_gov_');
  });
});
