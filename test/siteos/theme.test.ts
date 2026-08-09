import { describe, it, expect } from 'vitest';
import {
  analyzeBlueprint,
  computeScores,
  contrastRatio,
  meetsWcagAA,
  parseBrief,
  relativeLuminance,
  renderPage,
  renderThemeCss,
  safeColor,
  safeFontStack,
  safeRadius,
  sanitizeTheme,
  synthesizeBlueprint,
  THEME_FALLBACK,
} from '../../packages/siteos-core/src/index';

describe('safeColor', () => {
  it('akzeptiert die gängigen Hex-Schreibweisen', () => {
    expect(safeColor('#fff')).toBe('#fff');
    expect(safeColor('#0052FF')).toBe('#0052FF');
    expect(safeColor('#0052FF80')).toBe('#0052FF80');
  });

  it('akzeptiert funktionale und benannte Farben', () => {
    expect(safeColor('rgb(0, 82, 255)')).toBe('rgb(0, 82, 255)');
    expect(safeColor('hsl(220 100% 50%)')).toBe('hsl(220 100% 50%)');
    expect(safeColor('rebeccapurple')).toBe('rebeccapurple');
  });

  it('verwirft den Ausbruch aus der Deklaration', () => {
    // Der Kern der Sache: ohne diese Prüfung schriebe ein solcher Wert die
    // ganze Seite um. CSS lässt sich nicht escapen — nur verwerfen.
    expect(safeColor('red; } body { display: none } .x {')).toBeNull();
    expect(safeColor('red}')).toBeNull();
    expect(safeColor('red;')).toBeNull();
  });

  it('verwirft url(), var() und calc()', () => {
    expect(safeColor('url(https://evil.example/x.png)')).toBeNull();
    expect(safeColor('var(--x)')).toBeNull();
    expect(safeColor('calc(1px)')).toBeNull();
  });

  it('verwirft Leeres und Unsinn', () => {
    expect(safeColor('')).toBeNull();
    expect(safeColor(null)).toBeNull();
    expect(safeColor('#12345')).toBeNull();
  });
});

describe('safeFontStack', () => {
  it('akzeptiert einen üblichen Stack', () => {
    expect(safeFontStack('Inter, system-ui, sans-serif')).toBe('Inter, system-ui, sans-serif');
    expect(safeFontStack('"Space Grotesk", sans-serif')).toBe('"Space Grotesk", sans-serif');
  });

  it('verwirft Ausbrüche und unbalancierte Anführungszeichen', () => {
    expect(safeFontStack('Inter; } body { display:none')).toBeNull();
    expect(safeFontStack('"Unfertig, sans-serif')).toBeNull();
    expect(safeFontStack('a'.repeat(201))).toBeNull();
  });
});

describe('safeRadius', () => {
  it('rundet, begrenzt und fängt Unsinn ab', () => {
    expect(safeRadius(12)).toBe(12);
    expect(safeRadius(12.6)).toBe(13);
    expect(safeRadius(9999)).toBe(64);
    expect(safeRadius(-5)).toBe(0);
    expect(safeRadius('keine Zahl')).toBe(0);
    expect(safeRadius(NaN)).toBe(0);
  });
});

describe('sanitizeTheme', () => {
  it('ersetzt jeden unsicheren Wert durch den Default', () => {
    const result = sanitizeTheme({
      mode: 'dark',
      accent: 'red; } * { display:none }',
      surface: '#000',
      foreground: 'url(x)',
      fontDisplay: 'a; }',
      fontBody: 'Inter, sans-serif',
      radiusPx: -3,
    });

    expect(result.accent).toBe(THEME_FALLBACK.accent);
    expect(result.surface).toBe('#000');
    expect(result.foreground).toBe(THEME_FALLBACK.foreground);
    expect(result.fontDisplay).toBe(THEME_FALLBACK.fontDisplay);
    expect(result.fontBody).toBe('Inter, sans-serif');
    expect(result.radiusPx).toBe(0);
  });

  it('verträgt ein fehlendes Theme', () => {
    expect(sanitizeTheme(undefined)).toEqual(THEME_FALLBACK);
  });
});

describe('renderThemeCss', () => {
  it('ist deterministisch', () => {
    const theme = { accent: '#0052FF' };
    expect(renderThemeCss(theme)).toBe(renderThemeCss(theme));
  });

  it('lässt keinen unsicheren Wert ins Stylesheet', () => {
    const css = renderThemeCss({ accent: 'red; } body { display: none } .x {' });
    expect(css).not.toContain('display: none');
    expect(css).toContain(`--accent:${THEME_FALLBACK.accent}`);
  });

  it('kann den style-Block nicht verlassen', () => {
    const css = renderThemeCss({ fontBody: '</style><script>alert(1)</script>' });
    expect(css).not.toContain('</style>');
    expect(css).not.toContain('<script>');
  });

  it('macht den Fokus sichtbar und setzt ihn nie auf none', () => {
    const css = renderThemeCss(undefined);
    expect(css).toContain(':focus-visible');
    expect(css).not.toMatch(/outline\s*:\s*none/);
  });

  it('respektiert prefers-reduced-motion', () => {
    expect(renderThemeCss(undefined)).toContain('prefers-reduced-motion');
  });

  it('hält die Sprungmarke fokussierbar statt sie auszublenden', () => {
    const css = renderThemeCss(undefined);
    expect(css).toContain('.skip-link:focus');
    expect(css).not.toContain('.skip-link{display:none');
  });
});

