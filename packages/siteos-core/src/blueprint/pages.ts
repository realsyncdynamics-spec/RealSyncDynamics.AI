// Seitenoperationen eines Blueprints — anlegen, umbenennen, Slug ändern,
// duplizieren, löschen (Phase 2, Schritt B).
//
// ## Warum das hier steht und nicht im Client
//
// Der Browser darf keinen Blueprint schicken (`edit.ts`, `handlers/builder.ts`).
// Seitenoperationen sind Strukturentscheidungen: Sie legen Pfade fest, auf die
// Navigation und Verweise zeigen, und sie können Rechtsseiten treffen, die
// eine Site nicht verlieren darf. Deshalb nimmt der Server nur die **Absicht**
// entgegen (`PageOperation`) und leitet alles Weitere hier ab — Blöcke der
// neuen Seite über `buildBlock`, Navigation und Verweise über die Kette,
// Schutz der Pflichtseiten über die Seite selbst, nicht über eine Liste, die
// der Client mitschickt.
//
// Dieselbe Funktion dient später dem KI-Pfad (Schritt C): `CreatePageAction`
// und Verwandte werden in genau diese Operationen übersetzt. Zwei Wege in die
// Struktur wären zwei Auslegungen derselben Regeln.
//
// ## Was geschützt ist
//
//   • Rechtsseiten (`/impressum`, `/datenschutz`, `/barrierefreiheit`, `/agb`,
//     `/widerruf`) und jede Seite mit einem `legal-text`-Block: nicht
//     löschbar, nicht umbenennbar, ihr Slug nicht änderbar, nicht
//     duplizierbar. Eine zweite Datenschutzerklärung ist kein Feature.
//   • Die Startseite: nicht löschbar, ihr Pfad bleibt `/`. Umbenennen und
//     Duplizieren sind erlaubt.
//
// Der Schutz wird an der Seite erkannt, nicht am Pfad allein — eine
// Rechtsseite unter einem anderen Pfad ist trotzdem eine.
//
// ## Slugs
//
// Ein Slug muss bereits in kanonischer Form ankommen (`slugify(slug) === slug`).
// Der Server normalisiert nicht stillschweigend: Wer „Wärmepumpen" schickt,
// bekommt `slug.invalid` und den Vorschlag `waermepumpen` — sonst stünde in
// der Antwort ein anderer Pfad als angefragt, und niemand hätte es gesehen.
// Reserviert sind die Rechtspfade und `site` (der Rückfallwert von `slugify`).
// Pfade sind einsegmentig: `/leistungen`, nicht `/leistungen/waermepumpen`.
//
// Rein und deterministisch: gleiche Eingabe ⇒ gleicher Blueprint ⇒ gleicher
// Hash. Danach läuft dieselbe Kette wie bei jeder Redaktion (Analyse,
// Bewertung, Version mit Vorgänger-Hash).

import type { BlockKind, SiteBlock, SiteBlueprint, SitePage } from '../types.ts';
import { getIndustryPreset } from './industries.ts';
import { briefFromBlueprint } from './brief.ts';
import { buildBlock, deriveCompliance, slugify } from './synthesize.ts';

// ─────────────────────────────────────────────────────────────────────
// Vokabular
// ─────────────────────────────────────────────────────────────────────

/** Rechtsseiten des Seitenplans — dieselbe Liste wie `LEGAL_PATHS` in `synthesize.ts`. */
export const LEGAL_PAGE_PATHS: readonly string[] = Object.freeze([
  '/impressum', '/datenschutz', '/barrierefreiheit', '/agb', '/widerruf',
]);

/** Slugs, die eine neue Seite nicht bekommen darf. `site` ist der Rückfall von `slugify`. */
export const RESERVED_PAGE_SLUGS: readonly string[] = Object.freeze([
  'site', ...LEGAL_PAGE_PATHS.map((path) => path.slice(1)),
]);

