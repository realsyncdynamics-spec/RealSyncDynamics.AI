/**
 * Vertical Voice Agent Builder — branch-specific configuration, no execution.
 *
 * The existing apps/agent-runtime/src/voice-policy.ts remains the exclusive
 * execution gate. Templates never authorize a tool or grant consent.
 *
 * Persistenz: eine Konfiguration wird auf eine bestehende
 * `public.voice_bot_configs`-Zeile abgebildet (toVoiceBotConfigFields).
 * Die Runtime lädt nur Zeilen mit status='active' und bietet dem Modell nur
 * Contract ∩ offered_tools an (session-runtime.ts, intersectOfferedTools).
 */
import { VOICE_AGENT_TOOLS, type VoiceToolName } from './voice-types.js';

/** Eine Quelle für Tool-Namen: der Voice-Contract (voice-types.ts). */
export const VERTICAL_VOICE_TOOL_IDS: readonly VoiceToolName[] = VOICE_AGENT_TOOLS;

export type VerticalVoiceToolId = VoiceToolName;
export type VoiceIndustry = 'trades' | 'butcher' | 'law_office';
export type VoiceChannel = 'web' | 'phone';
export type AgentLifecycle = 'draft' | 'review' | 'active' | 'paused';

const VOICE_CHANNELS: readonly VoiceChannel[] = ['web', 'phone'];
const AGENT_LIFECYCLES: readonly AgentLifecycle[] = ['draft', 'review', 'active', 'paused'];

/**
 * elevated: Berufsgeheimnis oder besondere Kategorien (Art. 9 DSGVO) sind
 * naheliegend. Aktivierung erst nach dokumentierter Datenschutzprüfung.
 */
export type VoiceDataSensitivity = 'standard' | 'elevated';

export interface VerticalVoiceTemplate {
  id: VoiceIndustry;
  title: string;
  description: string;
  greeting: string;
  dataSensitivity: VoiceDataSensitivity;
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
  /**
   * ISO-8601-Zeitpunkt der dokumentierten Datenschutzprüfung; null = keine.
   * Notwendige, keine hinreichende Bedingung: Der Wert beweist nicht, wer
   * geprüft hat. Er darf nur aus einer serverseitig geführten Freigabe
   * stammen (Prüfer, Ergebnis, Konfigurationsversion, Evidence-Referenz) —
   * dieses Modell fehlt noch (Doku, Review-Befund SEC-02).
   */
  privacyReviewApprovedAt: string | null;
}

export const VERTICAL_VOICE_TEMPLATES: Readonly<Record<VoiceIndustry, VerticalVoiceTemplate>> = {
  trades: {
    id: 'trades',
    title: 'Handwerksbetrieb',
    description: 'Anfragen aufnehmen, Dringlichkeit erfassen, Termine vorbereiten.',
    greeting: 'Guten Tag. Ich bin der KI-Telefonassistent. Wie kann ich Ihnen helfen?',
    dataSensitivity: 'standard',
    allowedTools: ['lookup_kb', 'create_ticket', 'schedule_appointment', 'handoff_human'],
    humanHandoffTriggers: ['Gefahr für Menschen', 'Gasgeruch', 'Stromunfall', 'Beschwerde'],
    forbiddenClaims: ['Verbindliche Kostenzusage', 'Garantierter Notdiensteinsatz'],
  },
  butcher: {
    id: 'butcher',
    title: 'Metzgerei',
    description: 'Produktfragen beantworten und unverbindliche Bestellanfragen erfassen.',
    greeting: 'Guten Tag. Sie sprechen mit unserem KI-Assistenten. Was darf es sein?',
    dataSensitivity: 'standard',
    allowedTools: ['lookup_kb', 'create_ticket', 'handoff_human'],
    humanHandoffTriggers: ['Allergiefrage ohne geprüfte Quelle', 'Reklamation'],
    forbiddenClaims: ['Bestellung verbindlich bestätigt', 'Garantierte Allergiefreiheit'],
  },
  law_office: {
    id: 'law_office',
    title: 'Rechtsanwaltskanzlei',
    description: 'Mandatsanfragen aufnehmen und Rückrufe vermitteln, keine Rechtsberatung.',
    greeting: 'Guten Tag. Ich bin der KI-Assistent der Kanzlei und nehme Ihr Anliegen auf.',
    dataSensitivity: 'elevated',
    allowedTools: ['lookup_kb', 'create_ticket', 'schedule_appointment', 'handoff_human'],
    humanHandoffTriggers: ['Fristsache', 'Eilrechtsschutz', 'Rechtliche Bewertung', 'Interessenkonflikt'],
    forbiddenClaims: ['Verbindliche Rechtsberatung', 'Mandat angenommen', 'Frist geprüft'],
  },
} as const;

