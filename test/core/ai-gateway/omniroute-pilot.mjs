import assert, { AssertionError } from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { ServerAiGateway } from '../../../supabase/functions/_shared/aiGateway/router.ts';

const labels = ['Rueckruf', 'Terminwunsch', 'Servicefrage', 'Unklar'];
const trades = ['Heizung', 'Elektro', 'Dach', 'Sanitaer', 'Fenster'];
const requests = {
  Rueckruf: [
    'Können Sie mich wegen {trade} zurückrufen?',
    'Bitte telefonisch melden, es geht um {trade}.',
    'Ich hätte zu {trade} gern einen Rückruf.',
    'Könnten Sie mich zu {trade} kurz anrufen?',
    'Am besten besprechen wir {trade} am Telefon. Bitte rufen Sie an.',
  ],
  Terminwunsch: [
    'Haben Sie am Dienstag einen Termin für {trade} frei?',
    'Ich möchte für {trade} einen Vor-Ort-Termin vereinbaren.',
    'Wann könnten Sie wegen {trade} vorbeikommen?',
    'Bitte einen Termin für {trade} nächste Woche vorschlagen.',
    'Kann ich Donnerstag für {trade} einen Besuch buchen?',
  ],
  Servicefrage: [
    'Bieten Sie zu {trade} auch Wartung an?',
    'Was kostet die Anfahrt für {trade}?',
    'Welche Garantie gilt nach Arbeiten an {trade}?',
    'Bearbeiten Sie bei {trade} auch kleinere Aufträge?',
    'Wie lange dauert üblicherweise ein Einsatz für {trade}?',
  ],
  Unklar: [
    'Guten Tag. Stichwort {trade}.',
    '{trade} – ich melde mich später nochmal.',
    'Das betrifft {trade}, Details folgen.',
    'Es geht irgendwie um {trade}.',
    'Hallo, Nachricht zu {trade}.',
  ],
};
const cases = labels.flatMap((label) => requests[label].flatMap((template) =>
  trades.map((trade) => ({ label, input: template.replace('{trade}', trade) }))));
const labelsByInput = new Map(cases.map(({ input, label }) => [input, label]));
const systemPrompt = [
  'Ordne die fiktive Serviceanfrage genau einer Kategorie zu.',
  'Rueckruf = Bitte um Rückruf. Terminwunsch = einen konkreten Termin vereinbaren.',
  'Servicefrage = Frage zum Angebot. Unklar = kein erkennbares Anliegen.',
  'Gib ausschließlich das exakte Kategorienwort aus.',
].join(' ');
const models = { anthropic: 'claude-haiku-4-5-20251001', openai: 'gpt-4.1-mini' };
const scenarios = ['normal', 'connect_refused', 'primary_429', 'primary_401', 'both_unavailable'];

function asCategory(output) {
  const value = typeof output === 'string' ? output.trim() : null;
  return labels.includes(value) ? value : null;
}

function readUsage(usage) {
  if (!usage || !Number.isSafeInteger(usage.prompt_tokens) || usage.prompt_tokens < 0 ||
      !Number.isSafeInteger(usage.completion_tokens) || usage.completion_tokens < 0) return null;
  return { input_tokens: usage.prompt_tokens, output_tokens: usage.completion_tokens };
}

function chatResponse(label, model) {
  return Response.json({
    model,
    choices: [{ message: { content: label } }],
    usage: { prompt_tokens: 40, completion_tokens: 3 },
  });
}

function makeProviderStub(scenario, attempts) {
  return async (url, { body }) => {
    const provider = {
      'https://anthropic.invalid/v1/messages': 'anthropic',
      'https://openai.invalid/v1/chat/completions': 'openai',
    }[url];
    assert.ok(provider, 'Unexpected upstream destination');

    const request = JSON.parse(body);
    assert.equal(request.model, models[provider]);
    assert.equal(request.max_tokens, 16);
    assert.equal(request.temperature, 0);
    const prompt = provider === 'anthropic'
      ? request.system.map(({ text }) => text).join('\n')
      : request.messages[0].content;
    assert.equal(prompt, systemPrompt);
    const label = labelsByInput.get(request.messages.at(-1)?.content);
    assert.ok(label, 'Expected a known synthetic case');

    const attempt = { provider, model: models[provider], status: 'ok' };
    attempts.push(attempt);
    if (scenario === 'both_unavailable' || (provider === 'anthropic' && scenario === 'connect_refused')) {
      attempt.status = 'connect_refused';
      throw new TypeError('fetch failed');
    }
    if (provider === 'anthropic' && ['primary_429', 'primary_401'].includes(scenario)) {
      const status = scenario === 'primary_429' ? 429 : 401;
      attempt.status = String(status);
      return Response.json({ error: { message: 'Anthropic HTTP '+status } }, { status });
    }
    if (provider === 'openai') return chatResponse(label, models.openai);
    return Response.json({
      model: models.anthropic,
      content: [{ type: 'text', text: label }],
      usage: { input_tokens: 40, output_tokens: 3 },
    });
  };
}

async function runDirect(testCase, scenario, attempts, requestId) {
  const fetchImpl = makeProviderStub(scenario, attempts);
  const gateway = new ServerAiGateway({
    lmStudioBaseUrl: 'https://local.invalid',
    anthropicConfig: {
      baseUrl: 'https://anthropic.invalid', apiKey: 'fixture', model: models.anthropic, fetchImpl,
    },
    openaiConfig: {
      baseUrl: 'https://openai.invalid', apiKey: 'fixture', model: models.openai, fetchImpl,
    },
  });
  try {
    return (await gateway.generate({
      feature: 'omniroute_pilot',
      task_type: 'classify',
      model_profile: 'cloud-fallback',
      input: testCase.input,
      system_prompt: systemPrompt,
      max_tokens: 16,
      temperature: 0,
      trace_id: requestId,
    })).output;
  } catch (error) {
    if (error instanceof AssertionError) throw error;
    return null;
  }
}

