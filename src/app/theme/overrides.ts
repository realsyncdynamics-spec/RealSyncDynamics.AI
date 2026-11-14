import type { CSSProperties } from 'react';
import { semanticCssName, TokenSchemaError } from './schema';

export type SemanticOverride = Record<string, string>;

const COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const FONT_FAMILY_PATH = /^(?:semantic\.)?type[./]family[./](?:display|body)$/;
const FONT_STACK = /^[A-Za-z0-9 ,."'-]+$/;

/** Mandanten-Override: nur semantische CSS-Variablen, konkrete Werte. */
export function semanticOverrideStyle(overrides: SemanticOverride): CSSProperties {
  const style: Record<string, string> = {};
  for (const [path, value] of Object.entries(overrides)) {
    if (path.startsWith('primitives') || path.startsWith('component')) {
      throw new TokenSchemaError('Nur die semantische Schicht darf überschrieben werden.');
    }
    const fontFamily = FONT_FAMILY_PATH.test(path);
    if (fontFamily) {
      if (!FONT_STACK.test(value)) throw new TokenSchemaError(`Schriftstapel ${path} ist kein konkreter Wert.`);
    } else if (!COLOR.test(value) && !value.endsWith('px') && !value.endsWith('ms')) {
      throw new TokenSchemaError(`Override ${path} ist kein konkreter Wert.`);
    }
    style[semanticCssName(path)] = value;
  }
  return style as CSSProperties;
}
