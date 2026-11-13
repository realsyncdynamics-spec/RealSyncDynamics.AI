// DNA-Overlay → CSS der SiteOS-Ausgabeschicht.
//
// Der Generator bleibt in `src/app/theme/generator`. Dieses Modul kopiert
// ihn nicht und rechnet keine Distanz. Es nimmt ein bereits erzeugtes
// semantisches Overlay und schreibt nur Werte, die `safeColor` /
// `safeFontStack` oder ein enges Maß-Muster bestehen.
//
// Ohne aktive Fassung ist die Rückgabe leer. Der Aufrufer hängt sie an das
// bestehende Stylesheet. Leer angehängt bleibt der String byte-gleich.

import { activeDnaVersion } from '../blueprint/dna.ts';
import type { SiteDnaRecord } from '../types.ts';
import { SEMANTIC_TOKEN_NAME_SET } from './semantic-token-names.ts';
import { safeColor, safeFontStack, safeRadius } from './theme.ts';

/**
 * Lücken aus der Design-Spec. Es wird kein Token-Name dafür angelegt.
 * Der Adapter setzt für diese Punkte keinen Ersatzwert.
 */
export const DOCUMENTED_TOKEN_GAPS = [
  {
    id: 'layout-tablet',
    detail:
      'Die Layout-Gruppe hat layout/screen-desktop und layout/screen-mobile. Eine Tablet-Breite ist kein Token. Der Adapter setzt keine Breite.',
  },
  {
    id: 'type-weight-regular',
    detail:
      'Vorhanden sind type/weight/medium, semibold, bold und heavy. Ein Regular-Gewicht wird nicht angelegt. Fließtext bleibt bei type/family/body.',
  },
  {
    id: 'status-error',
    detail:
      'Die Status-Gruppe hat success, preview und demo. Ein Error-Status wird nicht angelegt. color/accent/red bleibt der vorhandene Name, wenn ein Overlay ihn setzt.',
  },
  {
    id: 'overlay-opacity',
    detail:
      'Es gibt kein Opazitäts- oder Scrim-Token. color/overlay/orb-mid und color/overlay/orb-outer sind vorhandene Orb-Farben und kein Ersatz. Der Adapter setzt keinen Alpha-Wert.',
  },
  {
    id: 'disabled',
    detail: 'Es gibt kein Disabled-Token. Der Adapter setzt keinen eigenen Disabled-Zustand.',
  },
  {
    id: 'space-6',
    detail:
      'Kein Space-Token für 6px. Der Adapter erfindet keins. space/100 bleibt der nächste vorhandene Name und wird hier nicht als Ersatz eingesetzt.',
  },
  {
    id: 'type-size-16-32',
    detail:
      'Kein Type-Size-Token für einen 16px-Titel oder einen 32px-KPI-Wert. type/size/title-sm und type/size/h2-min existieren und werden nur ausgegeben, wenn das Overlay sie enthält.',
  },
  {
    id: 'text-accent-unset',
    detail:
      'color/text/accent existiert. Der Generator schreibt ihn nicht ins Overlay. Links nutzen color/text/primary. color/accent/primary wird nicht als Text- oder Linkfarbe gesetzt.',
  },
] as const;

const REQUIRED_BINDINGS = [
  'color/surface/default',
  'color/text/primary',
  'color/text/inverse',
  'color/accent/primary',
  'color/border/focus',
  'type/family/display',
  'type/family/body',
  'radius/md',
] as const;

export interface DnaCssBinding {
  /** Zusatz hinter dem bestehenden Theme-CSS. Leer, wenn nichts Sicheres aktiv ist. */
  layerCss: string;
  /** Zusatz hinter dem Showcase-CSS. Leer ohne aktive Fassung oder ohne die Button-Farben. */
  presentationCss: string;
  accepted: Record<string, string>;
  rejectedTokens: string[];
  missingTokens: string[];
}

function cssName(path: string): string {
  return `--${path.replaceAll('/', '-')}`;
}

