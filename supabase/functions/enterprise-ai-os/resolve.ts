// Pfad-Auflösung des enterprise-ai-os-Routers — bewusst als reine Funktion
// ohne Deno-Imports, damit vitest sie direkt testen kann (Muster wie
// _shared/schedule-assets.ts).
//
// Supabase reicht den Pfad hinter /functions/v1/ an die Function durch:
// ein Request auf /functions/v1/enterprise-ai-os/agents-run kommt hier mit
// pathname "/enterprise-ai-os/agents-run" an.

export const ROUTER_SLUG = 'enterprise-ai-os';

/**
 * Extrahiert den Endpunkt-Namen aus dem Request-Pfad.
 * "/enterprise-ai-os/agents-run"  → "agents-run"
 * "/enterprise-ai-os/"            → null (kein Endpunkt)
 * "/enterprise-ai-os/a/b"         → "a/b" (kein Treffer in der Route-Map → 404)
 */
export function resolveEndpoint(pathname: string): string | null {
  const segments = pathname.split('/').filter((s) => s.length > 0);
  const slugAt = segments.indexOf(ROUTER_SLUG);
  if (slugAt === -1) return null;
  const rest = segments.slice(slugAt + 1);
  if (rest.length === 0) return null;
  return rest.join('/');
}
