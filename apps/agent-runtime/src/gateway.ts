/**
 * Agent-Runtime HTTP-Gateway.
 *
 * Exportiert `createGatewayApp` für Tests; bootet den Listener nur beim
 * direkten Start (npm start / npm run dev).
 */

import { timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { z } from 'zod';

import { findAgent, listAgents } from './agent-registry.js';
import { emitAuditEvent } from './audit-log.js';
import { loadEnv, type Env } from './env.js';
import { evaluate } from './policy-engine.js';
import {
  applyVerdict,
  askPdp,
  loadPdpConfig,
  sanitizeToolCall,
} from './pdp-client.js';
import type { DenyReason, RunAgentResponse } from './types.js';
import { evaluateVoiceToolRequest, toGatewayDecision } from './voice-policy.js';
import { isVoiceToolName, VOICE_TOOLS } from './voice-tools.js';
import { VOICE_AGENT_ID, type VoiceConsentPurpose } from './voice-types.js';
import {
  VoiceSessionRuntime,
  type VoiceSessionStartRequest,
} from './voice/session-runtime.js';
import {
  CONTRACT_TOOL_NAMES,
  type AudioFormat,
  type VoiceToolDefinition,
} from './voice-provider-types.js';

/** Serverseitige Default-Instructions — kein Marketing, kein Caller-Override. */
export const VOICE_HTTP_INSTRUCTIONS_DEFAULT =
  'Du bist Nora, die Voice-Assistentin dieses Mandanten. Folge Policy-Entscheidungen. Keine verbindlichen Zusagen ohne verified Tool-Ergebnis.';

const DEFAULT_INPUT_AUDIO: AudioFormat = { encoding: 'pcm16', sampleRateHz: 24000 };
const DEFAULT_OUTPUT_AUDIO: AudioFormat = { encoding: 'g711_ulaw', sampleRateHz: 8000 };

export const DEFAULT_VOICE_TOOL_DEFINITIONS: VoiceToolDefinition[] = CONTRACT_TOOL_NAMES.map(
  (name) => ({
    name,
    description: VOICE_TOOLS[name].label,
    parameters: { type: 'object', properties: {} },
  }),
);

export interface GatewayAppOptions {
  env?: Env;
  /** Injizierte Runtime (Tests). Sonst eine Instanz pro Prozess. */
  voiceRuntime?: VoiceSessionRuntime;
  /** Factory für die Prozess-Default-Runtime (Tests / Override). */
  createVoiceRuntime?: () => VoiceSessionRuntime;
}

let processVoiceRuntime: VoiceSessionRuntime | null = null;

export function resetProcessVoiceRuntimeForTests(): void {
  processVoiceRuntime = null;
}

function resolveVoiceRuntime(options: GatewayAppOptions): VoiceSessionRuntime {
  if (options.voiceRuntime) return options.voiceRuntime;
  if (!processVoiceRuntime) {
    processVoiceRuntime = options.createVoiceRuntime
      ? options.createVoiceRuntime()
      : new VoiceSessionRuntime();
  }
  return processVoiceRuntime;
}

/** Timing-safe Bearer-Vergleich (gleiche Hilfsfunktion für alle Auth-Routen). */
export function bearerMatches(header: string, expectedToken: string): boolean {
  const expected = `Bearer ${expectedToken}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

export function createGatewayApp(options: GatewayAppOptions = {}): express.Express {
  const env = options.env ?? loadEnv();
  const pdpConfig = loadPdpConfig();
  const voiceRuntime = resolveVoiceRuntime(options);

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));

  function requireBearerToken(req: Request, res: Response, next: NextFunction): void {
    if (!env.apiToken) {
      res.status(503).json({
        ok: false,
        status: 'denied',
        reason: 'missing_token',
      });
      return;
    }

    const header = req.header('authorization') ?? '';
    if (!bearerMatches(header, env.apiToken)) {
      res.status(401).json({
        ok: false,
        status: 'denied',
        reason: 'missing_token',
      });
      return;
    }

    next();
  }

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'realsync-agent-runtime', port: env.port });
  });

  app.get('/agents', requireBearerToken, (_req, res) => {
    res.json({ agents: listAgents() });
  });

  const runAgentSchema = z.object({
    tenantId: z.string().min(1),
    agentId: z.string().min(1),
    taskType: z.string().min(1),
    requestedTool: z.string().min(1),
    input: z.record(z.unknown()),
    requestId: z.string().min(1),
    principalId: z.string().min(1).optional(),
  });

  app.post('/run-agent', requireBearerToken, async (req, res) => {
    const parsed = runAgentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        status: 'denied',
        reason: 'invalid_request',
      });
      return;
    }

    const request = parsed.data;

    if (request.agentId === VOICE_AGENT_ID) {
      const auditEvent = emitAuditEvent({
        status: 'denied',
        reviewRequired: false,
        reason: 'denied_by_channel_policy',
        request,
      });
      const body: RunAgentResponse = {
        ok: false,
        status: 'denied',
        reason: 'denied_by_channel_policy',
        auditEvent,
      };
      res.status(403).json(body);
      return;
    }

    const decision = evaluate(request);

    if (!decision.ok) {
      const auditEvent = emitAuditEvent({
        status: 'denied',
        reviewRequired: false,
        reason: decision.reason,
        request,
      });
      const body: RunAgentResponse = {
        ok: false,
        status: 'denied',
        reason: decision.reason,
        auditEvent,
      };
      res.status(403).json(body);
      return;
    }

    const agent = findAgent(request.agentId);
    // `decision.ok` impliziert, dass der Agent existiert — Defensive
    // hier nur für TypeScript-Narrowing.
    if (!agent) {
      res.status(500).json({
        ok: false,
        status: 'denied',
        reason: 'agent_not_found',
      });
      return;
    }

    let pdpAudit: { decision: string; mode: string; reason: string | null } | undefined;

    if (pdpConfig.enforcement !== 'off') {
      const verdict = await askPdp(
        pdpConfig,
        sanitizeToolCall({
          agentId: request.agentId,
          taskType: request.taskType,
          requestedTool: request.requestedTool,
          input: request.input,
          principalId: request.principalId,
          requiresHumanReview: decision.reviewRequired,
        }),
      );
      const applied = applyVerdict(pdpConfig, verdict);
      pdpAudit = {
        decision: verdict.outcome,
        mode: pdpConfig.enforcement,
        reason: applied.reason ?? verdict.reasons[0] ?? null,
      };

      if (!applied.allowed) {
        const reason: DenyReason =
          verdict.outcome === 'require_approval'
            ? 'approval_required'
            : verdict.outcome === 'unavailable'
              ? 'policy_engine_unavailable'
              : 'policy_blocked';
        const auditEvent = emitAuditEvent({
          status: 'denied',
          reviewRequired: decision.reviewRequired,
          reason,
          request,
          pdp: pdpAudit,
        });
        const denyBody: RunAgentResponse = {
          ok: false,
          status: 'denied',
          reason,
          message: applied.reason ?? undefined,
          auditEvent,
        };
        res.status(403).json(denyBody);
        return;
      }
    }

    const auditEvent = emitAuditEvent({
      status: 'accepted',
      reviewRequired: decision.reviewRequired,
      reason: null,
      request,
      pdp: pdpAudit,
    });

    const acceptBody: RunAgentResponse = {
      ok: true,
      status: 'accepted',
      reviewRequired: decision.reviewRequired,
      agent: { id: agent.id, name: agent.name },
      auditEvent,
    };
    res.json(acceptBody);
  });

  const voiceConsentPurposes: [VoiceConsentPurpose, ...VoiceConsentPurpose[]] = [
    'record_audio',
    'process_transcript',
    'store_evidence',
    'execute_tools',
    'tts_playback',
  ];

  const voiceToolSchema = z.object({
    tenantId: z.string().min(1),
    agentId: z.string().min(1),
    sessionId: z.string().min(1),
    requestId: z.string().min(1),
    tool: z.string().min(1),
    args: z.record(z.unknown()).default({}),
    session: z.object({
      killSwitch: z.boolean(),
      turnCount: z.number().int().nonnegative(),
      toolCount: z.number().int().nonnegative(),
      rateLimit: z.object({
        maxTurns: z.number().int().positive(),
        maxTools: z.number().int().positive(),
      }),
    }),
    consent: z
      .object({
        purposes: z.array(z.enum(voiceConsentPurposes)),
        withdrawnAt: z.string().nullable(),
      })
      .nullable(),
  });

  app.post('/voice-tool', requireBearerToken, async (req, res) => {
    const parsed = voiceToolSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        status: 'denied',
        reason: 'invalid_request',
      });
      return;
    }

    const body = parsed.data;
    if (body.agentId !== VOICE_AGENT_ID) {
      res.status(403).json({
        ok: false,
        status: 'denied',
        reason: 'agent_not_found',
      });
      return;
    }
    if (!isVoiceToolName(body.tool)) {
      res.status(403).json({
        ok: false,
        status: 'denied',
        reason: 'tool_not_allowed',
      });
      return;
    }

    const agent = findAgent(body.agentId);
    if (!agent) {
      res.status(403).json({
        ok: false,
        status: 'denied',
        reason: 'agent_not_found',
      });
      return;
    }

    const decision = evaluateVoiceToolRequest({
      session: {
        sessionId: body.sessionId,
        tenantId: body.tenantId,
        killSwitch: body.session.killSwitch,
        turnCount: body.session.turnCount,
        toolCount: body.session.toolCount,
        rateLimit: body.session.rateLimit,
      },
      request: {
        requestId: body.requestId,
        sessionId: body.sessionId,
        tenantId: body.tenantId,
        agentId: body.agentId,
        tool: body.tool,
        args: body.args,
        proposedBy: 'llm',
        createdAt: new Date().toISOString(),
      },
      consent: body.consent,
    });

    const gateway = toGatewayDecision(decision.verdict);
    const auditEvent = emitAuditEvent({
      status: gateway.ok ? 'accepted' : 'denied',
      reviewRequired: gateway.ok ? gateway.reviewRequired : false,
      reason: gateway.ok ? null : gateway.reason,
      request: {
        tenantId: body.tenantId,
        agentId: body.agentId,
        taskType: 'voice_tool',
        requestedTool: body.tool,
        requestId: body.requestId,
      },
    });

    if (decision.verdict === 'DENY') {
      res.status(403).json({
        ok: false,
        status: 'denied',
        reason: 'denied_by_channel_policy',
        verdict: decision.verdict,
        decision,
        gateway,
        agent: { id: agent.id, name: agent.name },
        auditEvent,
      });
      return;
    }

    if (pdpConfig.enforcement !== 'off') {
      const verdict = await askPdp(
        pdpConfig,
        sanitizeToolCall({
          agentId: body.agentId,
          taskType: 'voice_tool',
          requestedTool: body.tool,
          input: (body.args ?? {}) as Record<string, unknown>,
          requiresHumanReview: decision.verdict === 'REQUIRE_CONFIRMATION',
        }),
      );
      const applied = applyVerdict(pdpConfig, verdict);
      if (!applied.allowed) {
        const reason: DenyReason =
          verdict.outcome === 'require_approval'
            ? 'approval_required'
            : verdict.outcome === 'unavailable'
              ? 'policy_engine_unavailable'
              : 'policy_blocked';
        const pdpAudit = emitAuditEvent({
          status: 'denied',
          reviewRequired: false,
          reason,
          request: {
            tenantId: body.tenantId,
            agentId: body.agentId,
            taskType: 'voice_tool',
            requestedTool: body.tool,
            requestId: body.requestId,
          },
          pdp: {
            decision: verdict.outcome,
            mode: pdpConfig.enforcement,
            reason: applied.reason ?? verdict.reasons[0] ?? null,
          },
        });
        res.status(403).json({
          ok: false,
          status: 'denied',
          reason,
          message: applied.reason ?? undefined,
          verdict: decision.verdict,
          decision,
          gateway,
          agent: { id: agent.id, name: agent.name },
          auditEvent: pdpAudit,
        });
        return;
      }
    }

    res.json({
      ok: true,
      status:
        decision.verdict === 'REQUIRE_CONFIRMATION'
          ? 'confirmation_required'
          : 'accepted',
      reviewRequired: decision.verdict === 'REQUIRE_CONFIRMATION',
      verdict: decision.verdict,
      decision,
      gateway,
      agent: { id: agent.id, name: agent.name },
      auditEvent,
    });
  });

  /* ------------------------------------------------------------------ */
  /* POST /voice-sessions — authentifizierter Session-Start              */
  /* ------------------------------------------------------------------ */

  const audioEncodingSchema = z.enum(['pcm16', 'g711_ulaw', 'g711_alaw']);
  const sampleRateSchema = z.union([
    z.literal(8000),
    z.literal(16000),
    z.literal(24000),
    z.literal(48000),
  ]);
  const audioFormatSchema = z.object({
    encoding: audioEncodingSchema,
    sample_rate_hz: sampleRateSchema,
  });

  /**
   * .strict(): tenantId/policy/disclosure/provider/model/offered_tools/instructions
   * und sonstige Fremdfelder → 400 invalid_request (erreichen startSession nie).
   */
  const voiceSessionStartSchema = z
    .object({
      bot_id: z.string().uuid().optional(),
      number_binding_id: z.string().uuid().optional(),
      correlation_id: z.string().uuid().optional(),
      input_audio: audioFormatSchema.optional(),
      output_audio: audioFormatSchema.optional(),
      consent: z
        .object({
          purposes: z.array(z.enum(voiceConsentPurposes)),
          withdrawn_at: z.string().nullable(),
        })
        .nullable()
        .optional(),
    })
    .strict()
    .refine(
      (d) => (d.bot_id ? 1 : 0) + (d.number_binding_id ? 1 : 0) === 1,
      { message: 'exactly_one_of_bot_id_or_number_binding_id' },
    );

  app.post('/voice-sessions', requireBearerToken, async (req, res) => {
    const parsed = voiceSessionStartSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        status: 'denied',
        reason: 'invalid_request',
      });
      return;
    }

    if (!voiceRuntime.hasStore()) {
      res.status(503).json({
        ok: false,
        status: 'denied',
        reason: 'not_configured',
      });
      return;
    }

    const body = parsed.data;
    const inputAudio = mapAudio(body.input_audio) ?? DEFAULT_INPUT_AUDIO;
    const outputAudio = mapAudio(body.output_audio) ?? DEFAULT_OUTPUT_AUDIO;

    // Nur nicht-autoritative Felder — Snapshot kommt ausschließlich aus dem Store.
    const startRequest: VoiceSessionStartRequest = {
      botId: body.bot_id,
      numberBindingId: body.number_binding_id,
      correlationId: body.correlation_id,
      instructions: VOICE_HTTP_INSTRUCTIONS_DEFAULT,
      tools: DEFAULT_VOICE_TOOL_DEFINITIONS,
      inputAudio,
      outputAudio,
      session: {
        killSwitch: false,
        turnCount: 0,
        toolCount: 0,
        rateLimit: { maxTurns: 20, maxTools: 8 },
      },
      consent: body.consent
        ? {
            purposes: body.consent.purposes,
            withdrawnAt: body.consent.withdrawn_at,
          }
        : { purposes: ['execute_tools', 'store_evidence'], withdrawnAt: null },
    };

    try {
      const session = await voiceRuntime.startSession(startRequest);
      res.status(201).json({
        ok: true,
        session_id: session.sessionId,
      });
    } catch (err) {
      const mapped = mapVoiceStartError(err);
      res.status(mapped.status).json({
        ok: false,
        status: 'denied',
        reason: mapped.reason,
      });
    }
  });

  return app;
}

function mapAudio(
  raw: { encoding: 'pcm16' | 'g711_ulaw' | 'g711_alaw'; sample_rate_hz: 8000 | 16000 | 24000 | 48000 } | undefined,
): AudioFormat | undefined {
  if (!raw) return undefined;
  return { encoding: raw.encoding, sampleRateHz: raw.sample_rate_hz };
}

export function mapVoiceStartError(err: unknown): { status: number; reason: string } {
  const msg = err instanceof Error ? err.message : '';
  if (msg.includes('config_not_found')) return { status: 404, reason: 'config_not_found' };
  if (msg.includes('store_error')) return { status: 503, reason: 'store_error' };
  if (msg.includes('not_configured')) return { status: 503, reason: 'not_configured' };
  return { status: 502, reason: 'provider_error' };
}

function isDirectGatewayEntry(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    const resolved = path.resolve(entry);
    return (
      import.meta.url === pathToFileURL(resolved).href ||
      resolved.endsWith(`${path.sep}gateway.ts`) ||
      resolved.endsWith(`${path.sep}gateway.js`)
    );
  } catch {
    return false;
  }
}

if (isDirectGatewayEntry()) {
  const env = loadEnv();
  const app = createGatewayApp({ env });
  app.listen(env.port, () => {
    process.stdout.write(
      `${JSON.stringify({
        event_type: 'service_boot',
        service: 'realsync-agent-runtime',
        port: env.port,
        node_env: env.nodeEnv,
        auth_enforced: Boolean(env.apiToken),
        timestamp: new Date().toISOString(),
      })}\n`,
    );
  });
}
