// Freitext → Änderungsanweisung.
//
// „mach den Hero grösser" ist der Satz, um den es geht. Er muss in eine
// Operation übersetzt werden, die `applyEdit` ausführen kann — deterministisch
// und ohne Modell, aus demselben Grund wie bei `parseBrief`: Ein Modell, das
// an einem Dienstag anders interpretiert, macht den Hash unbeweisbar.
//
// ── Die Regel: erkennen oder ablehnen ───────────────────────────────────
//
// Es wird nicht geraten. Wird kein Muster erkannt, gibt es `null` zurück, und
// der Aufrufer sagt dem Besucher, was stattdessen geht. Eine Näherung wäre
// schlimmer als eine Ablehnung: Der Besucher bekäme eine Änderung, die er
// nicht gewollt hat, in einer Fassung, die er anschliessend übernimmt.
//
// ── Reihenfolge ─────────────────────────────────────────────────────────
//
// Die Muster werden in fester Reihenfolge geprüft, spezifisch vor allgemein.
// „Überschrift: Zahnarzt Hamburg heller" ist eine Textzuweisung, keine
// Helligkeitsänderung — deshalb stehen die ausdrücklichen Zuweisungen zuerst.

import type { BlockKind } from '../types.ts';
import type { EditOp } from './edit.ts';

/** Was der Besucher formulieren kann. Grundlage der Hilfetexte in der UI. */
export interface EditCapability {
  /** Kurzform für die Oberfläche, z. B. „Farbe ändern". */
  label: string;
  /** Ein Satz, der garantiert erkannt wird. */
  example: string;
}

/**
 * Die vollständige Liste dessen, was die Runtime ausführen kann.
 *
 * Diese Liste ist die Antwort auf eine nicht erkannte Anweisung. Sie wird
 * mit ausgeliefert, damit die Oberfläche nichts anbieten muss, was sie sich
 * selbst ausdenkt — und damit sie nichts anbietet, was hier fehlt.
 */
export const EDIT_CAPABILITIES: readonly EditCapability[] = Object.freeze([
  { label: 'Titelbereich betonen', example: 'Mach den Hero grösser' },
  { label: 'Überschrift setzen', example: 'Überschrift: Zahnmedizin in Hamburg' },
  { label: 'Untertitel setzen', example: 'Untertitel: Termine auch am Samstag' },
  { label: 'Namen ändern', example: 'Name: Praxis am Hafen' },
  { label: 'Akzentfarbe ändern', example: 'Mach die Akzentfarbe grün' },
  { label: 'Hell oder dunkel', example: 'Mach die Seite heller' },
  { label: 'Kanten abrunden', example: 'Mach die Ecken runder' },
  { label: 'Abschnitt entfernen', example: 'Entferne die Team-Sektion' },
  // Bewusst „zurückholen" und nicht „ergänzen": Die Branchen-Presets bringen
  // ihre Abschnitte vollständig mit. Ergänzt werden kann deshalb praktisch
  // nur, was vorher entfernt wurde — „Abschnitt ergänzen" wäre ein Angebot,
  // das auf einem frischen Entwurf fast immer ins Leere liefe.
  { label: 'Entfernten Abschnitt zurückholen', example: 'Füge das Team wieder hinzu' },
]);

/**
 * Benannte Farben → Hex.
 *
 * Bewusst als feste Tabelle statt über CSS-Farbnamen: Die Werte sind auf der
 * dunklen Standardfläche lesbar gewählt. `red` als CSS-Name erreicht auf
 * Obsidian 3.1:1 und verfehlt WCAG AA — die hier hinterlegte Variante nicht.
 * Damit erzeugt die naheliegendste Anweisung nicht sofort einen Befund.
 */
