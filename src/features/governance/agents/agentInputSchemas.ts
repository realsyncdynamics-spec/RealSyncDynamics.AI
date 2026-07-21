// agentInputSchemas — deklarative Eingabe-Schemas je Agent.
//
// Single Source of Truth für die Parameter, die ein Agent aus `payload` liest.
// AgentsCenterView rendert daraus ein Formular (AgentRunForm), bevor der Lauf
// gestartet wird. Agenten ohne Eintrag laufen ohne Formular (leeres payload) —
// z. B. Infrastructure (nutzt Live-Metriken) und Feedback Intelligence
// (strukturierte Report-Arrays, Formular folgt separat).
//
// Die Feld-`key`s entsprechen exakt den `input.payload.<key>`-Zugriffen der
// jeweiligen Agent-Implementierung in src/lib/enterprise-ai-os/agents/.
import type { AgentId } from '../../../lib/enterprise-ai-os/agents/types';

export type AgentInputFieldKind = 'text' | 'textarea' | 'tags' | 'select' | 'boolean';

export interface AgentInputField {
  key: string;
  label: string;
  kind: AgentInputFieldKind;
  placeholder?: string;
  help?: string;
  /** Nur für kind === 'select'. Erster Eintrag ist die Vorauswahl. */
  options?: Array<{ value: string; label: string }>;
  /** Nur für kind === 'boolean'. Default-Zustand. */
  defaultChecked?: boolean;
}

const RISK_OPTIONS: AgentInputField['options'] = [
  { value: 'minimal', label: 'Minimal' },
  { value: 'limited', label: 'Begrenzt' },
  { value: 'high', label: 'Hoch' },
  { value: 'prohibited', label: 'Verboten' },
];

const PRIORITY_OPTIONS: AgentInputField['options'] = [
  { value: 'low', label: 'Niedrig' },
  { value: 'medium', label: 'Mittel' },
  { value: 'high', label: 'Hoch' },
  { value: 'urgent', label: 'Dringend' },
];

/**
 * Partielle Map: nur Agenten mit einfachen Parameter-Eingaben. Fehlt ein
 * Agent, wird er ohne Formular direkt gestartet.
 */
export const AGENT_INPUT_SCHEMAS: Partial<Record<AgentId, AgentInputField[]>> = {
  'ai-discovery-agent': [
    {
      key: 'sources',
      label: 'Quellen',
      kind: 'tags',
      placeholder: 'z. B. Mitarbeiter nutzt ChatGPT',
      help: 'Freitext-Signale, die auf KI-Nutzung hindeuten (eine je Eintrag).',
    },
  ],
  'risk-classification-agent': [
    {
      key: 'systemName',
      label: 'Systemname',
      kind: 'text',
      placeholder: 'z. B. Recruiting-Assistent',
    },
    {
      key: 'dataCategories',
      label: 'Datenkategorien',
      kind: 'tags',
      placeholder: 'z. B. health_data',
      help: 'Verarbeitete Datenkategorien (eine je Eintrag).',
    },
    {
      key: 'usageContext',
      label: 'Nutzungskontext',
      kind: 'textarea',
      placeholder: 'z. B. Bewertung von Bewerbern',
      help: 'Wofür wird das System eingesetzt?',
    },
  ],
  'policy-enforcement-agent': [
    { key: 'systemName', label: 'Systemname', kind: 'text', placeholder: 'z. B. Support-Bot' },
    { key: 'model', label: 'Modell', kind: 'text', placeholder: 'z. B. gpt-4.1' },
    {
      key: 'dataCategories',
      label: 'Datenkategorien',
      kind: 'tags',
      placeholder: 'z. B. sensitive_data',
    },
    {
      key: 'externalAction',
      label: 'Externe Aktion',
      kind: 'boolean',
      help: 'Greift die Aktion auf externe Systeme zu?',
    },
    { key: 'riskLevel', label: 'Risikostufe', kind: 'select', options: RISK_OPTIONS },
  ],
  'audit-agent': [
    { key: 'action', label: 'Aktion', kind: 'text', placeholder: 'z. B. policy_blocked' },
    { key: 'actor', label: 'Akteur', kind: 'text', placeholder: 'z. B. system' },
    { key: 'systemName', label: 'Systemname', kind: 'text', placeholder: 'z. B. Microsoft Copilot' },
    { key: 'riskLevel', label: 'Risikostufe', kind: 'select', options: RISK_OPTIONS },
  ],
  'remediation-agent': [
    { key: 'systemName', label: 'Systemname', kind: 'text', placeholder: 'z. B. Scoring-Engine' },
    { key: 'riskLevel', label: 'Risikostufe', kind: 'select', options: RISK_OPTIONS },
    {
      key: 'issue',
      label: 'Problem',
      kind: 'textarea',
      placeholder: 'Beschreibung des Governance-Problems',
    },
    {
      key: 'issueType',
      label: 'Problemtyp',
      kind: 'text',
      placeholder: 'z. B. data / external / compliance',
      help: 'Steuert die Art der empfohlenen Maßnahmen.',
    },
  ],
  'workflow-agent': [
    {
      key: 'steps',
      label: 'Schritte',
      kind: 'tags',
      placeholder: 'z. B. DPIA durchführen',
      help: 'Aufgaben des Workflows (eine je Eintrag).',
    },
    {
      key: 'workflowType',
      label: 'Workflow-Typ',
      kind: 'text',
      placeholder: 'z. B. remediation',
    },
    { key: 'priority', label: 'Priorität', kind: 'select', options: PRIORITY_OPTIONS },
  ],
};

/** True, wenn der Agent ein Eingabeformular besitzt. */
export function hasInputSchema(agentId: AgentId): boolean {
  const schema = AGENT_INPUT_SCHEMAS[agentId];
  return Array.isArray(schema) && schema.length > 0;
}