/** Obergrenze je Site — dieselbe wie `MAX_PAGES` im Handler `siteos/edit`. */
export const MAX_PAGES_PER_SITE = 40;

/**
 * Die Obergrenze ist eine **Create-Invariante**, kein Zustandsurteil über das
 * Projekt. Geprüft wird, was die Operation *ergäbe* — nicht, was schon da ist.
 *
 * Der Unterschied ist für Bestandsprojekte entscheidend (Owner-Entscheidung
 * 2026-09-07): Ein Blueprint mit 47 Seiten bleibt lesbar, renderbar und
 * bearbeitbar; Löschen ist erlaubt, damit er *bereinigt* werden kann. Nur eine
 * 48. Seite entsteht nicht. Ein pauschales `pages.length > MAX` würde
 * dieselben Projekte einfrieren, statt sie in die Grenze zurückzuführen.
 *
 * Für eine einzelne Seite ist das Ergebnis dasselbe wie zuvor
 * (`length >= MAX` ⟺ `length + 1 > MAX`); der Unterschied wird erst bei
 * Mehrfach-Anlagen sichtbar, wie sie ein Action-Batch erzeugt.
 */
export function exceedsPageLimit(blueprint: SiteBlueprint, adding: number): boolean {
  return adding > 0 && blueprint.pages.length + adding > MAX_PAGES_PER_SITE;
}
export const MAX_PAGE_TITLE_LENGTH = 80;

export type PageOperation =
  | { op: 'create'; title: string; slug?: string }
  | { op: 'rename'; path: string; title: string }
  | { op: 'slug'; path: string; slug: string }
  | { op: 'duplicate'; path: string; title?: string; slug?: string }
  | { op: 'delete'; path: string };

export const PAGE_OPERATION_KINDS: readonly PageOperation['op'][] = Object.freeze(['create', 'rename', 'slug', 'duplicate', 'delete']);

export interface PageChange {
  /** Stabile Kennung. Wie Befund-Codes: nie umbenennen. */
  code: 'page.created' | 'page.renamed' | 'page.moved' | 'page.duplicated' | 'page.deleted';
  path: string;
  /** Bei `page.moved` der alte Pfad, bei `page.duplicated` die Quelle; sonst `null`. */
  previousPath: string | null;
  summary: string;
  complianceNote: string | null;
}

export interface PageOperationsResult {
  blueprint: SiteBlueprint;
  changes: PageChange[];
  /** Abgewiesene Operationen mit Grund. Die übrigen wurden angewandt. */
  rejected: string[];
}

export type PageProtection = 'legal' | 'home' | null;

/** Woran der Schutz erkannt wird: Pfad **oder** Rechtstext-Block. */
export function pageProtection(page: SitePage): PageProtection {
  if (LEGAL_PAGE_PATHS.includes(page.path) || page.blocks.some((b) => b.kind === 'legal-text')) return 'legal';
  if (page.path === '/') return 'home';
  return null;
}

/** Was auf einer Seite erlaubt ist — dieselbe Wahrheit für Oberfläche und Server. */
export function allowedPageOperations(page: SitePage): ReadonlySet<PageOperation['op']> {
  const protection = pageProtection(page);
  if (protection === 'legal') return new Set();
  if (protection === 'home') return new Set(['rename', 'duplicate']);
  return new Set(['rename', 'slug', 'duplicate', 'delete']);
}

export type SlugValidation =
  | { ok: true; slug: string }
  | { ok: false; reason: 'slug.empty' | 'slug.invalid' | 'slug.reserved' | 'slug.taken'; suggestion: string | null };

/**
 * Prüft einen Slug gegen Form, Reservierung und die vorhandenen Seiten.
 * `exceptPath` nimmt die eigene Seite von der Kollisionsprüfung aus (Slug
 * einer Seite ändern).
 */