const COLOR_WORDS: Readonly<Record<string, string>> = Object.freeze({
  blau: '#4C82FF', blue: '#4C82FF',
  gruen: '#3DD68C', grün: '#3DD68C', green: '#3DD68C',
  rot: '#FF6B6B', red: '#FF6B6B',
  orange: '#FF9F45',
  gelb: '#F5D547', yellow: '#F5D547',
  lila: '#B48CFF', violett: '#B48CFF', purple: '#B48CFF',
  tuerkis: '#4DD6D6', türkis: '#4DD6D6', teal: '#4DD6D6', cyan: '#4DD6D6',
  pink: '#FF7AC8', magenta: '#FF7AC8',
  weiss: '#FFFFFF', weiß: '#FFFFFF', white: '#FFFFFF',
  grau: '#9AA0A6', gray: '#9AA0A6', grey: '#9AA0A6',
});

/** Abschnittsbegriffe → Blockart. Erster Treffer im Text gewinnt. */
const BLOCK_WORDS: readonly (readonly [string, BlockKind])[] = Object.freeze([
  ['kontaktformular', 'contact-form'],
  ['contact form', 'contact-form'],
  ['kontaktbereich', 'contact-form'],
  ['terminbuchung', 'booking'],
  ['buchung', 'booking'],
  ['booking', 'booking'],
  ['testimonial', 'testimonials'],
  ['bewertungen', 'testimonials'],
  ['stimmen', 'testimonials'],
  ['karte', 'map'],
  ['landkarte', 'map'],
  ['map', 'map'],
  ['team', 'team'],
  ['faq', 'faq'],
  ['häufige fragen', 'faq'],
  ['haeufige fragen', 'faq'],
  ['über uns', 'about'],
  ['ueber uns', 'about'],
  ['about', 'about'],
  ['leistungen', 'services'],
  ['services', 'services'],
  ['vorteile', 'features'],
  ['features', 'features'],
  ['handlungsaufforderung', 'cta'],
  ['call to action', 'cta'],
]);

/** Wörter, die den Titelbereich meinen. */
const HERO_WORDS = ['hero', 'titelbereich', 'kopfbereich', 'headerbereich', 'aufmacher'];

const BIGGER = ['grösser', 'größer', 'groesser', 'bigger', 'larger', 'prominenter', 'auffälliger', 'auffaelliger'];
const SMALLER = ['kleiner', 'smaller', 'kompakter', 'dezenter', 'schmaler'];

const REMOVE_VERBS = ['entferne', 'entfernen', 'lösche', 'loesche', 'löschen', 'weg mit', 'remove', 'delete', 'raus mit', 'ohne '];
const ADD_VERBS = ['füge', 'fuege', 'hinzufügen', 'hinzufuegen', 'ergänze', 'ergaenze', 'add ', 'brauche ein', 'brauche eine'];

/**
 * Übersetzt einen Satz in genau eine Anweisung, oder `null`.
 *
 * `null` heisst „nicht verstanden", nicht „nichts zu tun" — die beiden
 * Fälle sind getrennt, weil der Aufrufer sie unterschiedlich beantwortet:
 * Auf „nicht verstanden" folgt die Liste des Möglichen, auf „nichts zu tun"
 * die Feststellung, dass der Wert bereits so steht.
 */
