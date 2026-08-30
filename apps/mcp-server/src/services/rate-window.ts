/**
 * Zähler mit festem Zeitfenster — für Schranken, die @fastify/rate-limit nicht
 * abdecken kann.
 *
 * **Warum überhaupt eigener Code:** Das Plugin lässt je Anfrage genau *eine*
 * Schranke greifen. Es markiert die Anfrage beim ersten Durchlauf
 * (`rateLimitRan`) und überspringt jede weitere — eine route-eigene
 * `config.rateLimit` bleibt also wirkungslos, sobald die globale Schranke
 * bereits gelaufen ist. Für eine zweite, engere Schranke braucht es deshalb
 * einen eigenen Zähler.
 *
 * **Warum an dieser Stelle und nicht an der Route:** Die teure Kettenprüfung
 * ist über zwei Wege erreichbar — die REST-Route und das Werkzeug
 * `evidence_verify_chain` über `/mcp`. Eine an die Route gehängte Schranke
 * ließe den zweiten Weg offen. Gezählt wird deshalb dort, wo beide Wege
 * zusammenlaufen.
 *
 * Die Zählung liegt im Prozessspeicher und gilt damit je Instanz. Das ist für
 * den derzeitigen Ein-Instanz-Betrieb ausreichend; bei mehreren Instanzen
 * bräuchte es einen gemeinsamen Speicher (Redis), sonst vervielfacht sich die
 * effektive Schranke mit der Instanzzahl.
 */

interface Window {
  count: number;
  /** Zeitpunkt (ms), an dem das Fenster endet. */
  resetAt: number;
}

const windows = new Map<string, Window>();

/** Fehler mit Wartezeit — vom Fehler-Handler auf 429 samt Retry-After abgebildet. */
export class RateLimitError extends Error {
  override readonly name = 'RateLimitError';
  constructor(
    message: string,
    readonly retryAfterSeconds: number,
  ) {
    super(message);
  }
}

/**
 * Verbucht einen Zugriff auf `key` und meldet, ob er noch im Kontingent liegt.
 *
 * Abgelaufene Fenster werden dabei aufgeräumt: Ohne das wüchse die Map mit
 * jedem je gesehenen Tenant und gäbe einem Angreifer mit vielen Schlüsseln
 * einen Speicherhebel.
 */
export function consume(
  key: string,
  max: number,
  windowMs: number,
  now: number = Date.now(),
): { allowed: boolean; retryAfterSeconds: number } {
  for (const [k, w] of windows) {
    if (w.resetAt <= now) windows.delete(k);
  }

  const existing = windows.get(key);
  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > max) {
    // Aufgerundet: eine Wartezeit von 0 lüde zum sofortigen Wiederholen ein.
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Verbucht einen Zugriff und wirft, sobald das Kontingent überschritten ist. */
export function enforce(key: string, max: number, windowMs: number, label: string): void {
  const { allowed, retryAfterSeconds } = consume(key, max, windowMs);
  if (!allowed) {
    throw new RateLimitError(
      `${label}: Kontingent von ${max} Aufrufen pro ${Math.round(windowMs / 1000)} s ausgeschöpft.`,
      retryAfterSeconds,
    );
  }
}

/** Nur für Tests — setzt alle Fenster zurück. */
export function resetWindows(): void {
  windows.clear();
}
