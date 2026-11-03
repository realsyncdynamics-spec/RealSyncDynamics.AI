/**
 * Signal „seitenweiter Assistent soll weichen“.
 *
 * Ein modaler Dialog (z. B. der Produkt-Dialog auf /unternehmen) setzt dieses
 * Attribut auf `<body>`, solange er offen ist. `AssistentChip` beobachtet es
 * und blendet den Chip so lange aus: Er läge sonst über dem Dialog, wäre
 * klickbar und stünde außerhalb der Fokusfalle.
 *
 * Eigenes Modul, damit Seiten den Chip (lazy, mit AgentWidget) nicht
 * mitladen müssen, nur um das Signal zu setzen.
 */
export const ASSISTANT_SUPPRESS_ATTR = 'data-assistant-suppressed';

/** Setzt das Signal; die Rückgabe hebt es wieder auf (für `useEffect`). */
export function suppressAssistant(): () => void {
  if (typeof document === 'undefined' || !document.body) return () => undefined;
  const body = document.body;
  const prev = body.getAttribute(ASSISTANT_SUPPRESS_ATTR);
  body.setAttribute(ASSISTANT_SUPPRESS_ATTR, '');
  return () => {
    if (prev === null) body.removeAttribute(ASSISTANT_SUPPRESS_ATTR);
    else body.setAttribute(ASSISTANT_SUPPRESS_ATTR, prev);
  };
}