function acceptValue(path: string, value: string): string | null {
  const raw = value.trim();
  if (raw === '' || raw.length > 200) return null;
  if (/[;{}<>\\]/.test(raw)) return null;
  if (/url\s*\(/i.test(raw) || /var\s*\(/i.test(raw) || /expression\s*\(/i.test(raw)) return null;
  if (path.startsWith('color/')) return safeColor(raw);
  if (path.startsWith('type/family/')) return safeFontStack(raw);
  if (path.startsWith('motion/duration/')) return /^\d{1,4}ms$/.test(raw) ? raw : null;
  if (path.startsWith('motion/easing/')) {
    return /^cubic-bezier\((?:\d*\.?\d+\s*,\s*){3}\d*\.?\d+\)$/.test(raw) ? raw : null;
  }
  if (path.startsWith('type/weight/')) return /^[1-9]00$/.test(raw) ? raw : null;
  if (path.startsWith('type/line-height/')) return /^\d(?:\.\d+)?$/.test(raw) ? raw : null;
  if (path.startsWith('type/letter-spacing/')) return /^-?\d(?:\.\d+)?em$/.test(raw) ? raw : null;
  if (
    path.startsWith('space/')
    || path.startsWith('radius/')
    || path.startsWith('type/size/')
    || path.startsWith('layout/')
    || path.startsWith('depth/')
  ) {
    return /^-?\d{1,4}(?:\.\d+)?px$/.test(raw) ? raw : null;
  }
  return null;
}

/** Prüft ein Overlay gegen die 114 Namen und die Wertregeln. */
export function bindDnaOverlay(overlay: Record<string, string> | undefined): DnaCssBinding {
  const accepted: Record<string, string> = {};
  const rejectedTokens: string[] = [];
  for (const path of Object.keys(overlay ?? {}).sort()) {
    const value = overlay?.[path] ?? '';
    if (!SEMANTIC_TOKEN_NAME_SET.has(path)) {
      rejectedTokens.push(path);
      continue;
    }
    const safe = acceptValue(path, value);
    if (safe === null) {
      rejectedTokens.push(path);
      continue;
    }
    accepted[path] = safe;
  }

  const missingTokens = REQUIRED_BINDINGS.filter((path) => accepted[path] === undefined);
  return {
    layerCss: layerCss(accepted),
    presentationCss: presentationCss(accepted),
    accepted,
    rejectedTokens,
    missingTokens: [...missingTokens],
  };
}

function layerCss(accepted: Record<string, string>): string {
  const declarations = Object.keys(accepted)
    .sort()
    .map((path) => `${cssName(path)}:${accepted[path]};`);
  const surface = accepted['color/surface/default'];
  const foreground = accepted['color/text/primary'];
  const accent = accepted['color/accent/primary'];
  const display = accepted['type/family/display'];
  const body = accepted['type/family/body'];
  const radius = accepted['radius/md'];
  if (surface) declarations.push(`--surface:${surface};`);
  if (foreground) declarations.push(`--foreground:${foreground};`);
  if (accent) declarations.push(`--accent:${accent};`);
  if (display) declarations.push(`--font-display:${display};`);
  if (body) declarations.push(`--font-body:${body};`);
  if (radius) declarations.push(`--radius:${safeRadius(Number.parseFloat(radius))}px;`);
  if (declarations.length === 0) return '';

  const rules = [`:root{${declarations.join('')}}`];
  if (foreground) rules.push(`a{color:var(--color-text-primary);}`);
  const focus = accepted['color/border/focus'];
  if (focus) {
    rules.push(
      'a:focus-visible,button:focus-visible,input:focus-visible,summary:focus-visible{outline:3px solid var(--color-border-focus);outline-offset:2px;}',
    );
  }
  const inverse = accepted['color/text/inverse'];
  if (foreground && inverse) {
    rules.push('button{background:var(--color-text-primary);color:var(--color-text-inverse);}');
  }
  return rules.join('');
}

function presentationCss(accepted: Record<string, string>): string {
  if (!accepted['color/text/primary'] || !accepted['color/text/inverse']) return '';
  return '[id*="--hero--"]>a,[id*="--cta--"]>a{background:var(--color-text-primary);color:var(--color-text-inverse);}';
}

export function renderDnaOverlayCss(record: SiteDnaRecord | undefined): string {
  const version = activeDnaVersion(record);
  if (!version) return '';
  return bindDnaOverlay(version.overlay).layerCss;
}

export function renderDnaPresentationCss(record: SiteDnaRecord | undefined): string {
  const version = activeDnaVersion(record);
  if (!version) return '';
  return bindDnaOverlay(version.overlay).presentationCss;
}
