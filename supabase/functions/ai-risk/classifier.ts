/**
 * Anthropic Haiku 4.5 classifier for the ai-risk-agent.
 *
 * Uses the Anthropic Messages API with tool_choice forcing the model to
 * emit structured output via the classify_ai_system tool. Defensive
 * runtime validation in classifyResponse() — the JSON-schema in the tool
 * is a hint, not a guarantee.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * Migration to AWS Bedrock (eu-central-1 / eu-west-1, future ADR):
 *
 *   Bedrock is NOT a drop-in for ANTHROPIC_API_URL + Authorization swap.
 *   The migration path involves:
 *
 *   1. AWS SigV4 request signing (Authorization header is replaced by a
 *      multi-line SigV4 signature derived from the request body, IAM
 *      access-key, secret, and region).
 *   2. Endpoint shape changes: POST to either
 *        /model/anthropic.claude-haiku-4-5-20251001-v1:0/invoke
 *      (InvokeModel) or to the Converse API
 *        /model/anthropic.claude-haiku-4-5.../converse
 *      AWS now recommends Converse as the unified Messages interface.
 *   3. Request body: drop the model field (it's in the URL), and add
 *        anthropic_version: "bedrock-2023-05-31"
 *      System prompts move from top-level "system" to system blocks in the
 *      Converse API. Tool definitions use Bedrock's tool-spec format
 *      (toolConfig.tools[].toolSpec.inputSchema).
 *   4. Streaming and tool-use are supported but with different SSE envelopes.
 *   5. IAM model-access must be enabled per-region in the AWS console.
 *
 *   Concretely: classifier.ts would split into anthropic-direct.ts and
 *   bedrock.ts behind a small interface, and the env switch
 *   AI_RISK_PROVIDER=anthropic|bedrock chooses which. Plan as ADR-003 when
 *   data-residency contracts demand AWS-only inference for EU customers.
 * ───────────────────────────────────────────────────────────────────────────
 */

import { SYSTEM_PROMPT } from "./prompt.ts";

// ─── Config ────────────────────────────────────────────────────────────────

export const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_VERSION = "2023-06-01";
export const MODEL_ID = "claude-haiku-4-5-20251001";
export const MAX_TOKENS = 512;
export const REQUEST_TIMEOUT_MS = 25_000;

const TIERS = ["minimal", "limited", "high", "prohibited"] as const;
export type RiskTier = (typeof TIERS)[number];

const REASON_PATTERN = /^[a-z0-9_]+$/;
const REASONS_MIN = 1;
const REASONS_MAX = 4;

const TOOL_NAME = "classify_ai_system";

const CLASSIFIER_TOOL = {
  name: TOOL_NAME,
  description:
    "Emit the EU AI Act risk classification for the supplied AI system payload.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["risk_tier", "reasons"],
    properties: {
      risk_tier: { type: "string", enum: [...TIERS] },
      reasons: {
        type: "array",
        minItems: REASONS_MIN,
        maxItems: REASONS_MAX,
        items: { type: "string", pattern: "^[a-z0-9_]+$" },
      },
    },
  },
};

// ─── Errors ────────────────────────────────────────────────────────────────

export class ClassifierError extends Error {
  override cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "ClassifierError";
    this.cause = cause;
  }
}

// ─── Public types ──────────────────────────────────────────────────────────

export interface ClassifyResult {
  risk_tier: RiskTier;
  reasons: string[];
  raw: {
    model: string;
    stop_reason: string | null;
    input_tokens: number | null;
    output_tokens: number | null;
    latency_ms: number;
    healthcheck?: true;
  };
}

// ─── Healthcheck shortcut ──────────────────────────────────────────────────

/**
 * Returns a free, deterministic response without an Anthropic call when the
 * payload has `_healthcheck: true`. Used by the eval-workflow preflight
 * step so reachability can be probed without burning tokens.
 *
 * The healthcheck path is still gated by Bearer-Auth in index.ts, so it
 * cannot be abused from the public internet.
 */
function isHealthcheck(payload: Record<string, unknown>): boolean {
  return payload._healthcheck === true;
}

