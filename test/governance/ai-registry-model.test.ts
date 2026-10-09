/**
 * Register-Ampel (Auftrag §14): aus Betrieb, Datenstandort, AI-Act-Klasse,
 * Verantwortung und Nachweisen — nie aus dem Anbieter. Ohne Datenbasis nie Grün.
 */
import { describe, expect, it } from 'vitest';
import {
  assessRegistryEntry,
  canEditRegistry,
  label,
  AI_SYSTEM_TYPE_LABEL,
  REGISTRY_REASON_LABEL,
  type EvidenceStats,
} from '../../src/features/governance/ai-registry/registryModel';

const NOW = new Date('2026-10-05T12:00:00Z');
const recent: EvidenceStats = { count: 2, latestAt: '2026-09-01T00:00:00Z' };
const none: EvidenceStats = { count: 0, latestAt: null };

const complete = {
  ai_act_class: 'limited' as const,
  owner_email: 'dpo@example.de',
  ai_system_type: 'external_ai',
  deployment_model: 'vendor_cloud',
  data_residency: 'eu',
};

describe('assessRegistryEntry', () => {
  it('Grün nur mit vollständigen Angaben und Nachweis der letzten 365 Tage', () => {
    expect(assessRegistryEntry(complete, recent, NOW)).toEqual({ light: 'green', reasons: ['evidence_recent'] });
    expect(assessRegistryEntry({ ...complete, data_residency: 'adequacy' }, recent, NOW).light).toBe('green');
  });

  it('der Anbieter spielt keine Rolle — gleiche Angaben, gleiche Ampel', () => {
    const a = assessRegistryEntry({ ...complete, vendor: 'OpenAI' } as typeof complete, recent, NOW);
    const b = assessRegistryEntry({ ...complete, vendor: 'Mistral' } as typeof complete, recent, NOW);
    expect(a).toEqual(b);
  });

  it('fehlende Angaben → unzureichende Daten, mit jedem fehlenden Feld als Grund', () => {
    const r = assessRegistryEntry(
      { ai_act_class: 'unknown', owner_email: null, ai_system_type: null, deployment_model: null, data_residency: 'unknown' },
      recent,
      NOW,
    );
    expect(r.light).toBe('insufficient_data');
    expect(r.reasons).toEqual(['missing_type', 'missing_deployment', 'missing_residency', 'missing_class']);
  });

  it('unbekannte Werte zählen als fehlend (kein Durchrutschen ungültiger Strings)', () => {
    expect(assessRegistryEntry({ ...complete, ai_system_type: 'quantum' }, recent, NOW).reasons).toContain('missing_type');
  });

  it('Nachweise nicht ladbar → keine Aussage, nie Grün', () => {
    expect(assessRegistryEntry(complete, null, NOW)).toEqual({ light: 'insufficient_data', reasons: [] });
  });

  it('Rot: verbotene Praxis — auch wenn Angaben fehlen', () => {
    const r = assessRegistryEntry({ ...complete, ai_act_class: 'prohibited', data_residency: null }, recent, NOW);
    expect(r.light).toBe('red');
    expect(r.reasons).toEqual(['prohibited_practice', 'missing_residency']);
  });

  it('Rot: Hochrisiko ohne jeden Nachweis; mit Nachweis Gelb mit Pflichten-Hinweis', () => {
    expect(assessRegistryEntry({ ...complete, ai_act_class: 'high' }, none, NOW).light).toBe('red');
    expect(assessRegistryEntry({ ...complete, ai_act_class: 'high' }, recent, NOW))
      .toEqual({ light: 'amber', reasons: ['high_risk_obligations'] });
  });

  it('Gelb: Drittland ohne Angemessenheit, keine verantwortliche Person, kein oder alter Nachweis', () => {
    expect(assessRegistryEntry({ ...complete, data_residency: 'third_country' }, recent, NOW).reasons).toEqual(['third_country_transfer']);
    expect(assessRegistryEntry({ ...complete, owner_email: null }, recent, NOW).reasons).toEqual(['no_owner']);
    expect(assessRegistryEntry(complete, none, NOW).reasons).toEqual(['no_evidence']);
    expect(assessRegistryEntry(complete, { count: 1, latestAt: '2025-09-01T00:00:00Z' }, NOW).reasons).toEqual(['evidence_stale']);
  });

  it('jeder Grund hat einen Text in DE und EN', () => {
    for (const [key, v] of Object.entries(REGISTRY_REASON_LABEL)) {
      expect(v.de, key).toBeTruthy();
      expect(v.en, key).toBeTruthy();
    }
  });
});

describe('canEditRegistry / label', () => {
  it('nur owner und admin — wie governance-resources', () => {
    expect(canEditRegistry('owner')).toBe(true);
    expect(canEditRegistry('admin')).toBe(true);
    for (const r of ['editor', 'dpo', 'viewer_auditor', undefined, null]) expect(canEditRegistry(r)).toBe(false);
  });

  it('label liefert nur bekannte Werte', () => {
    expect(label(AI_SYSTEM_TYPE_LABEL, 'local_ai', 'de')).toBe('Lokale KI');
    expect(label(AI_SYSTEM_TYPE_LABEL, 'nope', 'de')).toBeNull();
    expect(label(AI_SYSTEM_TYPE_LABEL, null, 'en')).toBeNull();
  });
});
