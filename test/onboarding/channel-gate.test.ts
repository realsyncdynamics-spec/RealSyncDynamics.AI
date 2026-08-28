import { describe, expect, it } from 'vitest';
import { applyChannelTransition, evidencePayloadForChannel } from '../../shared/channel-gate';

describe('channel gate', () => {
  it('lässt Test und Aus immer zu', () => {
    expect(
      applyChannelTransition({
        to: 'off',
        jobs: ['chat'],
        checklistDone: 0,
        checklistTotal: 5,
        art50Visible: false,
      }).ok,
    ).toBe(true);
    expect(
      applyChannelTransition({
        to: 'test',
        jobs: ['chat'],
        checklistDone: 0,
        checklistTotal: 5,
        art50Visible: false,
      }).state,
    ).toBe('test');
  });

  it('blockiert Live ohne Checkliste', () => {
    const result = applyChannelTransition({
      to: 'live',
      jobs: ['chat'],
      checklistDone: 2,
      checklistTotal: 5,
      art50Visible: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.state).toBe('test');
  });

  it('lässt Live nur mit voller Checkliste und Art. 50', () => {
    expect(
      applyChannelTransition({
        to: 'live',
        jobs: ['chat'],
        checklistDone: 5,
        checklistTotal: 5,
        art50Visible: true,
      }),
    ).toEqual({ ok: true, state: 'live' });
  });

  it('Evidence-Payload bleibt deterministisch', () => {
    const payload = evidencePayloadForChannel({
      channel: 'whatsapp',
      from: 'test',
      to: 'live',
      accepted: false,
      reason: 'live_gate',
    });
    expect(payload.type).toBe('operate.channel_transition');
    expect(payload.accepted).toBe(false);
    expect(payload.art50_required).toBe(true);
  });
});
