/**
 * Produktportal `/` und Produktseiten `/produkte/*`.
 *
 * Vertrag: Hero „BUILD. AUTOMATE. GOVERN.“, drei Produkt-Einstiege mit den
 * vereinbarten CTAs, Statuskennzeichnung je Funktion, Preise nur als Link auf
 * /pricing (keine Euro-Beträge auf Portal und Produktseiten).
 */
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProductPortal } from '../../src/pages/ProductPortal';
import { ProductPage } from '../../src/pages/products/ProductPage';

afterEach(cleanup);

function renderAt(path: string, ui: ReactElement) {
  return render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);
}

describe('ProductPortal', () => {
  it('zeigt Hero und drei Produkte mit den vereinbarten CTAs', () => {
    renderAt('/', <ProductPortal />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/BUILD\.\s*AUTOMATE\.\s*GOVERN\./);
    for (const name of ['RealSync Build Studio', 'RealSync Agent Studio', 'RealSync Governance OS']) {
      expect(screen.getByRole('heading', { level: 3, name })).toBeTruthy();
    }
    const href = (label: string) => screen.getByRole('link', { name: label }).getAttribute('href');
    expect(href('Website erstellen')).toBe('/build');
    expect(href('Bestehende Website analysieren')).toBe('/audit?source=portal-build');
    expect(href('KI-Agent erstellen')).toBe('/chatbot/start');
    expect(href('Agent Studio entdecken')).toBe('/produkte/agent-studio');
    expect(href('Kostenlosen Governance-Check starten')).toBe('/audit?source=portal-govern');
    expect(href('Governance OS entdecken')).toBe('/produkte/governance-os');
  });

  it('kennzeichnet Funktionen mit Status und nennt keine Euro-Beträge', () => {
    const { container } = renderAt('/', <ProductPortal />);
    expect(container.querySelectorAll('[data-status]').length).toBeGreaterThan(0);
    expect(container.textContent).not.toMatch(/\d\s?€/);
  });
});

describe('ProductPage', () => {
  it.each([
    ['build', '/produkte/build-studio', 'RealSync Build Studio'],
    ['automate', '/produkte/agent-studio', 'RealSync Agent Studio'],
    ['govern', '/produkte/governance-os', 'RealSync Governance OS'],
  ] as const)('%s rendert Titel, Statusmatrix und Freischaltungstabelle', (id, path, title) => {
    const { container } = renderAt(path, <ProductPage id={id} />);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Was Ihr Tarif freischaltet' })).toBeTruthy();
    expect(container.querySelectorAll('table').length).toBe(2);
    expect(container.textContent).not.toMatch(/\d\s?€/);
  });

  it('Agent Studio weist Telefonie als gesperrt aus', () => {
    const { container } = renderAt('/produkte/agent-studio', <ProductPage id="automate" />);
    expect(container.querySelectorAll('[data-status="blocked"]').length).toBeGreaterThan(0);
  });
});
