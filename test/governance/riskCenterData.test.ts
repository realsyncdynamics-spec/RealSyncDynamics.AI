import { describe, expect, it } from 'vitest';
import type { DbIncident } from '@/src/features/governance/incidentsApi';
import {
  asOfLabel,
  categorizeIncident,
  countByCategory,
  incidentToRisk,
} from '@/src/features/governance/risks/riskCenterData';

function incident(overrides: Partial<DbIncident> = {}): DbIncident {
  return {
    id: 'inc-1',
    tenant_id: 't-1',
    triggering_event_id: 'ev-1',
    asset_id: null,
    title: 'Meta Pixel ohne Einwilligung',
    description: 'Tracking vor Consent.',
    severity: 'critical',
    status: 'open',
    breach_confirmed: false,
    personal_data_affected: true,
    affected_data_types: ['cookies'],
    estimated_affected_subjects: null,
    detected_at: '2026-09-01T08:00:00Z',
    notification_deadline_at: '2026-09-03T08:00:00Z',
    contained_at: null,
    resolved_at: null,
    reported_to_authority_at: null,
    authority_reference: null,
    timeline: [],
    assigned_to: 'dpo@example.de',
    ...overrides,
  };
}

describe('incidentToRisk', () => {
  it('maps a live incident and keeps the incident id for persistence', () => {
    const risk = incidentToRisk(incident());
    expect(risk.incidentId).toBe('inc-1');
    expect(risk.severity).toBe('Kritisch');
    expect(risk.status).toBe('Offen');
    expect(risk.category).toBe('Cookie & Consent');
    expect(risk.evidence).toEqual(['ev-1']);
    expect(risk.owner).toBe('dpo@example.de');
  });

  it('does not invent atelier-nord systems', () => {
    const risk = incidentToRisk(incident({ affected_data_types: [] }));
    expect(risk.systems).toEqual([]);
    expect(JSON.stringify(risk)).not.toMatch(/atelier-nord/i);
  });
});

describe('categorizeIncident', () => {
  it('classifies cookie, AI Act and transfer language', () => {
    expect(categorizeIncident(incident())).toBe('Cookie & Consent');
    expect(categorizeIncident(incident({
      title: 'Hochrisiko-KI ohne Bewertung',
      description: 'EU AI Act',
      affected_data_types: [],
    }))).toBe('EU AI Act');
    expect(categorizeIncident(incident({
      title: 'Drittlandtransfer ohne SCC',
      description: '',
      affected_data_types: [],
    }))).toBe('Drittlandtransfer');
  });
});

describe('countByCategory / asOfLabel', () => {
  it('returns zeros for an empty tenant', () => {
    const counts = countByCategory([]);
    expect(counts['Cookie & Consent']).toBe(0);
    expect(counts['EU AI Act']).toBe(0);
    expect(Object.values(counts).every((n) => n === 0)).toBe(true);
  });

  it('uses today when there are no risks', () => {
    expect(asOfLabel([], new Date('2026-09-10T12:00:00Z'))).toMatch(/10\.09\.2026|9\/10\/2026|2026/);
  });
});
