import { describe, expect, it } from 'vitest';
import {
  EXECUTABLE_STATES,
  canReachExecutionOutcome,
  isAlreadyApplied,
  isExecutableState,
} from '../../workers/govard-gateway/src/workflows/execution-rules';
import { GovardError, TRANSITIONS, type CommandState } from '../../workers/govard-gateway/src/types';

const ALL_STATES = Object.keys(TRANSITIONS) as CommandState[];

describe('govard execution rules — welche Zustände der Workflow anfassen darf', () => {
  it('lässt genau APPROVED und EXECUTING zu', () => {
    expect(ALL_STATES.filter(isExecutableState)).toEqual(['APPROVED', 'EXECUTING']);
  });

  it('EXECUTING ist zulässig — sonst hinge ein Command nach Instanz-Tod für immer', () => {
    // Der Wiederanlauf-Fall: Die Instanz starb nach APPROVED → EXECUTING.
    expect(isExecutableState('EXECUTING')).toBe(true);
  });

  it('fasst nichts an, was die Governance noch nicht freigegeben hat', () => {
    for (const state of ['RECEIVED', 'EVALUATED', 'PENDING_APPROVAL'] as const) {
      expect(isExecutableState(state)).toBe(false);
    }
  });

  it('fasst keinen abgeschlossenen Command an', () => {
    for (const state of ['EXECUTED', 'FAILED', 'DENIED'] as const) {
      expect(isExecutableState(state)).toBe(false);
    }
  });

  it('jeder ausführbare Zustand kann ein Ausführungsende erreichen', () => {
    // Sonst nähme der Workflow einen Command an, den er nie abschließen kann.
    for (const state of EXECUTABLE_STATES) {
      expect(canReachExecutionOutcome(state)).toBe(true);
    }
  });

  it('terminale Zustände erreichen kein neues Ausführungsende', () => {
    expect(canReachExecutionOutcome('DENIED')).toBe(false);
  });
});

describe('govard execution rules — wann ein Fehler „schon erledigt" bedeutet', () => {
  it('erkennt STATE_CONFLICT als bereits vollzogenen Übergang', () => {
    // Der wiederholte Workflow-Schritt: `WHERE state = ?` trifft nicht mehr
    // zu, weil der Übergang beim ersten Lauf schon gelungen ist.
    expect(isAlreadyApplied(new GovardError('STATE_CONFLICT', 'nicht mehr im Zustand', 409))).toBe(true);
  });

  it('verschluckt keinen anderen GovardError', () => {
    // Eng gefasst mit Absicht — ein verschluckter Fehler im Zustandsautomaten
    // bricht genau die Zusage, für die es das Gateway gibt.
    for (const code of ['ILLEGAL_TRANSITION', 'NOT_FOUND', 'EVALUATION_MISMATCH', 'FORBIDDEN']) {
      expect(isAlreadyApplied(new GovardError(code, code, 409))).toBe(false);
    }
  });

  it('verschluckt keinen fremden Fehler', () => {
    expect(isAlreadyApplied(new Error('STATE_CONFLICT'))).toBe(false);
    expect(isAlreadyApplied({ code: 'STATE_CONFLICT' })).toBe(false);
    expect(isAlreadyApplied('STATE_CONFLICT')).toBe(false);
    expect(isAlreadyApplied(null)).toBe(false);
    expect(isAlreadyApplied(undefined)).toBe(false);
  });
});
