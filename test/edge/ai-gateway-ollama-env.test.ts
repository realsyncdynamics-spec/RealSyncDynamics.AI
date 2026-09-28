import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../..');
const source = readFileSync(
  resolve(root, 'supabase/functions/_shared/aiGateway/serverFromEnv.ts'),
  'utf8',
);

describe('ai-gateway Ollama env compatibility', () => {
  it('accepts OLLAMA_URL as fallback for OLLAMA_BASE_URL', () => {
    expect(source).toContain("Deno.env.get('OLLAMA_BASE_URL') ?? Deno.env.get('OLLAMA_URL')");
  });

  it('passes existing OLLAMA_AUTH_TOKEN into the Ollama adapter', () => {
    expect(source).toContain("authToken: Deno.env.get('OLLAMA_AUTH_TOKEN') ?? undefined");
  });

  it('supports an explicit OLLAMA_AUTH_MODE override', () => {
    expect(source).toContain("parseOllamaAuthMode(Deno.env.get('OLLAMA_AUTH_MODE'))");
    expect(source).toContain("normalized === 'basic' || normalized === 'bearer'");
  });
});
