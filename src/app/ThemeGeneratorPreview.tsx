/**
 * Vorschau des Theme-Generators. Fixture-Katalog, keine Datenbank.
 * noindex. Kennzeichnung: UI-Konzept · Beispieldaten.
 */
import { useMemo, useState, type CSSProperties } from 'react';
import { semanticOverrideStyle } from './theme/overrides';
import { fixtureThemeCatalog } from './theme/generator/catalog';
import {
  generateTheme,
  INDUSTRIES,
  isHexColor,
  remixTheme,
  TONE_PRESETS,
  type GeneratorResult,
  type IndustryId,
  type TonePreset,
} from './theme/generator/generate';
import './shell.css';
import './theme/tokens.shell.css';

const MOTION_VARS = ['--motion-duration-fast', '--motion-duration-base', '--motion-duration-slow'] as const;

/** Motion-Dauern bleiben außerhalb des Inline-Styles, sonst schlägt er die Reduce-Media-Query. */
export function previewStyle(overlay: GeneratorResult['overlay']): { style: CSSProperties; motionCss: string } {
  const full = semanticOverrideStyle(overlay) as Record<string, string>;
  const style = Object.fromEntries(Object.entries(full).filter(([key]) => !MOTION_VARS.includes(key as typeof MOTION_VARS[number])));
  const duration = (name: typeof MOTION_VARS[number]) => (/^\d+ms$/.test(full[name] ?? '') ? full[name] : '0ms');
  const motionCss = `@media (prefers-reduced-motion: no-preference) {
  .app-shell[data-theme="generated"] {
    --motion-duration-fast: ${duration('--motion-duration-fast')};
    --motion-duration-base: ${duration('--motion-duration-base')};
    --motion-duration-slow: ${duration('--motion-duration-slow')};
  }
}`;
  return { style: style as CSSProperties, motionCss };
}

export function ThemeGeneratorPreview() {
  const catalog = useMemo(() => fixtureThemeCatalog(), []);
  const [industry, setIndustry] = useState<IndustryId>('handwerk-regional');
  const [tone, setTone] = useState<TonePreset>('warm-nahbar');
  const [color, setColor] = useState('#C45C26');
  const [displayFont, setDisplayFont] = useState('');
  const [remixed, setRemixed] = useState<GeneratorResult | null>(null);
  const colorOk = isHexColor(color);
  const generated = useMemo(
    () => (colorOk ? generateTheme({
      industry,
      tone,
      primaryColor: color,
      brandFonts: displayFont ? { display: displayFont } : null,
    }, catalog) : null),
    [industry, tone, color, displayFont, catalog, colorOk],
  );
  const result = remixed ?? generated;
  const painted = result ? previewStyle(result.overlay) : null;

  return (
    <div className="app-shell" data-theme="generated" style={painted?.style} data-testid="theme-generator">
      {painted ? <style>{painted.motionCss}</style> : null}
      <aside className="app-shell__sidebar">
        <p className="app-shell__brand">RSD &amp; AI</p>
        <p className="app-shell__concept">UI-Konzept · Beispieldaten</p>
      </aside>
      <div className="app-shell__main">
        <header className="app-shell__topbar">
          <h1>Theme-Generator</h1>
        </header>
        <div className="app-shell__content">
          <form className="app-shell__panel" onSubmit={(event) => event.preventDefault()}>
            <label>
              Branche
              <select aria-label="Branche" value={industry} onChange={(event) => { setRemixed(null); setIndustry(event.target.value as IndustryId); }}>
                {INDUSTRIES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>
              Tonalität
              <select aria-label="Tonalität" value={tone} onChange={(event) => { setRemixed(null); setTone(event.target.value as TonePreset); }}>
                {TONE_PRESETS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>
              Hauptfarbe
              <input aria-label="Hauptfarbe" value={color} onChange={(event) => { setRemixed(null); setColor(event.target.value); }} />
            </label>
            <label>
              Display-Schrift (optional, sperrt Typo)
              <input aria-label="Display-Schrift" value={displayFont} onChange={(event) => { setRemixed(null); setDisplayFont(event.target.value); }} />
            </label>
          </form>
          <article className="app-shell__card">
            <h2>Ergebnis</h2>
            {result ? (
              <>
                <p>Status {result.status} · Iterationen {result.iterations} · Hash {result.hash.slice(0, 12)}</p>
                <p>{result.remixOffer ? 'Remix angeboten, Abstand unter 0,42.' : 'Kein Remix-Angebot.'}</p>
                <p>{result.reasons.join(' · ') || 'Publish-Regeln erfüllt.'}</p>
                <p>Module: {result.modules.join(', ')}</p>
                <p>Achsen: {result.axes['header-type']} / {result.axes['card-style']} / {result.axes['sidebar-form']}</p>
                <button type="button" disabled={!result.remixOffer} onClick={() => setRemixed(remixTheme(result, catalog))}>Remix</button>
              </>
            ) : <p>Hauptfarbe muss ein Hex-Wert #RGB oder #RRGGBB sein.</p>}
            <button type="button" className="app-shell__button-primary">Primär</button>
          </article>
        </div>
      </div>
    </div>
  );
}
