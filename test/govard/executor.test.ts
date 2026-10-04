import { describe, expect, it } from 'vitest';
import { startCommandExecution } from '../../workers/govard-gateway/src/executor';

type Instance = { id: string; status: () => Promise<{ status: string }> };

function workflowStub(opts: { createError?: Error; existing?: string[] }) {
  const calls = { create: 0, get: 0 };
  const existing = new Set(opts.existing ?? []);
  const instance = (id: string): Instance => ({ id, status: async () => ({ status: 'running' }) });
  return {
    calls,
    env: {
      COMMAND_WORKFLOW: {
        async create(options?: { id?: string }) {
          calls.create += 1;
          if (opts.createError) throw opts.createError;
          return instance(options?.id ?? 'generated');
        },
        async get(id: string) {
          calls.get += 1;
          if (!existing.has(id)) throw new Error('instance.not_found');
          return instance(id);
        },
      },
    },
  };
}

describe('govard startCommandExecution — Doppelstart am Bestand erkennen', () => {
  it('startet eine Instanz mit der Command-Kennung', async () => {
    const { env } = workflowStub({});
    await expect(startCommandExecution(env, 'org_1', 'cmd_1')).resolves.toEqual({
      started: true,
      instanceId: 'cmd_1',
    });
  });

  it('wertet einen abgewiesenen Start als Doppelstart, wenn die Instanz existiert', async () => {
    const { env } = workflowStub({ createError: new Error('irgendein Wortlaut'), existing: ['cmd_1'] });
    await expect(startCommandExecution(env, 'org_1', 'cmd_1')).resolves.toEqual({
      started: false,
      instanceId: 'cmd_1',
    });
  });

  it('verschluckt keinen echten Fehler, auch wenn er „conflict" heißt', async () => {
    // Genau der Fall, den das frühere Textmuster still als Doppelstart verbucht hätte.
    const real = new Error('upstream conflict: storage unavailable');
    const { env } = workflowStub({ createError: real });
    await expect(startCommandExecution(env, 'org_1', 'cmd_1')).rejects.toBe(real);
  });

  it('fragt den Bestand nur nach einem abgewiesenen Start ab', async () => {
    const { env, calls } = workflowStub({});
    await startCommandExecution(env, 'org_1', 'cmd_1');
    expect(calls).toEqual({ create: 1, get: 0 });
  });
});