export function parseEditIntent(input: string): EditOp | null {
  const raw = input.trim();
  if (raw === '') return null;

  // ── 1. Ausdrückliche Zuweisungen ───────────────────────────────────
  // Stehen zuerst, weil ihr Wert Freitext ist und jedes andere Muster
  // enthalten kann.
  const assignment = raw.match(/^\s*(überschrift|ueberschrift|headline|titel|untertitel|subline|unterzeile|name|firmenname)\s*[:=]\s*(.+)$/i);
  if (assignment) {
    const field = assignment[1].toLowerCase();
    const value = assignment[2].trim();
    if (field === 'name' || field === 'firmenname') return { op: 'site.name', value };
    if (field === 'untertitel' || field === 'subline' || field === 'unterzeile') {
      return { op: 'hero.subline', value };
    }
    return { op: 'hero.headline', value };
  }

  const text = raw.toLowerCase();

  // ── 2. Titelbereich betonen ────────────────────────────────────────
  if (HERO_WORDS.some((w) => text.includes(w))) {
    if (BIGGER.some((w) => text.includes(w))) return { op: 'hero.emphasis', value: 'large' };
    if (SMALLER.some((w) => text.includes(w))) return { op: 'hero.emphasis', value: 'compact' };
  }

  // ── 3. Abschnitt entfernen oder ergänzen ───────────────────────────
  // Vor den Themenmustern: „entferne die Karte" enthält kein Farbwort, aber
  // „füge einen blauen Button hinzu" enthielte eines — die Blockabsicht ist
  // die speziellere.
  const block = matchBlockKind(text);
  if (block !== null) {
    if (REMOVE_VERBS.some((v) => text.includes(v))) return { op: 'block.remove', kind: block };
    if (ADD_VERBS.some((v) => text.includes(v))) return { op: 'block.add', kind: block };
  }

  // ── 4. Akzentfarbe ─────────────────────────────────────────────────
  const hex = raw.match(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/);
  if (hex) return { op: 'theme.accent', value: hex[0] };

  // Ein Farbwort zählt nur, wenn auch von Farbe die Rede ist. Sonst würde
  // „entferne den grünen Bereich" die Akzentfarbe setzen.
  //
  // Bewusst als Teilzeichenkette und nicht wortweise: „Akzentfarbe" ist ein
  // Wort, enthält aber beide Signale. Eine Wortgrenzenprüfung würde genau
  // die naheliegendste Formulierung durchfallen lassen.
  if (COLOR_CONTEXT.test(text)) {
    for (const [word, value] of Object.entries(COLOR_WORDS)) {
      if (wordish(word).test(text)) return { op: 'theme.accent', value };
    }
  }

  // ── 5. Hell oder dunkel ────────────────────────────────────────────
  if (/\b(heller|hell|light|hellem|weisser|weißer)\b/.test(text)) {
    return { op: 'theme.appearance', value: 'light' };
  }
  if (/\b(dunkler|dunkel|dark|dunklem)\b/.test(text)) {
    return { op: 'theme.appearance', value: 'dark' };
  }

  // ── 6. Kantenform ──────────────────────────────────────────────────
  // Feste Zielwerte statt relativer Schritte: Eine Anweisung, die vom
  // aktuellen Wert abhängt, ergibt bei zweimaliger Ausführung zwei
  // verschiedene Blueprints aus derselben Eingabe.
  if (/\b(runder|abgerundet|rund|rounded|weicher)\b/.test(text)) return { op: 'theme.radius', value: 12 };
  if (/\b(kantiger|eckig|eckiger|scharf|hard edge|kanten)\b/.test(text)) return { op: 'theme.radius', value: 0 };

  return null;
}

/** „Hier geht es um Farbe" — als Teilzeichenkette, siehe Begründung oben. */
const COLOR_CONTEXT = /farbe|akzent|accent|colour|color/;

/**
 * Wortgrenze, die deutsche Buchstaben als Buchstaben behandelt.
 *
 * `\\b` ist ASCII-basiert: In „weiß" gilt das `ß` als Nicht-Wortzeichen,
 * weshalb `\\bweiß\\b` am Zeilenende nie zutrifft. Bei einer deutschen
 * Oberfläche ist das kein Randfall, sondern der Normalfall.
 */
function wordish(word: string): RegExp {
  return new RegExp(`(^|[^\\p{L}\\p{N}])${word}($|[^\\p{L}\\p{N}])`, 'u');
}

/** Erster Abschnittsbegriff im Text. Reihenfolge der Tabelle entscheidet. */
function matchBlockKind(text: string): BlockKind | null {
  let best: { index: number; kind: BlockKind } | null = null;
  for (const [word, kind] of BLOCK_WORDS) {
    const index = text.indexOf(word);
    if (index === -1) continue;
    // Frühester Treffer gewinnt; bei Gleichstand die Tabellenreihenfolge,
    // damit „kontaktformular" nicht von „formular" überstimmt wird.
    if (best === null || index < best.index) best = { index, kind };
  }
  return best?.kind ?? null;
}
