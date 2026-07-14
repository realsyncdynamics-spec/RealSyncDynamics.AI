import { describe, it, expect } from 'vitest';
import {
  buildBriefPrompt,
  validateBriefPayload,
  type BriefContext,
} from '../../supabase/functions/_shared/agents/governanceBrief.ts';

const CTX: BriefContext = {
  tenant_name: 'Atelier Nord GmbH',
  brief_date: '2026-06-28',
  open_incidents: 2,
  overdue_dsr: 1,
  open_dpias: 3,
  vendors_no_dpa: 4,
  pending_approvals: 0,
  mappings_percent: 62,
  evidence_percent: 50,
  policies_enabled_percent: 80,
  observations: [
    { severity: 'critical', title: 'Vorfall: Meldefrist 72h' },
    { severity: 'medium', title: 'DSFA-Review fällig' },
  ],
};

describe('buildBriefPrompt', () => {
  it('serializes the key numbers and observations into the user prompt', () => {
    const { system, user } = buildBriefPrompt(CTX);
    expect(system).toMatch(/Hermes/);
    expect(system).toMatch(/narrative_de/);
    expect(user).toContain('Atelier Nord GmbH');
    expect(user).toContain('2026-06-28');
    expect(user).toContain('"vorfaelle": 2');
    expect(user).toContain('"vendoren_ohne_avv": 4');
    expect(user).toContain('Meldefrist 72h');
  });

  it('caps observations at 10', () => {
    const many = { ...CTX, observations: Array.from({ length: 25 }, (_, i) => ({ severity: 'low', title: `obs${i}` })) };
    const { user } = buildBriefPrompt(many);
    expect(user).toContain('obs9');
    expect(user).not.toContain('obs10');
  });
});

describe('validateBriefPayload', () => {
  it('accepts a well-formed payload and normalizes severities', () => {
    const out = validateBriefPayload({
      narrative_de: '  Heute sind zwei Vorfälle offen.  ',
      top_3_risks: [
        { title: 'Vorfall A', severity: 'CRITICAL' },
        { title: 'Vendor ohne AVV', severity: 'weird' },
        'DSFA offen',
      ],
      recommended_actions_today: ['Incident melden', '', 'AVV anfordern'],
    });
    expect(out.narrative_de).toBe('Heute sind zwei Vorfälle offen.');
    expect(out.top_3_risks).toEqual([
      { title: 'Vorfall A', severity: 'critical' },
      { title: 'Vendor ohne AVV', severity: 'medium' },
      { title: 'DSFA offen', severity: 'medium' },
    ]);
    expect(out.recommended_actions_today).toEqual(['Incident melden', 'AVV anfordern']);
  });

  it('caps risks at 3 and actions at 5', () => {
    const out = validateBriefPayload({
      narrative_de: 'x',
      top_3_risks: Array.from({ length: 6 }, (_, i) => ({ title: `r${i}` })),
      recommended_actions_today: Array.from({ length: 9 }, (_, i) => `a${i}`),
    });
    expect(out.top_3_risks).toHaveLength(3);
    expect(out.recommended_actions_today).toHaveLength(5);
  });

  it('throws on missing narrative or non-object input', () => {
    expect(() => validateBriefPayload({ top_3_risks: [] })).toThrow();
    expect(() => validateBriefPayload({ narrative_de: '   ' })).toThrow();
    expect(() => validateBriefPayload(null)).toThrow();
    expect(() => validateBriefPayload('nope')).toThrow();
  });
});