export function validatePageSlug(raw: unknown, blueprint: SiteBlueprint, exceptPath?: string): SlugValidation {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (value === '') return { ok: false, reason: 'slug.empty', suggestion: null };
  const canonical = slugify(value);
  if (canonical !== value || value === 'site') {
    return { ok: false, reason: 'slug.invalid', suggestion: canonical === 'site' ? null : canonical };
  }
  if (RESERVED_PAGE_SLUGS.includes(value)) return { ok: false, reason: 'slug.reserved', suggestion: null };
  const path = `/${value}`;
  if (blueprint.pages.some((page) => page.path === path && page.path !== exceptPath)) {
    return { ok: false, reason: 'slug.taken', suggestion: freeSlug(value, blueprint) };
  }
  return { ok: true, slug: value };
}

// ─────────────────────────────────────────────────────────────────────
// Anwenden
// ─────────────────────────────────────────────────────────────────────

export function applyPageOperations(blueprint: SiteBlueprint, operations: PageOperation[]): PageOperationsResult {
  const changes: PageChange[] = [];
  const rejected: string[] = [];
  let bp = blueprint;

  for (const operation of operations) {
    switch (operation.op) {
      case 'create': bp = createPage(bp, operation, changes, rejected); break;
      case 'rename': bp = renamePage(bp, operation, changes, rejected); break;
      case 'slug': bp = movePage(bp, operation, changes, rejected); break;
      case 'duplicate': bp = duplicatePage(bp, operation, changes, rejected); break;
      case 'delete': bp = deletePage(bp, operation, changes, rejected); break;
      default:
        rejected.push(`op.unknown:${String((operation as { op?: unknown }).op)}`);
    }
  }

  return { blueprint: changes.length > 0 ? recompileCompliance(bp) : bp, changes, rejected };
}

/**
 * Leitet das Compliance-Profil aus den tatsächlich verbauten Blöcken neu ab.
 * Nötig nach jeder Strukturänderung: Eine gelöschte Seite mit Terminbuchung
 * nimmt eine Verarbeitung mit, eine neue Seite mit Karte bringt einen
 * Drittanbieter — `analyzeBlueprint` und das Publish Gate lesen
 * `compliance.dpiaRequired` aus dem Profil, nicht aus den Blöcken.
 */
export function recompileCompliance(bp: SiteBlueprint): SiteBlueprint {
  const preset = getIndustryPreset(bp.industry);
  return { ...bp, compliance: deriveCompliance(briefFromBlueprint(bp), bp.pages, preset.compliance) };
}

function createPage(bp: SiteBlueprint, operation: Extract<PageOperation, { op: 'create' }>, changes: PageChange[], rejected: string[]): SiteBlueprint {
  const title = cleanTitle(operation.title);
  if (!title) { rejected.push('title.empty'); return bp; }
  if (exceedsPageLimit(bp, 1)) { rejected.push(`pages.limit:${MAX_PAGES_PER_SITE}`); return bp; }

  const slug = validatePageSlug(operation.slug ?? slugify(title), bp);
  if (!slug.ok) { rejected.push(describeSlugRejection(slug, operation.slug ?? title)); return bp; }
  const path = `/${slug.slug}`;

  const brief = briefFromBlueprint(bp);
  // Wie beim Erstbau und bei „Seite X anlegen" in `refine.ts`: Inhalte, die
  // aus dem Brief eines KI-Baus stammen, bleiben gekennzeichnet. Eine Seite,
  // die ein Mensch nur benennt, hat ihren Text trotzdem nicht selbst geschrieben.
  const aiGenerated = bp.origin.source === 'ai-builder';
  const home = bp.pages.find((page) => page.path === '/');
  const body: BlockKind[] = ['hero', 'features', 'cta'];

  const blocks: SiteBlock[] = [
    home ? copyBlock(findKind(home, 'navigation'), path, 0) ?? buildBlock('navigation', 0, path, brief, false) : buildBlock('navigation', 0, path, brief, false),
    ...body.map((kind, i) => buildBlock(kind, i + 1, path, brief, aiGenerated)),
  ];
  if (aiGenerated) {
    const disclosure = copyBlock(bp.pages.flatMap((p) => p.blocks).find((b) => b.kind === 'ai-disclosure'), path, blocks.length);
    if (disclosure) blocks.push(disclosure);
  }
  blocks.push(home ? copyBlock(findKind(home, 'footer'), path, blocks.length) ?? buildBlock('footer', blocks.length, path, brief, false) : buildBlock('footer', blocks.length, path, brief, false));

  const page: SitePage = { path, title, description: describe(bp, title), blocks, noindex: false };
  const next = addNavLink({ ...bp, pages: [...bp.pages, page] }, { label: title, href: path });

  changes.push({
    code: 'page.created', path, previousPath: null,
    summary: `Seite „${title}" (${path}) angelegt und in die Navigation aufgenommen.`,
    complianceNote: aiGenerated ? 'Die neue Seite führt den KI-Transparenzhinweis nach Art. 50 EU AI Act.' : null,
  });
  return next;
}

