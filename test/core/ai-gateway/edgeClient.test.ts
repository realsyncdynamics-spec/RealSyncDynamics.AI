import { describe, it, expect, vi } from 'vitest';
import {
  AiGatewayEdgeClient,
  AiGatewayEdgeError,
  type EdgeSuccessEnvelope,
  type EdgeErrorEnvelope,
} from '../../../src/core/ai-gateway/edgeClient';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function makeClient(fetchImpl: typeof fetch) {
  return new AiGatewayEdgeClient({
    supabaseUrl: 'https://example.supabase.co',
    apiKey: 'anon-test',
    fetchImpl,
  });
}

function callOf(fetchImpl: ReturnType<typeof vi.fn>): [string, RequestInit] {
  const call = fetchImpl.mock.calls[0];
  if (!call) throw new Error('expected fetchImpl to have been called');
  return call as [string, RequestInit];
}

describe('AiGatewayEdgeClient', () => {
  describe('generate', () => {
    it('returns AiGatewayResponse from a success envelope', async () => {
      const envelope: EdgeSuccessEnvelope<string> = {
        ok: true,
        provider: 'lm_studio',
        model: 'qwen-7b',
        profile: 'fast-local',
        output: 'hello there',
        usage: { input_tokens: 12, output_tokens: 4, total_tokens: 16 },
        trace_id: 't-1',
        latency_ms: 42,
      };
      const fetchImpl = vi.fn(async () => jsonResponse(envelope));
      const client = makeClient(fetchImpl);

      const resp = await client.generate({
        feature: 'test',
        task_type: 'chat',
        model_profile: 'fast-local',
        input: 'ping',
      });

      expect(resp.output).toBe('hello there');
      expect(resp.usage?.total_tokens).toBe(16);
      expect(resp.provider).toBe('lm_studio');
    });

    it('posts to the correct /functions/v1/ai-gateway endpoint', async () => {
      const fetchImpl = vi.fn(async () => jsonResponse({
        ok: true, provider: 'lm_studio', model: 'm', profile: 'fast-local',
        output: 'x', trace_id: 't', latency_ms: 1,
      }));
      const client = makeClient(fetchImpl);

      await client.generate({
        feature: 'test',
        task_type: 'chat',
        model_profile: 'fast-local',
        input: 'ping',
      });

      const [url, init] = callOf(fetchImpl);
      expect(url).toBe('https://example.supabase.co/functions/v1/ai-gateway');
      expect(init.method).toBe('POST');
      const body = JSON.parse(init.body as string);
      expect(body.op).toBe('generate');
      expect(body.model_profile).toBe('fast-local');
      const headers = init.headers as Record<string, string>;
      expect(headers.apikey).toBe('anon-test');
      expect(headers.authorization).toBe('Bearer anon-test');
    });

    it('strips trailing slash from supabaseUrl', async () => {
      const fetchImpl = vi.fn(async () => jsonResponse({
        ok: true, provider: 'lm_studio', model: 'm', profile: 'fast-local',
        output: 'x', trace_id: 't', latency_ms: 1,
      }));
      const client = new AiGatewayEdgeClient({
        supabaseUrl: 'https://example.supabase.co/',
        apiKey: 'a',
        fetchImpl,
      });
      await client.generate({ feature: 'f', task_type: 'chat', model_profile: 'fast-local', input: 'p' });
      const [url] = callOf(fetchImpl);
      expect(url).toBe('https://example.supabase.co/functions/v1/ai-gateway');
    });
  });

  describe('extractJson', () => {
    it('sends op=extract_json and returns parsed output', async () => {
      const envelope: EdgeSuccessEnvelope<{ status: string }> = {
        ok: true,
        provider: 'lm_studio',
        model: 'qwen-7b',
        profile: 'strict-json',
        output: { status: 'ok' },
        trace_id: 't-2',
        latency_ms: 50,
      };
      const fetchImpl = vi.fn(async () => jsonResponse(envelope));
      const client = makeClient(fetchImpl);

      const resp = await client.extractJson<{ status: string }>({
        feature: 'test',
        task_type: 'extract_json',
        model_profile: 'strict-json',
        input: 'give me json',
      });

      expect(resp.output).toEqual({ status: 'ok' });
      const [, init] = callOf(fetchImpl);
      const body = JSON.parse(init.body as string);
      expect(body.op).toBe('extract_json');
    });
  });

  describe('embed', () => {
    it('sends op=embed and returns the vector', async () => {
      const fetchImpl = vi.fn(async () => jsonResponse({
        ok: true, provider: 'lm_studio', model: 'bge', profile: 'embed-default',
        output: [0.1, 0.2, 0.3], trace_id: 't', latency_ms: 1,
      }));
      const client = makeClient(fetchImpl);

      const resp = await client.embed({
        feature: 'test',
        task_type: 'embed',
        model_profile: 'embed-default',
        input: 'vector me',
      });

      expect(resp.output).toEqual([0.1, 0.2, 0.3]);
    });
  });

  describe('error handling', () => {
    it('throws AiGatewayEdgeError on a structured error envelope', async () => {
      const envelope: EdgeErrorEnvelope = {
        ok: false,
        error: { code: 'UPSTREAM_UNAVAILABLE', message: 'No LM Studio model available' },
      };
      const fetchImpl = vi.fn(async () => jsonResponse(envelope, 502));
      const client = makeClient(fetchImpl);

      await expect(client.generate({
        feature: 'test',
        task_type: 'chat',
        model_profile: 'fast-local',
        input: 'ping',
      })).rejects.toMatchObject({
        name: 'AiGatewayEdgeError',
        status: 502,
        code: 'UPSTREAM_UNAVAILABLE',
        message: 'No LM Studio model available',
      });
    });

    it('throws BAD_ENVELOPE when the response is not JSON', async () => {
      const fetchImpl = vi.fn(async () => new Response('<html>oh no</html>', { status: 500 }));
      const client = makeClient(fetchImpl);

      await expect(client.generate({
        feature: 'test',
        task_type: 'chat',
        model_profile: 'fast-local',
        input: 'ping',
      })).rejects.toMatchObject({
        name: 'AiGatewayEdgeError',
        status: 500,
        code: 'BAD_ENVELOPE',
      });
    });

    it('propagates AiGatewayEdgeError with the correct properties', async () => {
      try {
        const err = new AiGatewayEdgeError(400, 'BAD_REQUEST', 'unknown model_profile');
        throw err;
      } catch (err) {
        expect(err).toBeInstanceOf(AiGatewayEdgeError);
        expect((err as AiGatewayEdgeError).status).toBe(400);
        expect((err as AiGatewayEdgeError).code).toBe('BAD_REQUEST');
      }
    });
  });
});
