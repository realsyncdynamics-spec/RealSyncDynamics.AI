// Kontingent für anonyme Aufrufe.
//
// ── Warum das hier steht und nicht im Handler ────────────────────────────
//
// `governance-agent` trägt seit Längerem eine eigene, im Speicher gehaltene
// Begrenzung. Sie ist erprobt, aber sie ist dort eingebaut und nicht
// prüfbar. Dieses Modul ist dieselbe Logik als reine Funktion: Der Zustand
// wird übergeben statt global gehalten, damit ein Test ihn setzen und das
// Verhalten an den Rändern belegen kann.
//
// **Offen und benannt**: `governance-agent` benutzt weiterhin seine eigene
// Kopie. Eine laufende Sicherheitsstrecke im selben Zug umzubauen, in dem
// eine neue entsteht, ist die riskantere Reihenfolge — die Zusammenführung
// gehört in einen eigenen Schritt.
//
// ── Warum Speicher allein nicht reicht ───────────────────────────────────
//
// Eine Begrenzung im Arbeitsspeicher gilt je Instanz und ist nach einem
// Kaltstart weg. Für einen Chat ist das vertretbar. Für einen Build, der
// Modellaufrufe auslöst, ist es das nicht: Wer oft genug einen Kaltstart
// erwischt, zahlt nichts und wir alles. Deshalb gibt es hier zwei Stufen —
// der Speicher fängt die schnellen Wiederholungen ab, die Datenbank zieht
// die eigentliche Grenze.

/** Zustand eines Zeitfensters je Schlüssel. */
export interface RateWindow {
  count: number;
  /** Zeitpunkt in ms, ab dem das Fenster neu beginnt. */
  reset: number;
  /**
   * Wurde für dieses Fenster bereits ein Ablehnungs-Eintrag geschrieben?
   *
   * Ohne diese Marke schriebe ein abgelehnter Aufrufer bei jedem weiteren
   * Versuch eine neue Zeile — die Ablehnung würde damit selbst zur Last,
   * gegen die sie schützen soll.
   */
  auditedDeny: boolean;
}

export interface RateDecision {
  allowed: boolean;
  /** Nur beim **ersten** Ablehnen im Fenster wahr. */
  shouldAuditDeny: boolean;
  /** Verbleibende Aufrufe im Fenster. 0, wenn abgelehnt. */
  remaining: number;
}

export interface RateLimitOptions {
  max: number;
  windowMs: number;
}

/**
 * Prüft und verbucht einen Aufruf.
 *
 * Verändert `state` — das ist Absicht: Die Begrenzung muss auch dann zählen,
 * wenn der Aufruf später scheitert. Wer erst nach Erfolg zählt, lädt dazu
 * ein, Fehler zu erzeugen, um das Kontingent zu schonen.
 */
export function consumeRateLimit(
  state: Map<string, RateWindow>,
  key: string,
  nowMs: number,
  options: RateLimitOptions,
): RateDecision {
  const existing = state.get(key);

  if (!existing || nowMs > existing.reset) {
    state.set(key, { count: 1, reset: nowMs + options.windowMs, auditedDeny: false });
    return { allowed: true, shouldAuditDeny: false, remaining: Math.max(0, options.max - 1) };
  }

  if (existing.count >= options.max) {
    const firstDeny = !existing.auditedDeny;
    existing.auditedDeny = true;
    return { allowed: false, shouldAuditDeny: firstDeny, remaining: 0 };
  }

  existing.count++;
  return { allowed: true, shouldAuditDeny: false, remaining: Math.max(0, options.max - existing.count) };
}

/**
 * Entfernt abgelaufene Fenster.
 *
 * Ohne Aufräumen wächst die Zuordnung mit jeder je gesehenen Herkunft. Bei
 * einer kurzlebigen Instanz fällt das nicht auf, bei einer langlebigen schon —
 * und genau die will man haben.
 */
export function pruneRateWindows(state: Map<string, RateWindow>, nowMs: number): number {
  let removed = 0;
  for (const [key, window] of state) {
    if (nowMs > window.reset) {
      state.delete(key);
      removed++;
    }
  }
  return removed;
}

// ─────────────────────────────────────────────────────────────────────────
//  Grenzen
// ─────────────────────────────────────────────────────────────────────────

/**
 * Schnelle Wiederholungen im Arbeitsspeicher.
 *
 * Absichtlich enger als die Tagesgrenze: Wer in einer Minute mehr als drei
 * Websites erzeugen will, probiert nicht aus, sondern automatisiert.
 */
export const ANON_BUILD_BURST: RateLimitOptions = { max: 3, windowMs: 60_000 };

/**
 * Die eigentliche Grenze, gezählt in der Datenbank.
 *
 * Sie überlebt Kaltstarts und gilt über alle Instanzen. Der Wert ist
 * grosszügig genug, dass ein echter Interessent mehrfach ausprobieren und
 * nachbessern kann, und eng genug, dass die Modellkosten je Herkunft
 * beschränkt bleiben.
 */
export const ANON_BUILD_DAILY: RateLimitOptions = { max: 20, windowMs: 24 * 60 * 60 * 1000 };

/**
 * Schnelle Wiederholungen beim Ändern eines Entwurfs.
 *
 * Deutlich grosszügiger als beim Bauen, weil Ändern der Normalfall ist: Wer
 * eine Seite formt, macht das in kurzer Folge — „grösser", „doch heller",
 * „Team weg". Eine Grenze, die dabei greift, würde genau das Verhalten
 * bestrafen, das das Produkt erzeugen will.
 *
 * Teuer ist die Änderung nicht: Sie ist deterministisch, ohne Modellaufruf.
 * Die Grenze schützt deshalb nur vor maschineller Wiederholung.
 */
export const ANON_ITERATE_BURST: RateLimitOptions = { max: 15, windowMs: 60_000 };

/**
 * Wie viele Fassungen ein einzelner Entwurf haben darf.
 *
 * Die eigentliche Grenze der Änderung — sie hängt am Entwurf, nicht an der
 * Herkunft, und ist damit nicht durch einen Adresswechsel zu umgehen. Jede
 * Fassung belegt eine Zeile in der Kette; ohne Deckel wäre die Kette eines
 * einzelnen Entwurfs unbegrenzt.
 */
export const ANON_DRAFT_MAX_REVISIONS = 60;
