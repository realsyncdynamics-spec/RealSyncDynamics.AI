// Blueprint → verfeinerter Blueprint.
//
// Der Erstbau (`synthesize.ts`) beantwortet „Was soll gebaut werden?".
// Diese Datei beantwortet die Frage danach: „Mach den Hero höher.",
// „Die Schrift gefällt mir nicht.", „Füge eine Referenzseite hinzu."
//
// ## Warum das deterministisch ist und kein Modellaufruf
//
// Dieselbe Begründung wie bei `parseBrief`, nur schärfer: Eine Verfeinerung
// verändert einen Blueprint, der bereits geprüft, gehasht und dem Kunden
// gezeigt wurde. Würde ein Modell die Änderung frei anwenden, könnte eine
// Bitte um eine andere Schriftart nebenbei ein Kontaktformular ohne
// Rechtsgrundlage oder einen entfernten KI-Hinweis hinterlassen. Hier wird
// deshalb nur ausgeführt, was benannt ist — und nichts sonst.
//
// Ein Sprachmodell darf davor sitzen und freie Sprache in diese Anweisungen
// übersetzen. Es darf den Blueprint nicht selbst schreiben.
//
// ## Was das Ergebnis zusagt
//
//   • Jede strukturelle Änderung leitet das Compliance-Profil neu ab.
//     Ein nachgerüstetes Kontaktformular bringt seine Rechtsgrundlage mit,
//     eine Karte ihre Einwilligungskategorie.
//   • Der KI-Hinweis (Art. 50 EU AI Act) ist nicht entfernbar. Eine
//     Anweisung, die darauf zielt, wird abgelehnt und begründet.
//   • Eine nicht verstandene Anweisung wird als solche gemeldet
//     (`understood: false`) und nicht stillschweigend verschluckt.

import type { BlockKind, SiteBlock, SiteBlueprint, SitePage, SiteTheme } from '../types.ts';
import { meetsWcagAA } from '../render/theme.ts';
import { getIndustryPreset } from './industries.ts';
import type { SiteBrief } from './brief.ts';
import { buildBlock, deriveCompliance, slugify } from './synthesize.ts';

/** Eine angewandte Änderung — Grundlage für Prüfpfad und Rückmeldung. */
export interface RefinementChange {
  /** Stabile Kennung, z. B. `theme.accent`. Wie Befund-Codes: nie umbenennen. */
  code: string;
  /** Was passiert ist, in einem Satz. Wird dem Kunden gezeigt. */
  summary: string;
  /**
   * Compliance-Wirkung der Änderung; `null`, wenn es keine gab. Sichtbar zu
   * machen, dass ein Formular Pflichten auslöst, ist der eigentliche
   * Unterschied zu einem beliebigen Website-Baukasten.
   */
  complianceNote: string | null;
}

export interface RefinementResult {
  blueprint: SiteBlueprint;
  changes: RefinementChange[];
  /**
   * Wurde mindestens ein Teil der Anweisung erkannt? `false` heißt: nichts
   * geändert. Der Aufrufer muss das sagen, statt eine unveränderte Vorschau
   * als Ergebnis auszugeben.
   */
  understood: boolean;
  /** Abgelehnte Anweisungen samt Grund (z. B. KI-Hinweis entfernen). */
  refusals: string[];
}

// ─────────────────────────────────────────────────────────────────────
// Wortlisten
// ─────────────────────────────────────────────────────────────────────

/**
 * Farbnamen → Hex. Bewusst kurz und geprüft: Jeder Wert erreicht auf
 * hellem wie dunklem Grund mindestens 3:1 für großen Text. Wer eine
 * beliebige Farbe will, gibt sie als Hex an.
 */
const NAMED_COLORS: Readonly<Record<string, string>> = Object.freeze({
  blau: '#2563EB', blue: '#2563EB',
  hellblau: '#0EA5E9', cyan: '#0891B2', türkis: '#0D9488', tuerkis: '#0D9488', teal: '#0D9488',
  grün: '#15803D', gruen: '#15803D', green: '#15803D',
  rot: '#DC2626', red: '#DC2626',
  orange: '#C2410C',
  gelb: '#A16207', amber: '#A16207',
  violett: '#7C3AED', lila: '#7C3AED', purple: '#7C3AED',
  magenta: '#BE185D', pink: '#BE185D', rosa: '#BE185D',
  braun: '#78350F',
  grau: '#475569', gray: '#475569', grey: '#475569',
  schwarz: '#111827', black: '#111827',
});

