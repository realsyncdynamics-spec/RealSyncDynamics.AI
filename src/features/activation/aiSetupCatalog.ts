/**
 * AI-OS-Setup — Katalog, Typen und toleranter Parser (WP3).
 *
 * Persistiert OHNE Migration als Unterobjekt `organization.aiSetup` in
 * `governance_activations` (JSONB ohne Constraint). Einzige Quelle für
 * Enum-Werte und deutsche Labels — Komponenten importieren von hier.
 *
 * Die Angaben sind eine Selbstauskunft des Tenants. Sie werden NICHT als
 * Risikobewertung ausgegeben (keine Scores).
 */

export const AI_SYSTEM_OPTIONS = [
  { id: 'openai', label: 'OpenAI (ChatGPT, API)' },
  { id: 'anthropic', label: 'Anthropic (Claude)' },
  { id: 'google', label: 'Google (Gemini)' },
  { id: 'microsoft_copilot', label: 'Microsoft Copilot' },
  { id: 'xai', label: 'xAI (Grok)' },
  { id: 'local', label: 'Lokale Modelle (z. B. Ollama)' },
  { id: 'custom', label: 'Eigene / individuelle Modelle' },
  { id: 'automation_make_zapier_n8n', label: 'Automationen (Make, Zapier, n8n)' },
  { id: 'none', label: 'Keine KI-Systeme im Einsatz' },
] as const;

export const BOT_AGENT_OPTIONS = [
  { id: 'website_chat', label: 'Website-Chat' },
  { id: 'voice', label: 'Voice-Agent / Telefon' },
  { id: 'whatsapp', label: 'WhatsApp-Bot' },
  { id: 'browser_agent', label: 'Browser-Agent' },
  { id: 'builder_agent', label: 'Builder-Agent' },
  { id: 'support_agent', label: 'Support-Agent' },
  { id: 'sales_agent', label: 'Sales-Agent' },
  { id: 'compliance_agent', label: 'Compliance-Agent' },
  { id: 'none', label: 'Keine Bots oder Agenten geplant' },
] as const;

export const DATA_CLASS_OPTIONS = [
  { id: 'customer', label: 'Kundendaten' },
  { id: 'employee', label: 'Mitarbeiterdaten' },
  { id: 'health', label: 'Gesundheitsdaten' },
  { id: 'payment', label: 'Zahlungsdaten' },
  { id: 'web_tracking', label: 'Web-Tracking / Analytics' },
  { id: 'crm', label: 'CRM-Daten' },
  { id: 'email', label: 'E-Mail-Inhalte' },
  { id: 'internal_docs', label: 'Interne Dokumente' },
  { id: 'process_knowledge', label: 'Prozesswissen' },
] as const;

export const APPROVAL_LEVEL_OPTIONS = [
  { id: 'no', label: 'Nein' },
  { id: 'with_approval', label: 'Nur mit Freigabe' },
  { id: 'yes', label: 'Ja' },
] as const;

export const APPROVAL_QUESTIONS = [
  { key: 'autoCommunicate', label: 'Dürfen Bots/Agenten selbstständig nach außen kommunizieren?' },
  { key: 'readCustomerData', label: 'Dürfen Bots/Agenten Kundendaten lesen?' },
  { key: 'triggerTransactions', label: 'Dürfen Bots/Agenten Transaktionen auslösen?' },
] as const;

export const HUMAN_APPROVAL_OPTIONS = [
  { id: 'publish_content', label: 'Inhalte veröffentlichen' },
  { id: 'send_external_message', label: 'Nachrichten an Externe senden' },
  { id: 'submit_forms', label: 'Formulare absenden' },
  { id: 'purchase', label: 'Käufe / Bestellungen' },
  { id: 'transfer_customer_data', label: 'Kundendaten übertragen' },
  { id: 'change_records', label: 'Stammdaten ändern' },
  { id: 'delete_data', label: 'Daten löschen' },
] as const;

/** Fester Hinweis für Browser- und Builder-Agent (WP3-Auftrag). */
export const AGENT_GUARDRAIL_NOTE =
  'Veröffentlicht, sendet Formulare, kauft oder überträgt Kundendaten nie ohne Freigabe.';

/** Bot-/Agent-Typen, die den festen Guardrail-Hinweis tragen. */
export const GUARDED_AGENT_IDS: readonly string[] = ['browser_agent', 'builder_agent'];

export const NONE_OPTION_ID = 'none';

export type ApprovalLevel = (typeof APPROVAL_LEVEL_OPTIONS)[number]['id'];
export type ApprovalQuestionKey = (typeof APPROVAL_QUESTIONS)[number]['key'];

