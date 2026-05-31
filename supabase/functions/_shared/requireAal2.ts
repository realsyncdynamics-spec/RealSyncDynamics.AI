// requireAal2 — Edge-Helfer für server-seitiges AAL2-Gewahrsein (P0d).
//
// KONTEXT: #504 erzwingt AAL2 in der UI. Die eigentlichen privilegierten
// Aktionen laufen aber über Edge Functions (oft mit Service-Role → RLS umgangen).
// Dieser Helfer liest den `aal`-Claim aus dem bereits plattform-verifizierten
// Bearer-JWT (verify_jwt=true) — er DEKODIERT nur, verifiziert NICHTS neu und
// baut KEINE eigene MFA/Auth-Logik.
//
// P0d-PHASE 1 = OBSERVE ONLY. `observeAal2` loggt nur (AAL2_OK /
// AAL2_REQUIRED_OBSERVED) und BLOCKT NIE. Hartes Enforce folgt separat,
// freigabepflichtig.

export type Aal = 'aal1' | 'aal2' | null;

/** base64url → JSON-String (Edge/Deno + Node: `atob` ist überall vorhanden). */
function decodeBase64UrlJson(segment: string): unknown {
  const b64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const json = atob(padded);
  return JSON.parse(json);
}

/**
 * Liest den `aal`-Claim aus einem Supabase-Access-Token. Akzeptiert sowohl
 * "Bearer <jwt>" als auch das nackte JWT. Gibt `null` bei fehlendem/kaputtem
 * Token oder fehlendem Claim — niemals Throw (Observe darf nie stören).
 */
export function decodeAalFromJwt(token: string | null | undefined): Aal {
  if (!token) return null;
  const raw = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
  const parts = raw.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = decodeBase64UrlJson(parts[1]) as { aal?: unknown };
    if (payload?.aal === 'aal2') return 'aal2';
    if (payload?.aal === 'aal1') return 'aal1';
    return null;
  } catch {
    return null;
  }
}

/** Reiner Prädikat-Check: ist die Session auf AAL2? */
export function isAal2(token: string | null | undefined): boolean {
  return decodeAalFromJwt(token) === 'aal2';
}

export interface Aal2Observation {
  aal: Aal;
  ok: boolean;     // true, wenn aal2
  event: 'AAL2_OK' | 'AAL2_REQUIRED_OBSERVED';
}

/**
 * OBSERVE-ONLY (P0d Phase 1): protokolliert den AAL2-Status eines Requests,
 * BLOCKT aber NICHT. `context` = Function-/Aktionsname für die Telemetrie.
 * Rückgabe erlaubt späteres Hard-Enforce ohne erneute Dekodierung.
 */
export function observeAal2(token: string | null | undefined, context: string): Aal2Observation {
  const aal = decodeAalFromJwt(token);
  const ok = aal === 'aal2';
  const event = ok ? 'AAL2_OK' : 'AAL2_REQUIRED_OBSERVED';
  // Strukturierte Log-Zeile (ein JSON pro Event) — auswertbar in Supabase-Logs.
  const line = JSON.stringify({ evt: event, fn: context, aal: aal ?? 'unknown' });
  if (ok) console.info(line);
  else console.warn(line);
  return { aal, ok, event };
}
