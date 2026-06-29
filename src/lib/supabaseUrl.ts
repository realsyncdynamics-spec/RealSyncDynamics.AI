// Zentrale Auflösung der Supabase-Basis-URL.
//
// Hintergrund: Öffentliche Landing-/Marketing-Flows (z. B. der DSGVO-Audit-
// Assistent) müssen auch dann funktionieren, wenn ein Deploy ohne gesetztes
// `VITE_SUPABASE_URL` gebaut wurde. In so einem Fall ging der Request relativ
// gegen den SPA-Host und der Scan brach mit „Backend nicht erreichbar
// (VITE_SUPABASE_URL ist nicht konfiguriert)" ab.
//
// Projekt-URL und anon-Key sind öffentlich (sie landen ohnehin im Bundle),
// daher ist die Produktions-URL als Fallback unbedenklich. Dasselbe Muster
// wird bereits in den Shopify-/Telegram-Integrationsseiten verwendet.
export const PRODUCTION_SUPABASE_URL = 'https://ebljyceifhnlzhjfyxup.supabase.co';

// Öffentlicher (publishable) anon-Key des Produktions-Projekts. Wie die
// Projekt-URL landet auch der anon-Key ohnehin im Client-Bundle und ist kein
// Geheimnis — der Service-Role-Key bleibt ausschließlich in Edge Functions.
// Als Fallback sorgt er dafür, dass Auth/Login auch dann funktionieren, wenn
// ein Deploy ohne gesetztes `VITE_SUPABASE_ANON_KEY` gebaut wurde (sonst läuft
// die SPA im Demo-Modus mit Platzhalter-Client und die Anmeldung schlägt fehl).
export const PRODUCTION_SUPABASE_ANON_KEY = 'sb_publishable_BqKKWFM8zcb8R5NXifVgjA_pIYunrhB';

/**
 * Liefert die Supabase-Basis-URL ohne abschließenden Slash. Greift auf die
 * Produktions-Projekt-URL zurück, wenn `VITE_SUPABASE_URL` nicht gesetzt ist.
 */
export function getSupabaseUrl(): string {
  const env = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  return (env || PRODUCTION_SUPABASE_URL).replace(/\/$/, '');
}

/**
 * Liefert den öffentlichen Supabase-anon-Key. Greift auf den Produktions-Key
 * zurück, wenn `VITE_SUPABASE_ANON_KEY` nicht gesetzt ist.
 */
export function getSupabaseAnonKey(): string {
  const env = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
  return env || PRODUCTION_SUPABASE_ANON_KEY;
}
