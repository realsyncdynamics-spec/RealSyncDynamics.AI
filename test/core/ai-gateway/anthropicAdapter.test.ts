import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  AnthropicAdapter,
  supportsSamplingParams,
} from '../../../src/core/ai-gateway/providers/anthropicAdapter';
import type { AiGatewayRequest } from '../../../src/core/ai-gateway/types';

function req(over: Partial<AiGatewayRequest> = {}): AiGatewayRequest {
  return {
    feature: 'governance_chat',
    task_type: 'chat',
    model_profile: 'cloud-fallback',
    input: 'Was deckt der DSGVO-Audit ab?',
    ...over,
  };
}

function fakeFetch(opts: { ok?: boolean; status?: number; body?: unknown } = {}): typeof fetch {
  const ok = opts.ok ?? true;
  const status = opts.status ?? 200;
  const body = opts.body ?? {
    id:    'msg_1',
    model: 'claude-haiku-4-5',
    content: [{ type: 'text', text: 'hi back' }],
    usage:   { input_tokens: 10, output_tokens: 4 },
  };
  return vi.fn(async () => ({
    ok,
    status,
    json: async () => body,
  } as unknown as Response)) as unknown as typeof fetch;
}

describe('AnthropicAdapter.health', () => {
  it('returns ok=true when an API key is present', async () => {
    const a = new AnthropicAdapter({ apiKey: 'sk-ant-...', model: 'claude-haiku-4-5' });
    expect(await a.health()).toEqual({ ok: true, models: ['claude-haiku-4-5'] });
  });

  it('returns ok=false when API key is empty', async () => {
    const a = new AnthropicAdapter({ apiKey: '', model: 'claude-haiku-4-5' });
    const h = await a.health();
    expect(h.ok).toBe(false);
    expect(h.error).toMatch(/not set/);
  });
});