function renamePage(bp: SiteBlueprint, operation: Extract<PageOperation, { op: 'rename' }>, changes: PageChange[], rejected: string[]): SiteBlueprint {
  const page = bp.pages.find((p) => p.path === operation.path);
  if (!page) { rejected.push(`page.unknown:${operation.path}`); return bp; }
  if (!allowedPageOperations(page).has('rename')) { rejected.push(`page.protected:${page.path}`); return bp; }
  const title = cleanTitle(operation.title);
  if (!title) { rejected.push('title.empty'); return bp; }
  if (title === page.title) return bp;

  const previous = page.title;
  const renamed: SitePage = {
    ...page,
    title,
    // Eine abgeleitete Beschreibung folgt dem Titel; eine redigierte bleibt.
    description: page.description.startsWith(`${previous} — `) ? describe(bp, title) : page.description,
  };
  const next: SiteBlueprint = {
    ...bp,
    pages: bp.pages.map((p) => (p.path === page.path ? renamed : p)).map((p) => ({
      ...p,
      blocks: p.blocks.map((block) => block.kind === 'navigation'
        ? { ...block, content: { ...block.content, links: navLinks(block).map((link) => (link.href === page.path ? { ...link, label: title } : link)) } }
        : block),
    })),
  };
  changes.push({ code: 'page.renamed', path: page.path, previousPath: null, summary: `Seite „${previous}" heißt jetzt „${title}".`, complianceNote: null });
  return next;
}

function movePage(bp: SiteBlueprint, operation: Extract<PageOperation, { op: 'slug' }>, changes: PageChange[], rejected: string[]): SiteBlueprint {
  const page = bp.pages.find((p) => p.path === operation.path);
  if (!page) { rejected.push(`page.unknown:${operation.path}`); return bp; }
  if (!allowedPageOperations(page).has('slug')) { rejected.push(`page.protected:${page.path}`); return bp; }
  const slug = validatePageSlug(operation.slug, bp, page.path);
  if (!slug.ok) { rejected.push(describeSlugRejection(slug, operation.slug)); return bp; }
  const path = `/${slug.slug}`;
  if (path === page.path) return bp;

  // Block-IDs bleiben: Sie sind Identität, nicht Adresse — Verlauf und
  // Prüfpfad verweisen darauf. Eindeutig bleiben sie, weil der alte Pfad
  // mit dieser Seite verschwindet.
  const next: SiteBlueprint = {
    ...bp,
    pages: bp.pages.map((p) => (p.path === page.path ? { ...p, path } : p)),
  };
  changes.push({
    code: 'page.moved', path, previousPath: page.path,
    summary: `Seite „${page.title}" ist jetzt unter ${path} statt ${page.path} erreichbar; Verweise wurden nachgezogen.`,
    complianceNote: null,
  });
  return rewriteHrefs(next, page.path, path);
}

