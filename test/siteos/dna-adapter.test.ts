import { describe, expect, it } from 'vitest';
import {
  activateDnaVersion,
  analyzeBlueprint,
  appendDnaVersion,
  bindDnaOverlay,
  canonicalHash,
  canonicalize,
  parseBrief,
  renderDnaOverlayCss,
  renderDnaPresentationCss,
  renderPage,
  renderPresentationCss,
  renderThemeCss,
  synthesizeBlueprint,
  THEME_FALLBACK,
  type SiteBlueprint,
  type SiteDnaVersion,
} from '../../packages/siteos-core/src/index';

const FIXED = '2026-11-13T12:00:00.000Z';

function blueprint(): SiteBlueprint {
  return synthesizeBlueprint(parseBrief('Zahnarzt in Hamburg'), { model: 'm', createdAt: FIXED });
}

function version(hash: string, status: SiteDnaVersion['status'], overlay: Record<string, string>): SiteDnaVersion {
  return {
    schemaVersion: 1,
    hash,
    status,
    overlay,
    axes: { 'header-type': 'solid', 'card-style': 'raised', 'sidebar-form': 'rail' },
    industry: 'zahnarzt',
    generatorIndustry: 'gesundheit',
    createdAt: FIXED,
    missingTokens: [],
    rejectedTokens: [],
    generatorInput: {
      tone: 'ruhig-vertrauensvoll',
      primaryColor: '#0F766E',
      brandFonts: null,
    },
  };
}

const SAFE_OVERLAY: Record<string, string> = {
  'color/surface/default': '#F4F9F9',
  'color/surface/inverse': '#0E2A2F',
  'color/text/primary': '#0E2A2F',
  'color/text/inverse': '#F7F8FA',
  'color/accent/primary': '#0F766E',
  'color/border/focus': '#7F8186',
  'type/family/display': 'Georgia, serif',
  'type/family/body': 'Arial, sans-serif',
  'radius/md': '10px',
};

describe('DNA-Adapter lässt bestehende Sites unverändert', () => {
  it('rendert ohne DNA byte-gleich zum Theme-CSS', () => {
    const bp = blueprint();
    expect(bp.dna).toBeUndefined();
    const html = renderPage(bp, bp.pages[0]);
    expect(html).toContain(`<style>${renderThemeCss(bp.theme)}</style>`);
    const showcase = renderPage(bp, bp.pages[0], { presentation: 'showcase' });
    expect(showcase).toContain(`<style>${renderThemeCss(bp.theme)}</style>`);
    expect(showcase).toContain(`<style>${renderPresentationCss(bp.theme)}</style>`);
  });

  it('lässt dna: undefined aus dem kanonischen Hash', async () => {
    const bp = blueprint();
    expect(canonicalize(bp)).not.toContain('"dna"');
    expect(canonicalize({ ...bp, dna: undefined })).toBe(canonicalize(bp));
    expect(await canonicalHash({ ...bp, dna: undefined })).toBe(await canonicalHash(bp));
  });

  it('behält den Plattform-Akzent, solange niemand DNA anhängt', () => {
    expect(blueprint().theme.accent).toBe(THEME_FALLBACK.accent);
  });
});

