/**
 * „Mein Plan" — die reinen Helfer der Fläche.
 *
 * Die Zustände kommen vom Server; hier wird geprüft, dass die Fläche sie
 * ehrlich sortiert (gebucht · zubuchbar · nicht verfügbar mit Grund) und
 * dass kein Betrag entsteht, der nicht aus der Antwort stammt.
 */
import { describe, expect, it } from 'vitest';
import {
  entitlementLabel,
  formatEntitlementValue,
  groupAddons,
  includedEntitlements,
  previewSentence,
  unavailableReason,
  type AddonListingEntry,
} from '../../src/features/market/subscriptionAddons';

function eintrag(over: Partial<AddonListingEntry>): AddonListingEntry {
  return {
    id: 'voice',
    name: 'Voice',
    description: 'Sprachkanal',
    price_eur: 150,
    price_note: '/ Monat',
    bullets: [],
    per_unit: false,
    grants: {},
    status: 'bookable',
    missing: [],
    quantity: 0,
    stripe_item_id: null,
    preview: {
      current_monthly_eur: 249,
      delta_monthly_eur: 150,
      new_monthly_eur: 399,
      effective_from: '2026-09-01T00:00:00.000Z',
      full_amount_from: '2026-10-01T00:00:00.000Z',
    },
    ...over,
  };
}

describe('groupAddons', () => {
  it('sortiert in gebucht, zubuchbar und nicht verfügbar', () => {
    const g = groupAddons({ addons: [
      eintrag({ id: 'voice', status: 'booked' }),
      eintrag({ id: 'response_pack', status: 'bookable' }),
      eintrag({ id: 'white_label', status: 'not_purchasable' }),
      eintrag({ id: 'compliance_pack', status: 'missing_dependency', missing: ['bots.enabled'] }),
    ] });
    expect(g.booked.map((a) => a.id)).toEqual(['voice']);
    expect(g.bookable.map((a) => a.id)).toEqual(['response_pack']);
    expect(g.unavailable.map((a) => a.id)).toEqual(['white_label', 'compliance_pack']);
  });

  it('zeigt weder Fremdes noch Enthaltenes als „nicht verfügbar"', () => {
    const g = groupAddons({ addons: [
      eintrag({ id: 'whatsapp', status: 'not_for_plan' }),
      eintrag({ id: 'white_label', status: 'included' }),
    ] });
    expect(g.booked).toEqual([]);
    expect(g.bookable).toEqual([]);
    expect(g.unavailable).toEqual([]);
  });
});

describe('unavailableReason', () => {
  it('nennt fehlende Voraussetzungen mit lesbarem Namen', () => {
    expect(unavailableReason({ status: 'missing_dependency', missing: ['bots.enabled'] }))
      .toBe('Setzt voraus: Governance-Bots.');
  });

  it('sagt bei fehlender Price, dass die Buchung folgt — nicht, dass sie geht', () => {
    expect(unavailableReason({ status: 'not_purchasable', missing: [] })).toMatch(/Buchung folgt/);
  });
});

describe('previewSentence', () => {
  it('alt + Zuschlag = neu, mit Datum des vollen Betrags', () => {
    const satz = previewSentence(eintrag({}));
    expect(satz).toContain('249');
    expect(satz).toContain('150');
    expect(satz).toContain('399');
    expect(satz).toMatch(/voll ab 1\. Oktober 2026/);
  });

  it('kommt ohne Datum aus', () => {
    const satz = previewSentence(eintrag({ preview: { current_monthly_eur: 79, delta_monthly_eur: 99, new_monthly_eur: 178, effective_from: 'x', full_amount_from: null } }));
    expect(satz).toContain('178');
    expect(satz).not.toContain('voll ab');
  });
});

describe('includedEntitlements', () => {
  it('führt nur Gewährtes, Kontingente zuerst, ohne das Scan-Kontingent', () => {
    const rows = includedEntitlements({ entitlements: [
      { key: 'policy.packs', kind: 'boolean', value: 1 },
      { key: 'reports.export', kind: 'boolean', value: 0 },
      { key: 'limit.domains', kind: 'limit', value: 3 },
      { key: 'limit.bot_messages_monthly', kind: 'limit', value: -1 },
      { key: 'website.scan_monthly_limit', kind: 'limit', value: -1 },
    ] });
    expect(rows.map((r) => r.key)).toEqual(['limit.bot_messages_monthly', 'limit.domains', 'policy.packs']);
    expect(rows[0].display).toBe('unbegrenzt');
    expect(rows[1].display).toBe('3');
  });

  it('zeigt einen unbekannten Key statt ihn zu verschweigen', () => {
    expect(entitlementLabel('foo.bar')).toBe('foo.bar');
    expect(formatEntitlementValue('limit', 12000)).toBe('12.000');
  });
});
