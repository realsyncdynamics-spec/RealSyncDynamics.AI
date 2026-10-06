/**
 * HTTP-Client für POST /voice-tool (PR 3).
 *
 * Die Session-Runtime ruft nur die Policy-Kante auf — keine Tool-Ausführung.
 * Bearer-Token und Base-URL kommen aus der Umgebung (injizierbar für Tests).
 */

import { VOICE_AGENT_ID, type VoiceConsent, type VoiceVerdict } from '../voice-types.js';

export interface VoiceToolSessionSnapshot {
  killSwitch: boolean;
  turnCount: number;
  toolCount: number;
  rateLimit: { maxTurns: number; maxTools: number };
}

export interface VoiceToolHttpRequest {
  tenantId: string;
  sessionId: string;
  requestId: string;
  tool: string;
  args: Record<string, unknown>;
  session: VoiceToolSessionSnapshot;
  consent: VoiceConsent | null;
}

export type VoiceToolHttpOutcome =
  | { ok: true; verdict: VoiceVerdict; status: string }
  | { ok: false; reason: string; verdict?: VoiceVerdict };

export interface VoiceToolClient {
  evaluate(request: VoiceToolHttpRequest): Promise<VoiceToolHttpOutcome>;
}

export interface VoiceToolClientOptions {
  /** Base-URL ohne Trailing-Slash, z. B. http://127.0.0.1:8787 */
  baseUrl: string;
  /** Bearer-Token (AGENT_RUNTIME_API_TOKEN). */
  getApiToken: () => string | null | undefined;
  /** Timeout in ms. Default 5 000. */
  timeoutMs?: number;
  /** Injizierbar für Tests. Default: global fetch. */
  fetchImpl?: typeof fetch;
}

const RESERVED_ARG_KEYS = new Set(['tenantId', 'tenant_id', 'botId', 'bot_id']);
const PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Entfernt reservierte und Prototype-Keys aus Modell-Args (fail-closed strip). */
export function sanitizeToolArgs(args: Record<string, unknown>): Record<string, unknown> | null {
  const entries = Object.entries(args);
  if (entries.some(([key]) => PROTOTYPE_KEYS.has(key))) return null;
  return Object.fromEntries(entries.filter(([key]) => !RESERVED_ARG_KEYS.has(key)));
}

export function createVoiceToolClient(options: VoiceToolClientOptions): VoiceToolClient {
  const timeoutMs = options.timeoutMs ?? 5_000;
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async evaluate(request: VoiceToolHttpRequest): Promise<VoiceToolHttpOutcome> {
      const token = options.getApiToken()?.trim();
      if (!token) {
        return { ok: false, reason: 'missing_token' };
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetchImpl(`${options.baseUrl.replace(/\/$/, '')}/voice-tool`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            tenantId: request.tenantId,
            agentId: VOICE_AGENT_ID,
            sessionId: request.sessionId,
            requestId: request.requestId,
            tool: request.tool,
            args: request.args,
            session: request.session,
            consent: request.consent,
          }),
          signal: controller.signal,
        });

        let body: Record<string, unknown> = {};
        try {
          const parsed: unknown = await res.json();
          if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            body = parsed as Record<string, unknown>;
          }
        } catch {
          body = {};
        }

        const verdict = typeof body.verdict === 'string' ? (body.verdict as VoiceVerdict) : undefined;

        if (!res.ok) {
          return {
            ok: false,
            reason: typeof body.reason === 'string' ? body.reason : `http_${res.status}`,
            verdict,
          };
        }

        if (verdict !== 'ALLOW' && verdict !== 'DENY' && verdict !== 'REQUIRE_CONFIRMATION') {
          return { ok: false, reason: 'invalid_voice_tool_response' };
        }

        return {
          ok: true,
          verdict,
          status: typeof body.status === 'string' ? body.status : 'accepted',
        };
      } catch (err) {
        const aborted =
          (err instanceof Error && err.name === 'AbortError') ||
          (typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AbortError');
        return { ok: false, reason: aborted ? 'timeout' : 'transport_error' };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
