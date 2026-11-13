import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { inferBrand } from '../../src/core/realsync-os/design/designState';
import { brandKitFromTenant, demoBrandKit } from '../../src/features/creative-studio/brandKit';
import { fitStage, pngExportSize, SOCIAL_FORMATS } from '../../src/features/creative-studio/formats';
import {
  applyTransformedBox,
  commitDocument,
  createBlankDesign,
  createTextLayer,
  parseSocialDesign,
  redoDocument,
  replaceDocument,
  scaleDocumentToFormat,
  undoDocument,
  type TextLayer,
} from '../../src/features/creative-studio/model';
import { documentFromTemplate, SOCIAL_TEMPLATES } from '../../src/features/creative-studio/templates';

describe('Social-Formate', () => {
  it('hält die vereinbarten Pixelmaße', () => {
    const size = Object.fromEntries(SOCIAL_FORMATS.map((format) => [format.id, `${format.width}x${format.height}`]));
    expect(size).toEqual({
      'instagram-feed-1080': '1080x1080',
      'instagram-portrait-1080x1350': '1080x1350',
      'story-1080x1920': '1080x1920',
      'linkedin-landscape-1200x627': '1200x627',
      'landscape-1600x900': '1600x900',
    });
  });

  it('exportiert die Zielpixel und skaliert die Bühne proportional', () => {
    const format = SOCIAL_FORMATS[0];
    expect(pngExportSize(format)).toEqual({ width: 1080, height: 1080 });
    const fitted = fitStage({ width: 400, height: 800 }, format, 0);
    expect(fitted.scale).toBeCloseTo(400 / 1080);
    expect(fitted.displayWidth / fitted.displayHeight).toBeCloseTo(1);
  });
});

describe('Brand-Kit', () => {
  it('nutzt ohne Mandanten die DesignOS-Tokens und kennzeichnet das Demo-Kit', () => {
    const kit = demoBrandKit();
    const dna = inferBrand({ text: 'Social-Motiv', mode: 'prompt', locale: 'de', wantsPublish: false });
    expect(kit.source).toBe('demo');
    expect(kit.label).toBe('Demo-Brand-Kit');
    expect(kit.logoIsDemo).toBe(true);
    expect(kit.tokens['color.ink']).toBe(dna.colors.ink);
    expect(kit.tokens['color.paper']).toBe(dna.colors.paper);
    expect(kit.tokens['color.accent']).toBe(dna.colors.accent);
    expect(kit.tokens['color.muted']).toBe(dna.colors.muted);
    expect(kit.logoUrl).toContain('DEMO');
  });

  it('übernimmt gültige Mandantenfarben und verwirft unsichere Logos', () => {
    const kit = brandKitFromTenant({
      company_name: 'Werkstatt Adler',
      brand_colors: { primary: '#0052FF', text: 'rot', background: '#F8FAFC' },
      custom_logo_url: 'javascript:alert(1)',
      custom_css: { fontHeading: 'Space Grotesk', fontBody: 'Inter</style>' },
    });
    expect(kit.source).toBe('tenant');
    expect(kit.label).toBe('Brand-Kit · Werkstatt Adler');
    expect(kit.tokens['color.accent']).toBe('#0052FF');
    expect(kit.tokens['color.paper']).toBe('#F8FAFC');
    expect(kit.tokens['color.ink']).toBe(demoBrandKit().tokens['color.ink']);
    expect(kit.logoIsDemo).toBe(true);
    expect(kit.tokens['type.heading']).toBe('Space Grotesk');
    expect(kit.tokens['type.body']).toBe(demoBrandKit().tokens['type.body']);
  });

  it('nimmt ein https-Logo des Mandanten', () => {
    const kit = brandKitFromTenant({
      brand_colors: { primary: '#0F766E' },
      custom_logo_url: 'https://cdn.example.test/logo.png',
    });
    expect(kit.logoUrl).toBe('https://cdn.example.test/logo.png');
    expect(kit.logoIsDemo).toBe(false);
  });
});

describe('Dokument und Verlauf', () => {
  it('macht Undo und Redo rückgängig', () => {
    const start = replaceDocument(createBlankDesign('instagram-feed-1080', 'doc-1'));
    const next = commitDocument(start, { ...start.present, title: 'Zweite Fassung' });
    expect(undoDocument(next).present.title).toBe('Neues Motiv');
    expect(redoDocument(undoDocument(next)).present.title).toBe('Zweite Fassung');
  });

  it('skaliert Ebenen beim Formatwechsel', () => {
    const doc = createBlankDesign('instagram-feed-1080', 'doc-2');
    const layer = doc.layers[0];
    const scaled = scaleDocumentToFormat(doc, 'landscape-1600x900');
    expect(scaled.formatId).toBe('landscape-1600x900');
    expect(scaled.layers[0].width).toBe(Math.max(8, Math.round(layer.width * (1600 / 1080))));
    expect(scaled.layers[0].height).toBe(Math.max(8, Math.round(layer.height * (900 / 1080))));
  });

  it('übernimmt die Transformer-Skalierung in die Schriftgröße', () => {
    const text = createTextLayer(createBlankDesign()) as TextLayer;
    const next = applyTransformedBox(text, {
      x: 10,
      y: 20,
      rotation: 15,
      scaleX: 2,
      scaleY: 1.5,
      width: text.width,
      height: text.height,
    });
    expect(next.kind).toBe('text');
    if (next.kind !== 'text') return;
    expect(next.fontSize).toBe(Math.max(8, Math.round(text.fontSize * 1.5)));
    expect(next.width).toBe(Math.max(8, text.width * 2));
    expect(next.rotation).toBe(15);
  });

  it('lehnt fremde Bildquellen ab', () => {
    const doc = createBlankDesign();
    expect(() => parseSocialDesign({
      ...doc,
      layers: [{ id: 'x', name: 'Bild', kind: 'image', src: 'javascript:alert(1)', x: 0, y: 0, width: 10, height: 10 }],
    })).toThrow(/zulässige Quelle/);
  });
});

describe('Vorlagen', () => {
  it('binden Farben an Token-Pfade', () => {
    for (const template of SOCIAL_TEMPLATES) {
      const doc = documentFromTemplate(template.id, 'tpl');
      const raw = JSON.stringify(doc.layers);
      expect(raw).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      expect(doc.formatId).toBe(template.formatId);
      expect(doc.layers.some((layer) => layer.kind === 'logo')).toBe(true);
      expect(doc.backgroundToken).toBe('color.paper');
    }
  });
});

describe('Migration social_designs', () => {
  const sql = readFileSync('supabase/migrations/20261113120000_social_designs.sql', 'utf8');

  it('isoliert Zeilen über die Mitgliedschaft und sperrt viewer beim Schreiben', () => {
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('public.has_tenant_membership(tenant_id)');
    expect(sql).toContain("membership.role IN ('owner', 'admin', 'member')");
    expect(sql).toContain('created_by = auth.uid()');
    expect(sql).toContain('REVOKE ALL ON TABLE public.social_designs FROM PUBLIC, anon');
    expect(sql).not.toMatch(/service_role_key|eyJ/);
  });
});
