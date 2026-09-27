/**
 * Typen für das Agent-/Bot-Register (kontrollierte OS-Objekte).
 *
 * Das Register ist ein **Katalog** der Agenten- und Bot-Typen, die das
 * Governance OS führt — kein Mandanten-Datenbestand. Jeder Eintrag sagt, was
 * das Objekt darf, was es nie darf, wann ein Mensch freigibt und welche
 * Nachweise entstehen.
 *
 * Der Reifegrad (`maturity`) wird nicht hier gesetzt, sondern aus einer
 * belegten Quelle abgeleitet (`AGENT_MESH` oder `implementation-status.ts`),
 * siehe `agentCatalog.ts`. So kann das Register keinen Status behaupten, den
 * die Runtime nicht trägt.
 *
 * Abgelöst (WP5, 2026-09-27): `GovernanceAgent` mit `status: 'active' | …`
 * und das Demo-Set `DEMO_AGENTS`. Deren Felder sind hier aufgegangen:
 * `ownerRole` → `owner`, `restrictedActions` → `forbiddenActions`,
 * `requiresHumanReview` → `reviewMode` + `reviewPoints`,
 * `tools`/`permissions` → `allowedActions` + `dataAccess`.
 * `lastRunAt` und `evidenceRefs` entfallen — ein Katalog hat keine Läufe.
 */
import type { ImplementationStatus } from '../../../product/implementation-status';

export type AgentKind = 'agent' | 'bot';

export type GovernedAgentType =
  | 'compliance'
  | 'evidence'
  | 'security'
  | 'onboarding'
  | 'website_chat'
  | 'voice'
  | 'whatsapp'
  | 'browser'
  | 'builder'
  | 'workflow';

export type AgentRiskLevel = 'low' | 'medium' | 'high' | 'critical';

/** Wann ein Mensch vor der Ausführung freigibt. */
export type AgentReviewMode = 'always' | 'on_risk' | 'none';

/** Welche Nachweise ein Lauf erzeugen muss. */
export type AgentEvidenceRequirement = 'every_action' | 'on_decision' | 'none';

export interface GovernedAgentEntry {
  id: string;
  kind: AgentKind;
  agentType: GovernedAgentType;
  name: string;
  /** Verantwortliche Rolle (z. B. „governance.owner", „dsb"). */
  owner: string;
  /** Zweck in einem Satz (DE). */
  purpose: string;
  /** Datenklassen, auf die das Objekt zugreifen darf. */
  dataAccess: readonly string[];
  /** Erlaubte Aktionen (Whitelist, Default-Deny). */
  allowedActions: readonly string[];
  /** Aktionen, die das Objekt NIE eigenständig ausführen darf. */
  forbiddenActions: readonly string[];
  reviewMode: AgentReviewMode;
  /** Feste Punkte, an denen der Lauf für eine Freigabe anhält. */
  reviewPoints: readonly string[];
  riskLevel: AgentRiskLevel;
  evidenceRequirement: AgentEvidenceRequirement;
  /** Abgeleitet aus AGENT_MESH bzw. implementation-status.ts — nie frei gesetzt. */
  maturity: ImplementationStatus;
  /** Nur true, wenn die Quelle einen Preview-/Live-Lauf belegt. */
  runnable: boolean;
  /** Woher `maturity` und `runnable` stammen (für Tests und Transparenz). */
  statusSource: string;
}
