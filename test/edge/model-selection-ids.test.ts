import { describe, expect, it } from 'vitest';

import { getModelId, selectModel } from '../../supabase/functions/_shared/modelSelection';

/**
 * `getModelId` feeds `client.messages.create({ model })` directly (the
 * governance agent passes `getModelId(selectedTier)` as `model`). A model id
 * that Anthropic does not publish is not a cosmetic problem — the request
 * fails outright.
 *
 * Until 2026-09-21 the sonnet tier returned `claude-sonnet-4-6-20250514`, an id
 * assembled from two generations: Sonnet 4.6 plus the release date of Sonnet 4.
 * `selectModel` picks that tier for every query scoring >= 40, i.e. for every
 * non-trivial request to the governance agent.
 *
 * These are the ids as Anthropic publishes them. Model ids are complete as
 * given; a date suffix belongs to a specific snapshot id and is never appended
 * to a base id.
 */
const PUBLISHED_IDS: Record<'haiku' | 'sonnet', string> = {
  haiku:  'claude-haiku-4-5',
  sonnet: 'claude-sonnet-4-6',
};

describe('getModelId', () => {
  it.each(Object.entries(PUBLISHED_IDS))(
    'returns the published id for the %s tier',
    (tier, expected) => {
      expect(getModelId(tier as 'haiku' | 'sonnet')).toBe(expected);
    },
  );

  it('never returns a dated Sonnet 4.6 id', () => {
    // Guards the exact regression. Sonnet 4.6 is published only as
    // `claude-sonnet-4-6`; there is no dated snapshot of it, so any
    // `claude-sonnet-4-6-<date>` is fabricated. Other families do have dated
    // snapshots with a minor group (claude-haiku-4-5-20251001 is real), so the
    // guard deliberately covers Sonnet 4.6 only.
    const fabricated = /^claude-sonnet-4-6-\d{8}$/;
    expect('claude-sonnet-4-6-20250514').toMatch(fabricated);
    expect('claude-haiku-4-5-20251001').not.toMatch(fabricated);
    for (const tier of ['haiku', 'sonnet'] as const) {
      expect(getModelId(tier)).not.toMatch(fabricated);
    }
  });

  it('routes a trivial question to haiku and a complex one to sonnet', () => {
    // Pins the two tiers to reachable inputs, so the ids above are not merely
    // asserted against a function nothing calls.
    const simple  = selectModel('Was ist die DSGVO?', 0, false);
    const complex = selectModel(
      'Bitte analysiere schrittweise, welche Auftragsverarbeiter-Vertraege wir '
      + 'nach Art. 28 DSGVO fuer unsere drei Cloud-Anbieter brauchen, und '
      + 'vergleiche das mit den Anforderungen des EU AI Act fuer Hochrisiko-Systeme.',
      6,
      true,
    );

    expect(getModelId(simple)).toBe(PUBLISHED_IDS.haiku);
    expect(getModelId(complex)).toBe(PUBLISHED_IDS.sonnet);
  });
});
