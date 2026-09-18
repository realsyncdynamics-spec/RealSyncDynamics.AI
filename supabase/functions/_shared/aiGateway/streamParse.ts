/**
 * Token-stream parsers for OpenAI-compat SSE and Anthropic SSE.
 * Deno mirror of src/core/ai-gateway/streamParse.ts.
 */

export interface ParsedDelta {
  text?: string;
  model?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
}

export async function* parseOpenAiSse(body: ReadableStream<Uint8Array>): AsyncGenerator<ParsedDelta> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') {
        if (data === '[DONE]') return;
        continue;
      }
      let json: {
        model?: string;
        choices?: Array<{ delta?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };
      try {
        json = JSON.parse(data) as typeof json;
      } catch {
        continue;
      }
      const text = json.choices?.[0]?.delta?.content;
      const out: ParsedDelta = {};
      if (typeof text === 'string' && text.length > 0) out.text = text;
      if (json.model) out.model = json.model;
      if (json.usage) {
        out.usage = {
          input_tokens: json.usage.prompt_tokens,
          output_tokens: json.usage.completion_tokens,
          total_tokens: json.usage.total_tokens,
        };
      }
      if (out.text || out.usage || out.model) yield out;
    }
  }
}

export async function* parseAnthropicSse(body: ReadableStream<Uint8Array>): AsyncGenerator<ParsedDelta> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (!data) continue;
      let json: {
        type?: string;
        delta?: { type?: string; text?: string };
        message?: { model?: string; usage?: { input_tokens?: number; output_tokens?: number } };
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      try {
        json = JSON.parse(data) as typeof json;
      } catch {
        continue;
      }
      if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta' && json.delta.text) {
        yield { text: json.delta.text };
      }
      if (json.type === 'message_start' && json.message) {
        const u = json.message.usage;
        yield {
          model: json.message.model,
          usage: u
            ? { input_tokens: u.input_tokens, output_tokens: u.output_tokens, total_tokens: (u.input_tokens ?? 0) + (u.output_tokens ?? 0) }
            : undefined,
        };
      }
      if (json.type === 'message_delta' && json.usage) {
        yield {
          usage: {
            output_tokens: json.usage.output_tokens,
            input_tokens: json.usage.input_tokens,
            total_tokens: (json.usage.input_tokens ?? 0) + (json.usage.output_tokens ?? 0),
          },
        };
      }
    }
  }
}
