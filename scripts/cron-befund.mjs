// Befundzeilen des Cron-Health-Guards — Format, Rueckgewinnung, Fingerabdruck.
//
// ## Warum es dieses Modul gibt
//
// Erkennung und Zustellung funktionieren: Seit dem 2026-09-22 haelt
// `drift-alert.yml` Issue #1521 offen, der Guard ist jeden Tag rot und nennt
// im Protokoll die Ursache. Trotzdem galt der Cron-Ausfall im Oktober als
// „nur durch manuelle Pruefung aufgefallen". Der Grund steht in den
// Kommentaren des Issues: 35-mal derselbe Satz, „❌ Weiterhin rot — Lauf #n".
// Kein Kommentar nannte die Ursache, und als die Antworten am Wechsel von
// 401 (falsches Secret) auf 500 (`CRON_KEY_MISSING`, Secret fehlt) die
// Ursache wechselten, sah der Kommentar genauso aus wie am Vortag.
//
// Ein Alarm, dessen Text sich nie aendert, wird nach drei Tagen nicht mehr
// gelesen. Deshalb gibt der Guard seine Befunde zusaetzlich als
// maschinenlesbare Zeilen aus, und der Zusteller holt sie aus dem Protokoll:
//
//   Guard ──► Protokoll  "BEFUND| C · HTTP 500 · … | 24×"
//                 └──► drift-alert ──► Kommentar mit Ursache,
//                                      „geaendert" oder „unveraendert seit …"
//
// Der Fingerabdruck enthaelt Klasse, Status, Ursache und Jobnamen, aber keine
// Anzahlen und Zeitpunkte: 24 statt 23 Fehlschlaege sind derselbe Befund,
// 500 statt 401 ist ein neuer.
//
// Rein, ohne Netz und ohne Abhaengigkeiten — `drift-alert.yml` importiert es
// per `import()` aus dem ausgecheckten Default-Branch.

export const PRAEFIX = 'BEFUND| ';

const ANZAHL_RE = / \| (\d+)×$/;
const ZEITSTEMPEL_RE = /^\d{4}-\d\d-\d\dT[\d:.]+Z\s/;
const MARKER_RE = /<!-- cron-befund: ([0-9a-f]{8}) seit=(\S+) -->/;

/** Eine Befundzeile fuer das Protokoll. `anzahl` ist optional. */
export function formatBefundZeile({ schluessel, anzahl }) {
  const einzeilig = String(schluessel).replace(/\s+/g, ' ').trim();
  return `${PRAEFIX}${einzeilig}${anzahl != null ? ` | ${anzahl}×` : ''}`;
}

/**
 * Holt die Befundzeilen aus einem Job-Protokoll von GitHub Actions.
 *
 * Jede Protokollzeile beginnt dort mit einem Zeitstempel
 * (`2026-10-26T13:36:17.3025060Z `); lokal ausgefuehrt fehlt er. Beides wird
 * akzeptiert.
 */
export function befundAusLog(text) {
  const zeilen = [];
  for (const roh of String(text ?? '').split(/\r?\n/)) {
    const zeile = roh.replace(ZEITSTEMPEL_RE, '');
    if (!zeile.startsWith(PRAEFIX)) continue;
    const rest = zeile.slice(PRAEFIX.length).trim();
    const m = ANZAHL_RE.exec(rest);
    zeilen.push(
      m
        ? { schluessel: rest.slice(0, m.index), anzahl: Number(m[1]) }
        : { schluessel: rest, anzahl: null },
    );
  }
  return zeilen;
}

/** Kurzer, stabiler Fingerabdruck (FNV-1a, 32 Bit) ueber die Schluessel. */
export function fingerabdruck(zeilen) {
  const text = [...new Set(zeilen.map((z) => z.schluessel))].sort().join('\n');
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Liest Fingerabdruck und Beginn aus einem frueheren Kommentar. */
export function leseMarker(body) {
  const m = MARKER_RE.exec(String(body ?? ''));
  return m ? { fingerabdruck: m[1], seit: m[2] } : null;
}

export function marker(fp, seit) {
  return `<!-- cron-befund: ${fp} seit=${seit} -->`;
}

/** Befundliste als Markdown. Backticks im Text wuerden das Inline-Code brechen. */
export function befundMarkdown(zeilen) {
  return zeilen
    .map((z) => {
      const text = z.schluessel.replace(/`/g, "'");
      return `- \`${text}\`${z.anzahl != null ? ` — ${z.anzahl}×` : ''}`;
    })
    .join('\n');
}

/**
 * Text eines Folgekommentars auf dem offenen Cron-Issue.
 *
 * `vorher` ist der Marker des juengsten Kommentars mit Befundliste (oder
 * null). Gleicher Fingerabdruck → „unveraendert seit", sonst „geaendert".
 * Ohne lesbare Befundzeilen bleibt es beim bisherigen Satz, ergaenzt um den
 * Hinweis, dass das Protokoll selbst zu oeffnen ist — dann ohne Marker, damit
 * der naechste lesbare Lauf wieder richtig vergleicht.
 */
export function folgeKommentar({ zeilen, vorher, link, when }) {
  if (zeilen.length === 0) {
    return [
      `❌ Weiterhin rot — ${link} (${when}).`,
      '',
      'Die Befundzeilen waren im Protokoll nicht lesbar; Ursache bitte im Lauf selbst nachsehen.',
    ].join('\n');
  }

  const fp = fingerabdruck(zeilen);
  const liste = befundMarkdown(zeilen);

  if (vorher && vorher.fingerabdruck === fp) {
    return [
      `❌ Weiterhin rot — ${link} (${when}). Befund **unverändert seit ${vorher.seit}**:`,
      '',
      liste,
      '',
      marker(fp, vorher.seit),
    ].join('\n');
  }

  return [
    `⚠️ **Befund hat sich geändert** — ${link} (${when}). Jetzt:`,
    '',
    liste,
    '',
    vorher
      ? 'Der vorige Stand steht im letzten Kommentar mit Befundliste. Eine neue Ursache braucht meist eine andere Behebung.'
      : 'Erster Kommentar mit Befundliste — ab jetzt meldet jeder Lauf, ob sich der Befund geändert hat.',
    '',
    marker(fp, when),
  ].join('\n');
}
