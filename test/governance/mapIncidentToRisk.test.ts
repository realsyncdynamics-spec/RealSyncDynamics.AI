import { describe, expect, it } from 'vitest';
import { countRisksByCategory, mapIncidentToRisk } from '../../src/features/governance/risks/mapIncidentToRisk';
import type { DbIncident } from '../../src/features/governance/incidentsApi';

function incident(overrides: Partial<DbIncident> = {}): DbIncident {
  return {
    id: 'inc-1',
    tenant_id: 't-1',
    triggering_event_id: null,
    asset_id: null,
    title: 'Meldepflichtiger Vorfall',
    description: 'Personenbezogene Daten betroffen.',
    severity: 'critical',
    status: 'open',
    breach_confirmed: true,
    personal_data_affected: true,
    affected_data_types: ['email'],
    estimated_affected_subjects: 12,
    detected_at: '2026-09-09T10:00:00.000Z',
    notification_deadline_at: '2026-09-12T10:00:00.000Z',
    contained_at: null,
    resolved_at: null,
    reported_to_authority_at: null,
    timeline: [],
    assigned_to: 'dpo@example.de',
    ...overrides,
  } as DbIncident;
}

describe('mapIncidentToRisk', () => {
  it('maps severity, status and keeps the incident id for persistence', () => {
    const risk = mapIncidentToRisk(incident());
    expect(risk.incidentId).toBe('inc-1');
    expect(risk.severity).toBe('Kritisch');
    expect(risk.status).toBe('Offen');
    expect(risk.impact).toBe('Hoch');
    expect(risk.owner).toBe('dpo@example.de');
    expect(risk.title).toBe('Meldepflichtiger Vorfall');
  });

  it('falls back to Mittel / Offen for unknown enums and missing assignee', () => {
    const risk = mapIncidentToRisk(incident({
      severity: 'unknown' as DbIncident['severity'],
      status: 'mystery' as DbIncident['status'],
      assigned_to: null,
      description: null,
      notification_deadline_at: '',
    }));
    expect(risk.severity).toBe('Mittel');
    expect(risk.status).toBe('Offen');
    expect(risk.owner).toBe('–');
    expect(risk.description).toBe('Meldepflichtiger Vorfall');
    expect(risk.dueDate).toBeNull();
  });

  it('does not invent atelier-nord demo content', () => {
    const risk = mapIncidentToRisk(incident());
    expect(JSON.stringify(risk)).not.toMatch(/atelier-nord/i);
  });
});

describe('countRisksByCategory', () => {
  it('counts live risks and stays at zero without a seed', () => {
    expect(countRisksByCategory([])['Cookie & Consent']).toBe(0);
    const mapped = mapIncidentToRisk(incident());
    expect(countRisksByCategory([mapped])['DSGVO Art. 6']).toBe(1);
    expect(countRisksByCategory([mapped])['EU AI Act']).toBe(0);
  });
});
