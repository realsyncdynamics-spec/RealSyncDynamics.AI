/**
 * Dokumentmodell des Social-Editors.
 * Die Bühne serialisiert dieses JSON, nicht den internen Konva-Knotenbaum.
 * Flächen tragen Token-Pfade (`color.ink` …), keine kundenindividuellen Hex-Werte.
 */
import { formatById, isSocialFormatId, type SocialFormatId } from './formats';
import {
  isBrandColorToken,
  isBrandFontToken,
  type BrandColorToken,
  type BrandFontToken,
} from './brandKit';

export type LayerKind = 'text' | 'image' | 'shape' | 'logo';

interface LayerBase {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  visible: boolean;
  locked: boolean;
}

export interface TextLayer extends LayerBase {
  kind: 'text';
  text: string;
  fontToken: BrandFontToken;
  fillToken: BrandColorToken;
  fontSize: number;
  align: 'left' | 'center' | 'right';
  fontStyle: 'normal' | 'bold';
}

export interface ImageLayer extends LayerBase {
  kind: 'image';
  src: string;
}

export interface ShapeLayer extends LayerBase {
  kind: 'shape';
  shape: 'rect' | 'ellipse';
  fillToken: BrandColorToken;
}

export interface LogoLayer extends LayerBase {
  kind: 'logo';
}

export type DesignLayer = TextLayer | ImageLayer | ShapeLayer | LogoLayer;

export interface SocialDesignDocument {
  version: 1;
  id: string;
  title: string;
  formatId: SocialFormatId;
  backgroundToken: BrandColorToken;
  layers: DesignLayer[];
}

export interface HistoryState {
  past: SocialDesignDocument[];
  present: SocialDesignDocument;
  future: SocialDesignDocument[];
}

export const HISTORY_LIMIT = 100;
export const MAX_DESIGN_JSON_BYTES = 8_000_000;
export const MAX_IMAGE_BYTES = 1_500_000;

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

function baseLayer(partial: Pick<LayerBase, 'id' | 'name' | 'x' | 'y' | 'width' | 'height'>): LayerBase {
  return {
    ...partial,
    rotation: 0,
    visible: true,
    locked: false,
  };
}

export function createBlankDesign(formatId: SocialFormatId = 'instagram-feed-1080', id = newId()): SocialDesignDocument {
  const format = formatById(formatId);
  const margin = Math.round(format.width * 0.08);
  const barHeight = Math.round(format.height * 0.28);
  return {
    version: 1,
    id,
    title: 'Neues Motiv',
    formatId,
    backgroundToken: 'color.paper',
    layers: [
      {
        ...baseLayer({
          id: newId(),
          name: 'Fläche',
          x: margin,
          y: margin,
          width: format.width - margin * 2,
          height: barHeight,
        }),
        kind: 'shape',
        shape: 'rect',
        fillToken: 'color.accent',
      },
      {
        ...baseLayer({
          id: newId(),
          name: 'Überschrift',
          x: margin + 24,
          y: margin + 28,
          width: Math.max(80, format.width - margin * 2 - 48),
          height: Math.max(48, Math.round(barHeight * 0.45)),
        }),
        kind: 'text',
        text: 'Überschrift',
        fontToken: 'type.heading',
        fillToken: 'color.paper',
        fontSize: Math.max(28, Math.round(format.width * 0.045)),
        align: 'left',
        fontStyle: 'bold',
      },
      {
        ...baseLayer({
          id: newId(),
          name: 'Logo',
          x: format.width - margin - 180,
          y: format.height - margin - 72,
          width: 180,
          height: 56,
        }),
        kind: 'logo',
      },
    ],
  };
}

