/**
 * setObligationDone — Schreibpfad für von Hand abgehakte Pflichten.
 *
 * RLS lässt Mitglieder ohne Owner-/Admin-Rolle die Activation-Zeile lesen,
 * filtert ihr UPDATE aber still auf null Zeilen. Ein Haken darf dann nicht
 * als gespeichert gelten.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const state: {
    organization: Record<string, unknown> | null;
    updatedRows: { tenant_id: string }[];
    updateError: { message: string } | null;
    lastUpdate: Record<string, unknown> | null;
  } = { organization: null, updatedRows: [], updateError: null, lastUpdate: null };

  const client = {
    from: (table: string) => {
      if (table !== 'governance_activations') throw new Error(`unerwartete Tabelle: ${table}`);
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: state.organization ? { organization: state.organization } : null,
              error: null,
            }),
          }),
        }),
        update: (payload: Record<string, unknown>) => {
          state.lastUpdate = payload;
          return {
            eq: () => ({
              select: async () => ({ data: state.updatedRows, error: state.updateError }),
            }),
          };
        },
      };
    },
  };
  return { state, client };
});

vi.mock('../../src/lib/supabase', () => ({
  getSupabase: () => mocks.client,
  isSupabaseConfigured: () => true,
}));

import { setObligationDone } from '../../src/features/governance/dashboard/obligationProgress';

const NOW = new Date('2026-10-23T09:00:00.000Z');

describe('setObligationDone', () => {
  beforeEach(() => {
    mocks.state.organization = { company: 'Muster GmbH', aiSetup: { aiSystems: ['openai'] } };
    mocks.state.updatedRows = [{ tenant_id: 't-1' }];
    mocks.state.updateError = null;
    mocks.state.lastUpdate = null;
  });

  it('setzt den Haken und lässt alle anderen Org-Felder stehen', async () => {
    const progress = await setObligationDone('t-1', 'ai_literacy', true, NOW);
    expect(progress).toEqual({ ai_literacy: { doneAt: NOW.toISOString() } });
    const org = mocks.state.lastUpdate?.organization as Record<string, unknown>;
    expect(org.company).toBe('Muster GmbH');
    expect(org.aiSetup).toEqual({ aiSystems: ['openai'] });
    expect(org.obligationProgress).toEqual(progress);
  });

  it('entfernt einen Haken', async () => {
    mocks.state.organization = {
      company: 'Muster GmbH',
      obligationProgress: { ai_literacy: { doneAt: '2026-10-01T00:00:00Z' } },
    };
    expect(await setObligationDone('t-1', 'ai_literacy', false, NOW)).toEqual({});
  });

  it('null geänderte Zeilen (RLS ohne Schreibrecht) → Fehler, nicht „gespeichert"', async () => {
    mocks.state.updatedRows = [];
    await expect(setObligationDone('t-1', 'ai_literacy', true, NOW))
      .rejects.toThrow(/Schreibberechtigung/);
  });

  it('Datenbankfehler wird weitergereicht', async () => {
    mocks.state.updateError = { message: 'boom' };
    await expect(setObligationDone('t-1', 'ai_literacy', true, NOW)).rejects.toThrow('boom');
  });

  it('ohne Activation-Zeile wird nichts geschrieben', async () => {
    mocks.state.organization = null;
    await expect(setObligationDone('t-1', 'ai_literacy', true, NOW)).rejects.toThrow();
    expect(mocks.state.lastUpdate).toBeNull();
  });
});
