import { describe, expect, it } from 'vitest';
import {
  effectiveVoiceTools,
  validateVerticalVoiceAgent,
  VERTICAL_VOICE_TEMPLATES,
  type VerticalVoiceAgentConfig,
} from './vertical-voice-templates.js';

const base: VerticalVoiceAgentConfig = {
  agentId: 'demo-agent',
  tenantId: 'demo-tenant',
  templateId: 'butcher',
  displayName: 'Bestellassistent',
  businessName: 'Testmetzgerei',
  locale: 'de-DE',
  channels: ['web'],
  lifecycle: 'active',
  enabledTools: ['lookup_kb', 'create_ticket'],
  recordingEnabled: false,
  transcriptStorageEnabled: false,
  retentionDays: 0,
  humanHandoffContact: 'team@example.invalid',
};

describe('vertical voice template safety', () => {
  it('keeps all three sector templates', () => {
    expect(Object.keys(VERTICAL_VOICE_TEMPLATES).sort()).toEqual(['butcher', 'law_office', 'trades']);
  });
  it('prevents cross-industry escalation', () => {
    const config = { ...base, enabledTools: ['lookup_kb', 'schedule_appointment'] as const };
    expect(effectiveVoiceTools(config)).toEqual(['lookup_kb']);
    expect(validateVerticalVoiceAgent(config)).toContain('Nicht erlaubtes Tool für diese Branche.');
  });
  it('returns no execution tools when agent is paused or in draft', () => {
    expect(effectiveVoiceTools({ ...base, lifecycle: 'paused' })).toEqual([]);
    expect(effectiveVoiceTools({ ...base, lifecycle: 'draft' })).toEqual([]);
  });
  it('blocks unimplemented phone and recording capability', () => {
    const errors = validateVerticalVoiceAgent({ ...base, channels: ['web', 'phone'], recordingEnabled: true });
    expect(errors.some((e) => e.includes('Telefonie'))).toBe(true);
    expect(errors.some((e) => e.includes('Audio-Aufzeichnung'))).toBe(true);
  });
  it('requires human handoff for an active agent', () => {
    expect(validateVerticalVoiceAgent({ ...base, humanHandoffContact: null }))
      .toContain('Für aktive Agenten muss eine menschliche Übergabe möglich sein.');
  });
  it('accepts an isolated, web-only draft', () => {
    expect(validateVerticalVoiceAgent({ ...base, lifecycle: 'draft', humanHandoffContact: null })).toEqual([]);
  });
});
