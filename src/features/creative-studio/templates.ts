/**
 * Branchen-Startsets. Nur Metadaten und Token-Pfade — keine Hex-Werte,
 * keine erfundenen Kunden, keine Kennzahlen.
 */
import type { BrandColorToken, BrandFontToken } from './brandKit';
import { formatById, type SocialFormatId } from './formats';
import { newId, type DesignLayer, type SocialDesignDocument } from './model';

export type TemplateVertical = 'craft' | 'legal' | 'saas';

export interface SocialTemplate {
  id: string;
  label: string;
  vertical: TemplateVertical;
  /** Tonalität aus der Design-DNA, kein fertiger Kunden-Text. */
  tone: string;
  formatId: SocialFormatId;
}

export const SOCIAL_TEMPLATES: readonly SocialTemplate[] = [
  {
    id: 'handwerk-ankuendigung',
    label: 'Handwerk · Ankündigung',
    vertical: 'craft',
    tone: 'klar, konkret, Sie-Form',
    formatId: 'instagram-feed-1080',
  },
  {
    id: 'kanzlei-hinweis',
    label: 'Praxis / Kanzlei · Hinweis',
    vertical: 'legal',
    tone: 'formal, präzise, ohne Werbeversprechen',
    formatId: 'instagram-portrait-1080x1350',
  },
  {
    id: 'saas-update',
    label: 'B2B-SaaS · Update',
    vertical: 'saas',
    tone: 'direkt, produktbezogen',
    formatId: 'linkedin-landscape-1200x627',
  },
] as const;

const COPY: Record<TemplateVertical, { title: string; heading: string; body: string }> = {
  craft: {
    title: 'Handwerk · Ankündigung',
    heading: 'Wir sind vor Ort',
    body: 'Schreiben Sie uns, worum es geht. Wir melden uns mit einem konkreten nächsten Schritt.',
  },
  legal: {
    title: 'Hinweis',
    heading: 'Unterlagen vollständig?',
    body: 'Wir melden uns, sobald alles vorliegt. Dies ist eine Vorlage, keine Rechtsberatung.',
  },
  saas: {
    title: 'Produkt-Update',
    heading: 'Was sich ändert',
    body: 'Die Änderung steht in der Übersicht. Keine Kennzahlen, kein Kundenname.',
  },
};

function textLayer(
  name: string,
  text: string,
  box: { x: number; y: number; width: number; height: number },
  fontToken: BrandFontToken,
  fillToken: BrandColorToken,
  fontSize: number,
  fontStyle: 'normal' | 'bold',
): DesignLayer {
  return {
    id: newId(),
    name,
    kind: 'text',
    text,
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    rotation: 0,
    visible: true,
    locked: false,
    fontToken,
    fillToken,
    fontSize,
    align: 'left',
    fontStyle,
  };
}

export function templateById(id: string): SocialTemplate | undefined {
  return SOCIAL_TEMPLATES.find((template) => template.id === id);
}

/** Vorlage als Dokument. Farben bleiben Token-Pfade des aktiven Brand-Kits. */
export function documentFromTemplate(templateId: string, id = newId()): SocialDesignDocument {
  const template = templateById(templateId);
  if (!template) throw new Error('Vorlage ist unbekannt');
  const format = formatById(template.formatId);
  const copy = COPY[template.vertical];
  const margin = Math.round(format.width * 0.08);
  const contentWidth = format.width - margin * 2;
  return {
    version: 1,
    id,
    title: copy.title,
    formatId: template.formatId,
    backgroundToken: 'color.paper',
    layers: [
      {
        id: newId(),
        name: 'Fläche',
        kind: 'shape',
        shape: 'rect',
        x: 0,
        y: 0,
        width: format.width,
        height: Math.round(format.height * 0.34),
        rotation: 0,
        visible: true,
        locked: false,
        fillToken: 'color.accent',
      },
      textLayer(
        'Überschrift',
        copy.heading,
        { x: margin, y: Math.round(format.height * 0.08), width: contentWidth, height: Math.round(format.height * 0.16) },
        'type.heading',
        'color.paper',
        Math.max(32, Math.round(format.width * 0.055)),
        'bold',
      ),
      textLayer(
        'Text',
        copy.body,
        { x: margin, y: Math.round(format.height * 0.42), width: contentWidth, height: Math.round(format.height * 0.28) },
        'type.body',
        'color.ink',
        Math.max(22, Math.round(format.width * 0.028)),
        'normal',
      ),
      {
        id: newId(),
        name: 'Logo',
        kind: 'logo',
        x: margin,
        y: format.height - margin - Math.round(format.height * 0.08),
        width: Math.round(format.width * 0.2),
        height: Math.round(format.height * 0.07),
        rotation: 0,
        visible: true,
        locked: false,
      },
    ],
  };
}
