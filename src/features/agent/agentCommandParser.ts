// agentCommandParser.ts — Natürlichsprachliche Befehle → AgentAction
// Nur Aktionen aus der Registry (agentActions.ts) sind erlaubt.
import { NAVIGATE_ACTIONS, SCROLL_ACTIONS, type AgentAction } from './agentActions';

export interface ParsedCommand {
  action: AgentAction;
  confidence: 'high' | 'medium' | 'low';
}

// Keyword-Maps für Navigations-Befehle (DE + EN)
const NAV_KEYWORDS: Record<string, string> = {
  // Dashboard
  'dashboard': 'nav_dashboard', 'übersicht': 'nav_dashboard', 'startseite': 'nav_dashboard',
  // Websites
  'website': 'nav_websites', 'websites': 'nav_websites', 'domain': 'nav_websites', 'scan': 'nav_websites',
  // DSGVO
  'dsgvo': 'nav_gdpr', 'datenschutz': 'nav_gdpr', 'gdpr': 'nav_gdpr', 'dsr': 'nav_gdpr',
  // KI / AI Act
  'ki': 'nav_ai_act', 'ai act': 'nav_ai_act', 'ki-systeme': 'nav_ai_act', 'ai-systeme': 'nav_ai_act',
  'eu ai act': 'nav_ai_act', 'kI-system': 'nav_ai_act',
  // Evidence
  'evidence': 'nav_evidence', 'nachweis': 'nav_evidence', 'nachweise': 'nav_evidence',
  'vault': 'nav_evidence', 'prüfpfad': 'nav_evidence',
  // Monitoring
  'monitoring': 'nav_monitoring', 'überwachung': 'nav_monitoring', 'live': 'nav_monitoring',
  // Automations
  'automation': 'nav_automations', 'automations': 'nav_automations', 'skill': 'nav_automations',
  'skills': 'nav_automations', 'agenten': 'nav_automations', 'agent': 'nav_automations',
  'workflow': 'nav_automations', 'workflows': 'nav_automations',
  // Office
  'office': 'nav_office', 'dokument': 'nav_documents', 'dokumente': 'nav_documents',
  'tabelle': 'nav_office', 'präsentation': 'nav_office', 'vertrag': 'nav_office',
  // Team
  'team': 'nav_team', 'mitglieder': 'nav_team', 'rollen': 'nav_team',
  // Settings
  'einstellungen': 'nav_settings', 'settings': 'nav_settings', 'konfiguration': 'nav_settings',
  // Risks
  'risiko': 'nav_risks', 'risiken': 'nav_risks', 'risk': 'nav_risks',
  // Audit
  'audit': 'nav_audit', 'export': 'nav_audit', 'behörde': 'nav_audit',
  // Reports
  'report': 'nav_reports', 'bericht': 'nav_reports', 'compliance': 'nav_reports',
};

const SCROLL_KEYWORDS: Record<string, string> = {
  'oben': 'scroll_top', 'anfang': 'scroll_top', 'top': 'scroll_top', 'start': 'scroll_top',
  'unten': 'scroll_bottom', 'ende': 'scroll_bottom', 'bottom': 'scroll_bottom',
  'hoch': 'scroll_up', 'hochscrollen': 'scroll_up',
  'runter': 'scroll_down', 'herunter': 'scroll_down',
};

const NAVIGATE_TRIGGERS = ['öffne', 'open', 'zeige', 'gehe zu', 'navigiere', 'wechsle zu', 'öffnen'];
const SCROLL_TRIGGERS   = ['scroll', 'scrolle', 'gehe', 'springe'];

export function parseAgentCommand(input: string): ParsedCommand | null {
  const lower = input.toLowerCase().trim();

  // Try navigate
  for (const trigger of NAVIGATE_TRIGGERS) {
    if (lower.includes(trigger)) {
      for (const [kw, actionId] of Object.entries(NAV_KEYWORDS)) {
        if (lower.includes(kw)) {
          const action = NAVIGATE_ACTIONS.find((a) => a.id === actionId);
          if (action) return { action, confidence: 'high' };
        }
      }
    }
  }

  // Try scroll
  for (const trigger of SCROLL_TRIGGERS) {
    if (lower.includes(trigger)) {
      for (const [kw, actionId] of Object.entries(SCROLL_KEYWORDS)) {
        if (lower.includes(kw)) {
          const action = SCROLL_ACTIONS.find((a) => a.id === actionId);
          if (action) return { action, confidence: 'high' };
        }
      }
    }
  }

  // Fallback: keyword-only match (lower confidence)
  for (const [kw, actionId] of Object.entries(NAV_KEYWORDS)) {
    if (lower.includes(kw)) {
      const action = NAVIGATE_ACTIONS.find((a) => a.id === actionId);
      if (action) return { action, confidence: 'medium' };
    }
  }

  return null;
}