function duplicatePage(bp: SiteBlueprint, operation: Extract<PageOperation, { op: 'duplicate' }>, changes: PageChange[], rejected: string[]): SiteBlueprint {
  const source = bp.pages.find((p) => p.path === operation.path);
  if (!source) { rejected.push(`page.unknown:${operation.path}`); return bp; }
  if (!allowedPageOperations(source).has('duplicate')) { rejected.push(`page.protected:${source.path}`); return bp; }
  if (exceedsPageLimit(bp, 1)) { rejected.push(`pages.limit:${MAX_PAGES_PER_SITE}`); return bp; }

  const title = cleanTitle(operation.title ?? `${source.title} (Kopie)`);
  if (!title) { rejected.push('title.empty'); return bp; }
  // Ohne Wunsch-Slug einen freien wählen; ein gewünschter muss frei sein.
  const slug = operation.slug !== undefined
    ? validatePageSlug(operation.slug, bp)
    : validatePageSlug(freeSlug(`${source.path === '/' ? 'startseite' : slugify(source.path)}-kopie`, bp), bp);
  if (!slug.ok) { rejected.push(describeSlugRejection(slug, operation.slug ?? title)); return bp; }
  const path = `/${slug.slug}`;

  const blocks = source.blocks.map((block, index) => copyBlock(block, path, index)!);
  const page: SitePage = { path, title, description: describe(bp, title), blocks, noindex: source.noindex };
  const next = source.noindex
    ? { ...bp, pages: [...bp.pages, page] }
    : addNavLink({ ...bp, pages: [...bp.pages, page] }, { label: title, href: path });

  changes.push({
    code: 'page.duplicated', path, previousPath: source.path,
    summary: `Seite „${source.title}" als „${title}" (${path}) dupliziert${source.noindex ? '' : ' und in die Navigation aufgenommen'}.`,
    complianceNote: blocks.some((b) => b.processesPersonalData)
      ? 'Die Kopie verarbeitet wie das Original personenbezogene Daten — Rechtsgrundlage und Datenschutz-Link sind übernommen.'
      : null,
  });
  return next;
}

function deletePage(bp: SiteBlueprint, operation: Extract<PageOperation, { op: 'delete' }>, changes: PageChange[], rejected: string[]): SiteBlueprint {
  const page = bp.pages.find((p) => p.path === operation.path);
  if (!page) { rejected.push(`page.unknown:${operation.path}`); return bp; }
  if (!allowedPageOperations(page).has('delete')) { rejected.push(`page.protected:${page.path}`); return bp; }

  const remaining = bp.pages.filter((p) => p.path !== page.path);
  // Navigationslinks auf die Seite verschwinden; andere Verweise (CTA,
  // Hero) zeigen auf die Startseite statt ins Leere.
  const withoutLinks: SiteBlueprint = {
    ...bp,
    pages: remaining.map((p) => ({
      ...p,
      blocks: p.blocks.map((block) => block.kind === 'navigation'
        ? { ...block, content: { ...block.content, links: navLinks(block).filter((link) => !pointsTo(link.href, page.path)) } }
        : block),
    })),
  };
  const dangling = countHrefs(withoutLinks, page.path);
  const next = dangling > 0 ? rewriteHrefs(withoutLinks, page.path, '/') : withoutLinks;

  changes.push({
    code: 'page.deleted', path: page.path, previousPath: null,
    summary: `Seite „${page.title}" (${page.path}) gelöscht${dangling > 0 ? `; ${dangling} Verweis${dangling === 1 ? '' : 'e'} zeigt jetzt auf die Startseite` : ''}.`,
    complianceNote: page.blocks.some((b) => b.processesPersonalData)
      ? 'Damit entfällt eine Verarbeitung personenbezogener Daten auf dieser Site.'
      : null,
  });
  return next;
}

// ─────────────────────────────────────────────────────────────────────
// Hilfen
// ─────────────────────────────────────────────────────────────────────

function cleanTitle(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_PAGE_TITLE_LENGTH);
}

