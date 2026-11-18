/**
 * Startseite `/` (Landing v6) — gezielte Verbesserungen vom 16.11.2026:
 * Bedarfs-Check als zweiter Hero-Button, ein wiederholter Scan-CTA durch den
 * Bedarfs-Check ersetzt, keine Zusage für Telefon/Terminbuchung.
 * Rein clientseitig, kein Backend.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { LandingV6View } from '../../src/components/landing/v6/LandingV6View';
import { useLandingV6 } from '../../src/components/landing/v6/useLandingV6';

function Harness() {
  return <LandingV6View v={useLandingV6()} />;
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const mount = () => render(<MemoryRouter initialEntries={['/']}><Harness /></MemoryRouter>);

it('zeigt den Bedarfs-Check als zweiten Hero-Button, der Scan bleibt primär', () => {
  mount();
  expect(screen.getByTestId('hero-primary-cta')).toHaveAttribute('href', '/audit?source=landing-v6');
  const check = screen.getByTestId('hero-needs-check');
  expect(check).toHaveAttribute('href', '/check?source=landing-v6-hero');
  expect(check).toHaveTextContent('Bedarfs-Check in 3 Fragen');
  // Genau ein Audit-CTA im Hero bleibt markiert.
  expect(document.querySelectorAll('[data-hero-cta="audit"]').length).toBe(1);
});

it('führt den KI-Empfang im Hero zum Voice-Agent-Einstieg, nicht direkt zur Warteliste', () => {
  mount();
  const link = screen.getByTestId('hero-voice-agent');
  expect(link.getAttribute('href')).toMatch(/^\/phonebot\/start\?/);
  expect(link).toHaveTextContent('Voice Agent ansehen');
  // Die Warteliste bleibt über /phonebot/start erreichbar, der Hero verlinkt sie nicht mehr direkt.
  expect(document.querySelector('[data-hero-cta="voice-waitlist"]')).toBeNull();
});

it('führt jeden „Governance OS“-Link zum Governance-Dashboard (#control-room)', () => {
  mount();
  expect(screen.getByTestId('hero-os-cta')).toHaveAttribute('href', '#control-room');
  const osLinks = screen.getAllByRole('link', { name: 'Governance OS' });
  expect(osLinks.length).toBeGreaterThan(0);
  for (const a of osLinks) expect(a).toHaveAttribute('href', '#control-room');
  expect(document.getElementById('control-room')).not.toBeNull();
});

it('führt nach dem Governance-OS-Abschnitt zum Bedarfs-Check statt erneut zum Scan', () => {
  mount();
  const link = screen.getByTestId('produkt-needs-check');
  expect(link).toHaveAttribute('href', '/check?source=landing-v6-produkt');
});

it('verspricht weder Telefon noch Terminbuchung als verfügbar', () => {
  const src = readFileSync('src/components/landing/v6/useLandingV6.ts', 'utf8');
  expect(src).not.toContain('Website-Chat, Terminbuchung, WhatsApp, Telefon');
  expect(src).toContain('Telefon und Terminbuchung sind in Vorbereitung');
});
