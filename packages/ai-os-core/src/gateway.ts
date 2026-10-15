// Tool-Gateway — eine Entscheidung je Aktion, serverseitig ausgewertet.
//
// Reihenfolge (Default-Deny, erste zutreffende Regel gewinnt):
//   1. Aktion unbekannt                       → unknown_action
//   2. Auftraggeber ist kein Plattform-Operator → not_operator
//   3. Klasse `critical`                      → critical_requires_release
//   4. Kanal ist nicht `edge-gateway`         → not_executable_here
//   5. Status `coming-soon`                   → not_live
//   6. Agent genannt, Aktion nicht in seiner Positivliste → agent_not_allowed
//   7. Schreibaktion ohne AAL2-Sitzung        → mfa_required
//   8. Schreibaktion ohne Bestätigung         → confirmation_required
//
// Wie ADR 0011 D1: Die Grenze ist eine Policy-Invariante im Server, keine
// Selbstauskunft des Agenten oder des Browsers. Das UI darf diese Funktion
// zur Vorschau benutzen; maßgeblich ist der Aufruf in der Edge Function.

import { getAgent } from './agents.ts';
import { getToolAction } from './tools.ts';
import type { GatewayDecision, GatewayPrincipal, GatewayRequest } from './types.ts';

export function authorizeAction(principal: GatewayPrincipal, request: GatewayRequest): GatewayDecision {
  const action = getToolAction(request.actionId);
  if (!action) {
    return { allow: false, reason: 'unknown_action', message: `Aktion ${request.actionId} ist nicht registriert.` };
  }
  if (!principal.isOperator) {
    return { allow: false, reason: 'not_operator', message: 'Nur aktive Plattform-Operatoren.' };
  }
  if (action.class === 'critical') {
    return {
      allow: false,
      reason: 'critical_requires_release',
      message: `${action.label}: kritische Aktion — nur über den dokumentierten Freigabeweg, nie über das AI-OS.`,
    };
  }
  if (action.channel !== 'edge-gateway') {
    return {
      allow: false,
      reason: 'not_executable_here',
      message: `${action.label} läuft über ${action.channel}, nicht über das Server-Gateway.`,
    };
  }
  if (action.status === 'coming-soon') {
    return { allow: false, reason: 'not_live', message: `${action.label} ist noch nicht verfügbar.` };
  }
  if (request.agentId) {
    const agent = getAgent(request.agentId);
    if (!agent || !agent.allowedActions.includes(action.id)) {
      return {
        allow: false,
        reason: 'agent_not_allowed',
        message: `Agent ${request.agentId} darf ${action.id} nicht auslösen.`,
      };
    }
  }
  if (action.class === 'write') {
    if (principal.aal !== 'aal2') {
      return {
        allow: false,
        reason: 'mfa_required',
        message: 'Schreibaktionen erfordern eine Sitzung mit Zwei-Faktor-Anmeldung (AAL2).',
      };
    }
    if (!request.confirmed) {
      return { allow: false, reason: 'confirmation_required', message: 'Bitte die Aktion ausdrücklich bestätigen.' };
    }
  }
  return { allow: true, action, mustAudit: action.class !== 'read' };
}

/** Pfade, die `github.knowledge.propose` ändern darf. */
export const KNOWLEDGE_ROOT = 'docs/ai-os/';

/**
 * Prüft einen Wissensbasis-Pfad: nur Markdown unter docs/ai-os/, keine
 * Pfad-Traversierung, keine versteckten Dateien.
 */
export function isAllowedKnowledgePath(path: string): boolean {
  if (typeof path !== 'string' || path.length === 0 || path.length > 200) return false;
  if (!path.startsWith(KNOWLEDGE_ROOT)) return false;
  if (!path.endsWith('.md')) return false;
  if (path.includes('..') || path.includes('\\') || path.includes('//')) return false;
  const segments = path.slice(KNOWLEDGE_ROOT.length).split('/');
  return segments.every((s) => /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(s));
}

/**
 * Grobe Sperre gegen versehentlich eingefügte Zugangsdaten in Wissensnotizen.
 * Ersetzt keinen Secret-Scanner (GitHub Push Protection bleibt maßgeblich).
 */
export function findSecretLikeContent(text: string): string[] {
  const patterns: Array<[string, RegExp]> = [
    ['GitHub-Token', /\b(ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{20,}/],
    ['Stripe-Schlüssel', /\b(sk|rk)_(live|test)_[A-Za-z0-9]{16,}/],
    ['Anthropic-Schlüssel', /\bsk-ant-[A-Za-z0-9_-]{20,}/],
    ['OpenAI-Schlüssel', /\bsk-(proj-)?[A-Za-z0-9]{32,}/],
    ['Google-API-Schlüssel', /\bAIza[0-9A-Za-z_-]{35}\b/],
    ['AWS-Zugangsschlüssel', /\bAKIA[0-9A-Z]{16}\b/],
    ['Privater Schlüssel', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
    ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ];
  return patterns.filter(([, re]) => re.test(text)).map(([label]) => label);
}
