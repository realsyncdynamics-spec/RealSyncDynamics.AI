/**
 * Vertical Voice Agent Builder — branch-specific configuration, no execution.
 *
 * The existing apps/agent-runtime/src/voice-policy.ts remains the exclusive
 * execution gate. Templates never authorize a tool or grant consent.
 */
export const VERTICAL_VOICE_TOOL_IDS = [
  'lookup_kb',
  'create_ticket',
  'schedule_appointment',
  'handoff_human',
  'export_transcript',
] as const;

export type VerticalVoiceToolId = typeof VERTICAL_VOICE_TOOL_IDS[number];
export type VoiceIndustry = 'trades' | 'butcher' | 'law_office';
export type VoiceChannel = 'web' | 'phone';
export type AgentLifecycle = 'draft' | 'review' | 'active' | 'paused';

export interface VerticalVoiceTemplate {
  id: VoiceIndustry;
  title: string;
  description: string;
  greeting: string;
  allowedTools: readonly VerticalVoiceToolId[];
  humanHandoffTriggers: readonly string[];
  forbiddenClaims: readonly string[];
}

export interface VerticalVoiceAgentConfig {
  agentId: string;
  tenantId: string;
  templateId: VoiceIndustry;
  displayName: string;
  businessName: string;
  locale: 'de-DE';
  channels: readonly VoiceChannel[];
  lifecycle: AgentLifecycle;
  enabledTools: readonly VerticalVoiceToolId[];
  recordingEnabled: boolean;
  transcriptStorageEnabled: boolean;
  retentionDays: number;
  humanHandoffContact: string | null;
}

export const VERTICAL_VOICE_TEMPLATES: Readonly<Record<VoiceIndustry, VerticalVoiceTemplate>> = {
  trades: {
    id: 'trades',
    title: 'Handwerksbetrieb',
    description: 'Anfragen aufnehmen, Dringlichkeit erfassen, Termine vorbereiten.',
    greeting: 'Guten Tag. Ich bin der KI-Telefonassistent. Wie kann ich Ihnen helfen?',
    allowedTools: ['lookup_kb', 'create_ticket', 'schedule_appointment', 'handoff_human'],
    humanHandoffTriggers: ['Gefahr für Menschen', 'Gasgeruch', 'Stromunfall', 'Beschwerde'],
    forbiddenClaims: ['Verbindliche Kostenzusage', 'Garantierter Notdiensteinsatz'],
  },
  butcher: {
    id: 'butcher',
    title: 'Metzgerei',
    description: 'Produktfragen beantworten und unverbindliche Bestellanfragen erfassen.',
    greeting: 'Guten Tag. Sie sprechen mit unserem KI-Assistenten. Was darf es sein?',
    allowedTools: ['lookup_kb', 'create_ticket', 'handoff_human'],
    humanHandoffTriggers: ['Allergiefrage ohne geprüfte Quelle', 'Reklamation'],
    forbiddenClaims: ['Bestellung verbindlich bestätigt', 'Garantierte Allergiefreiheit'],
  },
  law_office: {
    id: 'law_office',
    title: 'Rechtsanwaltskanzlei',
    description: 'Mandatsanfragen aufnehmen und Rückrufe vermitteln, keine Rechtsberatung.',
    greeting: 'Guten Tag. Ich bin der KI-Assistent der Kanzlei und nehme Ihr Anliegen auf.',
    allowedTools: ['lookup_kb', 'create_ticket', 'schedule_appointment', 'handoff_human'],
    humanHandoffTriggers: ['Fristsache', 'Eilrechtsschutz', 'Rechtliche Bewertung', 'Interessenkonflikt'],
    forbiddenClaims: ['Verbindliche Rechtsberatung', 'Mandat angenommen', 'Frist geprüft'],
  },
} as const;

/** Tool intersection is restrictive: templates cannot widen the runtime's policy. */
export function effectiveVoiceTools(config: VerticalVoiceAgentConfig): VerticalVoiceToolId[] {
  if (config.lifecycle !== 'active') return [];
  const template = VERTICAL_VOICE_TEMPLATES[config.templateId];
  if (!template) return [];
  return config.enabledTools.filter(
    (tool, index, all) =>
      template.allowedTools.includes(tool) &&
      VERTICAL_VOICE_TOOL_IDS.includes(tool) &&
      all.indexOf(tool) === index,
  );
}

export function validateVerticalVoiceAgent(config: VerticalVoiceAgentConfig): string[] {
  const errors: string[] = [];
  if (!config.tenantId.trim() || !config.agentId.trim()) errors.push('Tenant und Agent-ID fehlen.');
  if (!config.businessName.trim() || !config.displayName.trim()) errors.push('Name fehlt.');
  if (!VERTICAL_VOICE_TEMPLATES[config.templateId]) errors.push('Unbekannte Branchenvorlage.');
  if (config.locale !== 'de-DE') errors.push('Nicht unterstützte Sprache.');
  if (!Number.isInteger(config.retentionDays) || config.retentionDays < 0 || config.retentionDays > 30) {
    errors.push('Aufbewahrungsfrist muss zwischen 0 und 30 Tagen liegen.');
  }
  if (config.channels.includes('phone')) {
    errors.push('Telefonie ist noch nicht aktiviert: SIP-Provider, Datenschutz und Routing fehlen.');
  }
  if (config.recordingEnabled) errors.push('Audio-Aufzeichnung benötigt separaten Freigabeprozess.');
  if (config.transcriptStorageEnabled && config.retentionDays === 0) {
    errors.push('Transkriptspeicherung benötigt eine explizite Aufbewahrungsfrist.');
  }
  if (config.enabledTools.some((tool) => !VERTICAL_VOICE_TEMPLATES[config.templateId]?.allowedTools.includes(tool))) {
    errors.push('Nicht erlaubtes Tool für diese Branche.');
  }
  if (config.lifecycle === 'active' && !config.humanHandoffContact?.trim()) {
    errors.push('Für aktive Agenten muss eine menschliche Übergabe möglich sein.');
  }
  return errors;
}
