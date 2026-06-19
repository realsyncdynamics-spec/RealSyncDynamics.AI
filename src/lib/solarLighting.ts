/**
 * solarLighting — plausible (nicht astronomisch perfekte) Sonnenrichtung für
 * die Hero-Erde, abhängig von Datum/Uhrzeit und Standort (Default: Deutschland).
 *
 * Szenen-Konvention (Hero-Kamera blickt entlang −Z auf die Erde, Europa vorn):
 *   +X = Osten (rechts) · +Y = Norden (oben) · +Z = Zenit über Mitteleuropa
 *   (zur Kamera). Die Funktion liefert die Sonnenrichtung in genau diesem
 *   Welt-Koordinatensystem, sodass `dot(surfaceNormal, sunDir)` für die
 *   Tag/Nacht-Grenze im Shader direkt verwendbar ist.
 *
 * Modell (dokumentierte Approximation):
 *   - Deklination δ  ≈ 23.44° · sin(360°·(N−81)/365)   (N = Tag im Jahr)
 *   - Stundenwinkel  H = 15°·(wahre Ortszeit − 12)       (morgens negativ)
 *   - Lokale Horizontalkoordinaten (Azimut/Höhe) aus δ, H und Breite φ,
 *     anschließend nach ENU (East/North/Up) projiziert.
 *
 * Referenz-Design: ~11:16 Uhr Ortszeit Deutschland → Vormittagslicht,
 * Mitteleuropa klar im Tageslicht, Sonne hoch aus südlicher/östlicher Richtung.
 */

export interface Vec3 { x: number; y: number; z: number }

export interface SolarOptions {
  /** Zeitpunkt (Default: jetzt). */
  date?: Date;
  /** Breitengrad (Default: Deutschland, Mitte). */
  lat?: number;
  /** Längengrad (Default: Deutschland, Mitte). */
  lon?: number;
  /**
   * Mindest-Frontbeleuchtung: hebt die Sonnenrichtung in Richtung Betrachter
   * (+Z) an, damit das zur Kamera gewandte Europa stets im Tageslicht liegt
   * (Hero-Lesbarkeit). 0 = rein physikalisch, 1 = stark frontlastig.
   */
  frontBias?: number;
}

const DEG = Math.PI / 180;
const DEFAULT_LAT = 51.1657;
const DEFAULT_LON = 10.4515;

function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  return Math.floor((d.getTime() - start) / 86_400_000);
}

/**
 * Sonnenrichtung als normalisierter Vektor in Szenen-Weltkoordinaten.
 */
export function getSunDirection(opts: SolarOptions = {}): Vec3 {
  const date = opts.date ?? new Date();
  const lat = opts.lat ?? DEFAULT_LAT;
  const lon = opts.lon ?? DEFAULT_LON;
  const frontBias = opts.frontBias ?? 0.55;

  // Deklination
  const decl = 23.44 * DEG * Math.sin(360 * DEG * ((dayOfYear(date) - 81) / 365));

  // Wahre Ortszeit (grobe Näherung über Längengrad-Offset zur UTC)
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60;
  const solarTime = utcHours + lon / 15; // 15° Länge ≈ 1 h
  const hourAngle = 15 * DEG * (solarTime - 12); // morgens < 0

  const phi = lat * DEG;

  // Sonnenhöhe
  const sinAlt =
    Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(hourAngle);
  const altitude = Math.asin(Math.max(-1, Math.min(1, sinAlt)));

  // Azimut (von Norden, im Uhrzeigersinn über Osten)
  const cosAz =
    (Math.sin(decl) - Math.sin(phi) * Math.sin(altitude)) /
    (Math.cos(phi) * Math.cos(altitude) || 1e-6);
  let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz)));
  if (hourAngle > 0) azimuth = 2 * Math.PI - azimuth; // nachmittags → Westen

  // Lokale ENU-Komponenten (East/North/Up)
  const cosAlt = Math.cos(altitude);
  let x = cosAlt * Math.sin(azimuth); // Ost
  let y = cosAlt * Math.cos(azimuth); // Nord
  let z = Math.sin(altitude); // Zenit (zur Kamera)

  // Front-Bias: Europa zur Kamera bleibt beleuchtet, auch früh/spät am Tag.
  z = z * (1 - frontBias) + frontBias;
  // leichte Anhebung nach oben für den Hero-Look (Flare über dem Horizont)
  y += 0.12;

  const len = Math.hypot(x, y, z) || 1;
  return { x: x / len, y: y / len, z: z / len };
}

export default getSunDirection;
