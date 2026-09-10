// Redaktionelle Bearbeitung eines Blueprints — das Modell hinter dem
// Block-Editor.
//
// ## Warum der Client Inhalte schickt und keinen Blueprint
//
// `handlers/builder.ts` nimmt aus demselben Grund nur Anweisungen an: Ein
// Blueprint aus dem Browser wäre eine Struktur aus einer Quelle, die der
// Nutzer kontrolliert — Compliance-Profil, Rechtsgrundlagen, KI-Kennzeichnung
// und Drittanbieter-Hosts kämen dann vom Client. Der Editor schickt deshalb
// nur, was ein Redakteur ändern darf: Reihenfolge, hinzugefügte oder
// entfernte Blöcke und die **redaktionellen** Felder je Block. Alles andere
// leitet `applyPageEdits` selbst ab:
//
//   • Neue Blöcke entstehen über `buildBlock` aus `synthesize.ts` — dem einen
//     Block-Bauer, der ein Kontaktformular nie ohne Rechtsgrundlage anlegt.
//   • `processesPersonalData` und `thirdPartyHosts` kommen aus dem Bauer
//     bzw. aus dem gespeicherten Block, nie aus der Anfrage.
//   • `aiGenerated` kippt auf `false`, sobald ein Mensch den Inhalt eines
//     generierten Blocks ändert — die Kennzeichnung nach Art. 50 EU AI Act
//     bleibt damit wahr, in beide Richtungen.
//   • Navigation, Fuß, KI-Hinweis und Rechtstexte sind angeheftet: Sie
//     lassen sich weder entfernen noch verschieben. Der Renderer öffnet
//     `<main>` in der Navigation und schließt es im Fuß; die Analyse verlangt
//     den Hinweis auf jeder Seite mit generierten Inhalten.
//
// Das Ergebnis läuft durch dieselben Schritte wie jeder Erstbau: Hash,
// Analyse, Bewertung, Persistenz mit Vorgänger-Hash. Ein bearbeiteter
// Blueprint ist eine neue Version in derselben Kette — kein Sonderfall.

import type { BlockKind, SiteBlock, SiteBlueprint, SitePage } from '../types.ts';
import type { SiteBrief } from './brief.ts';
import { briefFromBlueprint } from './refine.ts';
import { buildBlock, slugify } from './synthesize.ts';

// ─────────────────────────────────────────────────────────────────────
// Vokabular: was je Block redaktionell ist
// ─────────────────────────────────────────────────────────────────────

/** Form eines editierbaren Feldes. Bestimmt Eingabe und Bereinigung. */
export type FieldShape =
  | { type: 'text'; maxLength?: number }
  | { type: 'textarea'; maxLength?: number; nullable?: boolean }
  | { type: 'url' }
  | { type: 'enum'; values: readonly string[]; optional?: boolean }
  | { type: 'list'; item: Readonly<Record<string, FieldShape>>; max?: number }
  | { type: 'object'; fields: Readonly<Record<string, FieldShape>> }
  | { type: 'form-fields' };

const TEXT: FieldShape = { type: 'text', maxLength: 160 };
const LONG: FieldShape = { type: 'textarea', maxLength: 2000 };
const LONG_NULLABLE: FieldShape = { type: 'textarea', maxLength: 2000, nullable: true };
const URL: FieldShape = { type: 'url' };

/**
 * Welche Inhaltsfelder ein Redakteur je Block-Typ ändern darf.
 *
 * Bewusst **nicht** enthalten: `legalBasis`, `privacyHref`, `consentCategory`,
 * `requiresConsent`, `documentRef`, `media`, der Text des KI-Hinweises und
 * die Rechtslinks im Fuß. Das sind Compliance-Merkmale, keine Redaktion.
 */
