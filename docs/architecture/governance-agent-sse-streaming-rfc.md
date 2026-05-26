# RFC: SSE Streaming for `governance-agent` Chat Responses

**Status:** Proposed
**Author:** Governance Runtime
**Created:** 2026-05-24
**Companion to:** `supabase/functions/governance-agent/index.ts`, migration `20260609000000_llm_query_quota_history.sql` (PR #418)
**Scope:** Documentation only — no code in this PR. Implementation is a separate PR that lands only after this RFC is accepted.

---

## 1. Purpose

The `governance-agent` Edge Function today answers `op:'chat'` and `op:'chat_anon'` with a **single request/response cycle**: the client waits for the full LLM completion (Anthropic Claude or LM Studio via ai-gateway), the function blocks until the model finishes, then returns a 200 with the entire response.

This is functionally correct but produces **noticeably poor UX**:

- Anthropic Claude Sonnet 4.6 latency for a typical compliance answer (~600 output tokens) is **3–8 seconds end-to-end** with US-routing acknowledged.
- LM Studio over `ai-gateway` on the Hostinger VPS (`qwen3:4b`, fast-local profile) sits around **4–12 seconds** depending on Ollama load.
- The chat surface (`AssistentChip` → `AnonWidget`) shows nothing during the wait. Users perceive the system as frozen.

Server-Sent Events (SSE) would let the chat panel render the response **token-by-token as the model streams it**, dropping perceived latency to first-token-time (~300–800 ms).

**Why an RFC, not an immediate implementation:** SSE touches the auth model (no custom headers from `EventSource`), the quota/audit-log positions (mid-stream cancellation), and the response-shape contract (clients that consume `op:'chat_anon'` today must keep working). Get the model right before writing code.

---

## 2. Definitions

| Term | Meaning |
|---|---|
| **SSE** | Server-Sent Events — HTTP response with `Content-Type: text/event-stream` carrying `data:`-prefixed events until the server closes the stream. One-way (server→client). |
| **`EventSource`** | Browser API for consuming SSE. Cannot send custom HTTP headers; only `withCredentials: true` to forward cookies. |
| **`fetch` + `ReadableStream`** | Modern alternative to `EventSource`. Supports custom headers (e.g. `Authorization: Bearer …`) and request bodies. Browser support: all evergreen. |
| **First-token-time (FTT)** | Wall-clock from request send to first response chunk reaching the browser. SSE collapses this from full-completion latency to ~300 ms (model warm-up + first decode). |
| **Mid-stream cancellation** | Client closes the connection before the model finishes (user navigates away, hits escape). Server-side `signal.aborted` fires; quota MUST be consumed (already paid for in tokens), history MUST be logged with partial response. |
| **Chunk** | One `data: {...}\n\n` SSE frame. Contains a JSON object with `{type, …}` where `type ∈ {token, tool_use, error, done}`. |

---

## 3. Goals & Non-Goals

### Goals

1. Reduce perceived latency on `op:'chat'` and `op:'chat_anon'` from **3–12 s** to **<800 ms FTT** for both Anthropic and ai-gateway paths.
2. Preserve every Phase-1 contract: quota check before stream-open, fail-closed on quota error, history-log on stream-close with accurate token totals.
3. Multi-provider: SSE works for **both** Anthropic and ai-gateway (LM Studio). Anthropic has native SSE; LM Studio's OpenAI-compatible endpoint also supports `stream: true`.
4. Backward compatible: existing `op:'chat'` / `op:'chat_anon'` responses **do not change shape**. SSE is opt-in via a new op suffix or a `stream: true` body field.
5. EU-local toggle behaviour unchanged. SSE routes through the same provider the non-streaming path would.

### Non-Goals

- **No WebSocket server.** SSE is server-side HTTP/2 streaming; no upgraded protocol, no separate dispatcher.
- **No new VPS service.** Implementation lives in the existing `governance-agent` Edge Function.
- **No frontend rewrite.** `AgentWidget` already renders incremental message growth; the change is in `useAnonChat` / `useAgentChat` to consume `ReadableStream` instead of awaiting a single JSON.
- **No tool-call streaming.** Anthropic streams tool-use blocks too, but the current chat surface doesn't render mid-tool-call state. Tools fire as today (collect → execute → next turn); only the **final text turn** is streamed to the client.
- **No streaming for the audit-copilot panel.** Tool-heavy responses with structured JSON output don't benefit from token streaming. Out of scope.

---

## 4. Surface design

### 4.1 Auth

`EventSource` cannot carry custom `Authorization` headers — that ruled out the naive "just add an op". Two options:

**Option A — `fetch` + `ReadableStream`** *(recommended)*

```ts
const res = await fetch(`${url}/functions/v1/governance-agent`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwt}`,    // tenant; omitted for anon
  },
  body: JSON.stringify({ op: 'chat_stream', tenant_id, message, session_id }),
});
const reader = res.body!.getReader();
```

Auth model is **identical** to the existing non-streaming path. No URL-token leak. Works for both tenant (JWT) and anon (cookie/session-id-in-body).

**Option B — URL-token + `EventSource`**

```
GET /functions/v1/governance-agent?op=chat_stream&token=<jwt>&message=…
```

Leaks JWT into access logs, Referer headers, browser history. **Rejected.**

### 4.2 New ops

| New op | Auth | Returns |
|---|---|---|
| `chat_stream` | JWT (tenant) | `text/event-stream` |
| `chat_stream_anon` | session_id in body (anon) | `text/event-stream` |

Existing `op:'chat'` and `op:'chat_anon'` stay verbatim. A client that wants SSE explicitly opts in by calling the `_stream` variant.

Alternative considered: add `stream: true` to the existing op. **Rejected** because the response Content-Type differs (`application/json` vs `text/event-stream`); SDK consumers branching on a request-body flag instead of an op name is fragile.

### 4.3 Event-frame schema

Each `data:`-prefixed frame is a single JSON object:

```ts
type SSEFrame =
  | { type: 'token';    text: string }                          // incremental text
  | { type: 'tool_use'; name: string; iteration: number }       // tool call started (notification only)
  | { type: 'done';     totalIn: number; totalOut: number;
                        sessionId: string; runId: string }      // stream end
  | { type: 'error';    code: string; message: string };        // fatal mid-stream
