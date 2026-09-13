#!/usr/bin/env node
/**
 * Erzeugt `public/europe-relief.json` — die vorprojizierte Europa-Geometrie
 * für den Hintergrund der Startseite (`EuropeReliefBackdrop.tsx`).
 *
 * ## Warum vorberechnet?
 *
 * Der Design-Prototyp lud `d3` + `topojson-client` per CDN und projizierte im
 * Browser. Für die Produktion ist das dreifach schlecht: zwei zusätzliche
 * Runtime-Abhängigkeiten (~90 kB), ein Third-Party-Request auf einer Seite,
 * die DSGVO-Konformität verkauft, und eine Karte, die ohne Netz verschwindet.
 *
 * Stattdessen läuft die Projektion genau einmal — hier — und das Ergebnis ist
 * ein statisches Asset mit fertigen SVG-Pfaden. Die Komponente rendert nur
 * noch `<path d="…">`. Keine Laufzeit-Dependency, kein CDN, kein Fremd-Request.
 *
 * ## Quelle
 *
 * `world-atlas@2.0.2/countries-110m.json` (Natural Earth, public domain).
 * Nicht als Dependency geführt — einmalig beschaffen:
 *
 *     npm pack world-atlas@2.0.2 && tar xzf world-atlas-2.0.2.tgz
 *     node scripts/generate-europe-relief.mjs package/countries-110m.json
 *
 * Ohne Argument wird `node_modules/world-atlas/countries-110m.json` gesucht.
 *
 * ## Projektion
 *
 * Mercator, gefittet auf die Box (-24°/34° → 44°/71°) in das Feld
 * [[60,60],[940,940]] einer 1000×1000-viewBox — identisch zum Prototyp
 * (`d3.geoMercator().fitExtent(…)`). Die Parameter (k, tx, ty) liegen im
 * Output, damit die Komponente Pins und Datenströme selbst projizieren kann,
 * ohne die Mathematik zu duplizieren.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');

/** EU-27 nach ISO 3166-1 numeric. Bewusst exakt: Die Karte steht auf einer
 *  Compliance-Seite — „ungefähr die EU" wäre hier ein inhaltlicher Fehler. */
const EU_27 = new Set([
  '040', '056', '100', '191', '196', '203', '208', '233', '246', '250',
  '276', '300', '348', '372', '380', '428', '440', '442', '470', '528',
  '616', '620', '642', '703', '705', '724', '752',
]);

/** Sichtfenster: Features mit mindestens einem Punkt darin werden gerendert. */
const WINDOW = { lonMin: -32, lonMax: 52, latMin: 33, latMax: 73 };

/** Fit-Box und Zielfeld — 1:1 aus dem Prototyp. */
const FIT_BBOX = { lonMin: -24, latMin: 34, lonMax: 44, latMax: 71 };
const SIZE = 1000;
const PAD = 60;

// ── TopoJSON-Dekodierung ────────────────────────────────────────────────
// Die Spezifikation ist klein genug, dass `topojson-client` als
// Build-Dependency den Aufwand nicht lohnt: Arcs sind Delta-kodiert und
// quantisiert, ein negativer Index ~i meint „Arc i rückwärts".

function decodeArcs(topology) {
  const { scale: [sx, sy], translate: [tx, ty] } = topology.transform;
  return topology.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * sx + tx, y * sy + ty];
    });
  });
}

/** Arc-Indizes einer Ring-Definition zu einer durchgehenden Punktfolge. */
function ringPoints(arcIndexes, arcs) {
  const points = [];
  for (const index of arcIndexes) {
    const reversed = index < 0;
    const arc = arcs[reversed ? ~index : index];
    const segment = reversed ? arc.slice().reverse() : arc;
    // Der Endpunkt eines Arcs ist der Startpunkt des nächsten — sonst
    // entstehen doppelte Stützpunkte in jedem Pfad.
    for (let i = points.length ? 1 : 0; i < segment.length; i++) points.push(segment[i]);
  }
  return points;
}

/** Geometrie → Liste von Ringen (Polygon und MultiPolygon). */
function geometryRings(geometry, arcs) {
  if (geometry.type === 'Polygon') {
    return geometry.arcs.map((ring) => ringPoints(ring, arcs));
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.arcs.flatMap((polygon) => polygon.map((ring) => ringPoints(ring, arcs)));
  }
  return [];
}

// ── Mercator mit fitExtent ──────────────────────────────────────────────

const rad = (deg) => (deg * Math.PI) / 180;
const mercX = (lon) => rad(lon);
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + rad(lat) / 2));

function buildProjection() {
  const x0 = mercX(FIT_BBOX.lonMin);
  const x1 = mercX(FIT_BBOX.lonMax);
  const yTop = mercY(FIT_BBOX.latMax);
  const yBottom = mercY(FIT_BBOX.latMin);

  const span = SIZE - 2 * PAD;
  const k = Math.min(span / (x1 - x0), span / (yTop - yBottom));

  // Zentriert im Zielfeld — entspricht dem Verhalten von d3 fitExtent.
  const tx = PAD + (span - k * (x1 - x0)) / 2 - k * x0;
  const ty = PAD + (span - k * (yTop - yBottom)) / 2 + k * yTop;

  return { k, tx, ty };
}

