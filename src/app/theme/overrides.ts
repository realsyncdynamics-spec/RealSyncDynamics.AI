import type { CSSProperties } from 'react';
import { semanticCssName, TokenSchemaError } from './schema';

export type SemanticOverride = Record<string, string>;

const COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const FONT_FAMILY_PATH = /^(?:semantic\.)?type[./]family[./](?:display|body)$/;
const FONT_STACK = /^[A-Za-z0-9 ,."'-]+$/;
const EASING = /^cubic-bezier\([\d.,\s-]+\)$/;

function concrete(path: string, value: string): boolean {
  if (FONT_FAMILY_PATH.test(path)) return FONT_STACK.test(value);
  if (EASING.test(value)) return true;
  return COLOR.test(value) || value.endsWith('px') || value.endsWith('ms');
}

/** Mandanten-Override: nur semantische CSS-Variablen, konkrete Werte. */
export function semanticOverrideStyle(overrides: SemanticOverride): CSSProperties {
  const style: Record<string, string> = {};
  for (const [path, value] of Object.entries(overrides)) {
    if (path.startsWith('primitives') || path.startsWith('component')) {
      throw new TokenSchemaError('Nur die semantische Schicht darf überschrieben werden.');
    }
    if (!concrete(path, value)) throw new TokenSchemaError(`Override ${path} ist kein konkreter Wert.`);
    style[semanticCssName(path)] = value;
  }
  return style as CSSProperties;
}
