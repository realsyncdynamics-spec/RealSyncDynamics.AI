/**
 * Adoption-Vertrag fuer Phase 1 / PR #1:
 *
 * Die zwei migrierten Pfade exportieren parallel zu ihren alten Mock-Arrays
 * eine v0-konforme Variante. Diese Tests beweisen:
 *   - spec_version='0.1' auf jedem Eintrag
 *   - .type ist ein valider RuntimeEventType (laut Union)
 *   - .payload bewahrt ALLE Original-Felder
 *   - Reihenfolge ist deterministisch gleich
 */
import { describe, it, expect } from 'vitest';
import {
  RUNTIME_MOCK_EVENTS,
  RUNTIME_MOCK_EVENTS_V0,
} from '../../src/lib/runtimeMockEvents';
import {
  DEMO_RUNTIME_EVENTS,
  DEMO_RUNTIME_EVENTS_V0,
} from '../../src/features/governance/vvt/demoRuntimeVvtData';

const VALID_TYPES = new Set<string>([
  'scan.started', 'scan.completed', 'scan.failed',
  'tracker.detected', 'tracker.pre_consent_detected',
  'consent.banner_detected', 'consent.reject_missing',
  'header.missing', 'form.email_detected',
  'vendor.detected', 'vendor.unknown_detected',
  'ai.endpoint_found', 'ai.risk_classified',
  'policy.violation_detected',
  'evidence.created', 'remediation.suggested',
  'incident.opened', 'incident.closed',
]);

describe('Adoption #1 — runtimeMockEvents RUNTIME_MOCK_EVENTS_V0', () => {
  it('hat die gleiche Anzahl Eintraege wie das Original', () => {
    expect(RUNTIME_MOCK_EVENTS_V0.length).toBe(RUNTIME_MOCK_EVENTS.length);
    expect(RUNTIME_MOCK_EVENTS_V0.length).toBeGreaterThan(0);
  });

  it('jeder Eintrag hat spec_version="0.1"', () => {
    for (const e of RUNTIME_MOCK_EVENTS_V0) {
      expect(e.spec_version).toBe('0.1');
    }
  });

  it('jeder Eintrag hat einen validen RuntimeEventType', () => {
    for (const e of RUNTIME_MOCK_EVENTS_V0) {
      expect(VALID_TYPES.has(e.type), `unbekannter type: ${e.type}`).toBe(true);
    }
  });

  it('payload bewahrt rule_id, ts, kind, original_severity (Reihenfolge)', () => {
    for (let i = 0; i < RUNTIME_MOCK_EVENTS.length; i++) {
      const original = RUNTIME_MOCK_EVENTS[i];
      const wrapped  = RUNTIME_MOCK_EVENTS_V0[i];
      expect(wrapped.payload.rule_id).toBe(original.rule_id);
      expect(wrapped.payload.ts).toBe(original.ts);
      expect(wrapped.payload.kind).toBe(original.kind);
      expect(wrapped.payload.original_severity).toBe(original.severity);
      expect(wrapped.payload.detail).toBe(original.detail);
    }
  });

  it('jeder Eintrag hat einen actor und eine id', () => {
    for (const e of RUNTIME_MOCK_EVENTS_V0) {
      expect(e.actor).toBeDefined();
      expect(typeof e.id).toBe('string');
      expect(e.id.length).toBeGreaterThan(0);
    }
  });

  it('agent-kind events bekommen actor.type="agent"', () => {
    for (let i = 0; i < RUNTIME_MOCK_EVENTS.length; i++) {
      if (RUNTIME_MOCK_EVENTS[i].kind === 'agent') {
        expect(RUNTIME_MOCK_EVENTS_V0[i].actor.type).toBe('agent');
      }
    }
  });
});

describe('Adoption #2 — demoRuntimeVvtData DEMO_RUNTIME_EVENTS_V0', () => {
  it('hat die gleiche Anzahl Eintraege wie das Original', () => {
    expect(DEMO_RUNTIME_EVENTS_V0.length).toBe(DEMO_RUNTIME_EVENTS.length);
    expect(DEMO_RUNTIME_EVENTS_V0.length).toBeGreaterThan(0);
  });

  it('jeder Eintrag hat spec_version="0.1"', () => {
    for (const e of DEMO_RUNTIME_EVENTS_V0) {
      expect(e.spec_version).toBe('0.1');
    }
  });

  it('jeder Eintrag hat einen validen RuntimeEventType', () => {
    for (const e of DEMO_RUNTIME_EVENTS_V0) {
      expect(VALID_TYPES.has(e.type), `unbekannter type: ${e.type}`).toBe(true);
    }
  });

  it('payload.original_type traegt den alten Typstring 1:1 weiter', () => {
    for (let i = 0; i < DEMO_RUNTIME_EVENTS.length; i++) {
      expect(DEMO_RUNTIME_EVENTS_V0[i].payload.original_type)
        .toBe(DEMO_RUNTIME_EVENTS[i].type);
    }
  });

  it('payload.metadata bewahrt alle Original-Felder', () => {
    for (let i = 0; i < DEMO_RUNTIME_EVENTS.length; i++) {
      const originalMeta = DEMO_RUNTIME_EVENTS[i].metadata ?? {};
      expect(DEMO_RUNTIME_EVENTS_V0[i].payload.metadata).toEqual(originalMeta);
    }
  });

  it('id und tenant_id werden uebernommen', () => {
    for (let i = 0; i < DEMO_RUNTIME_EVENTS.length; i++) {
      expect(DEMO_RUNTIME_EVENTS_V0[i].id).toBe(DEMO_RUNTIME_EVENTS[i].id);
      expect(DEMO_RUNTIME_EVENTS_V0[i].tenant_id).toBe(DEMO_RUNTIME_EVENTS[i].tenantId);
    }
  });
});
