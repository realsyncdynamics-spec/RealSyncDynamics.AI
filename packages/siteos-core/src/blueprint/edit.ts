// Änderung eines bestehenden Blueprints — ausdrücklich ohne Neugenerierung.
//
// ── Warum das ein eigenes Modul ist ──────────────────────────────────────
//
// Der Besucher beschreibt eine Website, sieht sie, und sagt dann: „mach den
// Hero grösser". Der naheliegende Weg wäre, die Beschreibung um diesen Satz
// zu ergänzen und neu zu synthetisieren. Genau das ist der Fehler, den
// dieses Modul verhindert.
//
// Eine Neusynthese erzeugt einen **anderen** Blueprint mit einem **anderen**
// Hash. Alles, was der Besucher vorher gesehen hat, und alles, was
// zwischenzeitlich bewertet wurde, wäre damit hinfällig — und die Übernahme
// (Project Claim) würde nicht mehr die Fassung sichern, die er auf dem
// Bildschirm hatte, sondern eine neue. Der Claim wäre formal erfolgreich und
// inhaltlich kaputt.
//
// Deshalb gilt hier: Eine Änderung ist eine **begrenzte Abbildung** des
// vorhandenen Blueprints auf einen neuen. Was der Besucher nicht angefasst
// hat, bleibt Zeichen für Zeichen stehen.
//
// ── Warum die Änderungssprache so klein ist ─────────────────────────────
//
// Angeboten wird ausschliesslich, was die Runtime auch wirklich ausführt.
// Eine Anweisung, die im Blueprint etwas setzt, das der Renderer nie liest,
// wäre eine Attrappe: Die Vorschau bliebe unverändert, der Hash aber nicht.
// Der Besucher bekäme die Rückmeldung „erledigt" für nichts.
//
// Nicht erkannte Anweisungen werden deshalb **abgelehnt und benannt**, nicht
// stillschweigend ignoriert und nicht näherungsweise geraten.
//
// ── Determinismus ────────────────────────────────────────────────────────
//
// Wie die Synthese: kein Modellaufruf, keine Uhr, kein Zufall. Gleicher
// Blueprint + gleiche Anweisung ⇒ gleicher Blueprint ⇒ gleicher Hash.

import type { BlockKind, SiteBlock, SiteBlueprint, SitePage } from '../types.ts';
import type { SiteBrief } from './brief.ts';
import { getIndustryPreset } from './industries.ts';
import { deriveCompliance, synthesizeBlueprint } from './synthesize.ts';
import { safeColor, safeRadius } from '../render/theme.ts';

/** Betonung des Titelbereichs. Wird vom Renderer als `data-emphasis` ausgegeben. */
export type HeroEmphasis = 'compact' | 'normal' | 'large';

/**
 * Die vollständige Änderungssprache. Jede Variante entspricht einer Wirkung,
 * die der Renderer tatsächlich erzeugt — es gibt hier keine Operation ohne
 * sichtbares Ergebnis.
 */
export type EditOp =
  | { op: 'theme.accent'; value: string }
  | { op: 'theme.appearance'; value: 'dark' | 'light' }
  | { op: 'theme.radius'; value: number }
  | { op: 'hero.emphasis'; value: HeroEmphasis }
  | { op: 'hero.headline'; value: string }
  | { op: 'hero.subline'; value: string }
  | { op: 'site.name'; value: string }
  | { op: 'block.add'; kind: BlockKind }
  | { op: 'block.remove'; kind: BlockKind };

export type EditRejectionCode =
  /** Pflichtblock — darf nicht entfernt werden (Art. 50 EU AI Act, § 5 DDG). */
  | 'PROTECTED_BLOCK'
  | 'BLOCK_NOT_PRESENT'
  | 'BLOCK_ALREADY_PRESENT'
  /** Das Branchen-Preset kennt diesen Block nicht — er liesse sich nur raten. */
  | 'BLOCK_NOT_AVAILABLE'
  /** Wert hat die Sicherheitsprüfung nicht bestanden (z. B. CSS-Ausbruch). */
  | 'VALUE_REJECTED'
  /** Der Wert steht bereits so — nichts zu tun. */
  | 'NO_CHANGE';

