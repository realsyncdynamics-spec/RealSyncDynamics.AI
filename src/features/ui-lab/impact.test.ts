import { describe, expect, it } from 'vitest';
import { exportCss } from './exportCss';
import { analyzeDraft, mergeBlocked, sistersIntact } from './impact';
import { emptyDraft, type Draft } from './types';

function draftWith(values: Record<string, string>): Draft {
  const draft = emptyDraft();
  draft.shared = { ...values };
  return draft;
}

describe('exportCss', () => {
  it('returns a comment when the draft is empty', () => {
    expect(exportCss(emptyDraft())).toContain('No changes');
  });

  it('emits only the dashboard-context block for density tokens', () => {
    const css = exportCss(draftWith({ '--dash-kpi-min-height': '128px' }));
    expect(css).toContain('.dashboard-context');
    expect(css).toContain('--dash-kpi-min-height: 128px');
    expect(css).not.toContain('@theme {');
  });
});

describe('analyzeDraft', () => {
  it('marks selector-backed density as legacy, not blocked', () => {
    const cards = analyzeDraft(draftWith({ '--dash-kpi-min-height': '128px' }));
    expect(cards).toHaveLength(1);
    expect(cards[0]?.status).toBe('legacy');
    expect(cards[0]?.sisters).toHaveLength(4);
    expect(sistersIntact(cards)).toBe(true);
    expect(mergeBlocked(cards)).toBe(false);
  });

  it('blocks a radius that breaks Hard-Edge Industrial', () => {
    const cards = analyzeDraft(draftWith({ '--context-radius-card': '12px' }));
    expect(cards[0]?.status).toBe('blocked');
    expect(cards[0]?.risk).toBe('high');
    expect(mergeBlocked(cards)).toBe(true);
  });

  it('blocks unmapped tokens', () => {
    const cards = analyzeDraft(draftWith({ '--unknown-token': '1px' }));
    expect(cards[0]?.status).toBe('unmapped');
    expect(mergeBlocked(cards)).toBe(true);
  });

  it('enforces industrial-radius-lock: baseline 0 passes, any other value blocks', () => {
    const zeroCards = analyzeDraft(draftWith({ '--context-radius-card': '0' }));
    expect(zeroCards[0]?.status).not.toBe('blocked');
    expect(mergeBlocked(zeroCards)).toBe(false);

    const nonZeroCards = analyzeDraft(draftWith({ '--context-radius-card': '4px' }));
    expect(nonZeroCards[0]?.status).toBe('blocked');
    expect(nonZeroCards[0]?.risk).toBe('high');
    expect(mergeBlocked(nonZeroCards)).toBe(true);
  });
});
