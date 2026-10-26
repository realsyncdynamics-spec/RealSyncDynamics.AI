import type { GovernanceAgentId } from './governanceAgents';

/**
 * Öffnet den Assistenten der App-Shell mit vorbefülltem Text.
 *
 * Auslöser (z. B. die Agenten-Eingabe der Übersicht) senden
 * `new CustomEvent(ASSISTANT_PROMPT_EVENT, { detail: { prompt, agent } })`;
 * GovernanceBrowserShell öffnet daraufhin GovernanceChatSidebar und wählt den
 * Agenten vor. Gesendet wird erst durch den Nutzer — der Chat routet über die
 * USA und zeigt vorher den Hinweis.
 */
export const ASSISTANT_PROMPT_EVENT = 'realsync:assistant-prompt';

export interface AssistantPromptDetail {
  prompt?: string;
  /** Vorgewählter Governance-Agent (`@`-Auswahl). */
  agent?: GovernanceAgentId;
}

/** Vorbefüllung für GovernanceChatSidebar; `id` erzwingt das Übernehmen auch bei gleichem Text. */
export interface AssistantPrefill {
  id: number;
  text: string;
  agent?: GovernanceAgentId;
}
