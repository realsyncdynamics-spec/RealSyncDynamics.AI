import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CloudProviderHttpError } from '../../supabase/functions/_shared/aiGateway/cloudProviderHttpError.ts';
import { CloudAttemptAuditError, ServerAiGateway } from '../../supabase/functions/_shared/aiGateway/router.ts';

const request = {
  feature: 'governance_router',
  task_type: 'classify',
  model_profile: 'cloud-fallback',
  input: 'Synthetische Anfrage',
  trace_id: 'synthetic-request-id',
};

function setup(primaryStatus, secondaryStatus = 200, { openai = true, output = 'Rueckruf' } = {}) {
  const events = [];
  const upstream = (provider, status) => async () => {
    events.push(['http', provider]);
    if (status === 429) return new Response('rate limited', { status });
    // A misleading provider error must not override the HTTP status.
    if (status !== 200) return Response.json({ error: { message: 'rate limit or fetch failed' } }, { status });
    return provider === 'anthropic'
      ? Response.json({ content: [{ type: 'text', text: output }] })
      : Response.json({ choices: [{ message: { content: output } }] });
  };
  const gateway = new ServerAiGateway({
    lmStudioBaseUrl: 'https://local.invalid',
    anthropicConfig: { apiKey: 'fixture', model: 'claude-fixture', fetchImpl: upstream('anthropic', primaryStatus) },
    openaiConfig: openai
      ? { apiKey: 'fixture', model: 'gpt-fixture', fetchImpl: upstream('openai', secondaryStatus) }
      : undefined,
  });
  const record = async ({ provider, outcome, http_status }) => {
    events.push([outcome, provider, http_status ?? null]);
  };
  return { gateway, events, record };
}

test('non-JSON HTTP 429 triggers one audited switch and preserves the request ID', async () => {
  const { gateway, events, record } = setup(429);
  const result = await gateway.generate(request, record);
  assert.equal(result.trace_id, request.trace_id);
  assert.equal(result.provider, 'openai');
  assert.deepEqual(events, [
    ['started', 'anthropic', null], ['http', 'anthropic'], ['error', 'anthropic', 429],
    ['started', 'openai', null], ['http', 'openai'], ['success', 'openai', null],
  ]);
});

for (const status of [401, 403, 503]) {
  test(`primary HTTP ${status} stops without calling the second provider`, async () => {
    const { gateway, events, record } = setup(status);
    await assert.rejects(gateway.generate(request, record), (err) =>
      err instanceof CloudProviderHttpError && err.status === status);
    assert.deepEqual(events, [
      ['started', 'anthropic', null], ['http', 'anthropic'], ['error', 'anthropic', status],
    ]);
  });
}

test('two rate limits stop after two distinct provider calls', async () => {
  const { gateway, events, record } = setup(429, 429);
  await assert.rejects(gateway.generate(request, record), { status: 429 });
  assert.deepEqual(events.filter(([kind]) => kind === 'http'), [['http', 'anthropic'], ['http', 'openai']]);
  assert.deepEqual(events.at(-1), ['error', 'openai', 429]);
});

test('no configured secondary preserves the primary response status', async () => {
  const { gateway, events, record } = setup(429, 200, { openai: false });
  await assert.rejects(gateway.generate(request, record), { status: 429 });
  assert.deepEqual(events.filter(([kind]) => kind === 'http'), [['http', 'anthropic']]);
});

for (const [provider, outcome, expectedHttp] of [
  ['anthropic', 'started', []],
  ['anthropic', 'error', [['http', 'anthropic']]],
  ['openai', 'started', [['http', 'anthropic']]],
  ['openai', 'success', [['http', 'anthropic'], ['http', 'openai']]],
]) {
  test(`failed audit at ${provider}/${outcome} prevents further inference or a successful response`, async () => {
    const { gateway, events, record } = setup(429);
    await assert.rejects(gateway.generate(request, async (attempt) => {
      if (attempt.provider === provider && attempt.outcome === outcome) throw new CloudAttemptAuditError();
      await record(attempt);
    }), CloudAttemptAuditError);
    assert.deepEqual(events.filter(([kind]) => kind === 'http'), expectedHttp);
  });
}

test('JSON extraction uses the same audited cloud path', async () => {
  const { gateway, events, record } = setup(429, 200, { output: '{"category":"Rueckruf"}' });
  const result = await gateway.extractJson({ ...request, task_type: 'extract_json' }, record);
  assert.deepEqual(result.output, { category: 'Rueckruf' });
  assert.equal(result.trace_id, request.trace_id);
  assert.deepEqual(events.at(-1), ['success', 'openai', null]);
});

test('callers without the audit callback retain the default 429 behavior', async () => {
  const { gateway, events } = setup(429);
  await assert.rejects(gateway.generate(request), { status: 429 });
  assert.deepEqual(events, [['http', 'anthropic']]);
});

test('a local profile does not use the audited cloud path', async () => {
  const { events, record } = setup(429);
  const gateway = new ServerAiGateway({
    lmStudioBaseUrl: 'https://local.invalid',
    lmStudio: {
      id: 'ollama',
      generate: async () => ({ provider: 'ollama', trace_id: request.trace_id }),
    },
  });
  const result = await gateway.generate({ ...request, model_profile: 'fast-local' }, record);
  assert.equal(result.provider, 'ollama');
  assert.deepEqual(events, []);
});

test('an exhausted time budget stops before the next provider', async () => {
  const { gateway, events, record } = setup(429);
  const budgetMs = 50;
  await assert.rejects(gateway.generate({ ...request, timeout_ms: budgetMs }, async (attempt) => {
    await record(attempt);
    if (attempt.outcome === 'error') await new Promise((resolve) => setTimeout(resolve, budgetMs));
  }), { status: 429 });
  assert.deepEqual(events.filter(([kind]) => kind === 'http'), [['http', 'anthropic']]);
});