describe('AnthropicAdapter.generate', () => {
  it('POSTs to /v1/messages with x-api-key + anthropic-version headers', async () => {
    const f = fakeFetch();
    const a = new AnthropicAdapter({ apiKey: 'sk-ant-test', model: 'claude-haiku-4-5', fetchImpl: f });
    await a.generate(req());

    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect((init as RequestInit).method).toBe('POST');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-ant-test');
    expect(headers['anthropic-version']).toBe('2023-06-01');
  });

  it('returns the assistant text + usage', async () => {
    const a = new AnthropicAdapter({
      apiKey: 'k', model: 'claude-haiku-4-5',
      fetchImpl: fakeFetch({ body: {
        id: 'msg_2', model: 'claude-haiku-4-5',
        content: [{ type: 'text', text: 'Antwort A' }, { type: 'text', text: 'Antwort B' }],
        usage: { input_tokens: 12, output_tokens: 8, cache_creation_input_tokens: 4 },
      }}),
    });
    const out = await a.generate(req());
    expect(out.provider).toBe('anthropic');
    expect(out.output).toBe('Antwort A\nAntwort B');
    expect(out.usage?.input_tokens).toBe(12 + 4);     // cache-creation counts toward input
    expect(out.usage?.output_tokens).toBe(8);
  });

  /** Liest den an fetch uebergebenen Request-Body. */
  function gesendeterBody(f: typeof fetch): Record<string, unknown> {
    const aufruf = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    return JSON.parse(aufruf.body as string) as Record<string, unknown>;
  }

  // Frueher stand hier die Zusicherung, `temperature` werde fuer
  // claude-haiku-4-5-20251001 weggelassen — "Claude 4.x Deprecation". Das
  // war falsch und hat den Fehler festgeschrieben: Haiku 4.5 nimmt den
  // Parameter an, und das ist das Standardmodell dieses Adapters. Der
  // Aufrufer bekam seine temperature also still verworfen.
  it('sendet temperature an Haiku 4.5 — das Standardmodell', async () => {
    const f = fakeFetch();
    const a = new AnthropicAdapter({ apiKey: 'k', model: 'claude-haiku-4-5-20251001', fetchImpl: f });
    await a.generate(req({ temperature: 0.5 }));
    expect(gesendeterBody(f).temperature).toBe(0.5);
  });

  it('does pass temperature for legacy model ids', async () => {
    const f = fakeFetch();
    const a = new AnthropicAdapter({ apiKey: 'k', model: 'claude-3-5-sonnet-20241022', fetchImpl: f });
    await a.generate(req({ temperature: 0.7 }));
    expect(gesendeterBody(f).temperature).toBe(0.7);
  });

  // Der eigentliche Grund fuer diesen Fix: die alte Regex verlangte ein
  // "-4" in der Id und griff deshalb bei den 5er-Modellen nicht. Dort sind
  // die Sampling-Parameter entfernt, die API antwortet mit HTTP 400 — der
  // Fehler waere erst beim Modellwechsel aufgetreten, dann aber sofort bei
  // jedem Aufruf.
  it.each(['claude-sonnet-5', 'claude-opus-5', 'claude-opus-4-8', 'claude-opus-4-7'])(
    'laesst temperature bei %s weg (dort mit 400 abgelehnt)',
    async (model) => {
      const f = fakeFetch();
      const a = new AnthropicAdapter({ apiKey: 'k', model, fetchImpl: f });
      await a.generate(req({ temperature: 0.5 }));
      expect('temperature' in gesendeterBody(f)).toBe(false);
    },
  );

  it.each(['claude-haiku-4-5', 'claude-sonnet-4-6', 'claude-opus-4-6'])(
    'sendet temperature an %s',
    async (model) => {
      const f = fakeFetch();
      const a = new AnthropicAdapter({ apiKey: 'k', model, fetchImpl: f });
      await a.generate(req({ temperature: 0.5 }));
      expect(gesendeterBody(f).temperature).toBe(0.5);
    },
  );

  it('throws when the API returns an error envelope', async () => {
    const a = new AnthropicAdapter({
      apiKey: 'k', model: 'claude-haiku-4-5',
      fetchImpl: fakeFetch({ ok: false, status: 401, body: { error: { message: 'invalid x-api-key' } } }),
    });
    await expect(a.generate(req())).rejects.toThrow(/invalid x-api-key/);
  });

  it('attaches system_prompt with cache_control: ephemeral', async () => {
    const f = fakeFetch();
    const a = new AnthropicAdapter({ apiKey: 'k', model: 'claude-haiku-4-5', fetchImpl: f });
    await a.generate(req({ system_prompt: 'You are the RealSync compliance assistant.' }));
    const body = JSON.parse(((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit).body as string);
    expect(body.system).toEqual([
      { type: 'text', text: 'You are the RealSync compliance assistant.', cache_control: { type: 'ephemeral' } },
    ]);
  });
});

describe('AnthropicAdapter.extractJson', () => {
  it('returns parsed JSON when the model emits valid JSON', async () => {
    const a = new AnthropicAdapter({
      apiKey: 'k', model: 'claude-haiku-4-5',
      fetchImpl: fakeFetch({ body: {
        id: 'msg', model: 'claude-haiku-4-5',
        content: [{ type: 'text', text: '{"verdict":"compliant","score":92}' }],
        usage: { input_tokens: 5, output_tokens: 6 },
      }}),
    });
    const out = await a.extractJson<{ verdict: string; score: number }>(req({ task_type: 'extract_json' }));
    expect(out.output).toEqual({ verdict: 'compliant', score: 92 });
  });

  it('throws when the response is not valid JSON', async () => {
    const a = new AnthropicAdapter({
      apiKey: 'k', model: 'claude-haiku-4-5',
      fetchImpl: fakeFetch({ body: {
        id: 'msg', model: 'claude-haiku-4-5',
        content: [{ type: 'text', text: 'I think it is mostly compliant.' }],
        usage: { input_tokens: 5, output_tokens: 6 },
      }}),
    });
    await expect(a.extractJson(req({ task_type: 'extract_json' }))).rejects.toThrow(/invalid JSON/);
  });
});

describe('AnthropicAdapter.embed', () => {
  it('throws — Anthropic offers no embeddings API', async () => {
    const a = new AnthropicAdapter({ apiKey: 'k', model: 'claude-haiku-4-5' });
    await expect(a.embed(req({ task_type: 'embed' }))).rejects.toThrow(/no embeddings API/);
  });
});

describe('supportsSamplingParams', () => {
  // Die Grenze verlaeuft bei 4.6: bis dahin akzeptiert, ab 4.7 entfernt.
  it.each([
    'claude-haiku-4-5-20251001',
    'claude-haiku-4-5',
    'claude-sonnet-4-5',
    'claude-sonnet-4-6',
    'claude-opus-4-6',
  ])('%s akzeptiert die Parameter', (id) => {
    expect(supportsSamplingParams(id)).toBe(true);
  });

  it.each([
    'claude-opus-4-7',
    'claude-opus-4-8',
    'claude-opus-5',
    'claude-sonnet-5',
  ])('%s akzeptiert sie nicht', (id) => {
    expect(supportsSamplingParams(id)).toBe(false);
  });

  it('kennt die alte Namensform, bei der die Familie hinter der Version steht', () => {
    expect(supportsSamplingParams('claude-3-5-sonnet-20241022')).toBe(true);
    expect(supportsSamplingParams('claude-3-opus-20240229')).toBe(true);
  });

  it('liest ein Datumssuffix nicht als Minor-Version', () => {
    // Ohne diese Unterscheidung waere claude-sonnet-4-20250514 die
    // Version 4.20250514 und damit faelschlich oberhalb der Grenze.
    expect(supportsSamplingParams('claude-sonnet-4-20250514')).toBe(true);
  });

  it('haelt Unbekanntes fuer nicht unterstuetzt', () => {
    // Sichere Richtung: ein weggelassener Parameter kostet Steuerbarkeit,
    // ein faelschlich gesendeter bricht den Aufruf mit 400.
    for (const id of ['claude-fable-5-1', 'claude-mythos-5-1', '', 'irgendwas']) {
      expect(supportsSamplingParams(id), id).toBe(false);
    }
  });

  it('ist gegen Schreibweise und Leerraum unempfindlich', () => {
    expect(supportsSamplingParams('  CLAUDE-OPUS-5  ')).toBe(false);
    expect(supportsSamplingParams('  Claude-Haiku-4-5 ')).toBe(true);
  });
});

describe('Frontend- und Edge-Kopie bleiben in Deckung', () => {
  // anthropicAdapter.ts existiert zweimal: als Quelle unter src/ und als
  // Deno-Spiegel unter supabase/functions/_shared/. Getestet wird nur die
  // erste. Laufen sie auseinander, prueft dieser Test eine Regel, die in
  // der Produktion nicht gilt — und genau das ist die Klasse von Fehler,
  // die dieser PR behebt.
  const ROOT = resolve(__dirname, '../../..');

  function praedikat(pfad: string): string {
    const quelle = readFileSync(resolve(ROOT, pfad), 'utf8');
    const start = quelle.indexOf('export function supportsSamplingParams');
    expect(start, `supportsSamplingParams fehlt in ${pfad}`).toBeGreaterThanOrEqual(0);
    let tiefe = 0;
    for (let i = quelle.indexOf('{', start); i < quelle.length; i += 1) {
      if (quelle[i] === '{') tiefe += 1;
      else if (quelle[i] === '}') {
        tiefe -= 1;
        if (tiefe === 0) return quelle.slice(start, i + 1);
      }
    }
    throw new Error(`Funktionsende nicht gefunden in ${pfad}`);
  }

  it('supportsSamplingParams ist in beiden Kopien zeichengleich', () => {
    expect(praedikat('supabase/functions/_shared/aiGateway/anthropicAdapter.ts'))
      .toBe(praedikat('src/core/ai-gateway/providers/anthropicAdapter.ts'));
  });

  it('beide Kopien rufen das Praedikat auf, statt eine eigene Regex zu fahren', () => {
    for (const pfad of [
      'src/core/ai-gateway/providers/anthropicAdapter.ts',
      'supabase/functions/_shared/aiGateway/anthropicAdapter.ts',
    ]) {
      const quelle = readFileSync(resolve(ROOT, pfad), 'utf8');
      expect(quelle, pfad).toContain('if (supportsSamplingParams(this.config.model))');
      // Kommentarfrei pruefen: der Doc-Block von supportsSamplingParams
      // zitiert die alte Regel absichtlich, um sie zu erklaeren. Eine
      // Zusicherung, die Prosa mitliest, schlaegt daran fehl.
      const code = quelle
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
      expect(code, pfad).not.toContain('!/^claude-(opus|sonnet|haiku)-4/');
    }
  });
});
