import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const state: {
    existing: Record<string, unknown> | null;
    readError: { message: string } | null;
    upserts: Record<string, unknown>[];
  } = { existing: null, readError: null, upserts: [] };

  const client = {
    from: (table: string) => {
      if (table === 'governance_activations') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: state.existing ? { organization: state.existing } : null,
                error: state.readError,
              }),
            }),
          }),
          upsert: async (payload: Record<string, unknown>) => {
            state.upserts.push(payload);
            return { error: null };
          },
        };
      }
      return { update: () => ({ eq: async () => ({ error: null }) }) };
    },
  };
  return { state, client };
});

vi.mock('../../src/lib/supabase', () => ({
  getSupabase: () => mocks.client,
  isSupabaseConfigured: () => true,
}));

import {
  mergeOrganizationForSave,
  saveGovernanceActivation,
  EMPTY_ORGANIZATION,
} from '../../src/features/activation/activationApi';
import {
  asAiSetup,
  createEmptyAiSetup,
  isAiSetupComplete,
  toggleExclusiveOption,
  type AiSetup,
} from '../../src/features/activation/aiSetupCatalog';

function sampleAiSetup(): AiSetup {
  return {
    ...createEmptyAiSetup(),
    responsibleRole: 'AI Officer',
    aiSystems: ['openai', 'local'],
    botsAgents: ['browser_agent'],
    dataClasses: ['customer', 'email'],
  };
}

describe('asAiSetup (toleranter Parser)', () => {
  it('liefert undefined, wenn kein Objekt gespeichert ist', () => {
    expect(asAiSetup(undefined)).toBeUndefined();
    expect(asAiSetup(null)).toBeUndefined();
    expect(asAiSetup([])).toBeUndefined();
    expect(asAiSetup('x')).toBeUndefined();
  });

  it('verwirft unbekannte Werte und Duplikate', () => {
    const parsed = asAiSetup({
      aiSystems: ['openai', 'openai', 'skynet', 42],
      dataClasses: ['customer', 'secret'],
    });
    expect(parsed?.aiSystems).toEqual(['openai']);
    expect(parsed?.dataClasses).toEqual(['customer']);
    expect(parsed?.botsAgents).toEqual([]);
  });

  it('bereinigt „none" neben anderen Werten auf nur „none"', () => {
    expect(asAiSetup({ botsAgents: ['voice', 'none'] })?.botsAgents).toEqual(['none']);
  });

  it('fällt bei ungültigen Freigaben auf die vorsichtige Vorbelegung zurück', () => {
    const parsed = asAiSetup({ approvals: { autoCommunicate: 'always', logEveryAgentAction: 'ja' } });
    const defaults = createEmptyAiSetup().approvals;
    expect(parsed?.approvals.autoCommunicate).toBe(defaults.autoCommunicate);
    expect(parsed?.approvals.logEveryAgentAction).toBe(true);
    expect(parsed?.approvals.humanApprovalFor).toEqual(defaults.humanApprovalFor);
  });

  it('übernimmt gültige gespeicherte Werte unverändert', () => {
    const setup = sampleAiSetup();
    expect(asAiSetup(JSON.parse(JSON.stringify(setup)))).toEqual(setup);
  });
});

describe('toggleExclusiveOption', () => {
  it('„none" wählen leert die übrigen Optionen', () => {
    expect(toggleExclusiveOption(['openai', 'google'], 'none')).toEqual(['none']);
  });

  it('eine andere Option entfernt „none"', () => {
    expect(toggleExclusiveOption(['none'], 'openai')).toEqual(['openai']);
  });

  it('erneutes Klicken entfernt die Option', () => {
    expect(toggleExclusiveOption(['openai', 'google'], 'openai')).toEqual(['google']);
  });
});

describe('isAiSetupComplete', () => {
  it('verlangt eine Angabe bei KI-Systemen und Bots/Agenten', () => {
    expect(isAiSetupComplete(createEmptyAiSetup())).toBe(false);
    expect(
      isAiSetupComplete({ ...createEmptyAiSetup(), aiSystems: ['none'], botsAgents: ['none'] }),
    ).toBe(true);
  });
});

describe('mergeOrganizationForSave', () => {
  const org = { ...EMPTY_ORGANIZATION, company: 'Muster GmbH' };

  it('erhält ein gespeichertes aiSetup, wenn nur Org-Felder gespeichert werden', () => {
    const stored = sampleAiSetup();
    const merged = mergeOrganizationForSave({ company: 'Alt', aiSetup: stored }, org);
    expect(merged.company).toBe('Muster GmbH');
    expect(merged.aiSetup).toEqual(stored);
  });

  it('ersetzt aiSetup, wenn es übergeben wird', () => {
    const next = { ...sampleAiSetup(), aiSystems: ['none'] };
    const merged = mergeOrganizationForSave({ aiSetup: sampleAiSetup() }, { ...org, aiSetup: next });
    expect(merged.aiSetup).toEqual(next);
  });

  it('erhält unbekannte Felder des Bestands', () => {
    expect(mergeOrganizationForSave({ legacyField: 1 }, org).legacyField).toBe(1);
  });

  it('schreibt kein aiSetup, wenn weder Bestand noch Eingabe eines haben', () => {
    expect('aiSetup' in mergeOrganizationForSave(null, org)).toBe(false);
  });
});

describe('saveGovernanceActivation — Regression: Org-Speichern löscht aiSetup nicht', () => {
  beforeEach(() => {
    mocks.state.existing = null;
    mocks.state.readError = null;
    mocks.state.upserts = [];
  });

  it('upsertet die Organisation inklusive des gespeicherten aiSetup', async () => {
    const stored = sampleAiSetup();
    mocks.state.existing = { company: 'Alt', aiSetup: stored };

    await saveGovernanceActivation({
      tenantId: 't-1',
      organization: { ...EMPTY_ORGANIZATION, company: 'Muster GmbH' },
      scopes: ['dsgvo'],
    });

    expect(mocks.state.upserts).toHaveLength(1);
    const organization = mocks.state.upserts[0].organization as Record<string, unknown>;
    expect(organization.company).toBe('Muster GmbH');
    expect(organization.aiSetup).toEqual(stored);
    expect(mocks.state.upserts[0].tenant_id).toBe('t-1');
  });

  it('schreibt nicht, wenn der Bestand nicht gelesen werden kann', async () => {
    mocks.state.readError = { message: 'permission denied' };

    await expect(
      saveGovernanceActivation({
        tenantId: 't-1',
        organization: { ...EMPTY_ORGANIZATION, company: 'Muster GmbH' },
        scopes: ['dsgvo'],
      }),
    ).rejects.toThrow('permission denied');
    expect(mocks.state.upserts).toHaveLength(0);
  });
});
