/**
 * Deno mock-tests for the ai-risk-agent classifier.
 *
 * Run:
 *   deno task test           (no --allow-net — mocks only)
 *   deno task test:integration  (allow-net=api.anthropic.com — hits real API)
 *
 * These tests target the response-parsing and error-mapping logic
 * directly (`parseAnthropicResponse`, `classify` via fetch mock). The
 * full end-to-end agent quality is measured by the Goldset eval
 * workflow (.github/workflows/risk-agent-eval.yml), not here.
 */

import { assertEquals, assertRejects, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  classify,
  ClassifierError,
  MODEL_ID,
  parseAnthropicResponse,
} from "./classifier.ts";

// ─── Helpers ───────────────────────────────────────────────────────────────

function anthropicOk(
  tier: string,
  reasons: string[],
  overrides: Record<string, unknown> = {},
) {
  return {
    id: "msg_test",
    model: MODEL_ID,
    role: "assistant",
    stop_reason: "tool_use",
    content: [
      {
        type: "tool_use",
        name: "classify_ai_system",
        input: { risk_tier: tier, reasons },
      },
    ],
    usage: { input_tokens: 200, output_tokens: 30 },
    ...overrides,
  };
}

function mockFetch(handler: (req: Request) => Response | Promise<Response>) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input.toString(), init);
    return await handler(req);
  };
  return () => {
    globalThis.fetch = original;
  };
}

const FIVE_GOLDSET_SAMPLES = [
  {
    label: "AI Spam Filter",
    payload: {
      system_name: "Email Spam Classifier",
      sector: "productivity",
      decisions_affect_persons: false,
    },
    tier: "minimal" as const,
    reasons: ["no_personal_decisions", "non_sensitive_data"],
  },
  {
    label: "Customer Chatbot Sales Tier",
    payload: {
      system_name: "Sales Chatbot",
      interacts_with_humans: true,
      discloses_ai_nature: false,
    },
    tier: "limited" as const,
    reasons: ["art_50_1_undisclosed_chatbot"],
  },
  {
    label: "CV Screening for Hiring",
    payload: {
      system_name: "Recruitment AI Screener",
      sector: "hr",
      context: "employment_access",
      decisions_affect_persons: true,
    },
    tier: "high" as const,
    reasons: ["annex_iii_4a_employment"],
  },
  {
    label: "Credit Scoring",
    payload: {
      system_name: "Consumer Credit Scorer",
      context: "essential_service_access",
      decisions_affect_persons: true,
    },
    tier: "high" as const,
    reasons: ["annex_iii_5b_creditworthiness"],
  },
  {
    label: "Real-time RBI Public",
    payload: {
      system_name: "Live CCTV Face ID",
      context: "real_time_remote_biometric_id_public",
      law_enforcement_exception_applies: false,
    },
    tier: "prohibited" as const,
    reasons: ["art_5_1_h_real_time_rbi"],
  },
];

// ─── Tests ─────────────────────────────────────────────────────────────────

Deno.test("classify — healthcheck shortcut returns minimal without API call", async () => {
  const restore = mockFetch(() => {
    throw new Error("fetch must not be called for healthcheck");
  });
  try {
    const r = await classify({ _healthcheck: true }, "fake-key");
    assertEquals(r.risk_tier, "minimal");
    assertEquals(r.reasons, ["healthcheck"]);
    assertEquals(r.raw.healthcheck, true);
    assertEquals(r.raw.input_tokens, 0);
  } finally {
    restore();
  }
});

