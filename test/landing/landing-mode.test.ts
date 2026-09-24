/**
 * Die Startseite laesst sich zwischen drei Farben umschalten.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  LANDING_MODES,
  LANDING_MODE_LABEL,
  MODE_ACCENT,
  modeAccent,
  modeVeil,
} from '../../src/components/landing/landing-mode';

const root = resolve(__dirname, '../..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const landing = read('src/pages/MainLanding.tsx');
const header = read('src/components/landing/PublicDarkHeader.tsx');
const hero = read('src/components/landing/EuropeNetworkHero.tsx');
const heroTitanium = read('src/components/landing/HeroTitanium.tsx');
const modeSwitch = read('src/components/landing/LandingModeSwitch.tsx');
const css = read('src/index.css');

describe('Farbmodus — drei Paletten, ein Attribut', () => {
  it('genau drei Modi, benannt, Gold als Vorgabe', () => {
    expect([...LANDING_MODES]).toEqual(['gold', 'cyan', 'light']);
    expect(LANDING_MODE_LABEL.gold).toBe('Dunkel');
    expect(LANDING_MODE_LABEL.cyan).toBe('Cyan');
    expect(LANDING_MODE_LABEL.light).toBe('Hell');
    expect(LANDING_MODES[0]).toBe('gold');
  });

  it('alle Paletten stehen in src/index.css und unterscheiden sich', () => {
    expect(css).toContain('[data-landing-mode]');
    expect(css).toContain("[data-landing-mode='cyan']");
    expect(css).toContain("[data-landing-mode='light']");
    expect(css).toContain('--rsd-accent: #d6ad68;');
    expect(css).toContain('--rsd-accent: #22c3e6;');
    expect(css).toContain('--rsd-bg: #f4efe6;');
    expect(css).toContain('--rsd-shot-filter:');
  });

  it('jede Variable der Gold-Fassung hat Cyan- und Hell-Entsprechung', () => {
    const block = (selector: string) => {
      const start = css.indexOf(selector);
      expect(start, `${selector} fehlt`).toBeGreaterThan(-1);
      const open = css.indexOf('{', start);
      return css.slice(open, css.indexOf('}', open));
    };
    const names = (body: string) => new Set(body.match(/--rsd-[a-z-]+/g) ?? []);
    const gold = names(block('[data-landing-mode] {'));
    const cyan = names(block("[data-landing-mode='cyan']"));
    const light = names(block("[data-landing-mode='light']"));
    expect(gold.size).toBeGreaterThan(5);
    expect([...gold].filter((n) => !cyan.has(n))).toEqual([]);
    expect([...gold].filter((n) => !light.has(n))).toEqual([]);
  });

  it('die Startseite setzt das Attribut und traegt den Schalter im Kopf', () => {
    expect(landing).toContain('useLandingMode');
    expect(landing).toContain('data-landing-mode={mode}');
    expect(landing).toContain('<LandingModeSwitch mode={mode} onChange={setMode} />');
    expect(header).toContain('modeSwitch');
  });

  it('der Schalter ist eine Radiogroup, kein Button-Paar', () => {
    expect(modeSwitch).toContain('role="radiogroup"');
    expect(modeSwitch).toContain('role="radio"');
    expect(modeSwitch).toContain('aria-checked={active}');
  });

  it('die Radiogroup liefert die Tastaturbedienung, die sie ankuendigt', () => {
    expect(modeSwitch).toContain('tabIndex={active ? 0 : -1}');
    expect(modeSwitch).toContain('onKeyDown');
    for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End']) {
      expect(modeSwitch, `${key} wird nicht behandelt`).toContain(`'${key}'`);
    }
    expect(modeSwitch).toContain('.focus()');
    expect(modeSwitch).toContain('event.preventDefault()');
  });
});

describe('Farbmodus — die Flaechen lesen die Variablen', () => {
  it('der Hero haengt nicht mehr an festen Hex-Werten', () => {
    expect(heroTitanium).toContain('MODE_ACCENT');
    expect(heroTitanium).toContain('MODE_BUTTON_INK');
    expect(heroTitanium).toContain('MODE_GLOW');
    for (const token of ['LANDING_ACCENT', 'LANDING_BUTTON', 'LANDING_CTA_GLOW']) {
      expect(heroTitanium, `${token} folgt dem Schalter nicht`).not.toContain(token);
    }
    expect(heroTitanium).toContain("'--landing-ring': MODE_ACCENT");
    expect(heroTitanium).toContain("'--landing-ring-soft': modeAccent(60)");
  });

  it('MainLanding verdrahtet den Modus, der Hero bleibt eine eigene Komponente', () => {
    expect(landing).toContain('<HeroTitanium />');
    expect(landing).toContain('MODE_BG');
    expect(landing).toContain('LANDING_ACCENT');
  });

  it('die Aufnahme wird je Modus anders getont', () => {
    expect(hero).toContain('MODE_SHOT_OPACITY');
    expect(hero).toContain('MODE_SHOT_FILTER');
    expect(hero).not.toContain('opacity-[0.55]');
  });

  it('Hero trägt kein Gold-Netz mehr', () => {
    expect(hero).not.toMatch(/\bfill=\{MODE_/);
    expect(hero).not.toMatch(/\bstroke=\{MODE_/);
    expect(hero).not.toContain('<line');
    expect(hero).not.toContain('<circle');
    expect(header).toContain('style={{ stroke: MODE_ACCENT }}');
  });

  it('Deckungen laufen ueber color-mix, nicht ueber Hex-Anhaengsel', () => {
    expect(MODE_ACCENT).toBe('var(--rsd-accent, #d6ad68)');
    expect(modeAccent(40)).toBe('color-mix(in srgb, var(--rsd-accent, #d6ad68) 40%, transparent)');
    expect(modeVeil(100)).toContain('color-mix(in srgb, var(--rsd-veil');
    expect(landing).not.toContain('${MODE_ACCENT}');
    expect(hero).not.toContain('${MODE_ACCENT}');
  });
});

describe('Farbmodus — nur Farbe, nicht Inhalt', () => {
  it('kein Text und kein Layout haengt am Modus', () => {
    for (const forbidden of ["mode === 'cyan' ?", "mode === 'gold' ?", 'mode ===']) {
      expect(landing, `Der Modus darf nur Farbe steuern (${forbidden})`).not.toContain(forbidden);
    }
    expect(hero).toContain('export function EuropeNetworkHero() {');
    expect(header).not.toContain('mode === ');
  });
});