export interface EditRejection {
  code: EditRejectionCode;
  /** Für den Besucher lesbar, deutsch, ohne Schuldzuweisung. */
  message: string;
}

export interface EditResult {
  blueprint: SiteBlueprint;
  changed: boolean;
  rejection: EditRejection | null;
}

/**
 * Blöcke, die eine Änderung nicht entfernen darf.
 *
 * `ai-disclosure` und `legal-text` sind gesetzliche Pflichtangaben — sie
 * stehen genau deshalb im Blueprint, damit niemand sie wegklickt. Der
 * Kommentar in `synthesize.ts` sagt es für die Erzeugung; hier gilt es für
 * die Änderung. `navigation` und `footer` tragen die Pflichtverlinkung auf
 * Impressum und Datenschutzerklärung.
 */
export const PROTECTED_BLOCK_KINDS: readonly BlockKind[] = Object.freeze([
  'navigation',
  'footer',
  'legal-text',
  'ai-disclosure',
]);

/** Am Seitenende stehende Blöcke — neue Blöcke werden davor eingefügt. */
const TAIL_KINDS: readonly BlockKind[] = Object.freeze(['ai-disclosure', 'footer']);

/** Steuerzeichen, die in keinem redaktionellen Text etwas zu suchen haben. */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

// ─────────────────────────────────────────────────────────────────────
// Anwenden
// ─────────────────────────────────────────────────────────────────────

/**
 * Wendet **eine** Anweisung auf den Blueprint an und gibt eine neue Fassung
 * zurück. Der eingehende Blueprint wird nicht verändert.
 *
 * Wird nichts geändert, ist `changed === false` und `rejection` benennt den
 * Grund. Der Aufrufer darf dann keine neue Fassung ablegen — eine Revision
 * ohne Änderung wäre ein Eintrag im Prüfpfad, der nichts belegt.
 */