export const EDITABLE_CONTENT: Readonly<Record<BlockKind, Readonly<Record<string, FieldShape>>>> = Object.freeze({
  navigation: { brand: TEXT, links: { type: 'list', max: 12, item: { label: TEXT, href: URL } } },
  hero: {
    headline: TEXT,
    subline: LONG,
    primaryCta: { type: 'object', fields: { label: TEXT, href: URL } },
    emphasis: { type: 'enum', values: ['compact', 'tall'], optional: true },
  },
  features: { heading: TEXT, items: { type: 'list', max: 12, item: { label: TEXT, description: LONG_NULLABLE } } },
  services: { heading: TEXT, items: { type: 'list', max: 24, item: { label: TEXT, description: LONG_NULLABLE } } },
  about: { heading: TEXT, body: LONG },
  team: { heading: TEXT, members: { type: 'list', max: 24, item: { name: TEXT } } },
  testimonials: { heading: TEXT, items: { type: 'list', max: 12, item: { quote: LONG } } },
  faq: { heading: TEXT, items: { type: 'list', max: 24, item: { question: TEXT, answer: LONG_NULLABLE } } },
  'contact-form': { heading: TEXT, fields: { type: 'form-fields' }, consentText: LONG_NULLABLE },
  booking: { heading: TEXT, fields: { type: 'form-fields' }, consentText: LONG_NULLABLE },
  map: { heading: TEXT },
  cta: { headline: TEXT, href: URL },
  'legal-text': {},
  'ai-disclosure': {},
  footer: {},
});

/** Formularfelder, die der Renderer kennt (`fieldLabel`/`fieldType`). */
export const FORM_FIELD_NAMES = Object.freeze(['name', 'email', 'phone', 'message', 'slot'] as const);

/** Blocktypen, die ein Redakteur einer Seite hinzufügen darf. */
export const ADDABLE_KINDS: readonly BlockKind[] = Object.freeze([
  'hero', 'features', 'services', 'about', 'team', 'testimonials', 'faq',
  'contact-form', 'booking', 'map', 'cta',
]);

/**
 * Angeheftete Blocktypen: weder entfernbar noch verschiebbar. Fehlen sie in
 * einer Anfrage, werden sie aus der gespeicherten Seite wiederhergestellt.
 */
export const PINNED_KINDS: readonly BlockKind[] = Object.freeze(['navigation', 'footer', 'ai-disclosure', 'legal-text']);

const ALL_KINDS: readonly BlockKind[] = Object.freeze(Object.keys(EDITABLE_CONTENT) as BlockKind[]);

export function isBlockKind(value: unknown): value is BlockKind {
  return typeof value === 'string' && (ALL_KINDS as readonly string[]).includes(value);
}

export function isAddableKind(kind: BlockKind): boolean {
  return ADDABLE_KINDS.includes(kind);
}

export function isPinnedKind(kind: BlockKind): boolean {
  return PINNED_KINDS.includes(kind);
}

// ─────────────────────────────────────────────────────────────────────
// Anfrage und Ergebnis
// ─────────────────────────────────────────────────────────────────────

export interface BlockEdit {
  /** ID des gespeicherten Blocks; fehlt sie oder ist sie unbekannt, ist es ein neuer Block. */
  id?: string;
  kind: BlockKind;
  /** Nur die redaktionellen Felder; alles andere wird ignoriert. */
  content?: Record<string, unknown>;
}

export interface PageEdit {
  path: string;
  /** Vollständige neue Blockfolge der Seite in gewünschter Reihenfolge. */
  blocks: BlockEdit[];
}

export interface EditChange {
  /** Stabile Kennung, z. B. `block.added`. Wie Befund-Codes: nie umbenennen. */
  code: 'block.added' | 'block.removed' | 'block.moved' | 'block.edited' | 'block.restored';
  path: string;
  blockId: string;
  kind: BlockKind;
  summary: string;
  /** Compliance-Wirkung, sichtbar gemacht — `null`, wenn es keine gab. */
  complianceNote: string | null;
}

export interface EditResult {
  blueprint: SiteBlueprint;
  changes: EditChange[];
  /** Abgewiesene Teile der Anfrage, mit Grund. Der Rest wurde angewandt. */
  rejected: string[];
}

// ─────────────────────────────────────────────────────────────────────
// Anwenden
// ─────────────────────────────────────────────────────────────────────

