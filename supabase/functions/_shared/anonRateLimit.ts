// Rate-Limit für anonyme Pfade.
//
// Herausgelöst aus `governance-agent/index.ts`, damit ein zweiter anonymer
// Pfad (SiteOS-Build) dieselbe Schranke benutzt statt einer eigenen. Zwei
// Limiter nebeneinander hiessen: zwei Zahlen, zwei Fenster, und beim
// nächsten Vorfall die Frage, welcher gegriffen hat.
//
// ## Was diese Schranke leistet — und was nicht
//
// Der Zähler liegt **im Arbeitsspeicher der Isolate**. Er überlebt keinen
// Kaltstart, und mehrere gleichzeitige Isolate zählen getrennt. Damit ist er
// eine Bremse gegen Wiederholung aus derselben Quelle, **keine** Abwehr
// gegen einen verteilten Angriff.
//
// Das ist bewusst so übernommen und nicht nebenbei „verbessert": Ein
// belastbares Limit braucht einen gemeinsamen Zähler (KV oder Datenbank),
// und das ist eine eigene Entscheidung mit eigenen Kosten. Was hier steht,
// ist der Bestand — unverändert, nur an einem Ort.
//
// Der Prüfpfad ist davon unberührt: Jede anonyme Anfrage schreibt eine Zeile
// in `anon_chat_runs`, bevor gearbeitet wird (`reserveAnonAudit`). Die
// Nachvollziehbarkeit hängt nicht am Zähler.

export interface AnonRateLimitDecision {
  allowed: boolean;
  /**
   * Nur bei der **ersten** Ablehnung im Fenster true. Ohne diese
   * Unterscheidung schriebe eine abgelehnte Quelle bei jedem Folgeaufruf
   * eine weitere Zeile — die Ablehnung würde selbst zur Last.
   */
  shouldAuditDeny: boolean;
}

export interface AnonRateLimitOptions {
  /** Erlaubte Anfragen je Fenster. */
  max?: number;
  /** Fensterlänge in Millisekunden. */
  windowMs?: number;
  /** Eigener Zählerraum. Getrennte Pfade teilen sich sonst ein Kontingent. */
  bucket?: string;
}

const DEFAULT_MAX = 5;
const DEFAULT_WINDOW_MS = 60_000;

const counters = new Map<string, { count: number; reset: number; auditedDeny: boolean }>();

/**
 * Prüft und verbucht eine Anfrage.
 *
 * Der Aufruf ist nicht seiteneffektfrei: Er zählt hoch. Zweimal für dieselbe
 * Anfrage aufgerufen, verbraucht er zwei Einheiten.
 */
export function checkAnonRateLimit(
  ipHash: string,
  options: AnonRateLimitOptions = {},
): AnonRateLimitDecision {
  const max = options.max ?? DEFAULT_MAX;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const key = options.bucket ? `${options.bucket}:${ipHash}` : ipHash;

  const now = Date.now();
  const rec = counters.get(key);

  if (!rec || now > rec.reset) {
    counters.set(key, { count: 1, reset: now + windowMs, auditedDeny: false });
    return { allowed: true, shouldAuditDeny: false };
  }

  if (rec.count >= max) {
    const firstDeny = !rec.auditedDeny;
    rec.auditedDeny = true;
    return { allowed: false, shouldAuditDeny: firstDeny };
  }

  rec.count += 1;
  return { allowed: true, shouldAuditDeny: false };
}

/** Nur für Tests: setzt alle Zähler zurück. */
export function resetAnonRateLimits(): void {
  counters.clear();
}
