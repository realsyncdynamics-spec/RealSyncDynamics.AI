import { describe, it, expect } from 'vitest';
import { handoffActions, isOpenHandoff, sortForInbox } from '../../src/features/bots/handoff';

describe('Bot-Posteingang – Übergabe-Helfer', () => {
  it('bietet je Status nur die von der RPC erlaubten Aktionen an', () => {
    expect(handoffActions('none')).toEqual(['request']);
    expect(handoffActions('resolved')).toEqual(['request']);
    expect(handoffActions('requested')).toEqual(['accept', 'resolve']);
    expect(handoffActions('accepted')).toEqual(['resolve']);
  });

  it('behandelt fehlende Spalte (Migration noch nicht angewendet) als „none“', () => {
    expect(isOpenHandoff({})).toBe(false);
    expect(handoffActions(({} as { handoff_status?: 'none' }).handoff_status ?? 'none')).toEqual(['request']);
  });

  it('sortiert offene Übergaben nach oben, sonst stabil', () => {
    const list = [
      { id: 'a', handoff_status: 'none' as const },
      { id: 'b', handoff_status: 'accepted' as const },
      { id: 'c' },
      { id: 'd', handoff_status: 'requested' as const },
      { id: 'e', handoff_status: 'resolved' as const },
    ];
    expect(sortForInbox(list).map((c) => c.id)).toEqual(['d', 'b', 'a', 'c', 'e']);
    expect(list.map((c) => c.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});
