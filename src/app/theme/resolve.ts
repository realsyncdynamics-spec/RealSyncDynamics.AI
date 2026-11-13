import tokensJson from './tokens.json';
import {
  collectLeaves,
  isTokenLeaf,
  parseDesignTokenDocument,
  type DesignTokenDocument,
  type ThemeModeId,
  type TokenLeaf,
} from './schema';

export { collectLeaves };

const documentCache = { current: null as DesignTokenDocument | null };

export function designTokens(): DesignTokenDocument {
  if (!documentCache.current) documentCache.current = parseDesignTokenDocument(tokensJson);
  return documentCache.current;
}

function lookup(doc: DesignTokenDocument, reference: string): TokenLeaf {
  const [collection, ...rest] = reference.split('.');
  if (collection !== 'primitives' && collection !== 'semantic' && collection !== 'component') {
    throw new Error(`Unbekannte Token-Sammlung: ${reference}`);
  }
  let node: unknown = doc[collection];
  for (const key of rest) {
    if (!node || typeof node !== 'object' || !(key in node)) throw new Error(`Token fehlt: ${reference}`);
    node = (node as Record<string, unknown>)[key];
  }
  if (!isTokenLeaf(node)) throw new Error(`Kein Token-Blatt: ${reference}`);
  return node;
}

function concrete(doc: DesignTokenDocument, value: string | number, mode: ThemeModeId, seen: Set<string>): string {
  const text = String(value);
  if (!text.startsWith('{') || !text.endsWith('}')) return text;
  const reference = text.slice(1, -1);
  if (seen.has(reference)) throw new Error(`Alias-Schleife: ${reference}`);
  seen.add(reference);
  const leaf = lookup(doc, reference);
  const modes = leaf.$extensions?.['com.rsd.modes'];
  const next = modes?.[mode] ?? leaf.$value;
  return concrete(doc, next, mode, seen);
}

/** Aufgelöste CSS-Variablen einer Theme-Mode. Semantik und Komponenten. */
export function resolveTheme(mode: ThemeModeId, doc: DesignTokenDocument = designTokens()): Record<string, string> {
  const css: Record<string, string> = {};
  for (const leaf of collectLeaves(doc)) {
    if (leaf.collection === 'primitives') continue;
    const name = leaf.leaf.$extensions?.['com.rsd.css'];
    if (!name) continue;
    const modes = leaf.leaf.$extensions?.['com.rsd.modes'];
    const chosen = modes?.[mode] ?? leaf.leaf.$value;
    css[name] = concrete(doc, chosen, mode, new Set());
  }
  return css;
}
