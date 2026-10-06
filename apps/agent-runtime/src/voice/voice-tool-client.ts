/**
 * HTTP-Client für POST /voice-tool (PR 3).
 *
 * Die Session-Runtime ruft nur die Policy-Kante auf — keine Tool-Ausführung.
 * Bearer-Token und Base-URL kommen aus der Umgebung (injizierbar für Tests).
 */

import { VOICE_AGENT_ID, type VoiceConsent, type VoicePolicyDecision, type VoiceVerdict } from '../voice-types.js';

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
  | { ok: true; verdict: VoiceVerdict; status: string; decision?: VoicePolicyDecision }
  | { ok: false; reason: string; verdict?: VoiceVerdict; decision?: VoicePolicyDecision };

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
        const expected = {
          requestId: request.requestId,
          sessionId: request.sessionId,
          tenantId: request.tenantId,
          verdict,
        };
        const decision = parsePolicyDecision(body.decision, expected);

        if (!res.ok) {
          return {
            ok: false,
            reason: typeof body.reason === 'string' ? body.reason : `http_${res.status}`,
            verdict,
            decision,
          };
        }

        if (verdict !== 'ALLOW' && verdict !== 'DENY' && verdict !== 'REQUIRE_CONFIRMATION') {
          return { ok: false, reason: 'invalid_voice_tool_response' };
        }

        // Decision ist Pflicht — ohne vollständigen Payload kein ok:true mit Fake.
        return {
          ok: true,
          verdict,
          status: typeof body.status === 'string' ? body.status : 'accepted',
          decision,
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

function parsePolicyDecision(
  raw: unknown,
  expected: {
    requestId: string;
    sessionId: string;
    tenantId: string;
    verdict: VoiceVerdict | undefined;
  },
): VoicePolicyDecision | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  const d = raw as Record<string, unknown>;
  if (d.decidedBy !== 'policy-engine') return undefined;
  if (typeof d.decisionId !== 'string' || typeof d.requestId !== 'string') return undefined;
  if (typeof d.sessionId !== 'string' || typeof d.tenantId !== 'string') return undefined;
  if (d.verdict !== 'ALLOW' && d.verdict !== 'DENY' && d.verdict !== 'REQUIRE_CONFIRMATION') {
    return undefined;
  }
  // tenantId/sessionId müssen exakt zum Request passen — kein Soft-Fill.
  if (d.tenantId !== expected.tenantId || d.sessionId !== expected.sessionId) return undefined;
  if (expected.verdict !== undefined && d.verdict !== expected.verdict) return undefined;
  if (typeof d.reason !== 'string' || typeof d.decidedAt !== 'string') return undefined;
  if (d.risk !== 'low' && d.risk !== 'medium' && d.risk !== 'high') return undefined;
  if (typeof d.piiDetected !== 'boolean' || typeof d.auditRequired !== 'boolean') return undefined;
  if (!Array.isArray(d.trace)) return undefined;
  return {
    decisionId: d.decisionId,
    requestId: d.requestId,
    sessionId: d.sessionId,
    tenantId: d.tenantId,
    verdict: d.verdict,
    reason: d.reason,
    risk: d.risk,
    piiDetected: d.piiDetected,
    auditRequired: d.auditRequired,
    trace: d.trace as VoicePolicyDecision['trace'],
    decidedAt: d.decidedAt,
    decidedBy: 'policy-engine',
  };
}
