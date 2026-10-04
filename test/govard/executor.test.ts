import { describe, expect, it } from 'vitest';
import { startCommandExecution } from '../../workers/govard-gateway/src/executor';

type Instance = { id: string; status: () => Promise<{ status: string }> };

/** `existing`: Kennung → Status der bereits vorhandenen Instanz. */
function workflowStub(opts: { createError?: Error; existing?: Record<string, string> }) {
  const calls = { create: 0, get: 0 };
  const existing = opts.existing ?? {};
  const instance = (id: string, status = 'queued'): Instance => ({ id, status: async () => ({ status }) });
  return {
    calls,
    env: {
      COMMAND_WORKFLOW: {
        async create(options: { id: string }) {
          calls.create += 1;
          if (opts.createError) throw opts.createError;
          return instance(options.id);
        },
        async get(id: string) {
          calls.get += 1;
          if (!(id in existing)) throw new Error('instance.not_found');
          return instance(id, existing[id]);
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

  it('wertet einen abgewiesenen Start als Doppelstart, wenn die Instanz noch arbeitet', async () => {
    for (const status of ['queued', 'running', 'waiting', 'paused']) {
      const { env } = workflowStub({ createError: new Error('irgendein Wortlaut'), existing: { cmd_1: status } });
      await expect(startCommandExecution(env, 'org_1', 'cmd_1')).resolves.toEqual({
        started: false,
        instanceId: 'cmd_1',
      });
    }
  });

  it('wertet eine erfolgreich beendete Instanz als Doppelstart', async () => {
    const { env } = workflowStub({ createError: new Error('irgendein Wortlaut'), existing: { cmd_1: 'complete' } });
    await expect(startCommandExecution(env, 'org_1', 'cmd_1')).resolves.toEqual({
      started: false,
      instanceId: 'cmd_1',
    });
  });

  it('verschweigt keine gescheiterte oder abgebrochene Instanz', async () => {
    // Sonst hinge der Command womöglich in EXECUTING, und niemand sähe es.
    for (const status of ['errored', 'terminated']) {
      const original = new Error('instance.already_exists');
      const { env } = workflowStub({ createError: original, existing: { cmd_1: status } });
      const err = await startCommandExecution(env, 'org_1', 'cmd_1').catch((e: unknown) => e);
      expect(err instanceof Error && err.message.includes(`"${status}"`)).toBe(true);
      expect((err as Error).cause).toBe(original);
    }
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