```

The terminal frame is **always** either `done` or `error`. Client knows to stop reading.

Heartbeat: every 15 s the server sends a SSE comment line (`: keepalive\n\n`) to prevent intermediaries (Cloudflare, nginx) from closing the connection during long Anthropic generations.

### 4.4 Backwards compatibility

The non-streaming ops are **not deprecated**. Use cases that genuinely need a single JSON response (server-to-server, batch jobs, audit copilot) keep using `op:'chat'`. Adding a new op is the smallest possible surface change.

---

## 5. Quota / history positioning

Phase-1 (PR #418) put the quota check **before** the LLM call and the history insert **after** a successful response. With streaming, the timing gets subtle:

| Step | Non-streaming (today) | Streaming (proposed) |
|---|---|---|
| Quota check | before LLM call, response: 429 if exceeded | **same** — before stream-open. If exceeded, return regular JSON `{error: 'QUOTA_EXCEEDED'}` with status 429, NOT a streamed error frame. SSE never starts. |
| anon_chat_runs reserve | before LLM call (anonGate) | **same** — before stream-open |
| History insert | after success (full text) | **after stream-close** (token totals from accumulator; full text from concatenated tokens) |
| anon_chat_runs finalize | after success/failure | **after stream-close** with outcome=success/error |
| Mid-stream client disconnect | n/a — caller waits | **MUST log partial response with `outcome='client_aborted'`** in both `anon_chat_runs` and `llm_query_history`. Tokens consumed are billable. |

Anthropic SDK supports `messages.stream()` returning an `AsyncIterable`; we accumulate `input_tokens` from the first chunk and `output_tokens` from cumulative deltas. ai-gateway / LM Studio OpenAI-compatible SSE returns `[DONE]` then a final usage chunk on some providers — fall back to estimating output tokens from accumulated text length × 0.25 if usage is absent.

### 5.1 Quota counter race

If two concurrent streams from the same tenant cross the cap (cap=100, used=99, two streams open at once), both pass the pre-stream check. Tolerable: occasional 1-stream overshoot is cheaper than introducing a `SELECT FOR UPDATE` race lock around every chat. If this becomes an abuse vector, swap the COUNT-based check for an atomic UPSERT-counter (`usage_counters` table already exists — schema in `20260406000000_entitlements_schema.sql`).

---

## 6. Failure modes

| Failure | Behaviour |
|---|---|
| Quota exceeded | 429 JSON before stream opens. Client UI shows the existing "Anfrage-Limit erreicht" banner. |
| LLM provider 503 (Anthropic, ai-gateway) | Stream opens, immediately emits one `{type:'error', code:'LLM_PROVIDER_DOWN'}` frame, closes. Client renders the error inline. |
| US-routing not acknowledged | Same as non-streaming — 412 JSON before stream opens. |
| Mid-stream Anthropic error (tokens exhausted, content_filter) | Emit `{type:'error', code:'LLM_MID_STREAM', message:'…'}`, close. Partial accumulated text gets history-logged with `outcome='llm_error'`. |
| Client disconnects mid-stream | Server's `signal.aborted` handler logs partial response, finalizes anon-audit row with `outcome='client_aborted'`. No further LLM tokens billed. |
| Heartbeat interval missed (intermediary closed connection) | Client `fetch` reader rejects. Caller can fall back to non-streaming `op:'chat'`. UI can offer a retry button. |
| Concurrent same-session stream | The second stream proceeds independently; history table accumulates two rows with the same session_id. UI MAY de-dupe by latest `correlation_id` if needed. |

---

## 7. Implementation sketch (Edge Function side)

```ts
if (body.op === 'chat_stream_anon') {
  const gate = await anonGate(req, body, 'chat_anon', { …, stream: true });
  if (gate instanceof Response) return gate;
  const { admin, requestId, ipHash, startedAt } = gate;

  // Quota check BEFORE stream opens — see §5
  const quotaResp = await enforceAnonQuota(admin, ipHash);
  if (quotaResp) { await finishAnon(admin, requestId, startedAt, { outcome:'error', error_code:'QUOTA_EXCEEDED' }); return quotaResp; }

  const message = (body.message as string).trim();
  if (!message) { …; return jsonError(400, ...); }

  const provider = LLM_PROVIDER;
  const model    = LLM_MODEL;

  // Build streaming response
  const { readable, writable } = new TransformStream();
  const writer  = writable.getWriter();
  const encoder = new TextEncoder();
  const send    = (frame: SSEFrame) =>
    writer.write(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
  const heartbeat = setInterval(() => {
    writer.write(encoder.encode(`: keepalive\n\n`)).catch(() => {});
  }, 15_000);

  // Detach the worker so the Response can return immediately
  (async () => {
    let accumulated = '';
    let totalIn = 0, totalOut = 0;
    try {
      if (provider === 'ai_gateway') {
        for await (const chunk of streamViaAiGateway(transcript)) {
          accumulated += chunk.text;
          if (chunk.usage) { totalIn = chunk.usage.input_tokens; totalOut = chunk.usage.output_tokens; }
          await send({ type:'token', text: chunk.text });
        }
      } else {
        // Anthropic
        const stream = client.messages.stream({ model, system: ANON_SYSTEM_PROMPT, messages: transcript });
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            accumulated += event.delta.text;
            await send({ type:'token', text: event.delta.text });
          }
        }
        const final = await stream.finalMessage();
        totalIn  = final.usage.input_tokens;
        totalOut = final.usage.output_tokens;
      }
      await send({ type:'done', totalIn, totalOut, sessionId, runId: requestId });
      await finishAnon(admin, requestId, startedAt, { outcome:'success', model, input_tokens: totalIn, output_tokens: totalOut });
    } catch (e) {
      await send({ type:'error', code:'LLM_MID_STREAM', message: (e as Error).message });
      await finishAnon(admin, requestId, startedAt, { outcome:'error', error_code:'LLM_MID_STREAM' });
    } finally {
      clearInterval(heartbeat);
      await logChatToHistory(admin, {
        tenant_id: null, user_id: null, session_id: sessionId,
        op: 'chat_anon', provider, model,
        query_text: message, response_summary: accumulated,
        input_tokens: totalIn, output_tokens: totalOut,
        correlation_id: requestId,
      });
      writer.close();
    }
  })();

  return new Response(readable, {
    status: 200,
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',   // disable nginx buffering
    },
  });
}
```

Tenant path (`chat_stream`) mirrors this with `auth` + membership check before `enforceTenantQuota`, and `agent_runs` row insert in the `finally` block alongside the history insert.

---

## 8. Implementation sketch (Client side)

```ts
// New helper in src/features/governance/AgentWidget/agentApi.ts
export async function streamChatAnon(
  args: { session_id: string; message: string; history?: SimpleMsg[] },
  onToken: (text: string) => void,
  onDone:  (info: { totalIn: number; totalOut: number }) => void,
  onError: (code: string, message: string) => void,
): Promise<void> {
  const sb = getSupabase();
  const url = `${SUPABASE_URL}/functions/v1/governance-agent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
    body: JSON.stringify({ op: 'chat_stream_anon', ...args }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    onError(err.code ?? 'HTTP_ERROR', err.message ?? `${res.status}`);
    return;
  }
  if (!res.body) { onError('NO_BODY', 'response body is null'); return; }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const raw   = buffer.slice(0, idx);
      buffer      = buffer.slice(idx + 2);
      if (!raw.startsWith('data:')) continue;     // comments / heartbeats skipped
      try {
        const frame = JSON.parse(raw.slice(5).trim());
        if (frame.type === 'token')      onToken(frame.text);
        else if (frame.type === 'done')  onDone({ totalIn: frame.totalIn, totalOut: frame.totalOut });
        else if (frame.type === 'error') onError(frame.code, frame.message);
      } catch { /* skip malformed frames */ }
    }
  }
}
```

`useAnonChat` switches from `await sendChatAnon(...)` to `streamChatAnon(..., onToken, onDone, onError)` where `onToken` appends to a "currently streaming" message bubble, `onDone` finalizes it, `onError` shows the existing error banner.

---

## 9. Feature flag + rollout

Both server and client gated by `SSE_ENABLED` env var, default `false`. Rollout:

1. **Week 1**: ship behind flag, set to `false` in production. Internal smoke against staging Supabase + Hostinger ai-gateway. Verify token totals on history match non-streaming counts within ±5% (estimation tolerance for ai-gateway).
2. **Week 2**: flip flag in staging, run real anon traffic for 48 h. Watch `anon_chat_runs.outcome` distribution — `client_aborted` rate should stay <5%, `LLM_MID_STREAM` <0.5%.
3. **Week 3**: flip flag in production. Client still falls back to non-streaming `op:'chat_anon'` on first SSE error per session, so a partial regression doesn't break the chat panel.
4. **Week 4+**: remove the fallback if metrics are clean.

**Rollback**: set `SSE_ENABLED=false` on the Edge Function — clients see a 400 for `op:'chat_stream*'` and fall back to non-streaming. Zero migration impact.

---

## 10. What this RFC does NOT decide

- **Whether to also stream `op:'chat'` for tenant** — implementation sketch covers it but the tenant chat has additional tool-call iterations that complicate the UX. The first deliverable is `chat_stream_anon` only; tenant follows after the anon flow is stable.
- **Rate-limit on stream-opens** vs. on completed-tokens. Today's per-IP 5/min rate limit applies at stream-open time. If abusers open + close streams to thrash, we can move to a token-budget per minute; out of scope here.
- **Replay / resume of dropped streams**. Out of scope — clients retry from the last assistant message in their session history.

---

## 11. Acceptance criteria

This RFC is **accepted** when the following are explicitly agreed:

- [ ] `fetch` + `ReadableStream` (Option A in §4.1) is the auth-carrying primitive; `EventSource` is not used.
- [ ] Two new ops `chat_stream` (JWT) and `chat_stream_anon` (session_id) — existing ops untouched.
- [ ] Frame schema in §4.3 is the contract; future fields are additive.
- [ ] Quota check stays pre-stream (§5). Mid-stream quota cannot reject.
- [ ] Mid-stream client-disconnect MUST log partial response + tokens-billed.
- [ ] Anon path ships first; tenant streaming is a follow-up.
- [ ] `SSE_ENABLED` feature flag with the 4-week rollout in §9.
- [ ] Client-side fallback to `op:'chat_anon'` on first SSE error stays in place through Week 3.

Until accepted: **no implementation PR**.

---

## 12. Open questions

1. **ai-gateway streaming verification.** Anthropic's SDK streaming is well-trodden; LM Studio's OpenAI-compatible streaming has corner-case behaviour around `[DONE]` and usage-on-final-chunk that needs confirming against the actual deployment before promising parity in §3 goal 3.
2. **CloudFront / Supabase Edge intermediaries.** Supabase Edge Functions are Deno Deploy under the hood; need to confirm Deno Deploy doesn't buffer SSE responses or impose a stream-duration cap below typical Anthropic completion times (~30 s max). Worst case: server emits an initial empty frame to flush headers.
3. **Heartbeat interval.** 15 s is a defensive guess. The right value is "less than the smallest intermediary read-timeout on the path". Need to measure post-staging-rollout.
4. **CORS preflight.** SSE responses don't trigger preflight, but the POST that opens the stream does. Current Edge Function CORS already handles POST + Authorization header; verify it covers the new ops.

These do not block RFC acceptance — they're tracked for the implementation PR.
