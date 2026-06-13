// Shared POST-helper für öffentliche (verify_jwt=false) Supabase Edge
// Functions wie `gdpr-audit`.
//
// Hintergrund: Ein roher `fetch(...).then(r => r.json())` wirft
// "Unexpected end of JSON input", sobald die Antwort einen leeren oder
// nicht-JSON Body hat — z. B. wenn VITE_SUPABASE_URL in einem Deploy nicht
// gesetzt ist und der Request dadurch relativ gegen den eigenen
// SPA-Host geht (404/405 mit leerem Body) statt gegen Supabase. Dieser
// Helper liefert in solchen Fällen eine verständliche Fehlermeldung statt
// des kryptischen JSON-Parse-Fehlers.
export async function postEdgeFunction<T>(fn: string, body: unknown): Promise<T> {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!SUPABASE_URL) {
    throw new Error('Backend nicht erreichbar (VITE_SUPABASE_URL ist nicht konfiguriert).');
  }

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await resp.text();
  let data: unknown = null;
  if (text) {
    try { data = JSON.parse(text); } catch {
      throw new Error(`Ungültige Server-Antwort (HTTP ${resp.status}).`);
    }
  }

  const payload = (data ?? {}) as { ok?: boolean; error?: { message?: string } };
  if (!resp.ok || !payload.ok) {
    throw new Error(payload.error?.message ?? `HTTP ${resp.status}`);
  }
  return data as T;
}
