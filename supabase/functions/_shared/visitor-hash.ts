// Pseudonymisierung für Pageview-Analytics (`public.page_views`).
//
// Reine Helper-Funktionen, vitest-importierbar — keine Deno-only-Imports.
//
// Warum HMAC statt reinem sha256:
//   Der Eingaberaum ist klein. IPv4 ist mit 2^32 vollständig durchprobierbar,
//   und ein User-Agent-String ist aus einer Handvoll gängiger Varianten
//   geraten. Ein ungesalzener Hash ist damit praktisch umkehrbar und trägt
//   als Pseudonymisierung im Sinne von Art. 4 Nr. 5 DSGVO kaum. Der Salt
//   liegt ausschließlich serverseitig in den Function-Secrets, ist dem
//   Angreifer also nicht bekannt.
//   Dieselbe Begründung wie in `_shared/subject-ref.ts`.
//
// Warum beide Werte einen UTC-Tagesbestandteil tragen:
//   Beide sind damit auf einen Kalendertag begrenzt. Über Tagesgrenzen
//   hinweg lässt sich derselbe Besucher nicht wiedererkennen — genau das,
//   was der Dateikopf von `track-pageview` und der Spaltenkommentar der
//   Migration zusagen. Ein Wert ohne Tagesbestandteil wäre über die
//   Aufbewahrungsfrist von 90 Tagen ein stabiles Wiedererkennungsmerkmal.

/** Scope-Tag im HMAC-Input. Verhindert, dass beide Werte identisch werden. */
export type HashScope = 'visitor' | 'session';

export interface VisitorHashInput {
  /** Client-IP aus X-Forwarded-For / CF-Connecting-IP. */
  ip: string;
  /** User-Agent-Header, ggf. leer. */
  userAgent: string;
  /** Zeitpunkt des Requests — bestimmt den UTC-Tag. */
  at: Date;
  /** Serverseitiges Geheimnis (PAGEVIEW_HASH_SALT). */
  salt: string;
}

export interface VisitorHashes {
  visitor_hash: string;
  session_hash: string;
  /** Der verwendete UTC-Tag (YYYY-MM-DD) — für Tests und Debugging. */
  day: string;
}

/** UTC-Kalendertag als YYYY-MM-DD. */
function utcDay(at: Date): string {
  if (Number.isNaN(at.getTime())) throw new Error('utcDay: invalid date');
  return at.toISOString().slice(0, 10);
}

// Längenpräfixe statt reiner Trennzeichen: ein User-Agent darf '|' enthalten
// und könnte sonst eine andere IP/UA-Kombination vortäuschen, die denselben
// Hash ergibt.
function canonicalMessage(scope: HashScope, ip: string, userAgent: string, day: string): string {
  return `${scope}|${day}|${ip.length}:${ip}|${userAgent.length}:${userAgent}`;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  if (!secret) throw new Error('hmacSha256Hex: empty secret');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Leitet `visitor_hash` und `session_hash` für einen Pageview ab.
 *
 * Beide Werte sind auf den UTC-Tag begrenzt und mit demselben serverseitigen
 * Salt gebildet. Sie unterscheiden sich nur durch das Scope-Tag, sind also
 * nicht ineinander überführbar, ohne den Salt zu kennen.
 *
 * @throws wenn der Salt leer ist — es wird bewusst kein ungesalzener
 *         Ersatzwert geschrieben (fail closed).
 */
export async function computeVisitorHashes(input: VisitorHashInput): Promise<VisitorHashes> {
  if (!input.salt) throw new Error('computeVisitorHashes: PAGEVIEW_HASH_SALT is not set');
  const day = utcDay(input.at);
  const [visitor_hash, session_hash] = await Promise.all([
    hmacSha256Hex(input.salt, canonicalMessage('visitor', input.ip, input.userAgent, day)),
    hmacSha256Hex(input.salt, canonicalMessage('session', input.ip, input.userAgent, day)),
  ]);
  return { visitor_hash, session_hash, day };
}

export const __internals = { utcDay, canonicalMessage, hmacSha256Hex };