const { k, tx, ty } = buildProjection();
const project = (lon, lat) => [mercX(lon) * k + tx, ty - mercY(lat) * k];

// ── Pfadausgabe ─────────────────────────────────────────────────────────

const round = (n) => Math.round(n * 10) / 10;

/** Ringe → SVG-Pfad. Ringe weit außerhalb der Leinwand fallen weg: Sie sind
 *  unter der radialen Maske ohnehin unsichtbar, blähen die Datei aber auf. */
function ringsToPath(rings) {
  const parts = [];
  for (const ring of rings) {
    if (ring.length < 3) continue;

    const projected = ring.map(([lon, lat]) => project(lon, lat));
    const xs = projected.map((p) => p[0]);
    const ys = projected.map((p) => p[1]);
    const outside =
      Math.max(...xs) < -400 || Math.min(...xs) > SIZE + 400 ||
      Math.max(...ys) < -400 || Math.min(...ys) > SIZE + 400;
    if (outside) continue;

    let d = '';
    let previous = null;
    for (const [x, y] of projected) {
      const point = [round(x), round(y)];
      // Aufeinanderfolgende identische Punkte nach dem Runden überspringen.
      if (previous && point[0] === previous[0] && point[1] === previous[1]) continue;
      d += `${d ? 'L' : 'M'}${point[0]},${point[1]}`;
      previous = point;
    }
    if (d) parts.push(`${d}Z`);
  }
  return parts.join('');
}

/** Gradnetz: In Mercator sind Meridiane senkrecht und Breitenkreise
 *  waagerecht — zwei Stützpunkte je Linie genügen. */
function graticulePath() {
  const parts = [];
  for (let lon = -30; lon <= 50; lon += 10) {
    const a = project(lon, 32);
    const b = project(lon, 73);
    parts.push(`M${round(a[0])},${round(a[1])}L${round(b[0])},${round(b[1])}`);
  }
  for (let lat = 40; lat <= 70; lat += 10) {
    const a = project(-30, lat);
    const b = project(50, lat);
    parts.push(`M${round(a[0])},${round(a[1])}L${round(b[0])},${round(b[1])}`);
  }
  return parts.join('');
}

// ── Lauf ────────────────────────────────────────────────────────────────

const sourceArg = process.argv[2];
const candidates = [
  sourceArg,
  join(root, 'node_modules/world-atlas/countries-110m.json'),
].filter(Boolean);

const source = candidates.find((path) => existsSync(path));
if (!source) {
  console.error(
    '::error::countries-110m.json nicht gefunden.\n' +
      'Beschaffen mit:  npm pack world-atlas@2.0.2 && tar xzf world-atlas-2.0.2.tgz\n' +
      'Dann:            node scripts/generate-europe-relief.mjs package/countries-110m.json',
  );
  process.exit(2);
}

const topology = JSON.parse(readFileSync(source, 'utf8'));
const arcs = decodeArcs(topology);

const countries = [];
for (const geometry of topology.objects.countries.geometries) {
  const rings = geometryRings(geometry, arcs);
  if (rings.length === 0) continue;

  const inWindow = rings.some((ring) =>
    ring.some(
      ([lon, lat]) =>
        lon >= WINDOW.lonMin && lon <= WINDOW.lonMax &&
        lat >= WINDOW.latMin && lat <= WINDOW.latMax,
    ),
  );
  if (!inWindow) continue;

  const d = ringsToPath(rings);
  if (!d) continue;

  // Nicht jedes Gebiet hat eine ISO-Nummer: Kosovo und Nordzypern führt
  // Natural Earth ohne `id`. Ein `String(undefined)` als Schlüssel kollidiert
  // — deshalb ein eigener `key`, der auf den Namen zurückfällt, während `id`
  // die ISO-Nummer bleibt (oder leer, wenn es keine gibt).
  const id = geometry.id == null ? '' : String(geometry.id);
  const name = geometry.properties?.name ?? '';
  const key = id || name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `feature-${countries.length}`;

  countries.push({ key, id, name, eu: EU_27.has(id), d });
}

countries.sort((a, b) => Number(a.eu) - Number(b.eu) || a.key.localeCompare(b.key));

const duplicateKeys = countries.map((c) => c.key).filter((k, i, all) => all.indexOf(k) !== i);
if (duplicateKeys.length > 0) {
  console.error(`::error::Doppelte Schlüssel im Relief: ${duplicateKeys.join(', ')}`);
  process.exit(1);
}

const output = {
  $comment:
    'Generiert von scripts/generate-europe-relief.mjs aus world-atlas@2.0.2/' +
    'countries-110m.json (Natural Earth, public domain). Nicht von Hand ändern.',
  size: SIZE,
  projection: { k, tx, ty },
  graticule: graticulePath(),
  countries,
};

const target = join(root, 'public/europe-relief.json');
writeFileSync(target, `${JSON.stringify(output)}\n`);

const bytes = Buffer.byteLength(JSON.stringify(output));
console.log(
  `✓ public/europe-relief.json — ${countries.length} Länder ` +
    `(${countries.filter((c) => c.eu).length} EU-27), ${(bytes / 1024).toFixed(1)} kB`,
);