export interface AiSetupApprovals {
  autoCommunicate: ApprovalLevel;
  readCustomerData: ApprovalLevel;
  triggerTransactions: ApprovalLevel;
  logEveryAgentAction: boolean;
  humanApprovalFor: string[];
}

export interface AiSetup {
  responsibleRole: string;
  aiSystems: string[];
  botsAgents: string[];
  dataClasses: string[];
  approvals: AiSetupApprovals;
}

/** Konservative Vorbelegung: nichts ohne Freigabe, jede Agent-Aktion wird protokolliert. */
export function createEmptyAiSetup(): AiSetup {
  return {
    responsibleRole: '',
    aiSystems: [],
    botsAgents: [],
    dataClasses: [],
    approvals: {
      autoCommunicate: 'with_approval',
      readCustomerData: 'with_approval',
      triggerTransactions: 'no',
      logEveryAgentAction: true,
      humanApprovalFor: ['publish_content', 'submit_forms', 'purchase', 'transfer_customer_data'],
    },
  };
}

const AI_SYSTEM_IDS = new Set<string>(AI_SYSTEM_OPTIONS.map((o) => o.id));
const BOT_AGENT_IDS = new Set<string>(BOT_AGENT_OPTIONS.map((o) => o.id));
const DATA_CLASS_IDS = new Set<string>(DATA_CLASS_OPTIONS.map((o) => o.id));
const APPROVAL_LEVEL_IDS = new Set<string>(APPROVAL_LEVEL_OPTIONS.map((o) => o.id));
const HUMAN_APPROVAL_IDS = new Set<string>(HUMAN_APPROVAL_OPTIONS.map((o) => o.id));

function asIdList(raw: unknown, allowed: Set<string>): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v === 'string' && allowed.has(v) && !out.includes(v)) out.push(v);
  }
  // „none" schließt alle anderen Werte aus — inkonsistente Altdaten bereinigen.
  return out.includes(NONE_OPTION_ID) ? [NONE_OPTION_ID] : out;
}

function asApprovalLevel(raw: unknown, fallback: ApprovalLevel): ApprovalLevel {
  return typeof raw === 'string' && APPROVAL_LEVEL_IDS.has(raw) ? (raw as ApprovalLevel) : fallback;
}

/**
 * Toleranter Parser für `organization.aiSetup`.
 * Gibt `undefined` zurück, wenn kein Objekt gespeichert ist — so bleibt
 * unterscheidbar, ob das Setup schon einmal gespeichert wurde.
 */
export function asAiSetup(raw: unknown): AiSetup | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const defaults = createEmptyAiSetup();
  const a =
    o.approvals && typeof o.approvals === 'object' && !Array.isArray(o.approvals)
      ? (o.approvals as Record<string, unknown>)
      : {};
  return {
    responsibleRole: typeof o.responsibleRole === 'string' ? o.responsibleRole : '',
    aiSystems: asIdList(o.aiSystems, AI_SYSTEM_IDS),
    botsAgents: asIdList(o.botsAgents, BOT_AGENT_IDS),
    dataClasses: asIdList(o.dataClasses, DATA_CLASS_IDS),
    approvals: {
      autoCommunicate: asApprovalLevel(a.autoCommunicate, defaults.approvals.autoCommunicate),
      readCustomerData: asApprovalLevel(a.readCustomerData, defaults.approvals.readCustomerData),
      triggerTransactions: asApprovalLevel(
        a.triggerTransactions,
        defaults.approvals.triggerTransactions,
      ),
      logEveryAgentAction:
        typeof a.logEveryAgentAction === 'boolean'
          ? a.logEveryAgentAction
          : defaults.approvals.logEveryAgentAction,
      humanApprovalFor: Array.isArray(a.humanApprovalFor)
        ? asIdList(a.humanApprovalFor, HUMAN_APPROVAL_IDS)
        : defaults.approvals.humanApprovalFor,
    },
  };
}

/**
 * Mehrfachauswahl mit exklusiver „none"-Option:
 * „none" wählen leert die Liste, jede andere Option entfernt „none".
 */
export function toggleExclusiveOption(list: readonly string[], id: string): string[] {
  if (list.includes(id)) return list.filter((x) => x !== id);
  if (id === NONE_OPTION_ID) return [NONE_OPTION_ID];
  return [...list.filter((x) => x !== NONE_OPTION_ID), id];
}

export function toggleOption(list: readonly string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/** Anzahl erfasster Einträge ohne „none" — reine Zählung, keine Bewertung. */
export function countSelected(list: readonly string[]): number {
  return list.filter((x) => x !== NONE_OPTION_ID).length;
}

/** Mindestangaben, damit „Weiter" im Setup-Schritt möglich ist. */
export function isAiSetupComplete(setup: AiSetup): boolean {
  return setup.aiSystems.length > 0 && setup.botsAgents.length > 0;
}