const HEX = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/;

/** Schriftpaare. Display und Body getrennt, damit Überschriften tragen. */
const FONT_SETS: ReadonlyArray<{ terms: string[]; display: string; body: string; label: string }> = [
  {
    terms: ['serif', 'serifen', 'klassisch', 'seriös', 'serioes', 'edel', 'zeitung'],
    display: 'Georgia, "Times New Roman", serif',
    body: 'Georgia, "Times New Roman", serif',
    label: 'klassische Serifenschrift',
  },
  {
    terms: ['mono', 'monospace', 'technisch', 'code'],
    display: '"JetBrains Mono", ui-monospace, monospace',
    body: 'ui-monospace, SFMono-Regular, monospace',
    label: 'technische Monospace-Schrift',
  },
  {
    terms: ['geometrisch', 'modern', 'grotesk', 'markant'],
    display: '"Space Grotesk", system-ui, sans-serif',
    body: 'Inter, system-ui, sans-serif',
    label: 'moderne Grotesk',
  },
  {
    terms: ['schlicht', 'neutral', 'sachlich', 'sans'],
    display: 'Inter, system-ui, sans-serif',
    body: 'Inter, system-ui, sans-serif',
    label: 'neutrale Sans-Serif',
  },
];

/** Nachrüstbare Blöcke. Was hier nicht steht, wird nicht erfunden. */
const ADDABLE_BLOCKS: ReadonlyArray<{ kind: BlockKind; terms: string[]; label: string }> = [
  { kind: 'contact-form', terms: ['kontaktformular', 'kontakt formular', 'anfrageformular', 'contact form'], label: 'Kontaktformular' },
  { kind: 'booking', terms: ['terminbuchung', 'termin buchen', 'buchung', 'reservierung', 'booking'], label: 'Terminbuchung' },
  { kind: 'faq', terms: ['faq', 'häufige fragen', 'haeufige fragen', 'fragen und antworten'], label: 'FAQ' },
  { kind: 'team', terms: ['teamseite', 'team-bereich', 'team bereich', 'mitarbeiter', 'team section'], label: 'Team-Bereich' },
  { kind: 'testimonials', terms: ['bewertungen', 'referenzen', 'stimmen', 'testimonials', 'kundenstimmen'], label: 'Kundenstimmen' },
  { kind: 'map', terms: ['karte', 'anfahrt', 'lageplan', 'map'], label: 'Anfahrtskarte' },
  { kind: 'features', terms: ['vorteile', 'warum wir', 'argumente', 'usp'], label: 'Vorzüge-Bereich' },
  { kind: 'about', terms: ['über uns', 'ueber uns', 'about'], label: 'Über-uns-Bereich' },
];

/** Vorgezeichnete Zusatzseiten. Freie Namen gehen über `SEITE_PATTERN`. */
const ADDABLE_PAGES: ReadonlyArray<{ terms: string[]; path: string; title: string }> = [
  { terms: ['referenzseite', 'referenzen-seite', 'projektseite', 'projekte'], path: '/referenzen', title: 'Referenzen' },
  { terms: ['preisseite', 'preise', 'pricing'], path: '/preise', title: 'Preise' },
  { terms: ['karriereseite', 'karriere', 'jobs', 'stellen'], path: '/karriere', title: 'Karriere' },
  { terms: ['blog', 'aktuelles', 'news'], path: '/aktuelles', title: 'Aktuelles' },
  { terms: ['galerie', 'gallery', 'bildergalerie'], path: '/galerie', title: 'Galerie' },
];