/**
 * Wendet Seitenbearbeitungen auf einen Blueprint an. Rein und deterministisch:
 * gleiche Eingabe ⇒ gleicher Blueprint ⇒ gleicher Hash.
 *
 * Seiten, die nicht in `edits` vorkommen, bleiben unverändert. Eine Anfrage
 * kann keine Seiten anlegen oder löschen — das ist eine Strukturentscheidung
 * des Bauplans, keine Redaktion.
 */
export function applyPageEdits(blueprint: SiteBlueprint, edits: PageEdit[]): EditResult {
  const changes: EditChange[] = [];
  const rejected: string[] = [];
  const brief = briefFromBlueprint(blueprint);

  const pages = blueprint.pages.map((page) => {
    const edit = edits.find((e) => e.path === page.path);
    if (!edit) return page;
    return applyToPage(page, edit, brief, changes, rejected);
  });

  for (const edit of edits) {
    if (!blueprint.pages.some((p) => p.path === edit.path)) {
      rejected.push(`page.unknown:${edit.path}`);
    }
  }

  return { blueprint: { ...blueprint, pages }, changes, rejected };
}

function applyToPage(page: SitePage, edit: PageEdit, brief: SiteBrief, changes: EditChange[], rejected: string[]): SitePage {
  const stored = new Map(page.blocks.map((b) => [b.id, b]));
  const usedIds = new Set<string>();
  const pathPart = page.path === '/' ? 'root' : slugify(page.path);
  const next: SiteBlock[] = [];

  for (const entry of edit.blocks ?? []) {
    if (!isBlockKind(entry.kind)) {
      rejected.push(`block.unknown-kind:${String((entry as { kind?: unknown }).kind)}`);
      continue;
    }

    const existing = entry.id ? stored.get(entry.id) : undefined;
    let base: SiteBlock;
    let added = false;

    if (existing && existing.kind === entry.kind && !usedIds.has(existing.id)) {
      base = existing;
    } else if (isPinnedKind(entry.kind)) {
      // Angeheftete Blöcke lassen sich nicht neu anlegen — sie werden unten
      // aus der gespeicherten Seite wiederhergestellt, falls sie dort waren.
      rejected.push(`block.pinned:${entry.kind}`);
      continue;
    } else if (isAddableKind(entry.kind)) {
      base = buildBlock(entry.kind, nextFreeIndex(pathPart, entry.kind, stored, usedIds), page.path, brief, false);
      added = true;
    } else {
      rejected.push(`block.not-addable:${entry.kind}`);
      continue;
    }

    const content = mergeContent(base, entry.content);
    const edited = !added && !deepEqual(content, base.content);
    const block: SiteBlock = {
      ...base,
      content,
      // Ein Mensch hat den Inhalt geändert ⇒ er ist nicht mehr generiert.
      // Umgekehrt bleibt ein unveränderter generierter Block gekennzeichnet.
      aiGenerated: added || edited ? false : base.aiGenerated,
    };
    usedIds.add(block.id);
    next.push(block);

    if (added) {
      changes.push({
        code: 'block.added', path: page.path, blockId: block.id, kind: block.kind,
        summary: `${labelFor(block.kind)} hinzugefügt.`,
        complianceNote: complianceNoteFor(block),
      });
    } else if (edited) {
      changes.push({
        code: 'block.edited', path: page.path, blockId: block.id, kind: block.kind,
        summary: `${labelFor(block.kind)} bearbeitet.`,
        complianceNote: base.aiGenerated ? 'Der Block gilt jetzt als redaktionell, nicht mehr als KI-generiert.' : null,
      });
    }
  }

  // Angeheftete Blöcke wiederherstellen, die die Anfrage weggelassen hat.
  for (const block of page.blocks) {
    if (isPinnedKind(block.kind) && !usedIds.has(block.id)) {
      next.push(block);
      usedIds.add(block.id);
      changes.push({
        code: 'block.restored', path: page.path, blockId: block.id, kind: block.kind,
        summary: `${labelFor(block.kind)} kann nicht entfernt werden und bleibt bestehen.`,
        complianceNote: null,
      });
    }
  }

  // Entfernte Blöcke protokollieren.
  for (const block of page.blocks) {
    if (!usedIds.has(block.id)) {
      changes.push({
        code: 'block.removed', path: page.path, blockId: block.id, kind: block.kind,
        summary: `${labelFor(block.kind)} entfernt.`,
        complianceNote: block.processesPersonalData ? 'Damit entfällt eine Verarbeitung personenbezogener Daten auf dieser Seite.' : null,
      });
    }
  }

  const ordered = pinOrder(next, page.blocks);

  // Verschiebungen protokollieren: relative Reihenfolge der behaltenen Blöcke.
  const beforeOrder = page.blocks.filter((b) => usedIds.has(b.id)).map((b) => b.id);
  const afterOrder = ordered.filter((b) => beforeOrder.includes(b.id)).map((b) => b.id);
  for (let i = 0; i < afterOrder.length; i += 1) {
    if (afterOrder[i] !== beforeOrder[i]) {
      const moved = ordered.find((b) => b.id === afterOrder[i])!;
      if (!changes.some((c) => c.code === 'block.moved' && c.blockId === moved.id)) {
        changes.push({
          code: 'block.moved', path: page.path, blockId: moved.id, kind: moved.kind,
          summary: `${labelFor(moved.kind)} verschoben.`, complianceNote: null,
        });
      }
    }
  }

  return { ...page, blocks: ordered };
}

