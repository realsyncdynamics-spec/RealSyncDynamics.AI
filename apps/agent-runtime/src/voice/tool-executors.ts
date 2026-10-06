/**
 * Tool-Executoren (PR 4).
 *
 * Nur dort echt, wo ein Backend im Repo existiert:
 *   schedule_appointment → public.bot_appointments (via VoiceStore)
 * Alle anderen Nora-Tools: fail-closed not_configured — nie erfundener Erfolg,
 * nie verified ohne external_ref.
 */

import type { VoiceToolName } from '../voice-types.js';
import type { VoiceStore } from './voice-store.js';

export interface ToolExecutionContext {
  tenantId: string;
  botId: string;
  sessionId: string;
  toolRequestId: string;
  args: Record<string, unknown>;
  store: VoiceStore;
}

export type ToolExecutionResult =
  | { ok: true; externalRef: string; output: Record<string, unknown> }
  | { ok: false; errorCode: string; output: Record<string, unknown> };

export type VoiceToolExecutor = (ctx: ToolExecutionContext) => Promise<ToolExecutionResult>;

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/** schedule_appointment → bot_appointments (Feature A). */
export const executeScheduleAppointment: VoiceToolExecutor = async (ctx) => {
  const customerName =
    str(ctx.args.customer_name) ??
    str(ctx.args.customerName) ??
    str(ctx.args.name) ??
    'Anrufer';
  const when = str(ctx.args.when) ?? str(ctx.args.requested_at) ?? str(ctx.args.date);
  const contact = str(ctx.args.contact) ?? str(ctx.args.phone) ?? null;
  const service = str(ctx.args.service) ?? null;
  const notes = str(ctx.args.notes) ?? (when ? `Wunschtermin: ${when}` : null);

  try {
    const appt = await ctx.store.insertAppointment({
      tenantId: ctx.tenantId,
      botId: ctx.botId,
      customerName,
      contact,
      service,
      requestedAt: when && !Number.isNaN(Date.parse(when)) ? new Date(when).toISOString() : null,
      notes,
      metadata: {
        source: 'voice_tool_gateway',
        session_id: ctx.sessionId,
        tool_request_id: ctx.toolRequestId,
        when: when ?? null,
      },
    });
    return {
      ok: true,
      externalRef: appt.id,
      output: { appointmentId: appt.id, status: 'requested' },
    };
  } catch {
    return {
      ok: false,
      errorCode: 'appointment_write_failed',
      output: { reason: 'appointment_write_failed' },
    };
  }
};

function notConfigured(tool: VoiceToolName): VoiceToolExecutor {
  return async () => ({
    ok: false,
    errorCode: 'not_configured',
    output: { reason: 'not_configured', tool },
  });
}

export const VOICE_TOOL_EXECUTORS: Record<VoiceToolName, VoiceToolExecutor> = {
  lookup_kb: notConfigured('lookup_kb'),
  create_ticket: notConfigured('create_ticket'),
  schedule_appointment: executeScheduleAppointment,
  handoff_human: notConfigured('handoff_human'),
  export_transcript: notConfigured('export_transcript'),
};
