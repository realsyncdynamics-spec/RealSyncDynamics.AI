import { describe, expect, it, vi } from 'vitest';
import { Orchestrator } from '../../../src/core/agent-os/orchestrator';
import { JARVIS_LOCAL_AGENT, registerJarvisLocalAgent } from '../../../src/core/agent-os/local-jarvis';

const TENANT = 'local-a';
const MODEL = 'qwen2.5:7b';

function fixture(shouldFail = false) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const localFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (shouldFail) throw new Error('ECONNREFUSED');
    return {
      ok: true,
      status: 200,
      json: async () => ({ model: MODEL, message: { role: 'assistant', content: 'Lokal beantwortet.' } }),
    } as Response;
  }) as typeof fetch;
  const orch = new Orchestrator();
  registerJarvisLocalAgent(orch, { model: MODEL, fetchImpl: localFetch });
  return { calls, orch };
}

describe('Jarvis Local — Agent OS / Ollama vertical slice', () => {
  it('uses only local Ollama and records an Agent OS task/output', async () => {
    const { calls, orch } = fixture();
    const task = orch.store.createTask({
      tenant_id: TENANT,
      agent: JARVIS_LOCAL_AGENT,
      task: 'Frage',
      input: { prompt: 'Hallo Jarvis' },
    });
    const result = await orch.run(task.id);
    expect(result?.status).toBe('done');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('http://127.0.0.1:11434/api/chat');
    const body = JSON.parse(String(calls[0]?.init?.body)) as { stream: boolean; model: string };
    expect(body.stream).toBe(false);
    expect(body.model).toBe(MODEL);
    expect(orch.store.listOutputsForTask(task.id)[0]?.content).toMatchObject({
      answer: 'Lokal beantwortet.',
      mode: 'local-read-only',
      actions_executed: false,
    });
    expect(orch.store.listEvents({ tenant_id: TENANT }).map((e) => e.event_type))
      .toContain('task.completed');
    expect(orch.store.listDecisions({ tenant_id: TENANT })).toHaveLength(0);
  });

  it('injects only active notes belonging to the current tenant', async () => {
    const { calls, orch } = fixture();
    orch.store.addMemory({
      tenant_id: TENANT, topic: 'Q4', content: 'Unser Q4-Ziel ist Stabilität.', source: 'q4.md',
    });
    orch.store.addMemory({
      tenant_id: 'another-tenant', topic: 'Secret', content: 'OTHER_TENANT_SECRET',
    });
    orch.store.addMemory({
      tenant_id: TENANT, topic: 'old', content: 'REDACTED_VALUE', status: 'redacted',
    });
    const task = orch.store.createTask({
      tenant_id: TENANT, agent: JARVIS_LOCAL_AGENT,
      task: 'Frage', input: { prompt: 'Was sind meine Q4-Ziele?' },
    });
    const result = await orch.run(task.id);
    expect(result?.status).toBe('done');
    const body = JSON.parse(String(calls[0]?.init?.body)) as {
      messages: Array<{ role: string; content: string }>;
    };
    const system = body.messages.find((m) => m.role === 'system')?.content ?? '';
    expect(system).toContain('Unser Q4-Ziel ist Stabilität.');
    expect(system).not.toContain('OTHER_TENANT_SECRET');
    expect(system).not.toContain('REDACTED_VALUE');
    expect(orch.store.listOutputsForTask(task.id)[0]?.content)
      .toMatchObject({ context_memory_ids: expect.arrayContaining([expect.any(String)]) });
  });

  it('blocks empty or oversized inputs without model calls', async () => {
    const { calls, orch } = fixture();
    for (const prompt of ['', ' '.repeat(3), 'x'.repeat(8001)]) {
      const task = orch.store.createTask({
        tenant_id: TENANT, agent: JARVIS_LOCAL_AGENT,
        task: 'Frage', input: { prompt },
      });
      expect((await orch.run(task.id))?.status).toBe('blocked');
    }
    expect(calls).toHaveLength(0);
  });

  it('fails closed when local Ollama is unreachable; never retries cloud', async () => {
    const { calls, orch } = fixture(true);
    const task = orch.store.createTask({
      tenant_id: TENANT, agent: JARVIS_LOCAL_AGENT,
      task: 'Frage', input: { prompt: 'Hallo' },
    });
    const result = await orch.run(task.id);
    expect(result?.status).toBe('failed');
    expect(calls.map((call) => call.url)).toEqual(['http://127.0.0.1:11434/api/chat']);
  });
});