describe('Kontrast (WCAG 2.2 — 1.4.3)', () => {
  it('liefert die bekannten Eckwerte', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });

  it('ist symmetrisch', () => {
    expect(contrastRatio('#0052FF', '#ffffff')).toBeCloseTo(contrastRatio('#ffffff', '#0052FF')!, 10);
  });

  it('versteht die Kurzform', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 5);
  });

  it('meldet nicht bestimmbare Farben als null statt zu raten', () => {
    expect(relativeLuminance('rebeccapurple')).toBeNull();
    expect(contrastRatio('rgb(0,0,0)', '#fff')).toBeNull();
  });

  it('wertet Unbestimmbares als nicht bestanden', () => {
    // Im Zweifel wird hingeschaut, nicht durchgewunken.
    expect(meetsWcagAA('rgb(0,0,0)', '#ffffff')).toBe(false);
  });

  it('unterscheidet Fließtext und großen Text', () => {
    // #808080 auf Weiß ≈ 3.95:1 — reicht für großen Text (3:1), aber
    // nicht für Fließtext (4.5:1).
    const fg = '#808080';
    const bg = '#ffffff';
    const ratio = contrastRatio(fg, bg)!;
    expect(ratio).toBeGreaterThan(3);
    expect(ratio).toBeLessThan(4.5);
    expect(meetsWcagAA(fg, bg, false)).toBe(false);
    expect(meetsWcagAA(fg, bg, true)).toBe(true);
  });

  it('trifft den Grenzwert für Fließtext genau', () => {
    // #767676 auf Weiß ist der bekannte Grenzfall: 4.54:1 — knapp über
    // 4.5 und damit AA-konform. Der Test hält die Rechnung an einem
    // extern nachprüfbaren Wert fest.
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
    expect(meetsWcagAA('#767676', '#ffffff')).toBe(true);
  });

  it('bestätigt das Default-Theme als AA-konform — beide Farbpaare', () => {
    // Die Plattform-Defaults müssen die eigene Prüfung bestehen, sonst
    // liefert der Builder von Haus aus unlesbare Seiten. Der Akzent war
    // hier zuerst durchgefallen (Marken-Blau #0052FF auf Obsidian = 3.44:1);
    // dieser Test hält die Korrektur fest.
    expect(meetsWcagAA(THEME_FALLBACK.foreground, THEME_FALLBACK.surface)).toBe(true);
    expect(meetsWcagAA(THEME_FALLBACK.accent, THEME_FALLBACK.surface)).toBe(true);
  });

  it('hält fest, warum das Marken-Blau nicht der Default sein kann', () => {
    // Dokumentiert den Messwert, damit die Entscheidung nachvollziehbar
    // bleibt und nicht versehentlich zurückgedreht wird.
    expect(contrastRatio('#0052FF', '#0A0A0B')!).toBeLessThan(4.5);
  });
});

describe('Renderer bindet das Theme ein', () => {
  it('liefert das Stylesheet inline im head aus', () => {
    const bp = synthesizeBlueprint(parseBrief('Zahnarzt in Hamburg'), { model: 'm' });
    const html = renderPage(bp, bp.pages[0]);
    expect(html).toContain('<style>');
    expect(html).toContain('--accent:');
  });

  it('trägt ein manipuliertes Theme nicht ins Dokument', () => {
    const bp = synthesizeBlueprint(parseBrief('Zahnarzt in Hamburg'), { model: 'm' });
    bp.theme.accent = '#fff; } body { background: url(https://evil.example/x) } .y {';

    const html = renderPage(bp, bp.pages[0]);
    expect(html).not.toContain('evil.example');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Kontrast als Befund (Entscheidung 2026-08-01: eigener Befund-Code)
// ─────────────────────────────────────────────────────────────────────

describe('accessibility.insufficient-contrast', () => {
  function bpWithTheme(theme: Partial<{ foreground: string; surface: string; accent: string }>) {
    const bp = synthesizeBlueprint(parseBrief('Zahnarzt in Hamburg'), { model: 'm' });
    Object.assign(bp.theme, theme);
    return bp;
  }

  it('meldet nichts beim Default-Theme', () => {
    const codes = analyzeBlueprint(bpWithTheme({})).map((f) => f.code);
    expect(codes).not.toContain('accessibility.insufficient-contrast');
  });

  it('meldet zu schwachen Fließtext-Kontrast', () => {
    const finding = analyzeBlueprint(bpWithTheme({ foreground: '#999999', surface: '#ffffff' }))
      .find((f) => f.code === 'accessibility.insufficient-contrast');

    expect(finding?.severity).toBe('high');
    expect(finding?.reference).toContain('1.4.3');
    expect(finding?.locator).toBe('theme.foreground/surface');
  });

  it('prüft auch die Akzentfarbe für Links', () => {
    const findings = analyzeBlueprint(bpWithTheme({
      foreground: '#000000', surface: '#ffffff', accent: '#dddddd',
    })).filter((f) => f.code === 'accessibility.insufficient-contrast');

    expect(findings.map((f) => f.locator)).toEqual(['theme.accent/surface']);
  });

  it('meldet nicht bestimmbare Farben NICHT als Befund', () => {
    // Der Unterschied zu meetsWcagAA(): dort gilt null als nicht bestanden
    // (richtig für ein Gate). Im Analysator wäre das eine Falschmeldung im
    // Kundenbericht — benannte Farben sind nicht berechenbar, nicht schlecht.
    const codes = analyzeBlueprint(bpWithTheme({ foreground: 'rebeccapurple', surface: 'white' }))
      .map((f) => f.code);
    expect(codes).not.toContain('accessibility.insufficient-contrast');
  });

  it('senkt den Accessibility-Score messbar', () => {
    const good = computeScores(analyzeBlueprint(bpWithTheme({})));
    const bad = computeScores(analyzeBlueprint(bpWithTheme({ foreground: '#999999', surface: '#ffffff' })));
    expect(bad.dimensions.accessibility).toBeLessThan(good.dimensions.accessibility);
  });
});