for (const sample of FIVE_GOLDSET_SAMPLES) {
  Deno.test(`classify — happy path: ${sample.label}`, async () => {
    const restore = mockFetch(() =>
      new Response(JSON.stringify(anthropicOk(sample.tier, sample.reasons)), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    try {
      const r = await classify(sample.payload, "fake-key");
      assertEquals(r.risk_tier, sample.tier);
      assertEquals(r.reasons, sample.reasons);
      assertEquals(typeof r.raw.latency_ms, "number");
      assertEquals(r.raw.input_tokens, 200);
    } finally {
      restore();
    }
  });
}

Deno.test("classify — wrong tool name throws ClassifierError", async () => {
  const restore = mockFetch(() =>
    new Response(
      JSON.stringify({
        ...anthropicOk("high", ["annex_iii_4a_employment"]),
        content: [
          {
            type: "tool_use",
            name: "some_other_tool",
            input: { risk_tier: "high", reasons: ["x"] },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    )
  );
  try {
    await assertRejects(
      () => classify({ system_name: "x" }, "fake-key"),
      ClassifierError,
      "Unexpected tool name from model",
    );
  } finally {
    restore();
  }
});

Deno.test("classify — empty reasons array throws ClassifierError", async () => {
  const restore = mockFetch(() =>
    new Response(JSON.stringify(anthropicOk("high", [])), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  );
  try {
    await assertRejects(
      () => classify({ system_name: "x" }, "fake-key"),
      ClassifierError,
      "Invalid reasons array",
    );
  } finally {
    restore();
  }
});

Deno.test("classify — reasons > 4 throws ClassifierError", async () => {
  const restore = mockFetch(() =>
    new Response(
      JSON.stringify(anthropicOk("high", ["a", "b", "c", "d", "e"])),
      { status: 200, headers: { "content-type": "application/json" } },
    )
  );
  try {
    await assertRejects(
      () => classify({ system_name: "x" }, "fake-key"),
      ClassifierError,
      "Invalid reasons array",
    );
  } finally {
    restore();
  }
});

Deno.test("classify — non-snake_case reason throws ClassifierError", async () => {
  const restore = mockFetch(() =>
    new Response(
      JSON.stringify(anthropicOk("high", ["AnnexIII4a-Employment"])),
      { status: 200, headers: { "content-type": "application/json" } },
    )
  );
  try {
    await assertRejects(
      () => classify({ system_name: "x" }, "fake-key"),
      ClassifierError,
      "Invalid reasons array",
    );
  } finally {
    restore();
  }
});

Deno.test("classify — invalid risk_tier throws ClassifierError", async () => {
  const restore = mockFetch(() =>
    new Response(
      JSON.stringify(anthropicOk("apocalyptic" as unknown as "high", ["foo"])),
      { status: 200, headers: { "content-type": "application/json" } },
    )
  );
  try {
    await assertRejects(
      () => classify({ system_name: "x" }, "fake-key"),
      ClassifierError,
      "Invalid risk_tier",
    );
  } finally {
    restore();
  }
});

Deno.test("classify — non-200 HTTP throws ClassifierError with upstream status", async () => {
  const restore = mockFetch(() =>
    new Response("rate limited", { status: 429 })
  );
  try {
    const err = await assertRejects(
      () => classify({ system_name: "x" }, "fake-key"),
      ClassifierError,
      "HTTP 429",
    );
    assert(err.cause && typeof err.cause === "object" && "status" in err.cause);
    assertEquals((err.cause as { status: number }).status, 429);
  } finally {
    restore();
  }
});

Deno.test("classify — AbortError surfaces as timeout ClassifierError", async () => {
  const restore = mockFetch(() => {
    throw new DOMException("aborted", "AbortError");
  });
  try {
    await assertRejects(
      () => classify({ system_name: "x" }, "fake-key"),
      ClassifierError,
      "timed out",
    );
  } finally {
    restore();
  }
});

Deno.test("classify — missing tool_use block throws ClassifierError", async () => {
  const restore = mockFetch(() =>
    new Response(
      JSON.stringify({
        ...anthropicOk("high", ["x"]),
        content: [{ type: "text", text: "I cannot use tools." }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    )
  );
  try {
    await assertRejects(
      () => classify({ system_name: "x" }, "fake-key"),
      ClassifierError,
      "did not contain a tool_use block",
    );
  } finally {
    restore();
  }
});

Deno.test("parseAnthropicResponse — populates raw with usage and stop_reason", () => {
  const r = parseAnthropicResponse(
    anthropicOk("limited", ["art_50_1_disclosed"]),
    123,
  );
  assertEquals(r.raw.latency_ms, 123);
  assertEquals(r.raw.input_tokens, 200);
  assertEquals(r.raw.output_tokens, 30);
  assertEquals(r.raw.stop_reason, "tool_use");
});

// =============================================================================
// Handler-Contract-Tests
//
// Diese Tests prüfen den HTTP-Vertrag (Status-Codes, Auth-Pfade, Body-
// Validierung), nicht den realen `Deno.serve`-Handler aus index.ts — dessen
// Auto-Bind beim Import würde Test-Runs blockieren. Stattdessen wird die
// Handler-Logik in `callHandler()` parallel re-implementiert. Bei Änderung
// am Handler in index.ts diese Re-Implementation entsprechend nachziehen.
// =============================================================================

async function callHandler(
  req: Request,
  env: Record<string, string | undefined> = {},
): Promise<Response> {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) {
      Deno.env.delete(k);
    } else {
      Deno.env.set(k, v);
    }
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const expectedToken = Deno.env.get("AI_RISK_AGENT_TOKEN");
  if (!expectedToken) {
    return new Response(JSON.stringify({ error: "agent_token_not_configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "missing_bearer_token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const presentedToken = authHeader.slice("Bearer ".length).trim();
  if (presentedToken !== expectedToken) {
    return new Response(JSON.stringify({ error: "invalid_bearer_token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { payload?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json_body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!body || !body.payload || typeof body.payload !== "object") {
    return new Response(JSON.stringify({ error: "missing_payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "anthropic_api_key_not_configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const result = await classify(body.payload, apiKey);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof ClassifierError) {
      return new Response(
        JSON.stringify({ error: "classifier_error", message: e.message }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
    throw e;
  }
}

Deno.test("handler: rejects GET", async () => {
  const res = await callHandler(new Request("http://x/", { method: "GET" }), {
    AI_RISK_AGENT_TOKEN: "secret",
    ANTHROPIC_API_KEY: "key",
  });
  assertEquals(res.status, 405);
});

Deno.test("handler: rejects missing bearer", async () => {
  const res = await callHandler(
    new Request("http://x/", {
      method: "POST",
      body: JSON.stringify({ payload: {} }),
    }),
    { AI_RISK_AGENT_TOKEN: "secret", ANTHROPIC_API_KEY: "key" },
  );
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.error, "missing_bearer_token");
});

Deno.test("handler: rejects wrong bearer", async () => {
  const res = await callHandler(
    new Request("http://x/", {
      method: "POST",
      headers: { Authorization: "Bearer wrong" },
      body: JSON.stringify({ payload: {} }),
    }),
    { AI_RISK_AGENT_TOKEN: "secret", ANTHROPIC_API_KEY: "key" },
  );
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.error, "invalid_bearer_token");
});

Deno.test("handler: 503 when AI_RISK_AGENT_TOKEN unset", async () => {
  const res = await callHandler(
    new Request("http://x/", {
      method: "POST",
      headers: { Authorization: "Bearer x" },
      body: JSON.stringify({ payload: {} }),
    }),
    { AI_RISK_AGENT_TOKEN: undefined, ANTHROPIC_API_KEY: "key" },
  );
  assertEquals(res.status, 503);
});

Deno.test("handler: 400 on invalid JSON", async () => {
  const res = await callHandler(
    new Request("http://x/", {
      method: "POST",
      headers: { Authorization: "Bearer secret" },
      body: "not-json",
    }),
    { AI_RISK_AGENT_TOKEN: "secret", ANTHROPIC_API_KEY: "key" },
  );
  assertEquals(res.status, 400);
});

Deno.test("handler: 400 on missing payload", async () => {
  const res = await callHandler(
    new Request("http://x/", {
      method: "POST",
      headers: { Authorization: "Bearer secret" },
      body: JSON.stringify({ wrong_key: "x" }),
    }),
    { AI_RISK_AGENT_TOKEN: "secret", ANTHROPIC_API_KEY: "key" },
  );
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "missing_payload");
});

Deno.test("handler: 200 on valid request with healthcheck payload", async () => {
  const res = await callHandler(
    new Request("http://x/", {
      method: "POST",
      headers: { Authorization: "Bearer secret" },
      body: JSON.stringify({ payload: { _healthcheck: true } }),
    }),
    { AI_RISK_AGENT_TOKEN: "secret", ANTHROPIC_API_KEY: "key" },
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.risk_tier, "minimal");
});
