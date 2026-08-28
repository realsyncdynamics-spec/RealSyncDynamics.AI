import { describe, expect, it } from 'vitest';
import {
  art50Required,
  canGoLive,
  furnitureDefaults,
  suggestPlan,
} from '../../shared/onboarding';

describe('onboarding plan suggestion', () => {
  it('Möbelhaus site+chat+proof → starter', () => {
    expect(
      suggestPlan({ industry: 'shop', jobs: ['site', 'chat', 'proof'] }),
    ).toBe('starter');
  });

  it('WhatsApp zieht auf growth', () => {
    expect(
      suggestPlan({ industry: 'shop', jobs: ['site', 'chat', 'wa', 'proof'] }),
    ).toBe('growth');
  });

  it('Agentur mit Mandanten → agency (nur Hinweis)', () => {
    expect(
      suggestPlan({
        industry: 'agentur',
        jobs: ['site', 'proof'],
        clients: 'we_plus_clients',
      }),
    ).toBe('agency');
  });
});

describe('art50 and live gate', () => {
  it('Art. 50 sobald Chat an ist', () => {
    expect(art50Required(['chat'])).toBe(true);
    expect(art50Required(['site', 'proof'])).toBe(false);
  });

  it('Live ohne Checkliste oder Art. 50 unmöglich', () => {
    expect(
      canGoLive({
        checklistDone: 4,
        checklistTotal: 5,
        art50Visible: true,
        jobs: ['chat'],
      }),
    ).toBe(false);
    expect(
      canGoLive({
        checklistDone: 5,
        checklistTotal: 5,
        art50Visible: false,
        jobs: ['chat'],
      }),
    ).toBe(false);
    expect(
      canGoLive({
        checklistDone: 5,
        checklistTotal: 5,
        art50Visible: true,
        jobs: ['chat'],
      }),
    ).toBe(true);
  });

  it('furnitureDefaults setzt locked art50', () => {
    const profile = furnitureDefaults();
    expect(profile.vertical).toBe('furniture');
    expect(profile.plan_suggested).toBe('starter');
    expect(profile.locked_limits).toContain('art50');
    expect(profile.channels.web).toBe('test');
    expect(profile.channels.whatsapp).toBe('off');
  });
});
