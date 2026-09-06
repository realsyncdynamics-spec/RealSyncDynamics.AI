/**
 * Was ein freigegebener Command tatsaechlich tut.
 *
 * Bewusst die einzige Stelle im Gateway, die Fachlogik enthaelt — und
 * bewusst noch leer: Govard ist die Governance-Schicht VOR austauschbaren
 * Agenten, kein Agent. Hier haengt spaeter der erste Referenz-Consumer
 * (n8n-Webhook, OpenAI, Claude, Zapier), ohne dass Policy Engine,
 * Zustandsautomat oder Evidence-Kette etwas davon mitbekommen.
 *
 * Der Rumpf laeuft in einem Workflow-Schritt mit Wiederholung. Zwei Regeln
 * gelten deshalb fuer alles, was hier eingehaengt wird:
 *
 *  1. Idempotent. Ein wiederholter Schritt ruft die Funktion erneut auf.
 *     Wer von hier aus eine Zahlung ausloest oder eine Mail verschickt,
 *     braucht einen eigenen Idempotenzschluessel beim Zielsystem —
 *     der des Gateways schuetzt nur den Eingang, nicht die Wirkung.
 *  2. Transiente Fehler werfen (werden wiederholt), fachliche Fehler
 *     dagegen als NonRetryableError, damit der Command zuegig FAILED wird,
 *     statt dreimal gegen dieselbe Wand zu laufen.
 */
export async function runIntent(
  intent: string,
  payload: Record<string, unknown>,
): Promise<unknown> {
  return { executor: "echo", intent, payload_keys: Object.keys(payload).sort() };
}
