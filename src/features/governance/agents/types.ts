/**
 * Typen fuer das Agent-Register (kontrollierte Governance-Agenten).
 *
 * Diese Registry ist die kontrollierte Sicht auf alle Governance-Agenten:
 * was sie tun, welche Werkzeuge sie nutzen, was sie NICHT tun, und an
 * welchen Punkten Human Review zwingend ist.
 *
 * Der View ist Phase A reine Anzeige — Agenten werden NICHT vom View
 * ausgefuehrt. Die spaetere Runtime-Ausfuehrung (n8n / Edge-Functions)
 * liest dieselbe Datenstruktur und ist ueber `restrictedActions` und
 * `requiresHumanReview` gebunden.
 */

export type AgentType =
  | 'detection'
  | 'classification'
  | 'evidence'
  | 'policy'
  | 'triage'
  | 'remediation';

export type AgentStatus =
  | 'active'
  | 'paused'
  | 'review_required'
  | 'disabled';

export type AgentRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface GovernanceAgent {
  id: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
  riskLevel: AgentRiskLevel;

  /** Erlaubte Werkzeuge / Tools. */
  tools: string[];

  /** Erlaubte Berechtigungen. */
  permissions: string[];

  /** Aktionen, die der Agent NIE eigenstaendig ausfuehren darf. */
  restrictedActions: string[];

  /** Schritte/Punkte, an denen Human Review zwingend ist. */
  requiresHumanReview: string[];

  /** Letzter Lauf (ISO-Timestamp) oder null, wenn nie. */
  lastRunAt: string | null;

  /** Verantwortliche Rolle (z. B. „governance.owner", „dsb"). */
  ownerRole: string;

  /** Pointer in das Evidence-System (Hash, Pfad, ID). */
  evidenceRefs: string[];

  /** Kurze Beschreibung (DE). */
  description: string;
}
