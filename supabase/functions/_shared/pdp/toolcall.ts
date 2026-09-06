/**
 * Tool-Call → Entscheidungsanfrage (P1-5, Agent-PEP).
 *
 * WARUM DIESES MODUL EXISTIERT — Selbstkritik K6 (Prompt Injection):
 * Ein Agent-PEP, der den PROMPT oder die MODELLAUSGABE bewertet, ist
 * durch genau diese Ausgabe manipulierbar. Ein eingeschleuster Text
 * („ignoriere die Richtlinie") wäre dann Teil der Entscheidungsgrundlage.
 *
 * Deshalb gilt hier ohne Ausnahme: Bewertet werden das WERKZEUG und
 * strukturierte Fakten über seinen Aufruf — welches Tool, welches
 * Zielsystem, welcher Anbieter, welche Datenklasse, welche
 * ARGUMENTNAMEN. Niemals Argumentwerte, niemals freier Text, niemals
 * Modellausgabe. Modellausgabe ist Evidenz, nie Autorität.
 *
 * Die Abbildung liegt bewusst hier und nicht in der Agent-Runtime:
 * Es soll genau EINE Stelle geben, die entscheidet, wie ein Tool-Aufruf
 * in eine Policy-Anfrage übersetzt wird (der Fragmentierungs-Befund aus
 * §1.4 des Plans). Die Agent-Runtime verantwortet nur die Frage, welche
 * Felder ihren Prozess überhaupt verlassen dürfen.
 *
 * Rein und importfrei bis auf die Typen — läuft in Deno und Vitest.
 */

import type { DecisionRequest } from './core.ts';

export interface ToolCallInput {
  /** Fachliche Agent-Kennung aus der Registry (z. B. 'evidence-agent'). */
  agent_id: string;
  /** Principal-ID aus P1-1, falls der Agent als Principal geführt wird. */
  agent_principal_id?: string;
  /** Name des aufgerufenen Werkzeugs. */
  tool: string;
  /** Aufgabenart des Laufs (taskType der Agent-Runtime). */
  task_type?: string;
  /** Zielsystem, das das Werkzeug anspricht. */
  target_system_id?: string;
  vendor?: string;
  model?: string;
  /** Vom Aufrufer deklarierte Datenklasse. */
  data_classification?: string;
  data_types?: string[];
  /** Lokal erkannte Signalnamen — nie Inhalte (siehe classify.ts). */
  signals?: string[];
  /**
   * NAMEN der Aufrufargumente — niemals deren Werte. Erlaubt Regeln wie
   * „Werkzeug X mit Argument `attachment` ist freigabepflichtig", ohne
   * dass je ein Argumentwert die Entscheidungsgrundlage berührt.
   */
  argument_keys?: string[];
  /** Ob die Agent-Registry für diesen Lauf menschliche Prüfung verlangt. */
  requires_human_review?: boolean;
}

/** Kanal, unter dem Agent-Entscheidungen im Prüfpfad erscheinen. */
export const AGENT_CHANNEL = 'agent_runtime';

/**
 * Baut die Entscheidungsanfrage. Alles, was nicht in `ToolCallInput`
 * steht, existiert für den PDP nicht — die Struktur IST die Grenze.
 */
export function toolCallToDecisionRequest(
  tenantId: string | null,
  tc: ToolCallInput,
): DecisionRequest {
  return {
    contract: 'v1',
    tenant_id: tenantId,
    principal: {
      type: 'agent',
      // Ohne Principal-Bindung bleibt die fachliche Agent-Kennung die
      // Identität — dann greifen Rollenregeln nicht, Typregeln schon.
      id: tc.agent_principal_id ?? undefined,
    },
    action: {
      verb: 'tool_call',
      channel: AGENT_CHANNEL,
      event_type: 'tool_call',
      event_source: 'agent_runtime',
    },
    target: {
      system_id: tc.target_system_id,
      vendor: tc.vendor,
      model: tc.model,
    },
    data: {
      classification: tc.data_classification,
      data_types: tc.data_types,
      signals: tc.signals,
    },
    // payload speist den generischen Bedingungs-Fallback: Eine
    // governance_policy mit { tool: 'evidence_export' } trifft damit.
    payload: {
      tool: tc.tool,
      agent_id: tc.agent_id,
      ...(tc.task_type ? { task_type: tc.task_type } : {}),
      ...(tc.argument_keys && tc.argument_keys.length > 0
        ? { argument_keys: tc.argument_keys }
        : {}),
      ...(tc.requires_human_review !== undefined
        ? { requires_human_review: tc.requires_human_review }
        : {}),
    },
  };
}

/**
 * Prüft eine eingehende Tool-Call-Nutzlast, bevor sie zur Anfrage wird.
 * Gibt eine Fehlermeldung zurück oder null.
 *
 * Streng, weil diese Struktur die Manipulationsgrenze ist: Ein Feld, das
 * hier durchrutscht, landet in der Entscheidungsgrundlage.
 */
export function validateToolCall(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return 'tool_call must be an object';
  const tc = raw as Record<string, unknown>;
  if (typeof tc.agent_id !== 'string' || tc.agent_id.length === 0) {
    return 'tool_call.agent_id is required';
  }
  if (typeof tc.tool !== 'string' || tc.tool.length === 0) {
    return 'tool_call.tool is required';
  }
  for (const key of ['agent_principal_id', 'task_type', 'target_system_id', 'vendor', 'model', 'data_classification']) {
    if (tc[key] !== undefined && typeof tc[key] !== 'string') {
      return `tool_call.${key} must be a string`;
    }
  }
  for (const key of ['data_types', 'signals', 'argument_keys']) {
    if (tc[key] !== undefined) {
      if (!Array.isArray(tc[key])) return `tool_call.${key} must be an array of strings`;
      if ((tc[key] as unknown[]).some((v) => typeof v !== 'string')) {
        return `tool_call.${key} must be an array of strings`;
      }
    }
  }
  if (tc.requires_human_review !== undefined && typeof tc.requires_human_review !== 'boolean') {
    return 'tool_call.requires_human_review must be a boolean';
  }
  return null;
}