function healthcheckResult(): ClassifyResult {
  return {
    risk_tier: "minimal",
    reasons: ["healthcheck"],
    raw: {
      model: MODEL_ID,
      stop_reason: "healthcheck",
      input_tokens: 0,
      output_tokens: 0,
      latency_ms: 0,
      healthcheck: true,
    },
  };
}

// ─── Anthropic call ────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
type AnthropicResponse = any;

interface RawContentBlock {
  type: string;
  name?: string;
  input?: unknown;
}

interface RawUsage {
  input_tokens?: number;
  output_tokens?: number;
}

export async function classify(
  payload: Record<string, unknown>,
  apiKey: string,
): Promise<ClassifyResult> {
  if (isHealthcheck(payload)) {
    return healthcheckResult();
  }

  const start = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL_ID,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        tool_choice: { type: "tool", name: TOOL_NAME },
        tools: [CLASSIFIER_TOOL],
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Classify this AI system. Return only via the ${TOOL_NAME} tool.\n\nPayload (JSON):\n${
                  JSON.stringify(payload)
                }`,
              },
            ],
          },
        ],
      }),
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new ClassifierError(
        `Anthropic API request timed out after ${REQUEST_TIMEOUT_MS}ms`,
        e,
      );
    }
    throw new ClassifierError(
      `Anthropic API request failed: ${e instanceof Error ? e.message : String(e)}`,
      e,
    );
  } finally {
    clearTimeout(timeout);
  }

  const latency_ms = Date.now() - start;

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ClassifierError(
      `Anthropic API returned HTTP ${res.status}`,
      { status: res.status, body: text },
    );
  }

  let body: AnthropicResponse;
  try {
    body = await res.json();
  } catch (e) {
    throw new ClassifierError("Anthropic API returned invalid JSON", e);
  }

  return parseAnthropicResponse(body, latency_ms);
}

// ─── Response validation ───────────────────────────────────────────────────

export function parseAnthropicResponse(
  body: AnthropicResponse,
  latency_ms: number,
): ClassifyResult {
  const content: RawContentBlock[] = Array.isArray(body?.content)
    ? body.content
    : [];
  const toolUseBlock = content.find((b) => b?.type === "tool_use");

  if (!toolUseBlock) {
    throw new ClassifierError(
      "Anthropic response did not contain a tool_use block",
      { content },
    );
  }

  if (toolUseBlock.name !== TOOL_NAME) {
    throw new ClassifierError(
      `Unexpected tool name from model: ${toolUseBlock.name ?? "undefined"}`,
      { expected: TOOL_NAME, received: toolUseBlock.name },
    );
  }

  const input = toolUseBlock.input;
  if (!input || typeof input !== "object") {
    throw new ClassifierError("tool_use.input is not an object", { input });
  }

  const { risk_tier, reasons } = input as {
    risk_tier?: unknown;
    reasons?: unknown;
  };

  if (typeof risk_tier !== "string" || !(TIERS as readonly string[]).includes(risk_tier)) {
    throw new ClassifierError(
      `Invalid risk_tier from model: ${String(risk_tier)}`,
      { received: risk_tier, allowed: TIERS },
    );
  }

  if (
    !Array.isArray(reasons) ||
    reasons.length < REASONS_MIN ||
    reasons.length > REASONS_MAX ||
    reasons.some((r) => typeof r !== "string" || !REASON_PATTERN.test(r))
  ) {
    throw new ClassifierError(
      `Invalid reasons array from model: ${JSON.stringify(reasons)}`,
      {
        received: reasons,
        constraint: `array of ${REASONS_MIN}–${REASONS_MAX} snake_case strings matching ${REASON_PATTERN}`,
      },
    );
  }

  const usage: RawUsage = body?.usage ?? {};

  return {
    risk_tier: risk_tier as RiskTier,
    reasons: reasons as string[],
    raw: {
      model: typeof body?.model === "string" ? body.model : MODEL_ID,
      stop_reason: typeof body?.stop_reason === "string" ? body.stop_reason : null,
      input_tokens: typeof usage.input_tokens === "number" ? usage.input_tokens : null,
      output_tokens: typeof usage.output_tokens === "number" ? usage.output_tokens : null,
      latency_ms,
    },
  };
}