export function applyEdit(blueprint: SiteBlueprint, edit: EditOp): EditResult {
  switch (edit.op) {
    case 'theme.accent': {
      const accent = safeColor(edit.value);
      if (accent === null) {
        return reject(blueprint, 'VALUE_REJECTED', 'Diese Farbangabe ist nicht verwendbar.');
      }
      if (accent === blueprint.theme.accent) {
        return reject(blueprint, 'NO_CHANGE', 'Diese Farbe ist bereits gesetzt.');
      }
      // Bewusst ohne Kontrastprüfung an dieser Stelle: Ein zu schwacher
      // Kontrast ist kein ungültiger Wert, sondern ein Befund. Er wird von
      // der Barrierefreiheits-Analyse erhoben und wirkt über den Publish
      // Gate — dort, wo er hingehört. Hier abzulehnen hiesse, den Befund zu
      // verstecken statt ihn zu zeigen.
      return changed({ ...blueprint, theme: { ...blueprint.theme, accent } });
    }

    case 'theme.appearance': {
      if (blueprint.theme.mode === edit.value) {
        return reject(blueprint, 'NO_CHANGE', 'Diese Darstellung ist bereits eingestellt.');
      }
      // Der Modus allein ändert nichts Sichtbares — das Stylesheet liest
      // Flächen- und Textfarbe, nicht `mode`. Beide werden deshalb
      // mitgeführt, sonst wäre die Anweisung eine Attrappe.
      const palette = edit.value === 'light'
        ? { surface: '#FFFFFF', foreground: '#0F172A' }
        : { surface: '#0A0A0B', foreground: '#E2E2E2' };
      return changed({ ...blueprint, theme: { ...blueprint.theme, mode: edit.value, ...palette } });
    }

    case 'theme.radius': {
      const radiusPx = safeRadius(edit.value);
      if (radiusPx === blueprint.theme.radiusPx) {
        return reject(blueprint, 'NO_CHANGE', 'Diese Kantenform ist bereits eingestellt.');
      }
      return changed({ ...blueprint, theme: { ...blueprint.theme, radiusPx } });
    }

    case 'hero.emphasis':
      return editHeroContent(blueprint, 'emphasis', edit.value);

    case 'hero.headline': {
      const value = cleanText(edit.value, 120);
      if (value === null) return reject(blueprint, 'VALUE_REJECTED', 'Der Text ist leer oder zu lang.');
      return editHeroContent(blueprint, 'headline', value);
    }

    case 'hero.subline': {
      const value = cleanText(edit.value, 300);
      if (value === null) return reject(blueprint, 'VALUE_REJECTED', 'Der Text ist leer oder zu lang.');
      return editHeroContent(blueprint, 'subline', value);
    }

    case 'site.name': {
      const name = cleanText(edit.value, 120);
      if (name === null) return reject(blueprint, 'VALUE_REJECTED', 'Der Name ist leer oder zu lang.');
      if (name === blueprint.name) return reject(blueprint, 'NO_CHANGE', 'Der Name lautet bereits so.');
      // `slug` bleibt bewusst unverändert: Er ist die Adresse der Site. Ein
      // mitwanderender Slug würde bei jeder Umbenennung die URL brechen —
      // öffentliche Route-Contracts werden nicht gebrochen (CLAUDE.md §12).
      return changed({
        ...blueprint,
        name,
        seo: {
          ...blueprint.seo,
          siteName: name,
          defaultTitle: blueprint.seo.locality ? `${name} — ${blueprint.seo.locality}` : name,
        },
        pages: blueprint.pages.map((page) => ({
          ...page,
          blocks: page.blocks.map((block) =>
            block.kind === 'navigation' ? { ...block, content: { ...block.content, brand: name } } : block,
          ),
        })),
      });
    }

    case 'block.remove': {
      if (PROTECTED_BLOCK_KINDS.includes(edit.kind)) {
        return reject(blueprint, 'PROTECTED_BLOCK',
          'Dieser Abschnitt ist gesetzlich vorgeschrieben und lässt sich nicht entfernen.');
      }
      if (!blueprint.pages.some((p) => p.blocks.some((b) => b.kind === edit.kind))) {
        return reject(blueprint, 'BLOCK_NOT_PRESENT', 'Diesen Abschnitt gibt es auf der Seite nicht.');
      }
      const pages = blueprint.pages.map((page) => ({
        ...page,
        blocks: page.blocks.filter((b) => b.kind !== edit.kind),
      }));
      return changed(withCompliance({ ...blueprint, pages }));
    }

    case 'block.add': {
      if (blueprint.pages.some((p) => p.blocks.some((b) => b.kind === edit.kind))) {
        return reject(blueprint, 'BLOCK_ALREADY_PRESENT', 'Diesen Abschnitt gibt es bereits.');
      }
      const template = blockTemplate(blueprint, edit.kind);
      if (template === null) {
        return reject(blueprint, 'BLOCK_NOT_AVAILABLE',
          'Für diese Branche ist dieser Abschnitt nicht hinterlegt.');
      }
      const pages = insertIntoHome(blueprint.pages, template);
      if (pages === null) {
        return reject(blueprint, 'BLOCK_NOT_AVAILABLE', 'Es gibt keine Startseite, in die der Abschnitt passt.');
      }
      return changed(withCompliance({ ...blueprint, pages }));
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Brief-Rekonstruktion und Compliance
// ─────────────────────────────────────────────────────────────────────

/**
 * Gewinnt den Brief aus einem bestehenden Blueprint zurück.
 *
 * Nötig, weil `deriveCompliance` und `synthesizeBlueprint` auf dem Brief
 * arbeiten, der Entwurf aber nur den Blueprint kennt — der Prompt wird
 * bewusst nie gespeichert, nur sein Hash.
 */
export function briefFromBlueprint(blueprint: SiteBlueprint): SiteBrief {
  const servicesBlock = blueprint.pages
    .flatMap((p) => p.blocks)
    .find((b) => b.kind === 'services');
  const raw = (servicesBlock?.content as { items?: unknown } | undefined)?.items;
  const items = Array.isArray(raw) ? raw : [];
  const services = items
    .map((item) => (item as { label?: unknown }).label)
    .filter((label): label is string => typeof label === 'string' && label.trim() !== '');

  return {
    name: blueprint.name,
    industry: blueprint.industry,
    locality: blueprint.seo.locality,
    summary: blueprint.seo.defaultDescription,
    services: services.length > 0 ? services : ['Beratung', 'Umsetzung', 'Betreuung'],
    locale: blueprint.locales.default,
    // `sonstiges` ist der Rückfall der Branchenerkennung; jede andere
    // Branche stand fest, sonst stünde sie nicht im Blueprint.
    industryConfident: blueprint.industry !== 'sonstiges',
  };
}

/**
 * Rechnet das Compliance-Profil neu aus den tatsächlich verbauten Blöcken.
 *
 * Muss nach jeder Änderung an der Blockliste laufen: Ein hinzugefügtes
 * Kontaktformular begründet eine Rechtsgrundlage, ein entfernter Kartenblock
 * hebt eine Consent-Kategorie auf. Bliebe das Profil stehen, würde die Site
 * etwas zusagen oder verschweigen, was nicht mehr stimmt.
 */
export function withCompliance(blueprint: SiteBlueprint): SiteBlueprint {
  const preset = getIndustryPreset(blueprint.industry);
  return {
    ...blueprint,
    compliance: deriveCompliance(briefFromBlueprint(blueprint), blueprint.pages, preset.compliance),
  };
}

// ─────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────────────────────────────────

function changed(blueprint: SiteBlueprint): EditResult {
  return { blueprint, changed: true, rejection: null };
}

function reject(blueprint: SiteBlueprint, code: EditRejectionCode, message: string): EditResult {
  return { blueprint, changed: false, rejection: { code, message } };
}

/** Trimmt und begrenzt. Steuerzeichen fliegen raus; `null` heisst unbrauchbar. */
function cleanText(value: string, maxLength: number): string | null {
  const stripped = value.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim();
  if (stripped === '' || stripped.length > maxLength) return null;
  return stripped;
}

/** Setzt ein Feld im ersten Hero-Block. Ohne Hero gibt es nichts zu ändern. */
function editHeroContent(blueprint: SiteBlueprint, key: string, value: unknown): EditResult {
  let found = false;
  let differs = false;

  const pages = blueprint.pages.map((page) => ({
    ...page,
    blocks: page.blocks.map((block) => {
      if (block.kind !== 'hero' || found) return block;
      found = true;
      const current = (block.content as Record<string, unknown>)[key];
      // `emphasis` ist im Ursprungsblueprint nicht gesetzt; `normal` ist der
      // stillschweigende Ausgangswert und damit keine Änderung.
      const effective = key === 'emphasis' ? (current ?? 'normal') : current;
      if (effective === value) return block;
      differs = true;
      return { ...block, content: { ...block.content, [key]: value } };
    }),
  }));

  if (!found) return reject(blueprint, 'BLOCK_NOT_PRESENT', 'Diese Seite hat keinen Titelbereich.');
  if (!differs) return reject(blueprint, 'NO_CHANGE', 'Dieser Wert steht bereits so.');
  return changed({ ...blueprint, pages });
}

/**
 * Holt einen Block, wie ihn die Synthese für diese Branche gebaut hätte.
 *
 * Bewusst über `synthesizeBlueprint` statt über eine zweite, hier gepflegte
 * Blockdefinition: Ein zweiter Bauplan würde mit der Zeit auseinanderlaufen,
 * und der hinzugefügte Block hätte andere Compliance-Felder als derselbe
 * Block aus der Erzeugung. `null` heisst: Diese Branche kennt den Block
 * nicht — dann wird er auch nicht erfunden.
 */
function blockTemplate(blueprint: SiteBlueprint, kind: BlockKind): SiteBlock | null {
  const reference = synthesizeBlueprint(briefFromBlueprint(blueprint), {
    source: blueprint.origin.source,
    model: blueprint.origin.model,
  });
  return reference.pages.flatMap((p) => p.blocks).find((b) => b.kind === kind) ?? null;
}

/** Fügt den Block auf der Startseite vor Pflichthinweis und Fusszeile ein. */
function insertIntoHome(pages: SitePage[], block: SiteBlock): SitePage[] | null {
  const homeIndex = pages.findIndex((p) => p.path === '/');
  if (homeIndex === -1) return null;

  const home = pages[homeIndex];
  let insertAt = home.blocks.length;
  while (insertAt > 0 && TAIL_KINDS.includes(home.blocks[insertAt - 1].kind)) insertAt -= 1;

  const blocks = [...home.blocks];
  blocks.splice(insertAt, 0, { ...block, id: `root--${block.kind}--${insertAt}` });

  const next = [...pages];
  next[homeIndex] = { ...home, blocks };
  return next;
}