/**
 * Navigation zuerst, dann Inhalt in Anfrage-Reihenfolge, KI-Hinweis, Fuß.
 * Rechtstexte bleiben an ihrer gespeicherten Stelle relativ zum Inhalt.
 */
function pinOrder(blocks: SiteBlock[], storedOrder: SiteBlock[]): SiteBlock[] {
  const nav = blocks.filter((b) => b.kind === 'navigation').slice(0, 1);
  const footer = blocks.filter((b) => b.kind === 'footer').slice(0, 1);
  const disclosure = blocks.filter((b) => b.kind === 'ai-disclosure').slice(0, 1);
  const body = blocks.filter((b) => b.kind !== 'navigation' && b.kind !== 'footer' && b.kind !== 'ai-disclosure' && b.kind !== 'legal-text');

  // Rechtstexte an ihrer ursprünglichen Position einsetzen (Index unter den
  // Inhaltsblöcken), damit eine Rechtsseite ihren Text nicht verliert oder
  // hinter ein nachträglich ergänztes Formular rutscht.
  const legal = blocks.filter((b) => b.kind === 'legal-text');
  const withLegal = [...body];
  for (const block of legal) {
    const storedIndex = storedOrder.filter((b) => !isPinnedKind(b.kind) || b.kind === 'legal-text').findIndex((b) => b.id === block.id);
    withLegal.splice(Math.min(Math.max(storedIndex, 0), withLegal.length), 0, block);
  }

  return [...nav, ...withLegal, ...disclosure, ...footer];
}

function nextFreeIndex(pathPart: string, kind: BlockKind, stored: Map<string, SiteBlock>, used: Set<string>): number {
  let index = stored.size + used.size + 1;
  while (stored.has(`${pathPart}--${kind}--${index}`) || used.has(`${pathPart}--${kind}--${index}`)) index += 1;
  return index;
}

// ─────────────────────────────────────────────────────────────────────
// Inhalte bereinigen
// ─────────────────────────────────────────────────────────────────────

function mergeContent(base: SiteBlock, incoming: Record<string, unknown> | undefined): Record<string, unknown> {
  const shapes = EDITABLE_CONTENT[base.kind];
  const out: Record<string, unknown> = { ...base.content };
  if (!incoming || typeof incoming !== 'object') return out;

  for (const [key, shape] of Object.entries(shapes)) {
    if (!(key in incoming)) continue;
    const value = sanitizeValue(shape, incoming[key]);
    if (value === undefined) delete out[key];
    else out[key] = value;
  }
  return out;
}

