import { describe, it, expect, vi } from 'vitest';
import {
  evaluateGovernanceOutput,
  overallFromChecks,
  runGovernanceTest,
  GOVERNANCE_TEST_PROMPT,
  GOVERNANCE_TEST_CASE,
} from '@/src/features/local-ai/governanceTest';

const GOOD = JSON.stringify({
  risk_level: 'high',
  risks: [
    { area: 'DSGVO', description: 'Automatisierte Einzelentscheidung ohne menschliche Prüfung.' },
    { area: 'EU_AI_ACT', description: 'Beschäftigungskontext — Hochrisiko-System.' },
  ],
  recommendation: 'Menschliche Prüfung vor jeder Absage einführen.',
  source: null,
});

function byId(raw: string) {
  return Object.fromEntries(evaluateGovernanceOutput(raw).map((c) => [c.id, c.status]));
}

describe('evaluateGovernanceOutput', () => {
  it('passes a compliant answer with source null', () => {
    const checks = evaluateGovernanceOutput(GOOD);
    expect(checks.every((c) => c.status === 'success')).toBe(true);
    expect(overallFromChecks(checks)).toBe('success');
  });

  it('fails when a source is invented although none was given', () => {
    const raw = JSON.stringify({ ...JSON.parse(GOOD), source: { title: 'Urteil BAG 2023', reference: '9 AZR 123/22' } });
    expect(byId(raw).no_fabricated_source).toBe('failed');
    expect(overallFromChecks(evaluateGovernanceOutput(raw))).toBe('failed');
  });

  it('fails when the source field is missing instead of null', () => {
    const { source: _omit, ...rest } = JSON.parse(GOOD);
    expect(byId(JSON.stringify(rest)).no_fabricated_source).toBe('failed');
  });

  it('fails when a link is smuggled into the text', () => {
    const raw = JSON.stringify({ ...JSON.parse(GOOD), recommendation: 'Siehe https://example.org/leitfaden' });
    expect(byId(raw).no_fabricated_source).toBe('failed');
  });

  it('fails every check on invalid JSON', () => {
    const checks = evaluateGovernanceOutput('Das System ist riskant.');
    expect(checks.map((c) => c.status)).toEqual(['failed', 'failed', 'failed', 'failed']);
  });

  it('warns when JSON is wrapped in a markdown fence', () => {
    const checks = evaluateGovernanceOutput('```json\n' + GOOD + '\n```');
    expect(byId('```json\n' + GOOD + '\n```').json_valid).toBe('warning');
    expect(overallFromChecks(checks)).toBe('warning');
  });

  it('flags missing risk output and recommendation', () => {
    const raw = JSON.stringify({ risk_level: 'high', risks: [], recommendation: '', source: null });
    const s = byId(raw);
    expect(s.risk_present).toBe('warning');
    expect(s.recommendation_present).toBe('failed');
    const none = byId(JSON.stringify({ source: null }));
    expect(none.risk_present).toBe('failed');
  });
});

describe('runGovernanceTest', () => {
  it('sends the no-source test case and evaluates the output', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: { content: GOOD } }), { status: 200 }),
    );
    const r = await runGovernanceTest(
      { runtimeUrl: 'http://127.0.0.1:11434', model: 'granite4.2:8b' },
      { fetchImpl, pageOrigin: 'http://localhost:3000' },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.overall).toBe('success');
      expect(r.data.rawOutput).toBe(GOOD);
      expect(r.data.model).toBe('granite4.2:8b');
    }
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.messages[1].content).toBe(GOVERNANCE_TEST_PROMPT);
    expect(GOVERNANCE_TEST_PROMPT).toContain('gib null zurück und erfinde nichts');
    expect(GOVERNANCE_TEST_CASE).toContain('keine');
  });

  it('propagates runtime errors fail-closed', async () => {
    const r = await runGovernanceTest(
      { runtimeUrl: 'http://127.0.0.1:11434', model: 'x' },
      { fetchImpl: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')), pageOrigin: 'http://localhost:3000' },
    );
    expect(r.ok).toBe(false);
  });
});
