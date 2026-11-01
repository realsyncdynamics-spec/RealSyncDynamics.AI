#!/usr/bin/env node
/**
 * Anthropic prompt-cache smoke test with synthetic, non-tenant text.
 * Calls Anthropic directly; does NOT validate RSD Edge deployment.
 * Requires an isolated Anthropic test-workspace API key and explicit opt-in.
 * No secret values or prompt content are logged.
 *
 * Preview: node scripts/probe-anthropic-cache.mjs --dry-run
 * Live (2 paid API calls): set ANTHROPIC_API_KEY and
 * RSD_CACHE_PROBE_CONFIRM=YES in your shell, then run the script.
 */
import { randomUUID } from 'node:crypto';

const dryRun = process.argv.includes('--dry-run');
const model = process.env.ANTHROPIC_PROBE_MODEL || 'claude-sonnet-5-5';
const maxTokens = 24;
const prefix = `RSD synthetic prompt-cache acceptance probe ${randomUUID()}.\n` +
  Array.from({ length: 100 }, (_, n) =>
    `Synthetic compliance instruction ${n + 1}: Explain the difference between evidence, ` +
    'authorization, operational controls, periodic verification, retention, and audit traceability. ' +
    'No customer records, credentials, user identifiers, or real tenant content are present.'
  ).join('\n');

function makeBody(userInput) {
  return {
    model,
    max_tokens: maxTokens,
    system: [{ type: 'text', text: prefix, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userInput }],
  };
}

if (dryRun) {
  console.log(JSON.stringify({
    mode: 'dry-run',
    model,
    count: 2,
    syntheticPrefixCharacters: prefix.length,
    caching: '5m ephemeral',
    realCalls: 0,
    note: 'Exact cacheable token count is determined by Anthropic; this is not a cache-hit result.',
  }, null, 2));
  process.exit(0);
}

if (process.env.RSD_CACHE_PROBE_CONFIRM !== 'YES') {
  console.error('Not run: set RSD_CACHE_PROBE_CONFIRM=YES to authorize two paid synthetic API calls.');
  process.exit(2);
}
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('Not run: ANTHROPIC_API_KEY not set; use an isolated test-workspace key.');
  process.exit(2);
}

async function send(message) {
  const sentAt = new Date().toISOString();
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(makeBody(message)),
    signal: AbortSignal.timeout(30_000),
  });
  // Evidence fields: Anthropic request id (safe to log, no secret) and timestamps.
  const requestId = resp.headers.get('request-id') || null;
  if (!resp.ok) {
    // Only the documented error type is logged; never the message body, prompt or key.
    const errType = await resp.json().then((j) => j?.error?.type ?? null).catch(() => null);
    console.error(`Anthropic request failed: HTTP ${resp.status}, error_type=${errType}, request_id=${requestId}. No prompt or API key logged.`);
    process.exit(1);
  }
  const json = await resp.json();
  const usage = json?.usage || {};
  return {
    request_id: requestId,
    response_model: json?.model ?? null,
    sent_at: sentAt,
    received_at: new Date().toISOString(),
    input_tokens: usage.input_tokens ?? 0,
    output_tokens: usage.output_tokens ?? 0,
    cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
  };
}

try {
  // Sequential requests: first response must begin before a cached read.
  const first = await send('Reply with just the word READY.');
  const second = await send('Reply with just the word CONFIRMED.');
  console.log(JSON.stringify({
    probe_version: 2,
    model,
    first,
    second,
    cache_write_observed: first.cache_creation_input_tokens > 0,
    cache_hit_observed: second.cache_read_input_tokens > 0,
    note: 'API-level probe only; test the RSD integration separately on staging.',
  }, null, 2));
  if (first.cache_creation_input_tokens <= 0 || second.cache_read_input_tokens <= 0) {
    console.error('Cache acceptance failed: expected first write and second read were not observed.');
    process.exitCode = 1;
  }
} catch (err) {
  console.error(`Anthropic probe failed (${err instanceof Error ? err.name : 'unknown error'}); no secrets logged.`);
  process.exitCode = 1;
}
