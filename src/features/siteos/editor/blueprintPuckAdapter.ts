// Brücke zwischen dem SiteOS-Blueprint und dem Datenmodell von Puck.
//
// Puck (MIT, @puckeditor/core) editiert eine flache Liste aus
// `{ type, props }`. Eine `SitePage` ist eine Liste aus `SiteBlock`
// (`{ id, kind, content, … }`). Die Abbildung ist deshalb dünn: `type` = Block-
// Art, `props` = editierbare Inhaltsfelder plus `id`. Was nicht editierbar ist,
// wandert unverändert mit (`__content`, `__meta`) und kommt beim Rückweg wieder
// heraus — der Editor kann nur ändern, was `EDITABLE_CONTENT` nennt.
//
// Der Rückweg erzeugt **keinen** fertigen Blueprint für den Server. Er
// erzeugt die Seite für die lokale Vorschau und daraus die `PageEdit`-Anfrage
// (`toPageEdit`), in der nur Reihenfolge, Art und redaktionelle Felder
// stehen. Die Merkmale leitet der Server ab (`applyPageEdits`).

import type { Data } from '@puckeditor/core';
import {
  EDITABLE_CONTENT,
  applyPageEdits,
  isBlockKind,
  type BlockEdit,
  type BlockKind,
  type FieldShape,
  type PageEdit,
  type SiteBlock,
  type SiteBlueprint,
  type SitePage,
} from '../../../../packages/siteos-core/src/index';

/** Nicht editierbare Merkmale, die den Rundweg unverändert überstehen. */
interface BlockMeta {
  processesPersonalData: boolean;
  thirdPartyHosts: string[];
  aiGenerated: boolean;
}

export interface BlockProps {
  id: string;
  /** Vollständiger gespeicherter Inhalt — Grundlage für nicht editierbare Felder. */
  __content: Record<string, unknown>;
  __meta: BlockMeta;
  [field: string]: unknown;
}

export type PuckPageData = Data<Record<BlockKind, BlockProps>>;

// ─────────────────────────────────────────────────────────────────────
// Blueprint → Puck
// ─────────────────────────────────────────────────────────────────────

export function pageToPuckData(page: SitePage): PuckPageData {
  return {
    root: { props: { title: page.title } },
    content: page.blocks.map((block) => ({ type: block.kind, props: blockToProps(block) })),
  };
}

export function blockToProps(block: SiteBlock): BlockProps {
  const props: BlockProps = {
    id: block.id,
    __content: block.content,
    __meta: {
      processesPersonalData: block.processesPersonalData,
      thirdPartyHosts: block.thirdPartyHosts,
      aiGenerated: block.aiGenerated,
    },
  };
  for (const [key, shape] of Object.entries(EDITABLE_CONTENT[block.kind])) {
    props[key] = toFieldValue(shape, block.content[key]);
  }
  return props;
}

/** Bringt einen Inhaltswert in die Form, die Puck-Felder erwarten. */
function toFieldValue(shape: FieldShape, value: unknown): unknown {
  switch (shape.type) {
    case 'text':
    case 'textarea':
    case 'url':
      return typeof value === 'string' ? value : '';
    case 'enum':
      return typeof value === 'string' && shape.values.includes(value) ? value : '';
    case 'object': {
      const source = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
      return Object.fromEntries(Object.entries(shape.fields).map(([k, s]) => [k, toFieldValue(s, source[k])]));
    }
    case 'list': {
      if (!Array.isArray(value)) return [];
      return value.map((item) => {
        const source = typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : {};
        return Object.fromEntries(Object.entries(shape.item).map(([k, s]) => [k, toFieldValue(s, source[k])]));
      });
    }
    case 'form-fields':
      // Puck kennt keine Liste aus Strings — jedes Feld wird zum Objekt.
      return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string').map((name) => ({ name })) : [];
  }
}

// ─────────────────────────────────────────────────────────────────────
// Puck → Seite (lokale Vorschau) und → PageEdit (Anfrage an den Server)
// ─────────────────────────────────────────────────────────────────────

/**
 * Baut aus den Puck-Daten die Seite für die lokale Vorschau. Läuft durch
 * `applyPageEdits`, also durch dieselbe Logik wie der Server — die Vorschau
 * zeigt damit, was gespeichert würde, nicht was der Client sich wünscht.
 */
export function puckDataToBlueprint(blueprint: SiteBlueprint, pagePath: string, data: PuckPageData): SiteBlueprint {
  return applyPageEdits(blueprint, [toPageEdit(pagePath, data)]).blueprint;
}

export function toPageEdit(pagePath: string, data: PuckPageData): PageEdit {
  const blocks: BlockEdit[] = [];
  for (const item of data.content ?? []) {
    if (!isBlockKind(item.type)) continue;
    const props = item.props as BlockProps;
    const content: Record<string, unknown> = {};
    for (const [key, shape] of Object.entries(EDITABLE_CONTENT[item.type])) {
      // Nur geänderte Felder gehen in die Anfrage. Ein unberührtes Feld hat
      // im Editor die Darstellung seines gespeicherten Werts (`''` für ein
      // fehlendes Feld) — es zurückzuschicken hieße, aus „nicht gesetzt"
      // ein leeres Feld zu machen und damit den Hash zu ändern.
      if (key in props && !fieldUnchanged(shape, props, key)) content[key] = fromFieldValue(shape, props[key]);
    }
    blocks.push({
      // Von Puck vergebene IDs neuer Blöcke sind für den Server unbekannt —
      // er legt den Block dann über den Block-Bauer neu an.
      id: isStoredId(props.id) ? props.id : undefined,
      kind: item.type,
      content,
    });
  }
  return { path: pagePath, blocks };
}

function fromFieldValue(shape: FieldShape, value: unknown): unknown {
  switch (shape.type) {
    case 'form-fields':
      return Array.isArray(value) ? value.map((v) => (typeof v === 'object' && v !== null ? (v as { name?: unknown }).name : v)) : [];
    case 'enum':
      return value === '' ? undefined : value;
    default:
      return value;
  }
}

/** Hat das Feld noch die Darstellung seines gespeicherten Werts? */
function fieldUnchanged(shape: FieldShape, props: BlockProps, key: string): boolean {
  const stored = toFieldValue(shape, props.__content?.[key]);
  return JSON.stringify(props[key]) === JSON.stringify(stored);
}

/** IDs aus `blockId()` tragen ihre Art zwischen Doppelstrichen. */
export function isStoredId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-z0-9-]+--[a-z-]+--\d+$/.test(id);
}

/**
 * Rekonstruiert aus Puck-Props den Block für das Rendern in der Leinwand —
 * lokal, ohne Server. Merkmale kommen aus `__meta`; ein neuer Block bekommt
 * bis zum Speichern die Vorgaben eines redaktionellen Blocks.
 */
export function propsToBlock(kind: BlockKind, props: BlockProps): SiteBlock {
  const content: Record<string, unknown> = { ...(props.__content ?? {}) };
  for (const [key, shape] of Object.entries(EDITABLE_CONTENT[kind])) {
    if (!(key in props) || fieldUnchanged(shape, props, key)) continue;
    const value = fromFieldValue(shape, props[key]);
    if (value === undefined) delete content[key];
    else content[key] = value;
  }
  const meta = props.__meta ?? { processesPersonalData: false, thirdPartyHosts: [], aiGenerated: false };
  return {
    id: String(props.id),
    kind,
    content,
    processesPersonalData: meta.processesPersonalData,
    thirdPartyHosts: meta.thirdPartyHosts,
    aiGenerated: meta.aiGenerated,
  };
}
