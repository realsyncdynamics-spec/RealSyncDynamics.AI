/**
 * Fail-closed Publish-Gate für OPERATE-Kanäle.
 * Keine Preise, keine Plan-Namen. Live nur über canGoLive.
 */

import {
  art50Required,
  canGoLive,
  type ChannelState,
  type JobId,
} from './onboarding';

export type OperateChannelId = 'web' | 'whatsapp' | 'voice';

export const OPERATE_CHANNELS: {
  id: OperateChannelId;
  label: string;
  job: JobId;
}[] = [
  { id: 'web', label: 'Website-Chat', job: 'chat' },
  { id: 'whatsapp', label: 'WhatsApp', job: 'wa' },
  { id: 'voice', label: 'Telefon-Bot', job: 'phone' },
];

export type ChannelTransitionResult =
  | { ok: true; state: ChannelState }
  | { ok: false; reason: 'live_gate'; state: ChannelState };

export interface ChannelGateInput {
  to: ChannelState;
  jobs: readonly JobId[];
  checklistDone: number;
  checklistTotal: number;
  art50Visible: boolean;
}

export function applyChannelTransition(input: ChannelGateInput): ChannelTransitionResult {
  if (input.to !== 'live') {
    return { ok: true, state: input.to };
  }
  if (
    canGoLive({
      checklistDone: input.checklistDone,
      checklistTotal: input.checklistTotal,
      art50Visible: input.art50Visible,
      jobs: input.jobs,
    })
  ) {
    return { ok: true, state: 'live' };
  }
  return { ok: false, reason: 'live_gate', state: 'test' };
}

export function evidencePayloadForChannel(args: {
  channel: OperateChannelId;
  from: ChannelState;
  to: ChannelState;
  accepted: boolean;
  reason?: 'live_gate';
}): Record<string, unknown> {
  return {
    type: 'operate.channel_transition',
    channel: args.channel,
    from: args.from,
    to: args.to,
    accepted: args.accepted,
    reason: args.reason ?? null,
    art50_required: art50Required(
      args.channel === 'web' ? ['chat'] : args.channel === 'whatsapp' ? ['wa'] : ['phone'],
    ),
  };
}