function templateFor(config: VerticalVoiceAgentConfig): VerticalVoiceTemplate | undefined {
  return Object.prototype.hasOwnProperty.call(VERTICAL_VOICE_TEMPLATES, config.templateId)
    ? VERTICAL_VOICE_TEMPLATES[config.templateId]
    : undefined;
}

/**
 * Laufzeitprüfung der Form. Konfigurationen kommen als JSON; die
 * TypeScript-Typen gelten dort nicht. Erst wenn diese Liste leer ist,
 * werden Felder inhaltlich ausgewertet.
 */
function structuralErrors(input: unknown): string[] {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return ['Konfiguration ist kein Objekt.'];
  }
  const c = input as Record<string, unknown>;
  const errors: string[] = [];
  for (const key of ['agentId', 'tenantId', 'templateId', 'displayName', 'businessName', 'locale']) {
    if (typeof c[key] !== 'string') errors.push(`Feld ${key} fehlt oder ist kein Text.`);
  }
  const channels = c['channels'];
  if (
    !isStringArray(channels) ||
    channels.length === 0 ||
    !channels.every((ch) => (VOICE_CHANNELS as readonly string[]).includes(ch)) ||
    new Set(channels).size !== channels.length
  ) {
    errors.push('Kanäle ungültig: mindestens ein bekannter Kanal, keine Duplikate.');
  }
  const lifecycle = c['lifecycle'];
  if (typeof lifecycle !== 'string' || !(AGENT_LIFECYCLES as readonly string[]).includes(lifecycle)) {
    errors.push('Unbekannter Lebenszyklus-Status.');
  }
  const tools = c['enabledTools'];
  if (!isStringArray(tools) || !tools.every((t) => (VERTICAL_VOICE_TOOL_IDS as readonly string[]).includes(t))) {
    errors.push('Tool-Liste ungültig.');
  }
  for (const key of ['recordingEnabled', 'transcriptStorageEnabled']) {
    if (typeof c[key] !== 'boolean') errors.push(`Feld ${key} muss true oder false sein.`);
  }
  if (typeof c['retentionDays'] !== 'number') errors.push('Feld retentionDays muss eine Zahl sein.');
  for (const key of ['humanHandoffContact', 'privacyReviewApprovedAt']) {
    if (c[key] !== null && typeof c[key] !== 'string') errors.push(`Feld ${key} muss Text oder null sein.`);
  }
  return errors;
}

/**
 * Tool intersection is restrictive: templates cannot widen the runtime's policy.
 * Fail-closed: nur aktive, fehlerfrei validierte Konfigurationen erhalten Tools.
 *
 * Keine Autorisierungsgrenze: Die Voice-Policy prüft Tool-Rechte noch gegen
 * die feste Nora-ID, nicht gegen diese Konfiguration (Review-Befund SEC-01).
 */
