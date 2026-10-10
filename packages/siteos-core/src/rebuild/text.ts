// Textbausteine über fremdem Seitentext — linear, ohne Rückverfolgung.
//
// Titel, Firmennamen und Beschreibungen kommen von der abgerufenen Website,
// also von einer beliebigen Gegenseite. Ausdrücke wie `\s*\|\s*` oder
// `\s+(gmbh|…)\b.*$` laufen auf langen Leerraumfolgen quadratisch (ReDoS).
// Deshalb: erst Leerraum linear auf einzelne Leerzeichen zusammenziehen
// (`collapseSpace`), dann nur Ausdrücke mit fester Länge je Versuch.

import { collapseSpace } from './html.ts';

/**
 * Trennzeichen in Seitentiteln („Müller Bau | Heizung – Leipzig"): ein
 * Strich, Punkt oder Doppelpunkt zwischen Leerzeichen oder ein senkrechter
 * Strich mit oder ohne Leerzeichen. Auf zusammengezogenem Text.
 */
const TITLE_SEPARATOR = / [|–—·•:-] | ?\| ?/;

/** Seitentitel in seine Segmente (getrimmt, ohne leere). */
export function splitTitle(title: string): string[] {
  return collapseSpace(title).split(TITLE_SEPARATOR).map((s) => s.trim()).filter((s) => s !== '');
}

/**
 * Rechtsformzusatz am Ende eines Namens. Auf zusammengezogenem Text; jedes
 * Leerzeichen ist höchstens eines (` ?`), damit jeder Versuch eine feste
 * Höchstlänge hat.
 */
const LEGAL_SUFFIX = /(?:, ?| )?(?:(?:Steuerberatungs|Wirtschaftsprüfungs|Rechtsanwalts|Partnerschafts)gesellschaft ?)?(?:mbB|mbH|GmbH ?& ?Co\.? ?KG|GmbH|gGmbH|UG ?\(haftungsbeschränkt\)|UG|AG|KG|OHG|GbR|e\. ?K\.?|e\. ?V\.?|PartG(?: ?mbB)?|SE|Ltd\.?|Inc\.?)\.?$/i;

/** Name ohne Rechtsformzusatz („Müller Haustechnik GmbH" → „Müller Haustechnik"). */
export function stripLegalSuffix(name: string): string {
  let current = collapseSpace(name);
  for (let k = 0; k < 3; k += 1) {
    const next = current.replace(LEGAL_SUFFIX, '').trim();
    if (next === current || next.length < 2) break;
    current = next;
  }
  return current;
}

/** Text bis vor das erste Vorkommen von `pattern` (fester Länge) — oder unverändert. */
export function cutBefore(text: string, pattern: RegExp): string {
  const at = text.search(pattern);
  return at === -1 ? text : text.slice(0, at);
}

/** Für `new RegExp(…)` aus Daten: jedes Sonderzeichen maskiert. */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Skript- und Datenadressen — weder Link noch Formularziel. */
export function isScriptOrDataUrl(value: string): boolean {
  const lower = value.trim().toLowerCase();
  return lower.startsWith('javascript:') || lower.startsWith('vbscript:') || lower.startsWith('data:');
}
