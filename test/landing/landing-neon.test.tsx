/**
 * Neon-Design (18.11.2026): Startseite und App-Shell.
 * Geprüft: Umschalter Hell/Dunkel (Startseite seit der Glaswürfel-Vorlage standardmäßig dunkel),
 * Hero-Bildschirm nur mit Registry-Status und geplantem Ablauf,
 * keine Agent-/Bot-ID im Bundle, Shell trägt den Neon-Scope.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingV3 } from '../../src/pages/LandingV3';
import { RECEPTIONIST, STATUS_TEXT } from '../../src/components/landing/v3/landingV3Data';
import { CUBE_PHASES, screenLines } from '../../src/components/landing/neon/NeonHeroScreen';

const root = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));

describe('Neon-Design — Startseite', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('startet dunkel (Glaswürfel-Vorlage) und schaltet auf hell um', () => {
    const { container } = render(<MemoryRouter><LandingV3 /></MemoryRouter>);
    const page = container.querySelector('.lv3.lv3-neon');
    expect(page).toHaveAttribute('data-mode', 'dark');
    const toggle = within(screen.getByRole('navigation', { name: 'Hauptnavigation' })).getByTestId('neon-mode-toggle');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(toggle);
    expect(page).toHaveAttribute('data-mode', 'light');
    expect(window.localStorage.getItem('rs-neon-mode-landing')).toBe('light');
  });

  it('Hero-Bildschirm zeigt Registry-Status und den geplanten Ablauf, kein Live-Versprechen', () => {
    render(<MemoryRouter><LandingV3 /></MemoryRouter>);
    const tv = screen.getByTestId('neon-hero-screen');
    expect(tv).toHaveTextContent(`Vorschau · ${STATUS_TEXT[RECEPTIONIST.status]}`);
    expect(screen.getByTestId('neon-hero-caption')).toHaveTextContent(RECEPTIONIST.heading);
    expect(screenLines(RECEPTIONIST.heading, RECEPTIONIST.steps)).toHaveLength(RECEPTIONIST.steps.length + 1);
    expect(CUBE_PHASES).toEqual(['lattice', 'solid', 'shatter', 'empty', 'reassemble']);
    expect(screen.getByTestId('neon-cube-phase')).toHaveAttribute('data-phase', 'lattice');
    // Der Glaswürfel folgt derselben Phase.
    expect(within(screen.getByTestId('neon-cube-phase')).getByTestId('glass-cube')).toHaveAttribute('data-phase', 'lattice');
  });

  it('keine Agent-/Bot-IDs, keine Sprach-SDKs, keine festen Preise im Neon-Code', () => {
    const src = [
      'src/components/landing/neon/NeonHeroScreen.tsx',
      'src/components/neon/GlassCube.tsx',
      'src/components/neon/GlassPanel.tsx',
      'src/components/neon/NeonModeToggle.tsx',
      'src/hooks/useNeonMode.ts',
    ]
      .map(read)
      .join('\n');
    expect(src).not.toMatch(/agent_[0-9a-z]{10,}|@elevenlabs|elevenlabs\.io|wa\.me/i);
    expect(src).not.toMatch(/\b\d{2,4}(,\d{2})? €/);
  });
});

describe('Neon-Design — App-Shell', () => {
  it('Shell trägt den Neon-Scope mit Modus, Kopfzeile den Umschalter', () => {
    const shell = read('src/components/governance-os/GovernanceBrowserShell.tsx');
    expect(shell).toContain('rs-app rs-neon');
    expect(shell).toContain('data-neon-mode={neonMode}');
    expect(shell).toMatch(/useNeonMode\('rs-neon-mode-app', 'dark'\)/);
    const top = read('src/components/governance-os/BrowserTopBar.tsx');
    expect(top).toContain('<NeonModeToggle');
  });

  it('Neon-Overrides sind gescoped und lassen Statusfarben unberührt', () => {
    const css = read('src/styles/neon-theme.css');
    expect(css).toContain('.os-chrome.rs-app.rs-neon {');
    expect(css).toContain(".os-chrome.rs-app.rs-neon[data-neon-mode='light'] {");
    expect(css).not.toMatch(/--color-rs-(success|warning|danger)\s*:/);
    expect(css).not.toMatch(/^:root|^body|^html/m);
  });
});