export function commitDocument(state: HistoryState, next: SocialDesignDocument): HistoryState {
  if (JSON.stringify(state.present) === JSON.stringify(next)) return state;
  return {
    past: [...state.past, state.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
  };
}

export function undoDocument(state: HistoryState): HistoryState {
  const previous = state.past[state.past.length - 1];
  if (!previous) return state;
  return {
    past: state.past.slice(0, -1),
    present: previous,
    future: [state.present, ...state.future],
  };
}

export function redoDocument(state: HistoryState): HistoryState {
  const next = state.future[0];
  if (!next) return state;
  return {
    past: [...state.past, state.present].slice(-HISTORY_LIMIT),
    present: next,
    future: state.future.slice(1),
  };
}

export function replaceDocument(next: SocialDesignDocument): HistoryState {
  return { past: [], present: next, future: [] };
}

export function updateLayer(
  doc: SocialDesignDocument,
  id: string,
  patch: Partial<DesignLayer>,
): SocialDesignDocument {
  return {
    ...doc,
    layers: doc.layers.map((layer) => (layer.id === id ? ({ ...layer, ...patch, id: layer.id, kind: layer.kind } as DesignLayer) : layer)),
  };
}

export function addLayer(doc: SocialDesignDocument, layer: DesignLayer): SocialDesignDocument {
  return { ...doc, layers: [...doc.layers, layer] };
}

export function removeLayer(doc: SocialDesignDocument, id: string): SocialDesignDocument {
  return { ...doc, layers: doc.layers.filter((layer) => layer.id !== id) };
}

/** `forward` hebt die Ebene an (später im Array = weiter oben). */
export function moveLayer(
  doc: SocialDesignDocument,
  id: string,
  direction: 'forward' | 'back',
): SocialDesignDocument {
  const index = doc.layers.findIndex((layer) => layer.id === id);
  const target = direction === 'forward' ? index + 1 : index - 1;
  if (index < 0 || target < 0 || target >= doc.layers.length) return doc;
  const layers = doc.layers.slice();
  const [item] = layers.splice(index, 1);
  layers.splice(target, 0, item);
  return { ...doc, layers };
}

export interface NodeBox {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  width: number;
  height: number;
}

/** Transformer-Ende: Skalierung in Breite, Höhe und bei Text in die Schriftgröße übernehmen. */
export function applyTransformedBox(layer: DesignLayer, box: NodeBox): DesignLayer {
  const width = Math.max(8, box.width * box.scaleX);
  const height = Math.max(8, box.height * box.scaleY);
  if (layer.kind === 'text') {
    return {
      ...layer,
      x: box.x,
      y: box.y,
      rotation: box.rotation,
      width,
      height,
      fontSize: Math.max(8, Math.round(layer.fontSize * box.scaleY)),
    };
  }
  return {
    ...layer,
    x: box.x,
    y: box.y,
    rotation: box.rotation,
    width,
    height,
  };
}

/**
 * Formatwechsel skaliert Ebenen geometrisch mit.
 * Das ist kein inhaltliches Resize (das folgt später) — nur die Bühnenmaße.
 */
export function scaleDocumentToFormat(doc: SocialDesignDocument, formatId: SocialFormatId): SocialDesignDocument {
  if (doc.formatId === formatId) return doc;
  const from = formatById(doc.formatId);
  const to = formatById(formatId);
  const sx = to.width / from.width;
  const sy = to.height / from.height;
  const typeScale = Math.min(sx, sy);
  return {
    ...doc,
    formatId,
    layers: doc.layers.map((layer) => {
      const box = {
        x: Math.round(layer.x * sx),
        y: Math.round(layer.y * sy),
        width: Math.max(8, Math.round(layer.width * sx)),
        height: Math.max(8, Math.round(layer.height * sy)),
      };
      if (layer.kind === 'text') {
        return { ...layer, ...box, fontSize: Math.max(8, Math.round(layer.fontSize * typeScale)) };
      }
      return { ...layer, ...box };
    }),
  };
}

export function createTextLayer(doc: SocialDesignDocument): TextLayer {
  const format = formatById(doc.formatId);
  return {
    ...baseLayer({
      id: newId(),
      name: 'Text',
      x: Math.round(format.width * 0.12),
      y: Math.round(format.height * 0.4),
      width: Math.round(format.width * 0.76),
      height: Math.round(format.height * 0.12),
    }),
    kind: 'text',
    text: 'Text',
    fontToken: 'type.body',
    fillToken: 'color.ink',
    fontSize: Math.max(24, Math.round(format.width * 0.04)),
    align: 'left',
    fontStyle: 'normal',
  };
}

export function createShapeLayer(doc: SocialDesignDocument, shape: 'rect' | 'ellipse'): ShapeLayer {
  const format = formatById(doc.formatId);
  const size = Math.round(Math.min(format.width, format.height) * 0.28);
  return {
    ...baseLayer({
      id: newId(),
      name: shape === 'rect' ? 'Rechteck' : 'Ellipse',
      x: Math.round((format.width - size) / 2),
      y: Math.round((format.height - size) / 2),
      width: size,
      height: size,
    }),
    kind: 'shape',
    shape,
    fillToken: 'color.accent',
  };
}

export function createLogoLayer(doc: SocialDesignDocument): LogoLayer {
  const format = formatById(doc.formatId);
  return {
    ...baseLayer({
      id: newId(),
      name: 'Logo',
      x: Math.round(format.width * 0.08),
      y: Math.round(format.height * 0.08),
      width: Math.round(format.width * 0.22),
      height: Math.round(format.height * 0.08),
    }),
    kind: 'logo',
  };
}

export function createImageLayer(doc: SocialDesignDocument, src: string): ImageLayer {
  const format = formatById(doc.formatId);
  const width = Math.round(format.width * 0.46);
  const height = Math.round(format.height * 0.32);
  return {
    ...baseLayer({
      id: newId(),
      name: 'Bild',
      x: Math.round((format.width - width) / 2),
      y: Math.round((format.height - height) / 2),
      width,
      height,
    }),
    kind: 'image',
    src,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isSafeImageSrc(src: string): boolean {
  if (src.startsWith('data:image/')) {
    return src.length <= MAX_IMAGE_BYTES * 2;
  }
  try {
    const url = new URL(src);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function parseLayer(value: unknown, index: number): DesignLayer {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    throw new Error(`Ebene ${index + 1} ist ungültig`);
  }
  const shared: LayerBase = {
    id: typeof value.id === 'string' && value.id.trim() ? value.id : newId(),
    name: typeof value.name === 'string' && value.name.trim() ? value.name.slice(0, 80) : `Ebene ${index + 1}`,
    x: num(value.x),
    y: num(value.y),
    width: Math.max(8, num(value.width, 80)),
    height: Math.max(8, num(value.height, 40)),
    rotation: num(value.rotation),
    visible: value.visible !== false,
    locked: value.locked === true,
  };
  if (value.kind === 'text') {
    const fill = typeof value.fillToken === 'string' && isBrandColorToken(value.fillToken) ? value.fillToken : 'color.ink';
    const font = typeof value.fontToken === 'string' && isBrandFontToken(value.fontToken) ? value.fontToken : 'type.body';
    const align = value.align === 'center' || value.align === 'right' ? value.align : 'left';
    return {
      ...shared,
      kind: 'text',
      text: typeof value.text === 'string' ? value.text.slice(0, 2000) : '',
      fillToken: fill,
      fontToken: font,
      fontSize: Math.max(8, num(value.fontSize, 32)),
      align,
      fontStyle: value.fontStyle === 'bold' ? 'bold' : 'normal',
    };
  }
  if (value.kind === 'shape') {
    const fill = typeof value.fillToken === 'string' && isBrandColorToken(value.fillToken) ? value.fillToken : 'color.accent';
    return {
      ...shared,
      kind: 'shape',
      shape: value.shape === 'ellipse' ? 'ellipse' : 'rect',
      fillToken: fill,
    };
  }
  if (value.kind === 'logo') {
    return { ...shared, kind: 'logo' };
  }
  if (value.kind === 'image') {
    if (typeof value.src !== 'string' || !isSafeImageSrc(value.src)) {
      throw new Error(`Bild-Ebene ${index + 1} hat keine zulässige Quelle`);
    }
    return { ...shared, kind: 'image', src: value.src };
  }
  throw new Error(`Ebene ${index + 1} hat einen unbekannten Typ`);
}

/** Akzeptiert das Dokument oder die heruntergeladene Hülle `{ document }`. */
export function parseSocialDesign(value: unknown): SocialDesignDocument {
  if (!isRecord(value)) throw new Error('Design-JSON ist kein Objekt');
  const raw = value.kind === 'realsync.social-design' && isRecord(value.document) ? value.document : value;
  if (!isRecord(raw)) throw new Error('Design-JSON ist kein Objekt');
  if (raw.version !== 1) throw new Error('Diese Design-Version wird nicht gelesen');
  if (typeof raw.formatId !== 'string' || !isSocialFormatId(raw.formatId)) {
    throw new Error('Format ist unbekannt');
  }
  if (!Array.isArray(raw.layers)) throw new Error('Ebenen fehlen');
  const background = typeof raw.backgroundToken === 'string' && isBrandColorToken(raw.backgroundToken)
    ? raw.backgroundToken
    : 'color.paper';
  const doc: SocialDesignDocument = {
    version: 1,
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : newId(),
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim().slice(0, 160) : 'Neues Motiv',
    formatId: raw.formatId,
    backgroundToken: background,
    layers: raw.layers.map((layer, index) => parseLayer(layer, index)),
  };
  if (designJsonByteLength(doc) > MAX_DESIGN_JSON_BYTES) {
    throw new Error('Design-JSON ist zu groß');
  }
  return doc;
}

export function designJsonByteLength(doc: SocialDesignDocument): number {
  return new TextEncoder().encode(JSON.stringify(doc)).length;
}

export function designFileJson(doc: SocialDesignDocument, brandSnapshot: unknown): string {
  return JSON.stringify(
    {
      kind: 'realsync.social-design',
      version: 1,
      document: doc,
      brandSnapshot,
    },
    null,
    2,
  );
}

export function pngFileName(doc: SocialDesignDocument): string {
  const format = formatById(doc.formatId);
  const slug = doc.title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'motiv';
  return `${slug}-${format.width}x${format.height}.png`;
}
