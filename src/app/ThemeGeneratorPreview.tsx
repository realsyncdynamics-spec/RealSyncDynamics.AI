/**
 * Vorschau des Theme-Generators. Fixture-Katalog, keine Datenbank.
 * noindex. Kennzeichnung: UI-Konzept · Beispieldaten.
 */
import { useMemo, useState } from 'react';
import { semanticOverrideStyle } from './theme/overrides';
import { generateTheme, INDUSTRIES, TONE_PRESETS, type IndustryId, type TonePreset } from './theme/generator/generate';
import { fixtureThemeCatalog } from './theme/generator/catalog';
import './shell.css';
import './theme/tokens.shell.css';

export function ThemeGeneratorPreview() {
  const catalog = useMemo(() => fixtureThemeCatalog(), []);
  const [industry, setIndustry] = useState<IndustryId>('handwerk-regional');
  const [tone, setTone] = useState<TonePreset>('warm-nahbar');
  const [color, setColor] = useState('#C45C26');
  const [displayFont, setDisplayFont] = useState('');
  const result = useMemo(
    () => generateTheme({
      industry,
      tone,
      primaryColor: color,
      brandFonts: displayFont ? { display: displayFont } : null,
    }, catalog),
    [industry, tone, color, displayFont, catalog],
  );
  const style = semanticOverrideStyle(result.overlay);

  return (
    <div className="app-shell" data-theme="generated" style={style} data-testid="theme-generator">
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
              <select aria-label="Branche" value={industry} onChange={(event) => setIndustry(event.target.value as IndustryId)}>
                {INDUSTRIES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>
              Tonalität
              <select aria-label="Tonalität" value={tone} onChange={(event) => setTone(event.target.value as TonePreset)}>
                {TONE_PRESETS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>
              Hauptfarbe
              <input aria-label="Hauptfarbe" value={color} onChange={(event) => setColor(event.target.value)} />
            </label>
            <label>
              Display-Schrift (optional, sperrt Typo)
              <input aria-label="Display-Schrift" value={displayFont} onChange={(event) => setDisplayFont(event.target.value)} />
            </label>
          </form>
          <article className="app-shell__card">
            <h2>Ergebnis</h2>
            <p>Status {result.status} · Iterationen {result.iterations} · Hash {result.hash.slice(0, 12)}</p>
            <p>{result.remixOffer ? 'Remix angeboten, Abstand unter 0,42.' : 'Kein Remix-Angebot.'}</p>
            <p>{result.reasons.join(' · ') || 'Publish-Regeln erfüllt.'}</p>
            <p>Module: {result.modules.join(', ')}</p>
            <p>Achsen: {result.axes['header-type']} / {result.axes['card-style']} / {result.axes['sidebar-form']}</p>
            <button type="button" className="app-shell__button-primary">Primär</button>
          </article>
        </div>
      </div>
    </div>
  );
}
