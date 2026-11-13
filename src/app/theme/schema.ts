/**
 * W3C Design Tokens (DTCG) für die drei Schichten des Designer-Sets v1.
 *
 * Figma-Variables-Abbildung (Starter-Plan hat nur einen Live-Modus):
 * - Collection `primitives`, Modus `value` → `primitives`. Rohwerte, kein Alias.
 * - Collection `semantic`, Variable `color/surface/default` → `semantic.color.surface.default`.
 *   Modi liegen in `$extensions["com.rsd.modes"]`: `light-cream` (Default),
 *   `pure-white-silver`, `warm-graphite`. Im Figma-File ist nur `light-cream`
 *   als Modus angelegt; die anderen beiden stehen vollständig in tokens.json.
 * - Collection `component` → `component`. `$value` zeigt nur auf `{semantic…}`.
 * - CSS-Name steht in `$extensions["com.rsd.css"]` (`--color-surface-default`).
 *
 * Mandanten überschreiben nur die semantische Schicht. `proposed` in
 * `$description` bleibt stehen; dieses Modul ändert keine Werte.
 */
export const THEME_MODES = ['light-cream', 'pure-white-silver', 'warm-graphite'] as const;
export type ThemeModeId = (typeof THEME_MODES)[number];
export const DEFAULT_THEME_MODE: ThemeModeId = 'light-cream';

export interface TokenLeaf {
  $type: string;
  $value: string | number;
  $description?: string;
  $extensions?: {
    'com.rsd.modes'?: Partial<Record<ThemeModeId, string>>;
    'com.rsd.css'?: string;
  };
}

export interface DesignTokenDocument {
  $schema?: string;
  $description?: string;
  primitives: Record<string, unknown>;
  semantic: Record<string, unknown>;
  component: Record<string, unknown>;
}

export class TokenSchemaError extends Error {}

export function isTokenLeaf(value: unknown): value is TokenLeaf {
  return !!value && typeof value === 'object' && '$type' in value && '$value' in value;
}

export function isThemeMode(value: string | null | undefined): value is ThemeModeId {
  return !!value && (THEME_MODES as readonly string[]).includes(value);
}

interface LeafRef {
  collection: 'primitives' | 'semantic' | 'component';
  path: string[];
  leaf: TokenLeaf;
}

function walk(node: unknown, collection: LeafRef['collection'], path: string[], out: LeafRef[]) {
  if (!node || typeof node !== 'object') return;
  if (isTokenLeaf(node)) {
    out.push({ collection, path, leaf: node });
    return;
  }
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith('$')) continue;
    walk(child, collection, [...path, key], out);
  }
}

function aliasTarget(value: string): string | null {
  if (!value.startsWith('{') || !value.endsWith('}')) return null;
  return value.slice(1, -1);
}

export function collectLeaves(doc: DesignTokenDocument): LeafRef[] {
  const out: LeafRef[] = [];
  walk(doc.primitives, 'primitives', [], out);
  walk(doc.semantic, 'semantic', [], out);
  walk(doc.component, 'component', [], out);
  return out;
}

export function parseDesignTokenDocument(input: unknown): DesignTokenDocument {
  if (!input || typeof input !== 'object') throw new TokenSchemaError('Token-Dokument fehlt.');
  const doc = input as Partial<DesignTokenDocument>;
  if (!doc.primitives || !doc.semantic || !doc.component) {
    throw new TokenSchemaError('primitives, semantic und component sind Pflicht.');
  }
  const parsed: DesignTokenDocument = {
    primitives: doc.primitives,
    semantic: doc.semantic,
    component: doc.component,
    $schema: doc.$schema,
    $description: doc.$description,
  };
  for (const leaf of collectLeaves(parsed)) {
    const value = String(leaf.leaf.$value);
    const target = aliasTarget(value);
    if (leaf.collection === 'primitives') {
      if (target) throw new TokenSchemaError(`Primitiv ${leaf.path.join('/')} darf nicht aliassen.`);
      continue;
    }
    if (leaf.collection === 'semantic') {
      const modes = leaf.leaf.$extensions?.['com.rsd.modes'];
      if (!modes) throw new TokenSchemaError(`Semantik ${leaf.path.join('/')} braucht Modi.`);
      const allowed = (ref: string | undefined) => {
        const name = ref ? aliasTarget(ref) : null;
        return !!name && (name.startsWith('primitives.') || name.startsWith('semantic.'));
      };
      for (const mode of THEME_MODES) {
        if (!allowed(modes[mode])) {
          throw new TokenSchemaError(`Semantik ${leaf.path.join('/')} zeigt in ${mode} nicht auf primitives oder semantic.`);
        }
      }
      if (!allowed(value)) {
        throw new TokenSchemaError(`Semantik ${leaf.path.join('/')} muss auf primitives oder semantic zeigen.`);
      }
      if (!leaf.leaf.$extensions?.['com.rsd.css']?.startsWith('--')) {
        throw new TokenSchemaError(`Semantik ${leaf.path.join('/')} braucht einen CSS-Namen.`);
      }
      continue;
    }
    if (!target?.startsWith('semantic.')) {
      throw new TokenSchemaError(`Komponente ${leaf.path.join('/')} muss auf semantic zeigen.`);
    }
  }
  return parsed;
}

/** `color/surface/default` oder `semantic.color.surface.default` → `--color-surface-default`. */
export function semanticCssName(path: string): string {
  const normalized = path.trim().replace(/^semantic\./, '').replaceAll('/', '.');
  if (normalized.startsWith('primitives.') || normalized.startsWith('component.')) {
    throw new TokenSchemaError('Nur die semantische Schicht darf überschrieben werden.');
  }
  if (!normalized || normalized.includes(' ')) throw new TokenSchemaError(`Ungültiger Token-Pfad: ${path}`);
  return `--${normalized.replaceAll('.', '-')}`;
}
