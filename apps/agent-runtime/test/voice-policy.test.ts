import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { evaluate } from '../src/policy-engine.js';
import { evaluateVoiceToolRequest, toGatewayDecision } from '../src/voice-policy.js';
import {
  VOICE_AGENT_ID,
  type VoiceConsent,
  type VoiceSessionState,
  type VoiceToolName,
  type VoiceToolRequest,
} from '../src/voice-types.js';

function session(
  overrides: Partial<VoiceSessionState> = {},
): VoiceSessionState {
  return {
    sessionId: 'sess_1',
    tenantId: 'tenant_mueller_sanitaer',
    killSwitch: false,
    turnCount: 1,
    toolCount: 0,
    rateLimit: { maxTurns: 20, maxTools: 8 },
    ...overrides,
  };
}

function consent(
  purposes: VoiceConsent['purposes'] = [
    'record_audio',
    'process_transcript',
    'store_evidence',
    'execute_tools',
    'tts_playback',
  ],
): VoiceConsent {
  return { purposes, withdrawnAt: null };
}

function request(
  tool: VoiceToolName,
  args: Record<string, unknown> = {},
  overrides: Partial<VoiceToolRequest> = {},
): VoiceToolRequest {
  return {
    requestId: 'req_1',
    sessionId: 'sess_1',
    tenantId: 'tenant_mueller_sanitaer',
    agentId: VOICE_AGENT_ID,
    tool,
    args,
    proposedBy: 'llm',
    createdAt: '2026-08-23T10:00:00.000Z',
    ...overrides,
  };
}

describe('evaluateVoiceToolRequest', () => {
  it('erlaubt lookup_kb ohne Confirmation', () => {
    const d = evaluateVoiceToolRequest({
      session: session(),
      request: request('lookup_kb', { query: 'öffnungszeiten' }),
      consent: consent(),
    });
    assert.equal(d.verdict, 'ALLOW');
    assert.equal(d.decidedBy, 'policy-engine');
    assert.equal(d.auditRequired, true);
    const g = toGatewayDecision(d.verdict);
    assert.equal(g.ok, true);
    if (g.ok) assert.equal(g.reviewRequired, false);
  });

  it('fordert Confirmation für high-priority Tickets', () => {
    const d = evaluateVoiceToolRequest({
      session: session(),
      request: request('create_ticket', {
        title: 'Rohrbruch',
        priority: 'high',
      }),
      consent: consent(),
    });
    assert.equal(d.verdict, 'REQUIRE_CONFIRMATION');
    const g = toGatewayDecision(d.verdict);
    assert.equal(g.ok, true);
    if (g.ok) assert.equal(g.reviewRequired, true);
  });

  it('fordert Confirmation für Termine', () => {
    const d = evaluateVoiceToolRequest({
      session: session(),
      request: request('schedule_appointment', {
        when: 'Freitag 09:00',
        service: 'Thermenwartung',
      }),
      consent: consent(),
    });
    assert.equal(d.verdict, 'REQUIRE_CONFIRMATION');
  });

  it('erlaubt handoff_human', () => {
    const d = evaluateVoiceToolRequest({
      session: session(),
      request: request('handoff_human', { reason: 'Anrufer verlangt einen Menschen' }),
      consent: consent(),
    });
    assert.equal(d.verdict, 'ALLOW');
  });

  it('verweigert Export ohne store_evidence', () => {
    const d = evaluateVoiceToolRequest({
      session: session(),
      request: request('export_transcript', { format: 'json' }),
      consent: consent(['execute_tools']),
    });
    assert.equal(d.verdict, 'DENY');
    assert.match(d.reason, /Consent/);
  });

  it('fordert Confirmation für Export mit store_evidence', () => {
    const d = evaluateVoiceToolRequest({
      session: session(),
      request: request('export_transcript', { format: 'json' }),
      consent: consent(),
    });
    assert.equal(d.verdict, 'REQUIRE_CONFIRMATION');
    assert.equal(d.trace.find((s) => s.check === 'consent')?.result, 'pass');
    assert.equal(d.trace.find((s) => s.check === 'risk')?.result, 'flag');
    assert.equal(d.decidedBy, 'policy-engine');
  });

  it('blockiert Kill Switch', () => {
    const d = evaluateVoiceToolRequest({
      session: session({ killSwitch: true }),
      request: request('lookup_kb', { query: 'x' }),
      consent: consent(),
    });
    assert.equal(d.verdict, 'DENY');
    assert.match(d.reason, /Kill Switch/);
  });

  it('blockiert Cross-Tenant', () => {
    const d = evaluateVoiceToolRequest({
      session: session(),
      request: request('lookup_kb', { query: 'x' }, { tenantId: 'tenant_other' }),
      consent: consent(),
    });
    assert.equal(d.verdict, 'DENY');
    assert.match(d.reason, /Tenant-Isolation/);
  });

  it('blockiert fehlende Einwilligung', () => {
    const d = evaluateVoiceToolRequest({
      session: session(),
      request: request('lookup_kb', { query: 'x' }),
      consent: null,
    });
    assert.equal(d.verdict, 'DENY');
    assert.match(d.reason, /Consent/);
  });

  it('mappt DENY auf den Gateway ohne evaluate() zu ändern', () => {
    const g = toGatewayDecision('DENY');
    assert.equal(g.ok, false);
    if (!g.ok) assert.equal(g.reason, 'denied_by_channel_policy');
  });
});

describe('evaluate() Regression', () => {
  it('lässt den Website-Drift-Agenten unverändert durch', () => {
    const d = evaluate({
      tenantId: 't1',
      agentId: 'website-drift-agent',
      taskType: 'scan',
      requestedTool: 'website_scan',
      input: { url: 'https://example.com' },
      requestId: 'req_reg',
    });
    assert.equal(d.ok, true);
    if (d.ok) assert.equal(d.reviewRequired, false);
  });

  it('denied weiterhin restricted_action', () => {
    const d = evaluate({
      tenantId: 't1',
      agentId: 'developer-remediation-agent',
      taskType: 'production_change',
      requestedTool: 'github_pr_draft',
      input: {},
      requestId: 'req_deny',
    });
    assert.equal(d.ok, false);
    if (!d.ok) assert.equal(d.reason, 'restricted_action');
  });

  it('evaluate() kennt Nora, Confirmation bleibt aber am Voice-Kanal', () => {
    const d = evaluate({
      tenantId: 't1',
      agentId: VOICE_AGENT_ID,
      taskType: 'scan',
      requestedTool: 'lookup_kb',
      input: {},
      requestId: 'req_voice_bypass',
    });
    assert.equal(d.ok, true);
    if (d.ok) assert.equal(d.reviewRequired, false);
  });
});
