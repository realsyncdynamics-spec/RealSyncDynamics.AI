import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { z } from 'zod';

import { findAgent, listAgents } from './agent-registry.js';
import { emitAuditEvent } from './audit-log.js';
import { loadEnv } from './env.js';
import { evaluate } from './policy-engine.js';
import {
  applyVerdict,
  askPdp,
  loadPdpConfig,
  sanitizeToolCall,
} from './pdp-client.js';
import type { DenyReason, RunAgentResponse } from './types.js';
import { evaluateVoiceToolRequest, toGatewayDecision } from './voice-policy.js';
import { isVoiceToolName } from './voice-tools.js';
import { VOICE_AGENT_ID, type VoiceConsentPurpose } from './voice-types.js';

const env = loadEnv();
const pdpConfig = loadPdpConfig();
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

/* ------------------------------------------------------------------ */
/* Auth-Middleware — Bearer-Token-Pflicht für /agents und /run-agent. */
/* ------------------------------------------------------------------ */

function requireBearerToken(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!env.apiToken) {
    // Nicht-Prod ohne Token: explizit ablehnen statt durchwinken,
    // damit Devs den Token sofort konfigurieren.
    res.status(503).json({
      ok: false,
      status: 'denied',
      reason: 'missing_token',
    });
    return;
  }

  const header = req.header('authorization') ?? '';
  const expected = `Bearer ${env.apiToken}`;
  if (header !== expected) {
    res.status(401).json({
      ok: false,
      status: 'denied',
      reason: 'missing_token',
    });
    return;
  }

  next();
}

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

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

  // Voice läuft nur über /voice-tool. evaluate() bleibt unangetastet —
  // dieser Kanal-Guard sitzt davor, sonst umgeht /run-agent Consent,
  // Kill Switch und den 8-Check-Prüfpfad.
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

  /* ---------------------------------------------------------------- */
  /* Agent-PEP (P1-5): zentrale Policies VOR der Freigabe des Laufs.   */
  /*                                                                   */
  /* Die lokale Registry-Prüfung oben bleibt die erste Schranke — sie  */
  /* kennt die erlaubten Werkzeuge des Agenten. Der PDP kommt darüber: */
  /* er kennt die Regeln des Mandanten. Ein lokales Nein bleibt ein    */
  /* Nein; der PDP kann nur zusätzlich anhalten, nie zusätzlich        */
  /* erlauben.                                                         */
  /*                                                                   */
  /* Bewertet werden ausschließlich strukturierte Fakten des Aufrufs — */
  /* Argumentwerte und Modellausgabe verlassen den Prozess nie         */
  /* (sanitizeToolCall, Prompt-Injection-Schutz K6).                   */
  /* ---------------------------------------------------------------- */
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
        verdict.outcome === 'require_approval' ? 'approval_required'
          : verdict.outcome === 'unavailable' ? 'policy_engine_unavailable'
            : 'policy_blocked';
      const auditEvent = emitAuditEvent({
        status: 'denied',
        reviewRequired: decision.reviewRequired,
        reason,
        request,
        pdp: pdpAudit,
      });
      const body: RunAgentResponse = {
        ok: false,
        status: 'denied',
        reason,
        message: applied.reason ?? undefined,
        auditEvent,
      };
      res.status(403).json(body);
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

  const body: RunAgentResponse = {
    ok: true,
    status: 'accepted',
    reviewRequired: decision.reviewRequired,
    agent: { id: agent.id, name: agent.name },
    auditEvent,
  };
  res.json(body);
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

/**
 * Voice-Kanal. LLM schlägt nur vor — diese Route entscheidet.
 * Keine Tool-Ausführung (gleicher Scope wie /run-agent).
 */
app.post('/voice-tool', requireBearerToken, (req, res) => {
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
/* Boot                                                                */
/* ------------------------------------------------------------------ */

app.listen(env.port, () => {
  process.stdout.write(
    `${JSON.stringify({
      event_type: 'service_boot',
      service: 'realsync-agent-runtime',
      port: env.port,
      node_env: env.nodeEnv,
      auth_enforced: Boolean(env.apiToken),
      pdp_enforcement: pdpConfig.enforcement,
      pdp_configured: Boolean(pdpConfig.url && pdpConfig.key),
      pdp_failure_mode: pdpConfig.failureMode,
      timestamp: new Date().toISOString(),
    })}\n`,
  );
});