function describe(bp: SiteBlueprint, title: string): string {
  return bp.seo.locality ? `${title} — ${bp.name} in ${bp.seo.locality}.` : `${title} — ${bp.name}.`;
}

function describeSlugRejection(result: SlugValidation, raw: unknown): string {
  if (result.ok) return '';
  // Ausdrücklich verengt: Denos Prüfer verengt `ok`-Unionen hier nicht
  // (derselbe Befund wie in `handlers/runtime-scan.ts`), tsc schon.
  const failed = result as Extract<SlugValidation, { ok: false }>;
  const shown = typeof raw === 'string' ? raw.trim().slice(0, 80) : '';
  const suffix = failed.suggestion ? `→${failed.suggestion}` : '';
  return `${failed.reason}:${shown}${suffix}`;
}

/** Erster freier Slug aus `base`, `base-2`, `base-3`, … */
function freeSlug(base: string, bp: SiteBlueprint): string {
  const stem = slugify(base);
  const taken = (slug: string) => RESERVED_PAGE_SLUGS.includes(slug) || bp.pages.some((p) => p.path === `/${slug}`);
  if (!taken(stem)) return stem;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${stem.slice(0, 64 - `-${n}`.length)}-${n}`;
    if (!taken(candidate)) return candidate;
  }
  return `${stem.slice(0, 50)}-${Date.now().toString(36)}`;
}

function findKind(page: SitePage, kind: BlockKind): SiteBlock | undefined {
  return page.blocks.find((b) => b.kind === kind);
}

/** Tiefe Kopie eines Blocks unter neuem Pfad — Inhalt und Merkmale unverändert. */
function copyBlock(block: SiteBlock | undefined, path: string, index: number): SiteBlock | undefined {
  if (!block) return undefined;
  const pathPart = path === '/' ? 'root' : slugify(path);
  return {
    ...block,
    id: `${pathPart}--${block.kind}--${index}`,
    content: JSON.parse(JSON.stringify(block.content)) as Record<string, unknown>,
    thirdPartyHosts: [...block.thirdPartyHosts],
  };
}

function navLinks(block: SiteBlock): { label: string; href: string }[] {
  const links = block.content.links;
  return Array.isArray(links) ? (links as { label: string; href: string }[]) : [];
}

function addNavLink(bp: SiteBlueprint, link: { label: string; href: string }): SiteBlueprint {
  return {
    ...bp,
    pages: bp.pages.map((page) => ({
      ...page,
      blocks: page.blocks.map((block) => {
        if (block.kind !== 'navigation') return block;
        const links = navLinks(block);
        if (links.some((l) => l.href === link.href)) return block;
        return { ...block, content: { ...block.content, links: [...links, link] } };
      }),
    })),
  };
}

function pointsTo(href: unknown, path: string): boolean {
  return typeof href === 'string' && (href === path || href.startsWith(`${path}#`));
}

function countHrefs(bp: SiteBlueprint, path: string): number {
  let n = 0;
  walkHrefs(bp, (href) => { if (pointsTo(href, path)) n += 1; return href; });
  return n;
}

/** Ersetzt alle `href`-Werte, die auf `from` zeigen, durch `to` — auch mit Anker. */
function rewriteHrefs(bp: SiteBlueprint, from: string, to: string): SiteBlueprint {
  return walkHrefs(bp, (href) => (pointsTo(href, from) ? `${to}${href.slice(from.length)}` : href));
}

function walkHrefs(bp: SiteBlueprint, fn: (href: string) => string): SiteBlueprint {
  const visit = (value: unknown, key: string | null): unknown => {
    if (typeof value === 'string') return key === 'href' ? fn(value) : value;
    if (Array.isArray(value)) return value.map((item) => visit(item, null));
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = visit(v, k);
      return out;
    }
    return value;
  };
  return {
    ...bp,
    pages: bp.pages.map((page) => ({
      ...page,
      blocks: page.blocks.map((block) => ({ ...block, content: visit(block.content, null) as Record<string, unknown> })),
    })),
  };
}
