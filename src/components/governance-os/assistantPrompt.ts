/**
 * Öffnet den Assistenten der App-Shell mit vorbefülltem Text.
 *
 * Auslöser (z. B. „Session starten“ in der Übersicht) senden
 * `new CustomEvent(ASSISTANT_PROMPT_EVENT, { detail: { prompt } })`;
 * GovernanceBrowserShell öffnet daraufhin GovernanceChatSidebar. Gesendet wird
 * erst durch den Nutzer — der Chat routet über die USA und zeigt vorher den
 * Hinweis.
 */
export const ASSISTANT_PROMPT_EVENT = 'realsync:assistant-prompt';

export interface AssistantPromptDetail {
  prompt?: string;
}
