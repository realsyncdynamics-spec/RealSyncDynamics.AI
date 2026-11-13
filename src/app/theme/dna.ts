/**
 * Design-DNA-Overlay. Nur semantische Overrides, Modi unter com.rsd.modes.
 * Ungesetzte Namen erben das Basis-Theme (light-cream).
 *
 * Die Generator-Spezifikation (Distanz, OKLCH, Achsen-Hamming) wird hier
 * nicht gerechnet. `axes_not_in_semantic_109` bleibt Metadatum.
 */
import type { CSSProperties } from 'react';
import dnaJson from './dna-tokens.json';
import { collectLeaves, designTokens } from './resolve';
import { TokenSchemaError, type DesignTokenDocument } from './schema';

export const DNA_MODES = ['beispiel-handwerk', 'beispiel-b2b-saas', 'beispiel-kanzlei'] as const;
export type DnaModeId = (typeof DNA_MODES)[number];

export function isDnaMode(value: string | null | undefined): value is DnaModeId {
  return !!value && (DNA_MODES as readonly string[]).includes(value);
}

interface DnaLeaf {
  cssName: string;
  path: string;
  modes: Record<DnaModeId, string>;
}

function toCss(value: unknown, tokenPath: string, mode: string): string {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    if (value.startsWith('{')) throw new TokenSchemaError(`DNA-Token ${tokenPath} setzt ${mode} nicht konkret.`);
    return value;
  }
  if (Array.isArray(value) && value.every((item) => typeof item === 'number')) {
    return `cubic-bezier(${value.join(', ')})`;
  }
  throw new TokenSchemaError(`DNA-Token ${tokenPath} hat in ${mode} keinen CSS-Wert.`);
}

function walk(node: unknown, path: string[], out: DnaLeaf[]) {
  if (!node || typeof node !== 'object') return;
  const record = node as Record<string, unknown>;
  if ('$type' in record && record.$extensions && typeof record.$extensions === 'object') {
    const extensions = record.$extensions as {
      'com.rsd.modes'?: Partial<Record<DnaModeId, unknown>>;
      'com.rsd.css'?: string;
    };
    const modes = extensions['com.rsd.modes'];
    const cssName = extensions['com.rsd.css'];
    if (!modes || !cssName?.startsWith('--')) {
      throw new TokenSchemaError(`DNA-Token ${path.join('/')} braucht Modi und einen CSS-Namen.`);
    }
    const resolved = {} as Record<DnaModeId, string>;
    for (const mode of DNA_MODES) {
      const value = modes[mode];
      if (value == null) throw new TokenSchemaError(`DNA-Token ${path.join('/')} setzt ${mode} nicht.`);
      resolved[mode] = toCss(value, path.join('/'), mode);
    }
    out.push({ cssName, path: path.join('/'), modes: resolved });
    return;
  }
  for (const [key, child] of Object.entries(record)) {
    if (key.startsWith('$')) continue;
    walk(child, [...path, key], out);
  }
}

export function parseDnaOverlay(input: unknown): DnaLeaf[] {
  if (!input || typeof input !== 'object') throw new TokenSchemaError('DNA-Overlay fehlt.');
  const record = input as Record<string, unknown>;
  if ('primitives' in record || 'component' in record) {
    throw new TokenSchemaError('DNA-Overlay darf weder primitives noch component enthalten.');
  }
  if (!record.semantic) throw new TokenSchemaError('DNA-Overlay braucht semantic.');
  const leaves: DnaLeaf[] = [];
  walk(record.semantic, [], leaves);
  return leaves;
}

let cached: DnaLeaf[] | null = null;

export function designDna(): DnaLeaf[] {
  if (!cached) cached = parseDnaOverlay(dnaJson);
  return cached;
}

/** Nur gesetzte Variablen. Alles andere bleibt beim Basis-Theme. */
export function dnaOverlayStyle(mode: DnaModeId, leaves: DnaLeaf[] = designDna()): CSSProperties {
  const style: Record<string, string> = {};
  for (const leaf of leaves) style[leaf.cssName] = leaf.modes[mode];
  return style as CSSProperties;
}

export function assertDnaWithinBase(base: DesignTokenDocument = designTokens()): void {
  const names = new Set(
    collectLeaves(base)
      .filter((leaf) => leaf.collection === 'semantic')
      .map((leaf) => leaf.path.join('/')),
  );
  for (const leaf of designDna()) {
    if (!names.has(leaf.path)) throw new TokenSchemaError(`DNA-Name außerhalb der Basis: ${leaf.path}`);
  }
}