// A deterministic comparison fixture for the proposed retry rules.
async function runFallbackFixture(testCase, scenario, attempts) {
  const providerFetch = makeProviderStub(scenario, attempts);
  const message = { role: 'user', content: testCase.input };
  const common = { max_tokens: 16, temperature: 0 };
  let primary;
  try {
    primary = await providerFetch('https://anthropic.invalid/v1/messages', { body: JSON.stringify({
      ...common, model: models.anthropic, system: [{ type: 'text', text: systemPrompt }], messages: [message],
    }) });
  } catch (error) {
    if (error instanceof AssertionError) throw error;
    if (attempts.at(-1)?.status !== 'connect_refused') return null;
  }
  if (primary?.ok) return (await primary.json()).content[0].text;
  if (primary && primary.status !== 429) return null;

  try {
    const fallback = await providerFetch('https://openai.invalid/v1/chat/completions', { body: JSON.stringify({
      ...common, model: models.openai, messages: [{ role: 'system', content: systemPrompt }, message],
    }) });
    return fallback.ok ? (await fallback.json()).choices[0].message.content : null;
  } catch (error) {
    if (error instanceof AssertionError) throw error;
    return null;
  }
}

async function runFixture() {
  assert.equal(labelsByInput.size, 100);
  for (const label of labels) assert.equal(cases.filter((item) => item.label === label).length, 25);
  assert.equal(asCategory('Rueckruf und Terminwunsch'), null);
  assert.equal(asCategory({ label: 'Rueckruf' }), null);
  assert.equal(readUsage({ prompt_tokens: 0, completion_tokens: 0 }).output_tokens, 0);
  assert.equal(readUsage({ prompt_tokens: 40 }), null);

  const expected = {
    normal: [[100, 100], [100, 100]],
    connect_refused: [[100, 200], [100, 200]],
    primary_429: [[0, 100], [100, 200]],
    primary_401: [[0, 100], [0, 100]],
    both_unavailable: [[0, 200], [0, 200]],
  };
  const observations = {};
  for (const scenario of scenarios) {
    observations[scenario] = {};
    const routes = { realsync_router: runDirect, fallback_fixture: runFallbackFixture };
    for (const [index, [name, run]] of Object.entries(routes).entries()) {
      let correct = 0;
      let attemptsTotal = 0;
      for (const testCase of cases) {
        const attempts = [];
        const requestId = randomUUID();
        const output = asCategory(await run(testCase, scenario, attempts, requestId));
        if (output !== null) assert.equal(output, testCase.label);
        correct += Number(output === testCase.label);
        const shouldFallback = ['connect_refused', 'both_unavailable'].includes(scenario) ||
          (scenario === 'primary_429' && name === 'fallback_fixture');
        assert.deepEqual(attempts.map(({ provider }) => provider),
          shouldFallback ? ['anthropic', 'openai'] : ['anthropic']);
        attemptsTotal += attempts.length;
      }
      assert.deepEqual([correct, attemptsTotal], expected[scenario][index]);
      observations[scenario][name] = { requests: cases.length, correct, upstream_attempts: attemptsTotal };
    }
  }
  console.log(JSON.stringify({
    mode: 'offline_fixture',
    scenarios: observations,
    external_requests: 0,
    measured_provider_cost: null,
    decision: 'LIVE_COMPARISON_PENDING',
  }, null, 2));
}

async function probeLocalOmniRoute({ port, combo }) {
  const key = process.env.OMNIROUTE_PILOT_API_KEY;
  if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535 ||
      !/^[a-zA-Z0-9._/-]{1,100}$/.test(combo) || !key) {
    throw new Error('Für die lokale Probe sind Port, Combo und OMNIROUTE_PILOT_API_KEY erforderlich.');
  }
  const fixture = cases[0];
  const started = performance.now();
  const response = await fetch('http://127.0.0.1:'+Number(port)+'/v1/chat/completions', {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
    headers: { authorization: 'Bearer '+key, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: combo,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: fixture.input },
      ],
      max_tokens: 16,
      temperature: 0,
      stream: false,
    }),
  });
  if (!response.ok) throw new Error('Lokaler Endpunkt meldete HTTP '+response.status+'.');
  const responseBody = await response.json();
  const correct = asCategory(responseBody.choices?.[0]?.message?.content) === fixture.label;
  console.log(JSON.stringify({
    mode: 'local_endpoint_probe',
    correct,
    elapsed_ms: Math.round(performance.now() - started),
    usage: readUsage(responseBody.usage),
    decision: 'LIVE_COMPARISON_PENDING',
  }, null, 2));
  if (!correct) process.exitCode = 1;
}

try {
  const { values } = parseArgs({
    options: {
      'probe-local': { type: 'boolean' },
      port: { type: 'string', default: '20128' },
      combo: { type: 'string', default: '' },
    },
  });
  if (values['probe-local']) await probeLocalOmniRoute(values);
  else await runFixture();
} catch (error) {
  if (process.argv.includes('--probe-local')) {
    // Print no raw provider responses, URLs, configured secrets or exception stack.
    console.error('Die lokale OmniRoute-Probe konnte nicht abgeschlossen werden.');
  } else {
    console.error(error);
  }
  process.exitCode = 1;
}
