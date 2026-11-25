// openAssistant — öffnet den öffentlichen Assistenten (AssistentChip) von
// beliebiger Stelle aus, z. B. über die „KI fragen“-Pill im Header.
//
// Der AssistentChip hört auf das Event und ruft `preventDefault()`, wenn er
// das Panel öffnet. Ist auf der aktuellen Route kein Chip montiert (z. B.
// /audit, /checkout, /dashboard), bleibt das Event unbehandelt und der
// Aufrufer bekommt `false` zurück, um auf einen Rückfall-Pfad zu wechseln.

export const OPEN_ASSISTANT_EVENT = 'rsd:open-assistant';

/**
 * Rückfall-Ziel, wenn auf der Route kein Assistent verfügbar ist.
 * Führt auf die Produktseite KI-Bots & Voice-Agenten (K4: KI-Mitarbeiter
 * zuerst), nicht mehr auf den Website-Check `/audit`.
 */
export const ASSISTANT_FALLBACK_HREF = '/ki-bots?source=ki-fragen';

/** @returns true, wenn ein Assistent das Öffnen übernommen hat. */
export function openAssistant(): boolean {
  if (typeof window === 'undefined') return false;
  const event = new Event(OPEN_ASSISTANT_EVENT, { cancelable: true });
  // dispatchEvent liefert false, sobald ein Listener preventDefault() ruft.
  return !window.dispatchEvent(event);
}
