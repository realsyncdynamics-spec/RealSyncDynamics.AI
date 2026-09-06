import { describe, expect, it } from 'vitest';
import {
  TRANSITIONS,
  canTransition,
  type CommandState,
} from '../../workers/govard-gateway/src/types';

const ALL_STATES = Object.keys(TRANSITIONS) as CommandState[];

describe('govard command state machine', () => {
  it('erlaubt den Happy Path RECEIVED → … → EXECUTED', () => {
    expect(canTransition('RECEIVED', 'EVALUATED')).toBe(true);
    expect(canTransition('EVALUATED', 'APPROVED')).toBe(true);
    expect(canTransition('APPROVED', 'EXECUTING')).toBe(true);
    expect(canTransition('EXECUTING', 'EXECUTED')).toBe(true);
  });

  it('erlaubt den Approval-Pfad und beide Ausgänge', () => {
    expect(canTransition('EVALUATED', 'PENDING_APPROVAL')).toBe(true);
    expect(canTransition('PENDING_APPROVAL', 'APPROVED')).toBe(true);
    expect(canTransition('PENDING_APPROVAL', 'DENIED')).toBe(true);
  });

  it('kennt keinen Weg an der Governance-Evaluation vorbei', () => {
    // Der Kern der Korrektur: RECEIVED → EXECUTED existiert nicht,
    // auch nicht über EXECUTING oder APPROVED direkt.
    expect(canTransition('RECEIVED', 'EXECUTED')).toBe(false);
    expect(canTransition('RECEIVED', 'EXECUTING')).toBe(false);
    expect(canTransition('RECEIVED', 'APPROVED')).toBe(false);
    expect(canTransition('RECEIVED', 'PENDING_APPROVAL')).toBe(false);
  });

  it('behandelt EXECUTED, FAILED und DENIED als terminal', () => {
    for (const terminal of ['EXECUTED', 'FAILED', 'DENIED'] as const) {
      for (const to of ALL_STATES) {
        expect(canTransition(terminal, to)).toBe(false);
      }
    }
  });

  it('lässt keine Selbstübergänge zu', () => {
    for (const state of ALL_STATES) {
      expect(canTransition(state, state)).toBe(false);
    }
  });
});