export function effectiveVoiceTools(
  config: VerticalVoiceAgentConfig,
  now: Date = new Date(),
): VerticalVoiceToolId[] {
  if (validateVerticalVoiceAgent(config, now).length > 0) return [];
  if (config.lifecycle !== 'active') return [];
  const template = templateFor(config);
  if (!template) return [];
  return config.enabledTools.filter(
    (tool, index, all) =>
      template.allowedTools.includes(tool) &&
      VERTICAL_VOICE_TOOL_IDS.includes(tool) &&
      all.indexOf(tool) === index,
  );
}

export function validateVerticalVoiceAgent(
  config: VerticalVoiceAgentConfig,
  now: Date = new Date(),
): string[] {
  const structural = structuralErrors(config);
  if (structural.length > 0) return structural;
  const errors: string[] = [];
  const template = templateFor(config);
  if (!config.tenantId.trim() || !config.agentId.trim()) errors.push('Tenant und Agent-ID fehlen.');
  if (!config.businessName.trim() || !config.displayName.trim()) errors.push('Name fehlt.');
  if (!template) errors.push('Unbekannte Branchenvorlage.');
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
  if (config.enabledTools.some((tool) => !template?.allowedTools.includes(tool))) {
    errors.push('Nicht erlaubtes Tool für diese Branche.');
  }
  if (config.lifecycle === 'active' && !config.humanHandoffContact?.trim()) {
    errors.push('Für aktive Agenten muss eine menschliche Übergabe möglich sein.');
  }
  if (
    config.lifecycle === 'active' &&
    template?.dataSensitivity === 'elevated' &&
    !isPastUtcTimestamp(config.privacyReviewApprovedAt, now)
  ) {
    errors.push('Diese Branche benötigt vor der Aktivierung eine dokumentierte Datenschutzprüfung.');
  }
  return errors;
}

/** Felder einer `public.voice_bot_configs`-Zeile, die eine Vorlage bestimmt. */
export interface VoiceBotConfigTemplateFields {
  language: 'de-DE';
  offered_tools: VerticalVoiceToolId[];
  status: 'draft' | 'active' | 'paused';
}

/**
 * Abbildung auf die bestehende Tabelle (Migration 20260928130000).
 * 'review' existiert dort nicht und wird fail-closed als 'draft' gespeichert.
 * 'active' nur, wenn die Konfiguration fehlerfrei validiert; sonst 'draft' —
 * eine ungültige Konfiguration wird über diesen Pfad nie aktiv persistiert.
 * Andere Schreibpfade (direkte Owner/Admin-Writes per RLS) prüft diese
 * Funktion nicht (Review-Befund SEC-03).
 */
export function toVoiceBotConfigFields(
  config: VerticalVoiceAgentConfig,
  now: Date = new Date(),
): VoiceBotConfigTemplateFields {
  if (structuralErrors(config).length > 0) {
    return { language: 'de-DE', offered_tools: [], status: 'draft' };
  }
  const template = templateFor(config);
  const offered = template
    ? config.enabledTools.filter(
        (tool, index, all) => template.allowedTools.includes(tool) && all.indexOf(tool) === index,
      )
    : [];
  let status: VoiceBotConfigTemplateFields['status'] = 'draft';
  if (config.lifecycle === 'paused') status = 'paused';
  if (config.lifecycle === 'active' && validateVerticalVoiceAgent(config, now).length === 0) status = 'active';
  return { language: 'de-DE', offered_tools: offered, status };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

/**
 * Nur kanonische UTC-Zeitpunkte, die bereits vergangen sind. Date.parse
 * allein akzeptiert '1' oder '2026-02-30T00:00:00Z' (→ 2. März).
 */
function isPastUtcTimestamp(value: string | null, now: Date): boolean {
  if (!value || !UTC_TIMESTAMP.test(value)) return false;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return false;
  const canonical = value.includes('.') ? value : value.replace('Z', '.000Z');
  if (new Date(ms).toISOString() !== canonical) return false;
  return ms <= now.getTime();
}