describe('DNA-Overlay auf der Ausgabeschicht', () => {
  it('verwirft unbekannte Namen und CSS-Ausbrüche', () => {
    const bound = bindDnaOverlay({
      ...SAFE_OVERLAY,
      'color/status/error': '#9B2C2C',
      'color/text/primary': 'red; } body { display:none } .x {',
    });
    expect(bound.rejectedTokens).toContain('color/status/error');
    expect(bound.layerCss).not.toContain('display:none');
    expect(bound.layerCss).not.toContain('color/status/error');
    expect(bound.missingTokens).toContain('color/text/primary');
  });

  it('setzt den Akzent nicht als Link- oder Button-Textfarbe', () => {
    const bound = bindDnaOverlay(SAFE_OVERLAY);
    expect(bound.rejectedTokens).toEqual([]);
    expect(bound.missingTokens).toEqual([]);
    expect(bound.layerCss).toContain('a{color:var(--color-text-primary);}');
    expect(bound.layerCss).not.toContain('a{color:var(--accent);}');
    expect(bound.layerCss).not.toContain('a{color:var(--color-accent-primary);}');
    expect(bound.layerCss).toContain('button{background:var(--color-text-primary);color:var(--color-text-inverse);}');
    expect(bound.layerCss).toContain('outline:3px solid var(--color-border-focus)');
    expect(bound.presentationCss).toContain('[id*="--hero--"]>a,[id*="--cta--"]>a{background:var(--color-text-primary);color:var(--color-text-inverse);}');
  });

  it('hängt die Schicht nur bei aktiver Fassung an und lässt die alte Linkregel davor stehen', () => {
    const bp = blueprint();
    const dna = appendDnaVersion(undefined, version('a'.repeat(64), 'ready', SAFE_OVERLAY));
    const html = renderPage({ ...bp, dna }, bp.pages[0], { presentation: 'showcase' });
    const legacyLink = html.indexOf('a{color:var(--accent);}');
    const dnaLink = html.indexOf('a{color:var(--color-text-primary);}');
    expect(legacyLink).toBeGreaterThan(-1);
    expect(dnaLink).toBeGreaterThan(legacyLink);
    expect(html.indexOf(renderDnaPresentationCss(dna))).toBeGreaterThan(html.indexOf(renderPresentationCss(bp.theme)));
    expect(renderDnaOverlayCss(undefined)).toBe('');
    expect(renderDnaOverlayCss({ schemaVersion: 1, activeHash: '', versions: dna.versions })).toBe('');
  });

  it('prüft bei aktiver DNA den Fließtext und nicht den Akzent als Linkfarbe', () => {
    const bp = blueprint();
    const weak = { ...SAFE_OVERLAY, 'color/text/primary': '#F4F9F9', 'color/surface/default': '#F4F9F9' };
    const dna = appendDnaVersion(undefined, version('b'.repeat(64), 'warn', weak));
    const codes = analyzeBlueprint({ ...bp, dna })
      .filter((finding) => finding.code === 'accessibility.insufficient-contrast')
      .map((finding) => finding.locator);
    expect(codes).toContain('dna.color/text/primary/surface');
    expect(codes).not.toContain('theme.accent/surface');
  });
});

describe('DNA-Verlauf im Blueprint-JSON', () => {
  it('hängt an, aktiviert ready und löscht die ältere Fassung nicht', () => {
    const first = version('c'.repeat(64), 'ready', SAFE_OVERLAY);
    const second = version('d'.repeat(64), 'warn', { ...SAFE_OVERLAY, 'radius/md': '12px' });
    const record = appendDnaVersion(appendDnaVersion(undefined, first), second);
    expect(record.versions.map((item) => item.hash)).toEqual([first.hash, second.hash]);
    expect(record.activeHash).toBe(second.hash);
    const restored = activateDnaVersion(record, first.hash);
    expect(restored.activeHash).toBe(first.hash);
    expect(restored.versions).toHaveLength(2);
  });

  it('speichert needs-editor, ohne sie zu aktivieren', () => {
    const record = appendDnaVersion(undefined, version('e'.repeat(64), 'needs-editor', SAFE_OVERLAY));
    expect(record.activeHash).toBe('');
    expect(record.versions).toHaveLength(1);
    expect(renderDnaOverlayCss(record)).toBe('');
  });

  it('ändert den Hash, sobald DNA im Blueprint steht', async () => {
    const bp = blueprint();
    const withDna = {
      ...bp,
      dna: appendDnaVersion(undefined, version('f'.repeat(64), 'ready', SAFE_OVERLAY)),
    };
    expect(await canonicalHash(withDna)).not.toBe(await canonicalHash(bp));
  });
});
