/**
 * Social-Format-Presets für den Konva-Editor.
 * Pixelmaße sind die üblichen Exportgrößen. Vor einem echten Publish
 * gegen die aktuelle Plattformdokumentation prüfen — hier kein hartes Recht.
 */

export const SOCIAL_FORMATS = [
  {
    id: 'instagram-feed-1080',
    label: 'Instagram Feed',
    ratio: '1:1',
    width: 1080,
    height: 1080,
  },
  {
    id: 'instagram-portrait-1080x1350',
    label: 'Instagram Portrait',
    ratio: '4:5',
    width: 1080,
    height: 1350,
  },
  {
    id: 'story-1080x1920',
    label: 'Story / Reel-Cover',
    ratio: '9:16',
    width: 1080,
    height: 1920,
  },
  {
    id: 'linkedin-landscape-1200x627',
    label: 'LinkedIn Landscape',
    ratio: '1.91:1',
    width: 1200,
    height: 627,
  },
  {
    id: 'landscape-1600x900',
    label: 'Landscape 16:9',
    ratio: '16:9',
    width: 1600,
    height: 900,
  },
] as const;

export type SocialFormatId = (typeof SOCIAL_FORMATS)[number]['id'];

export interface SocialFormat {
  id: SocialFormatId;
  label: string;
  ratio: string;
  width: number;
  height: number;
}

export function isSocialFormatId(value: string): value is SocialFormatId {
  return SOCIAL_FORMATS.some((format) => format.id === value);
}

export function formatById(id: SocialFormatId): SocialFormat {
  const format = SOCIAL_FORMATS.find((entry) => entry.id === id);
  if (!format) {
    throw new Error(`Unbekanntes Format: ${id}`);
  }
  return format;
}

/** Sichtbare Bühne: einheitlicher Maßstab, Seitenverhältnis bleibt erhalten. */
export function fitStage(
  viewport: { width: number; height: number },
  format: { width: number; height: number },
  padding = 32,
): { scale: number; displayWidth: number; displayHeight: number } {
  const availW = Math.max(1, viewport.width - padding);
  const availH = Math.max(1, viewport.height - padding);
  const scale = Math.min(availW / format.width, availH / format.height);
  return {
    scale,
    displayWidth: format.width * scale,
    displayHeight: format.height * scale,
  };
}

/** PNG-Export soll exakt die Zielpixel des Formats treffen. */
export function pngExportSize(format: { width: number; height: number }): { width: number; height: number } {
  return { width: format.width, height: format.height };
}