const PAGE_PATTERN = /\b(?:seite|unterseite|page)\s+(?:namens\s+)?[„"'»]?([\wäöüÄÖÜß][\wäöüÄÖÜß \-]{1,40}?)[""'«]?\s*(?:hinzu(?:füg\w*|fueg\w*)?|anlegen|ergänzen|ergaenzen|add)/iu;
const QUOTED = /[„"'»]([^""'«»]{2,80})[""'«]/u;

/** Anweisungen, die auf den KI-Hinweis zielen. Wird nicht ausgeführt. */
const DISCLOSURE_TERMS = ['ki-hinweis', 'ki hinweis', 'ai-hinweis', 'ai hinweis', 'ki-disclaimer', 'transparenzhinweis'];

/** Stämme, die eine Entfernung anzeigen. */
const REMOVE_STEMS = ['entfern', 'lösch', 'loesch', 'streich', 'remove', 'delete'] as const;
const REMOVE_WORDS = ['weg', 'raus'] as const;

/** Stämme, die eine Ergänzung anzeigen. */
const ADD_STEMS = [
  'hinzu', 'ergänz', 'ergaenz', 'anleg', 'einbau', 'einfüg', 'einfueg',
  'füge', 'fuege', 'brauche', 'möchte', 'moechte', 'add',
] as const;

/** Wortteile, die eine Farbabsicht anzeigen. Bewusst als Teilwort geprüft:
 *  „Akzentfarbe" und „Buttonfarbe" sind zusammengesetzt. */
const COLOR_HINTS = ['farb', 'akzent', 'accent', 'button', 'knöpf', 'knoepf', 'color', 'colour'] as const;

/** Ebenso als Teilwort: „Schriftart", „Typografie". */
const FONT_HINTS = ['schrift', 'typograf', 'typograph', 'font'] as const;

// ─────────────────────────────────────────────────────────────────────
// Worterkennung
// ─────────────────────────────────────────────────────────────────────
//
// `\b` ist hier unbrauchbar: Die Wortgrenze von JavaScript kennt nur
// ASCII-Wortzeichen. „überschrift" beginnt für sie mit einem Nicht-Wortzeichen,
// `\büberschrift` trifft also nie. Genau die Wörter, um die es in deutschen
// Anweisungen geht, wären damit blind.
//
// Lookbehind wäre der kurze Weg, ist aber in älteren Safari-Ständen nicht
// verfügbar — und der Kern soll unverändert im Browser laufen. Deshalb wird
// die Grenze selbst geprüft.

const WORDISH = /[\p{L}\p{N}_]/u;

function isWordish(char: string | undefined): boolean {
  return char !== undefined && char !== '' && WORDISH.test(char);
}

/** Kommt eines der Wörter als eigenständiges Wort vor? */
function mentions(text: string, terms: readonly string[]): boolean {
  return terms.some((term) => occursAt(text, term, true));
}

/**
 * Wie `mentions`, prüft aber nur den Wortanfang. Für Stämme: „hinzu" trifft
 * damit „hinzufügen" wie „hinzu", ohne dass beide Formen gepflegt werden
 * müssen.
 */
function mentionsStem(text: string, stems: readonly string[]): boolean {
  return stems.some((stem) => occursAt(text, stem, false));
}

function occursAt(text: string, term: string, requireEnd: boolean): boolean {
  for (let from = 0; ; from += 1) {
    const at = text.indexOf(term, from);
    if (at === -1) return false;
    if (isWordish(text[at - 1])) {
      from = at;
      continue;
    }
    if (!requireEnd || !isWordish(text[at + term.length])) return true;
    from = at;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Einstieg
// ─────────────────────────────────────────────────────────────────────

/**
 * Wendet eine Anweisung in natürlicher Sprache auf einen Blueprint an.
 *
 * Mehrere Regeln dürfen greifen („dunkel und runder" ist eine Anweisung mit
 * zwei Änderungen). Die Reihenfolge der Regeln ist fest, damit dieselbe
 * Anweisung immer dasselbe Ergebnis liefert.
 */
export function refineBlueprint(blueprint: SiteBlueprint, instruction: string): RefinementResult {
  const text = instruction.toLowerCase();
  const changes: RefinementChange[] = [];
  const refusals: string[] = [];

  let next = blueprint;

  // Ablehnungen zuerst — bevor eine Regel den Satz anders auslegt.
  if (wantsRemoval(text) && DISCLOSURE_TERMS.some((term) => text.includes(term))) {
    refusals.push(
      'Der KI-Transparenzhinweis kann nicht entfernt werden: Art. 50 EU AI Act verlangt ihn bei generativ erstellten Inhalten.',
    );
  }

  next = applyThemeMode(next, text, changes);
  next = applyAccent(next, instruction, text, changes);
  next = applyRadius(next, text, changes);
  next = applyFont(next, text, changes);
  next = applyHeroEmphasis(next, text, changes);
  next = applyHeadline(next, instruction, text, changes);
  next = applySiteName(next, instruction, text, changes);
  next = applyPageAddition(next, instruction, text, changes);
  next = applyBlockChange(next, text, changes);

  return {
    blueprint: next,
    changes,
    understood: changes.length > 0 || refusals.length > 0,
    refusals,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Wünsche aus dem Prompt
// ─────────────────────────────────────────────────────────────────────

/**
 * Liest aus einer freien Beschreibung die Bausteine heraus, die jemand
 * ausdrücklich genannt hat.
 *
 * Grund: Der Seitenplan kommt aus dem Branchen-Preset. Steht im Prompt
 * „Projekte, Teamseite, Kontaktformular und Terminbuchung", das Preset kennt
 * aber keine Terminbuchung, dann fehlt sie im Ergebnis — und der Kunde sieht
 * eine Website, die seine Aufzählung ignoriert hat. Das Preset bleibt die
 * Grundlage, die Nennung ergänzt sie.
 *
 * Die Ausgabe sind Anweisungen in derselben Sprache wie die Verfeinerung.
 * Damit läuft der Erstbau durch denselben Weg wie jede spätere Änderung —
 * inklusive Compliance-Neuableitung.
 */
export function deriveRequests(prompt: string): string[] {
  const text = prompt.toLowerCase();
  const requests: string[] = [];

  for (const candidate of ADDABLE_BLOCKS) {
    const term = candidate.terms.find((entry) => mentionsStem(text, [entry]));
    if (term && !negated(text, term)) requests.push(`${candidate.label} hinzufügen.`);
  }

  for (const page of ADDABLE_PAGES) {
    const term = page.terms.find((entry) => mentionsStem(text, [entry]));
    if (term && !negated(text, term)) requests.push(`${page.terms[0]} hinzufügen.`);
  }

  return requests;
}

/** Steht unmittelbar vor dem Begriff eine Verneinung? */
function negated(text: string, term: string): boolean {
  const at = text.indexOf(term);
  if (at <= 0) return false;
  const before = text.slice(Math.max(0, at - 12), at);
  return /\b(ohne|kein|keine|keinen|nicht)\s+$/u.test(before);
}

// ─────────────────────────────────────────────────────────────────────
// Theme
// ─────────────────────────────────────────────────────────────────────

/**
 * Hell/Dunkel tauscht Fläche und Text mit, nicht nur den Modus-Schalter.
 * Ein `mode: 'light'` auf schwarzer Fläche wäre eine Angabe, die das
 * Ergebnis nicht einlöst — und die Kontrastprüfung liefe gegen die
 * falschen Werte.
 */
const SURFACES: Readonly<Record<'dark' | 'light', { surface: string; foreground: string }>> = Object.freeze({
  dark: { surface: '#0A0A0B', foreground: '#E2E2E2' },
  light: { surface: '#F7F8FA', foreground: '#111827' },
});

function applyThemeMode(bp: SiteBlueprint, text: string, changes: RefinementChange[]): SiteBlueprint {
  const wantsDark = mentions(text, ['dunkel', 'dark', 'nacht', 'dunkles']);
  const wantsLight = mentions(text, ['hell', 'helles', 'light', 'weiß', 'weiss', 'freundlich']);
  if (wantsDark === wantsLight) return bp; // beides oder nichts — nicht raten

  const mode: 'dark' | 'light' = wantsDark ? 'dark' : 'light';
  if (bp.theme.mode === mode) return bp;

  changes.push({
    code: 'theme.mode',
    summary: mode === 'dark' ? 'Dunkles Farbschema übernommen.' : 'Helles Farbschema übernommen.',
    complianceNote: null,
  });
  return withTheme(bp, { mode, ...SURFACES[mode] });
}

function applyAccent(bp: SiteBlueprint, raw: string, text: string, changes: RefinementChange[]): SiteBlueprint {
  const hex = HEX.exec(raw)?.[0] ?? null;
  const named = hex ? null : Object.keys(NAMED_COLORS).find((name) => mentions(text, [name]));
  const accent = hex ?? (named ? NAMED_COLORS[named] : null);

  // Ohne Farbabsicht im Satz nichts tun: „Der grüne Bereich ist zu lang"
  // ist keine Farbanweisung.
  const mentionsColor = COLOR_HINTS.some((hint) => text.includes(hint));
  if (accent === null || !mentionsColor) return bp;
  if (accent.toLowerCase() === bp.theme.accent.toLowerCase()) return bp;

  // Der Akzent trägt Beschriftungen auf Buttons und Links. Unter WCAG AA
  // wird das gemeldet, nicht verhindert — die Farbwahl gehört dem Kunden,
  // der Befund gehört in den Prüfpfad.
  const readable = meetsWcagAA(accent, bp.theme.surface, true);
  changes.push({
    code: 'theme.accent',
    summary: `Akzentfarbe auf ${accent} gesetzt.`,
    complianceNote: readable
      ? null
      : `Kontrast von ${accent} auf ${bp.theme.surface} liegt unter WCAG 2.2 AA (3:1 für große Schrift). Die Analyse führt das als Befund.`,
  });
  return withTheme(bp, { accent });
}

function applyRadius(bp: SiteBlueprint, text: string, changes: RefinementChange[]): SiteBlueprint {
  const rounder = mentions(text, ['runder', 'rund', 'abgerundet', 'weicher', 'soft']);
  const sharper = mentions(text, ['kantig', 'eckig', 'scharfkantig', 'hard edge', 'scharf']);
  if (rounder === sharper) return bp;

  const radiusPx = rounder ? 16 : 0;
  if (bp.theme.radiusPx === radiusPx) return bp;

  changes.push({
    code: 'theme.radius',
    summary: rounder ? 'Ecken abgerundet (16px).' : 'Kanten auf Hard Edge gesetzt (0px).',
    complianceNote: null,
  });
  return withTheme(bp, { radiusPx });
}

function applyFont(bp: SiteBlueprint, text: string, changes: RefinementChange[]): SiteBlueprint {
  const mentionsFont = FONT_HINTS.some((hint) => text.includes(hint));
  if (!mentionsFont) return bp;

  const set = FONT_SETS.find((candidate) => candidate.terms.some((term) => text.includes(term)));
  if (!set) return bp;
  if (bp.theme.fontDisplay === set.display && bp.theme.fontBody === set.body) return bp;

  changes.push({
    code: 'theme.font',
    summary: `Schrift auf ${set.label} umgestellt.`,
    complianceNote: null,
  });
  return withTheme(bp, { fontDisplay: set.display, fontBody: set.body });
}

function withTheme(bp: SiteBlueprint, patch: Partial<SiteTheme>): SiteBlueprint {
  return { ...bp, theme: { ...bp.theme, ...patch } };
}

// ─────────────────────────────────────────────────────────────────────
// Inhalt
// ─────────────────────────────────────────────────────────────────────

function applyHeroEmphasis(bp: SiteBlueprint, text: string, changes: RefinementChange[]): SiteBlueprint {
  if (!mentions(text, ['hero', 'kopfbereich', 'titelbereich', 'aufmacher'])) return bp;

  const taller = mentions(text, ['höher', 'hoeher', 'größer', 'groesser', 'prominenter', 'mehr platz', 'bigger', 'taller']);
  const shorter = mentions(text, ['kleiner', 'kompakter', 'flacher', 'niedriger', 'weniger platz', 'smaller']);
  if (taller === shorter) return bp;

  const emphasis = taller ? 'tall' : 'compact';
  const before = firstHeroEmphasis(bp);
  if (before === emphasis) return bp;

  changes.push({
    code: 'content.hero-emphasis',
    summary: taller ? 'Hero-Bereich vergrößert.' : 'Hero-Bereich kompakter gesetzt.',
    complianceNote: null,
  });
  return mapBlocks(bp, (block) =>
    block.kind === 'hero' ? { ...block, content: { ...block.content, emphasis } } : block,
  );
}

function applyHeadline(bp: SiteBlueprint, raw: string, text: string, changes: RefinementChange[]): SiteBlueprint {
  if (!mentions(text, ['überschrift', 'ueberschrift', 'headline', 'titel', 'schlagzeile'])) return bp;
  const quoted = QUOTED.exec(raw)?.[1]?.trim();
  if (!quoted) return bp;

  changes.push({
    code: 'content.headline',
    summary: `Hero-Überschrift auf „${quoted}" geändert.`,
    complianceNote: null,
  });
  return mapBlocks(bp, (block) =>
    block.kind === 'hero' ? { ...block, content: { ...block.content, headline: quoted } } : block,
  );
}

function applySiteName(bp: SiteBlueprint, raw: string, text: string, changes: RefinementChange[]): SiteBlueprint {
  if (!mentions(text, ['nenne', 'benenne', 'heißt', 'heisst', 'name der website', 'firmenname'])) return bp;
  const quoted = QUOTED.exec(raw)?.[1]?.trim();
  if (!quoted || quoted === bp.name) return bp;

  changes.push({
    code: 'content.site-name',
    summary: `Name der Website auf „${quoted}" geändert.`,
    complianceNote: 'Der Name wandert in Impressum und strukturierte Daten — er muss dem tatsächlichen Anbieter entsprechen (§ 5 DDG).',
  });

  const renamed = mapBlocks(bp, (block) => {
    if (block.kind === 'navigation') return { ...block, content: { ...block.content, brand: quoted } };
    if (block.kind === 'hero' && block.content.headline === bp.name) {
      return { ...block, content: { ...block.content, headline: quoted } };
    }
    return block;
  });

  return {
    ...renamed,
    name: quoted,
    slug: slugify(quoted),
    seo: {
      ...renamed.seo,
      siteName: quoted,
      defaultTitle: renamed.seo.locality ? `${quoted} — ${renamed.seo.locality}` : quoted,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Struktur
// ─────────────────────────────────────────────────────────────────────

function applyPageAddition(bp: SiteBlueprint, raw: string, text: string, changes: RefinementChange[]): SiteBlueprint {
  if (!mentionsStem(text, ADD_STEMS)) return bp;

  const preset = ADDABLE_PAGES.find((page) => mentionsStem(text, page.terms));
  const freeform = preset ? null : PAGE_PATTERN.exec(raw)?.[1]?.trim();
  if (!preset && !freeform) return bp;

  const title = preset ? preset.title : titleCase(freeform as string);
  const path = preset ? preset.path : `/${slugify(title)}`;
  if (bp.pages.some((page) => page.path === path)) return bp;

  const brief = briefFromBlueprint(bp);
  const aiGenerated = bp.origin.source === 'ai-builder';
  const kinds: BlockKind[] = ['navigation', 'hero', 'features', 'cta', 'footer'];
  const blocks = kinds.map((kind, index) => buildBlock(kind, index, path, brief, aiGenerated));

  // Der KI-Hinweis sitzt wie beim Erstbau vor dem Fuß — nicht dahinter,
  // wo er außerhalb des Inhaltsbereichs stünde.
  if (aiGenerated) {
    blocks.splice(blocks.length - 1, 0, aiDisclosureFrom(bp, path));
  }

  const page: SitePage = {
    path,
    title,
    description: bp.seo.locality ? `${title} — ${bp.name} in ${bp.seo.locality}.` : `${title} — ${bp.name}.`,
    blocks,
    noindex: false,
  };

  // Die neue Seite muss verlinkt sein, sonst ist sie gebaut und unerreichbar.
  const link = { label: title, href: path };
  const withPage: SiteBlueprint = {
    ...bp,
    pages: [...bp.pages, page].map((existing) => ({
      ...existing,
      blocks: existing.blocks.map((block) =>
        block.kind === 'navigation'
          ? { ...block, content: { ...block.content, links: [...navLinks(block), link] } }
          : block,
      ),
    })),
  };

  changes.push({
    code: 'structure.page-added',
    summary: `Seite „${title}" (${path}) angelegt und in die Navigation aufgenommen.`,
    complianceNote: aiGenerated ? 'Die neue Seite führt den KI-Transparenzhinweis nach Art. 50 EU AI Act.' : null,
  });

  return recompile(withPage, changes);
}

function applyBlockChange(bp: SiteBlueprint, text: string, changes: RefinementChange[]): SiteBlueprint {
  const removing = wantsRemoval(text);
  const adding = mentionsStem(text, ADD_STEMS);
  if (removing === adding) return bp;

  // Wortanfang statt ganzes Wort: Deutsche Zusammensetzungen tragen den
  // Begriff vorn („Anfahrtskarte", „Kontaktformular"). Auf ganze Wörter
  // geprüft, träfe „Anfahrtskarte" weder „anfahrt" noch „karte".
  const target = ADDABLE_BLOCKS.find((candidate) => mentionsStem(text, candidate.terms));
  if (!target) return bp;

  const home = bp.pages.find((page) => page.path === '/');
  if (!home) return bp;

  if (removing) {
    // Entfernen gilt für die ganze Site. Bliebe derselbe Block auf einer
    // Unterseite stehen, wäre er aus der Vorschau verschwunden, aber weiter
    // ausgeliefert — und seine Pflichten (Einwilligung, Rechtsgrundlage)
    // stünden weiter im Compliance-Profil.
    if (!bp.pages.some((page) => page.blocks.some((block) => block.kind === target.kind))) return bp;

    const next: SiteBlueprint = {
      ...bp,
      pages: bp.pages.map((page) => ({
        ...page,
        blocks: page.blocks.filter((block) => block.kind !== target.kind),
      })),
    };
    changes.push({
      code: 'structure.block-removed',
      summary: `${target.label} entfernt.`,
      complianceNote: complianceNoteFor(target.kind, false),
    });
    return recompile(next, changes);
  }

  if (home.blocks.some((block) => block.kind === target.kind)) return bp;

  const brief = briefFromBlueprint(bp);
  const block = buildBlock(target.kind, home.blocks.length, '/', brief, bp.origin.source === 'ai-builder');

  const next = mapPage(bp, '/', (page) => ({ ...page, blocks: insertBeforeClosing(page.blocks, block) }));
  changes.push({
    code: 'structure.block-added',
    summary: `${target.label} auf der Startseite ergänzt.`,
    complianceNote: complianceNoteFor(target.kind, true),
  });
  return recompile(next, changes);
}

/**
 * Setzt einen Block vor die abschließende Gruppe (Handlungsaufforderung,
 * KI-Hinweis, Fuß). Sonst landete ein Kontaktformular unter dem Fuß.
 */
function insertBeforeClosing(blocks: SiteBlock[], block: SiteBlock): SiteBlock[] {
  const closing: BlockKind[] = ['cta', 'ai-disclosure', 'footer'];
  let index = blocks.length;
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    if (!closing.includes(blocks[i].kind)) break;
    index = i;
  }
  return [...blocks.slice(0, index), block, ...blocks.slice(index)];
}

function complianceNoteFor(kind: BlockKind, added: boolean): string | null {
  switch (kind) {
    case 'contact-form':
      return added
        ? 'Löst Art. 6 Abs. 1 lit. b DSGVO aus; Einwilligungstext und Verweis auf die Datenschutzerklärung sind gesetzt.'
        : 'Die zugehörige Rechtsgrundlage entfällt, sofern kein anderer Block sie auslöst.';
    case 'booking':
      return added
        ? 'Terminbuchung verarbeitet personenbezogene Daten (Art. 6 Abs. 1 lit. b DSGVO). Bei Heilberufen ist damit eine DSFA indiziert (Art. 35 DSGVO).'
        : 'Die zugehörige Rechtsgrundlage entfällt, sofern kein anderer Block sie auslöst.';
    case 'map':
      return added
        ? 'Die Karte lädt erst nach Einwilligung (TDDDG § 25 Abs. 1) und ergänzt die Consent-Kategorie „karten".'
        : 'Die Consent-Kategorie „karten" entfällt.';
    case 'testimonials':
      return added
        ? 'Kundenstimmen werden leer angelegt. Erfundene Bewertungen wären irreführende Werbung (§ 5 UWG) — der Block erscheint erst mit echten Inhalten.'
        : null;
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────────────────────────────────

/**
 * Leitet das Compliance-Profil nach jeder strukturellen Änderung neu ab.
 *
 * Das ist der Kern des Ganzen: Der Kunde bittet um ein Kontaktformular und
 * bekommt Rechtsgrundlage und Einwilligungstext mitgeliefert, ohne davon zu
 * wissen. Fiele dieser Schritt aus, wäre der Blueprint nach der zweiten
 * Verfeinerung nicht mehr das, was sein Compliance-Profil behauptet.
 */
function recompile(bp: SiteBlueprint, changes: RefinementChange[]): SiteBlueprint {
  const preset = getIndustryPreset(bp.industry);
  const before = bp.compliance;
  const compliance = deriveCompliance(briefFromBlueprint(bp), bp.pages, preset.compliance);

  if (before.dpiaRequired !== compliance.dpiaRequired && compliance.dpiaRequired) {
    changes.push({
      code: 'compliance.dpia-required',
      summary: 'Datenschutz-Folgenabschätzung ist jetzt erforderlich.',
      complianceNote: 'Art. 35 Abs. 3 lit. b DSGVO — besondere Kategorien treffen auf eine Online-Erhebung.',
    });
  }

  return { ...bp, compliance };
}

/**
 * Rekonstruiert den Brief aus dem Blueprint. Nötig, weil `buildBlock` und
 * `deriveCompliance` gegen den Brief arbeiten — und weil der ursprüngliche
 * Brief nach dem Erstbau nicht mitgeführt wird. Der Blueprint trägt alle
 * Felder, die dafür gebraucht werden.
 */
export function briefFromBlueprint(bp: SiteBlueprint): SiteBrief {
  const services = bp.pages
    .flatMap((page) => page.blocks)
    .find((block) => block.kind === 'services');
  const items = Array.isArray(services?.content.items) ? services.content.items : [];

  return {
    name: bp.name,
    industry: bp.industry,
    locality: bp.seo.locality,
    summary: bp.seo.defaultDescription,
    services: items
      .map((item) => (item as { label?: unknown }).label)
      .filter((label): label is string => typeof label === 'string'),
    locale: bp.locales.default,
    industryConfident: bp.industry !== 'sonstiges',
  };
}

function aiDisclosureFrom(bp: SiteBlueprint, path: string): SiteBlock {
  const existing = bp.pages
    .flatMap((page) => page.blocks)
    .find((block) => block.kind === 'ai-disclosure');

  // Vorlage aus dem Erstbau übernehmen, damit Wortlaut und Modellangabe
  // über alle Seiten identisch bleiben.
  return {
    id: `${slugify(path)}--ai-disclosure--999`,
    kind: 'ai-disclosure',
    processesPersonalData: false,
    thirdPartyHosts: [],
    aiGenerated: false,
    content: existing
      ? { ...existing.content }
      : {
          text: 'Teile der Inhalte dieser Website wurden mit Unterstützung generativer KI erstellt und redaktionell geprüft.',
          reference: 'Art. 50 EU AI Act',
          model: bp.origin.model,
        },
  };
}

function navLinks(block: SiteBlock): { label: string; href: string }[] {
  const links = block.content.links;
  return Array.isArray(links) ? (links as { label: string; href: string }[]) : [];
}

function firstHeroEmphasis(bp: SiteBlueprint): unknown {
  return bp.pages.flatMap((p) => p.blocks).find((b) => b.kind === 'hero')?.content.emphasis;
}

function mapBlocks(bp: SiteBlueprint, fn: (block: SiteBlock) => SiteBlock): SiteBlueprint {
  return { ...bp, pages: bp.pages.map((page) => ({ ...page, blocks: page.blocks.map(fn) })) };
}

function mapPage(bp: SiteBlueprint, path: string, fn: (page: SitePage) => SitePage): SiteBlueprint {
  return { ...bp, pages: bp.pages.map((page) => (page.path === path ? fn(page) : page)) };
}

/**
 * „weg" und „raus" nur als ganzes Wort — als Stamm gelesen träfe „weg" auch
 * „wegen", und „wegen der DSGVO" würde zur Löschanweisung.
 */
function wantsRemoval(text: string): boolean {
  return mentions(text, REMOVE_WORDS) || mentionsStem(text, REMOVE_STEMS);
}

function titleCase(input: string): string {
  return input
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
