import type { VoiceRiskLevel, VoiceToolName, VoiceVerdict } from './voice-types.js';

export interface VoiceToolSpec {
  name: VoiceToolName;
  label: string;
  risk: VoiceRiskLevel;
  writes: boolean;
  piiLikely: boolean;
  defaultVerdict: VoiceVerdict;
}

export const VOICE_TOOLS: Record<VoiceToolName, VoiceToolSpec> = {
  lookup_kb: {
    name: 'lookup_kb',
    label: 'Wissensbasis',
    risk: 'low',
    writes: false,
    piiLikely: false,
    defaultVerdict: 'ALLOW',
  },
  create_ticket: {
    name: 'create_ticket',
    label: 'Ticket anlegen',
    risk: 'medium',
    writes: true,
    piiLikely: true,
    defaultVerdict: 'ALLOW',
  },
  schedule_appointment: {
    name: 'schedule_appointment',
    label: 'Termin legen',
    risk: 'medium',
    writes: true,
    piiLikely: true,
    defaultVerdict: 'REQUIRE_CONFIRMATION',
  },
  handoff_human: {
    name: 'handoff_human',
    label: 'Human Handoff',
    risk: 'low',
    writes: false,
    piiLikely: false,
    defaultVerdict: 'ALLOW',
  },
  export_transcript: {
    name: 'export_transcript',
    label: 'Transkript exportieren',
    risk: 'high',
    writes: true,
    piiLikely: true,
    defaultVerdict: 'DENY',
  },
};

export function isVoiceToolName(value: string): value is VoiceToolName {
  return Object.prototype.hasOwnProperty.call(VOICE_TOOLS, value);
}
