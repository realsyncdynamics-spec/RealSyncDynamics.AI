/**
 * OpenClaw-Agent — OpenAI-Call mit Tool-Routing-Loop.
 *
 * Bis zu MAX_TOOL_ITERATIONS Tool-Round-Trips, danach Force-Final-Answer.
 * Verhindert Endlos-Schleifen wenn das Modell Tools immer wieder aufruft.
 */

import OpenAI from 'openai';
import { OPENCLAW_TOOLS, executeTool } from './tools.js';
import { assertCapNotExceeded, recordUsage } from './cost-cap.js';
import type { ChatResponse } from './types.js';

const MAX_TOOL_ITERATIONS = 4;
const MAX_TOKENS_PER_RESPONSE = 800;
const MODEL = 'gpt-4o-mini';

const SYSTEM_PROMPT = `Du bist OpenClaw, ein deutscher Compliance- und AI-Act-Agent fuer
RealSyncDynamicsAI. Antworte praezise, geschaeftlich, rechtlich vorsichtig.

Regeln:
- Antworte auf Deutsch.
- Bei DSGVO / TTDSG / AI-Act-Fragen: nutze die Tools (lookup_dsgvo_paragraph,
  classify_ai_system_risk, check_pre_consent_tracker) bevor du antwortest.
- Strukturiere komplexe Antworten klar (Bullets oder nummerierte Schritte).
- Gib konkrete naechste Schritte am Ende.
- Erinnere bei rechtskritischen Themen explizit: "Dies ersetzt keine
  individuelle anwaltliche Pruefung."
- Kein Marketing-Sprech, keine Versprechen.`;

let openaiClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openaiClient) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY env var missing');
    openaiClient = new OpenAI({ apiKey: key });
  }
  return openaiClient;
}

export async function runAgent(
  userMessage: string,
  context: Record<string, unknown> = {},
): Promise<ChatResponse> {
  assertCapNotExceeded();

  const client = getClient();
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'system',
      content: `Aktueller Kontext (aus Caller):\n${JSON.stringify(context, null, 2)}`,
    },
    { role: 'user', content: userMessage },
  ];

  let toolCallsMade = 0;
  let totalUsage: ChatResponse['usage'] = {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  };

  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      max_tokens: MAX_TOKENS_PER_RESPONSE,
      messages,
      tools: OPENCLAW_TOOLS,
      // Letzte Iteration: erzwinge Final-Answer (kein Tool mehr).
      tool_choice: iter === MAX_TOOL_ITERATIONS - 1 ? 'none' : 'auto',
    });

    if (completion.usage) {
      totalUsage.prompt_tokens =
        (totalUsage.prompt_tokens ?? 0) + (completion.usage.prompt_tokens ?? 0);
      totalUsage.completion_tokens =
        (totalUsage.completion_tokens ?? 0) + (completion.usage.completion_tokens ?? 0);
      totalUsage.total_tokens =
        (totalUsage.total_tokens ?? 0) + (completion.usage.total_tokens ?? 0);
      recordUsage(completion.usage.total_tokens ?? 0);
    }

    const choice = completion.choices[0];
    const msg = choice.message;

    // Final-Answer: kein tool_calls -> wir sind fertig.
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return {
        ok: true,
        answer: msg.content ?? 'Keine Antwort generiert.',
        tool_calls_made: toolCallsMade,
        usage: totalUsage,
      };
    }

    // Push assistant-message + tool-results und Loop
    messages.push(msg);
    for (const toolCall of msg.tool_calls) {
      if (toolCall.type !== 'function') continue;
      toolCallsMade += 1;
      let toolArgs: Record<string, unknown> = {};
      try {
        toolArgs = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
      } catch {
        // ungueltige args -> leeres Objekt, Tool reagiert defensiv
      }
      const toolResult = await executeTool(toolCall.function.name, toolArgs);
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: toolResult,
      });
    }
  }

  // Sollte durch tool_choice='none' im letzten iter nicht erreicht werden,
  // aber als Safety-Net.
  return {
    ok: true,
    answer:
      'Maximale Tool-Iterations erreicht. Bitte Anfrage konkreter formulieren.',
    tool_calls_made: toolCallsMade,
    usage: totalUsage,
  };
}
