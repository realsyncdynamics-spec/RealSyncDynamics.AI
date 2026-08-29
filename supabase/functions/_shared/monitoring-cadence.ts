// Kadenz-Regel der kontinuierlichen Überwachung.
//
// ## Warum das eine eigene, importfreie Datei ist
//
// Die Regel entscheidet, wie oft ein Kunde überwacht wird — also über die
// Ware, denn der Scan ist kostenlos und verkauft wird die Dauer. Eine solche
// Regel gehört geprüft, und ein Test darf dafür keinen Deno-Laufzeitkern
// brauchen. Die Datei hat deshalb **keine Importe**: Sie läuft in Deno wie in
// Vitest.
//
// ## Was sie regelt
//
// Die Kadenz kommt aus zwei Quellen, und beide gelten:
//
//   * `monitoring_sources.scan_frequency` — was der Kunde eingestellt hat
//   * sein Plan — wie oft er das darf
//
// Maßgeblich ist die **langsamere** von beiden. Eine Einstellung, die der
// Plan nicht trägt, wird gedrosselt statt abgelehnt: Der Kunde verliert die
// Überwachung nicht, sie läuft nur in der Frequenz, die er bezahlt.

export type Kadenz = 'hourly' | 'daily' | 'weekly' | 'monthly';

/** Je kleiner, desto häufiger. Die Reihenfolge ist die Drosselungsordnung. */
export const KADENZ_RANG: Readonly<Record<Kadenz, number>> = {
  hourly: 0,
  daily: 1,
  weekly: 2,
  monthly: 3,
};

/** Abstand bis zum nächsten Lauf, in Millisekunden. */
export const KADENZ_ABSTAND_MS: Readonly<Record<Kadenz, number>> = {
  hourly: 3_600_000,
  daily: 86_400_000,
  weekly: 604_800_000,
  monthly: 2_592_000_000,
};

/** Ist der Wert eine bekannte Kadenz? */
export function istKadenz(wert: string | null | undefined): wert is Kadenz {
  return wert !== null && wert !== undefined && wert in KADENZ_RANG;
}

/**
 * Die schnellste Kadenz, die ein Plan zulässt — `null`, wenn der Plan
 * überhaupt keine Überwachung enthält.
 *
 * `monitoring.daily` erlaubt bewusst **daily** und nicht `hourly`: Kein Plan
 * sagt stündliche Läufe zu. Eine Quelle auf `hourly` wird deshalb auch auf
 * der höchsten Stufe auf täglich gedrosselt. Das ist strenger als der
 * Zustand davor und die ehrlichere Auslegung — `hourly` stand in keiner
 * Preisliste.
 *
 * Der Aufrufer übergibt die beiden Berechtigungen, damit diese Datei nichts
 * über die Form von `Entitlements` wissen muss.
 */
export function erlaubteKadenz(hatTaeglich: boolean, hatMonatlich: boolean): Kadenz | null {
  if (hatTaeglich) return 'daily';
  if (hatMonatlich) return 'monthly';
  return null;
}

/**
 * Die langsamere von gewünschter und erlaubter Kadenz.
 *
 * Ein unbekannter Wunschwert wird als `daily` gelesen und dann ohnehin
 * gedrosselt — er darf nicht dazu führen, dass gar nicht mehr überwacht wird.
 */
export function wirksameKadenz(gewuenscht: string | null | undefined, erlaubt: Kadenz): Kadenz {
  const g: Kadenz = istKadenz(gewuenscht) ? gewuenscht : 'daily';
  return KADENZ_RANG[g] < KADENZ_RANG[erlaubt] ? erlaubt : g;
}

/** Zeitpunkt des nächsten Laufs als ISO-String. */
export function naechsterLauf(kadenz: Kadenz, jetzt: number): string {
  return new Date(jetzt + KADENZ_ABSTAND_MS[kadenz]).toISOString();
}
