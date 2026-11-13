// Reine Hilfsfunktionen für den Governance-Arbeitsbereich im Command Center.

/** Antwortform der Mutationen aus `resourcesApi` (`archive_asset`, `toggle_policy`). */
export interface MutationResult {
  ok: boolean;
  error?: { code: string; message: string };
}

/**
 * Ergebnis einer Mutation in eine Fehlermeldung übersetzen (`null` = ok).
 * `resourcesApi.call` liefert Server- und Netzfehler als `{ ok: false }`
 * statt zu werfen — das frühere Dashboard hat diese Antwort ignoriert und
 * damit Fehler still verschluckt.
 */
export function mutationError(result: MutationResult | null | undefined, fallback: string): string | null {
  if (result?.ok) return null;
  return result?.error?.message || fallback;
}