/** Bereinigt einen Wert nach seiner Form; `undefined` heißt „Feld entfernen". */
export function sanitizeValue(shape: FieldShape, value: unknown): unknown {
  switch (shape.type) {
    case 'text': {
      const text = cleanText(value, shape.maxLength ?? 160, false);
      return text === '' ? '' : text;
    }
    case 'textarea': {
      const text = cleanText(value, shape.maxLength ?? 2000, true);
      if (text === '' && shape.nullable) return null;
      return text;
    }
    case 'url':
      return cleanUrl(value);
    case 'enum': {
      if (typeof value === 'string' && shape.values.includes(value)) return value;
      return shape.optional ? undefined : shape.values[0];
    }
    case 'object': {
      const source = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
      const out: Record<string, unknown> = {};
      for (const [k, s] of Object.entries(shape.fields)) {
        const v = sanitizeValue(s, source[k]);
        if (v !== undefined) out[k] = v;
      }
      return out;
    }
    case 'list': {
      if (!Array.isArray(value)) return [];
      return value.slice(0, shape.max ?? 24).map((item) => {
        const source = typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : {};
        const out: Record<string, unknown> = {};
        for (const [k, s] of Object.entries(shape.item)) {
          const v = sanitizeValue(s, source[k]);
          if (v !== undefined) out[k] = v;
        }
        return out;
      });
    }
    case 'form-fields': {
      if (!Array.isArray(value)) return [];
      const seen = new Set<string>();
      const names: string[] = [];
      for (const raw of value) {
        const name = typeof raw === 'string' ? raw : typeof raw === 'object' && raw !== null ? String((raw as { name?: unknown }).name ?? '') : '';
        if ((FORM_FIELD_NAMES as readonly string[]).includes(name) && !seen.has(name)) {
          seen.add(name);
          names.push(name);
        }
      }
      return names;
    }
  }
}

function cleanText(value: unknown, maxLength: number, multiline: boolean): string {
  if (typeof value !== 'string') return '';
  // Steuerzeichen raus; Zeilenumbrüche nur, wo sie erlaubt sind. Der
  // Renderer escaped ohnehin — hier geht es um Länge und Unsichtbares.
  const control = multiline
    ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g
    : /[\u0000-\u001F\u007F]/g;
  return value.replace(control, '').trim().slice(0, maxLength);
}

/**
 * Nur relative Pfade und http(s)-Adressen. Alles andere (`javascript:`,
 * `data:`) wird verworfen — der Renderer prüft erneut, hier fällt es früh.
 */
function cleanUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim().slice(0, 2048);
  if (trimmed === '') return '';
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^mailto:[^\s]+@[^\s]+$/i.test(trimmed) || /^tel:\+?[0-9\s()/-]+$/i.test(trimmed)) return trimmed;
  return '';
}

// ─────────────────────────────────────────────────────────────────────
// Hilfen
// ─────────────────────────────────────────────────────────────────────

export function labelFor(kind: BlockKind): string {
  switch (kind) {
    case 'navigation': return 'Navigation';
    case 'hero': return 'Hero';
    case 'features': return 'Vorzüge';
    case 'services': return 'Leistungen';
    case 'about': return 'Über uns';
    case 'team': return 'Team';
    case 'testimonials': return 'Stimmen';
    case 'faq': return 'Häufige Fragen';
    case 'contact-form': return 'Kontaktformular';
    case 'booking': return 'Terminbuchung';
    case 'map': return 'Anfahrtskarte';
    case 'cta': return 'Handlungsaufforderung';
    case 'legal-text': return 'Rechtstext';
    case 'ai-disclosure': return 'KI-Hinweis';
    case 'footer': return 'Fußbereich';
  }
}

function complianceNoteFor(block: SiteBlock): string | null {
  if (block.kind === 'contact-form' || block.kind === 'booking') {
    return 'Das Formular verarbeitet personenbezogene Daten — Rechtsgrundlage und Datenschutz-Link sind gesetzt.';
  }
  if (block.kind === 'map') {
    return 'Die Karte bindet einen Drittanbieter ein und lädt erst nach Einwilligung (§ 25 TDDDG).';
  }
  return null;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const other = b as unknown[];
    return a.length === other.length && a.every((v, i) => deepEqual(v, other[i]));
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (!deepEqual(left[key], right[key])) return false;
  }
  return true;
}
