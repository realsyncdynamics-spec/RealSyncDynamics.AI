/**
 * Altes /app/siteos/builder: Quell-Links landen in der Transformation, alle
 * anderen in /build — und die Query geht dabei nicht verloren.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import {
  LEGACY_BUILDER_DEFAULT_KIND,
  LegacySiteOsBuilderRedirect,
  legacyBuilderTarget,
} from '../../src/features/build-studio/legacyBuilderRedirect';
import { DEFAULT_BUILD_KIND } from '../../src/features/build-studio/entry';

function Landed() {
  const location = useLocation();
  return <div data-testid="landed">{`${location.pathname}${location.search}`}</div>;
}

async function landingFor(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/app/siteos/builder" element={<LegacySiteOsBuilderRedirect />} />
        <Route path="/build" element={<Landed />} />
        <Route path="/unified-entry/transformation" element={<Landed />} />
      </Routes>
    </MemoryRouter>,
  );
  return (await screen.findByTestId('landed')).textContent;
}

describe('LegacySiteOsBuilderRedirect', () => {
  it('ohne Parameter: kanonischer Einstieg /build?kind=website', async () => {
    expect(await landingFor('/app/siteos/builder')).toBe('/build?kind=website');
  });

  it('mit Ausgangsseite: Transformation, alle Parameter bleiben', async () => {
    const landed = await landingFor(
      '/app/siteos/builder?url=https%3A%2F%2Fbeispiel.de&auditId=a1&instruction=CTA+st%C3%A4rker&variant=modern-minimal',
    );
    const target = new URL(landed ?? '', 'https://x.test');
    expect(target.pathname).toBe('/unified-entry/transformation');
    expect(target.searchParams.get('url')).toBe('https://beispiel.de');
    expect(target.searchParams.get('auditId')).toBe('a1');
    expect(target.searchParams.get('instruction')).toBe('CTA stärker');
    expect(target.searchParams.get('variant')).toBe('modern-minimal');
  });

  it('domain allein reicht als Ausgangsseite', async () => {
    expect(await landingFor('/app/siteos/builder?domain=beispiel.de')).toBe(
      '/unified-entry/transformation?domain=beispiel.de',
    );
  });

  it('ohne Ausgangsseite bleiben prompt und eine gesetzte Projektart erhalten', async () => {
    const landed = await landingFor('/app/siteos/builder?kind=web_app&prompt=Kundenportal');
    const target = new URL(landed ?? '', 'https://x.test');
    expect(target.pathname).toBe('/build');
    expect(target.searchParams.get('kind')).toBe('web_app');
    expect(target.searchParams.get('prompt')).toBe('Kundenportal');
  });

  it('ergänzt die Projektart nur, wenn sie fehlt', () => {
    const target = new URL(legacyBuilderTarget('?prompt=Kundenportal'), 'https://x.test');
    expect(target.searchParams.get('kind')).toBe('website');
    expect(target.searchParams.get('prompt')).toBe('Kundenportal');
  });

  it('Default deckt sich mit dem kanonischen Einstieg', () => {
    expect(LEGACY_BUILDER_DEFAULT_KIND).toBe(DEFAULT_BUILD_KIND);
  });
});
