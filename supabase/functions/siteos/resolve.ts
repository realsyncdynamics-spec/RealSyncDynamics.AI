// Pfad-Auflösung des siteos-Routers — bewusst als reine Funktion ohne
// Deno-Imports, damit vitest sie direkt testen kann (Muster wie
// enterprise-ai-os/resolve.ts).
//
// Supabase reicht den Pfad hinter /functions/v1/ an die Function durch:
// ein Request auf /functions/v1/siteos/runtime-scan kommt hier mit
// pathname "/siteos/runtime-scan" an.

export const ROUTER_SLUG = 'siteos';

/**
 * Extrahiert den Endpunkt-Namen aus dem Request-Pfad.
 * "/siteos/runtime-scan"  → "runtime-scan"
 * "/siteos/"              → null (kein Endpunkt)
 * "/siteos/a/b"           → "a/b" (kein Treffer in der Route-Map → 404)
 *
 * Wichtig: Der alte Bindestrich-Slug "/siteos-builder" darf **nicht** als
 * Router-Pfad durchgehen. Er ist ein eigener Segmentname, kein Präfix — sonst
 * würde ein Aufrufer, der den Cutover verpasst hat, still bedient und der
 * Fehler fiele erst auf, wenn niemand mehr weiß, wo er herkommt.
 */
export function resolveEndpoint(pathname: string): string | null {
  const segments = pathname.split('/').filter((s) => s.length > 0);
  const slugAt = segments.indexOf(ROUTER_SLUG);
  if (slugAt === -1) return null;
  const rest = segments.slice(slugAt + 1);
  if (rest.length === 0) return null;
  return rest.join('/');
}
