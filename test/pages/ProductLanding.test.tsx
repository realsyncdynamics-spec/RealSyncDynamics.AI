import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncMascotOptions } from '../../src/components/visual/sync-mascot/syncMascotScene';

// three/WebGL läuft nicht in jsdom: die Szene wird durch eine Attrappe ersetzt.
const scene = vi.hoisted(() => ({
  options: null as SyncMascotOptions | null,
  wave: vi.fn(() => true),
  dispose: vi.fn(),
}));

vi.mock('../../src/components/visual/sync-mascot/syncMascotScene', () => ({
  mountSyncMascot: (_canvas: HTMLCanvasElement, options: SyncMascotOptions) => {
    scene.options = options;
    return { wave: scene.wave, dispose: scene.dispose };
  },
}));

import ProductLanding from '../../src/pages/products/ProductLanding';
import { PRODUCT_CONTENT, type ProductLandingKey } from '../../src/components/landing/products/productContent';
import { PRODUCT_PAGES } from '../../src/components/landing/products/productLandingShared';
import { STAGE_SCENES, STAGE_VARIANT_BY_PRODUCT } from '../../src/components/landing/products/stageScenes';
import { LEGAL_LINKS, STATUS_TEXT, planCards } from '../../src/components/landing/v3/landingV3Data';
import { IMPLEMENTATION_ITEMS } from '../../src/product/implementation-status';

const root = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');
const KEYS = ['landingpage-builder', 'app-builder', 'governance-os'] as const;

async function renderPage(product: ProductLandingKey) {
  const view = render(
    <MemoryRouter>
      <ProductLanding product={product} />
    </MemoryRouter>,
  );
  await waitFor(() => expect(scene.options).not.toBeNull());
  return view;
}

describe('Produkt-Landingpages (Entwurf)', () => {
  beforeEach(() => {
    scene.options = null;
    scene.wave.mockClear();
    scene.dispose.mockClear();
  });

  it('sind geroutet, noindex und in der Produktnavigation verlinkt', () => {
    const app = read('src/App.tsx');
    expect(app).toContain('<Route path="/app-builder" element={<ProductLanding key="app-builder" product="app-builder" />} />');
    expect(app).toContain('<Route path="/governance-os" element={<ProductLanding key="governance-os" product="governance-os" />} />');
    expect(app).toContain(
      '<Route path="/claude-code-optimizer" element={<OptimizerOverview />} />',
    );
    // Der Optimizer-Ablauf unter der Landingpage bleibt erreichbar.
    for (const step of ['scan', 'ergebnis', 'anmelden', 'bericht']) {
      expect(app).toContain(`<Route path="/claude-code-optimizer/${step}"`);
    }
    const seo = read('src/config/seo.ts');
    expect(seo).toMatch(/'\/app-builder': \{[\s\S]*?noIndex: true/);
    expect(seo).toMatch(/'\/governance-os': \{[\s\S]*?noIndex: true/);
    expect(PRODUCT_PAGES.every((p) => p.built && p.href === p.plannedPath)).toBe(true);
  });

  it.each(KEYS)('%s: eigene Hero-Szene mit Produktkarte', async (key) => {
    await renderPage(key);
    const variant = STAGE_VARIANT_BY_PRODUCT[key];
    const stage = screen.getByTestId('pl-stage');
    expect(stage).toHaveAttribute('data-variant', variant);
    expect(within(stage).getByTestId('pl-stage-prop')).toHaveTextContent('Beispiel');
    expect(scene.options?.orbit).toEqual(STAGE_SCENES[variant].orbit);
    expect(scene.options?.poseAt).toBe(STAGE_SCENES[variant].poseAt);
  });

  it('jede Produktseite hat eine andere Szene', () => {
    const variants = Object.values(STAGE_VARIANT_BY_PRODUCT);
    expect(new Set(variants).size).toBe(variants.length);
    const orbits = variants.map((v) => JSON.stringify(STAGE_SCENES[v].orbit));
    expect(new Set(orbits).size).toBe(orbits.length);
  });

  it.each(KEYS)('%s: Überschrift, Hauptaktion und SYNC als 3D-Bühne', async (key) => {
    await renderPage(key);
    const c = PRODUCT_CONTENT[key];
    expect(screen.getByTestId('product-heading')).toHaveTextContent(c.h1[0]);
    const primary = screen.getByTestId('product-primary');
    expect(primary).toHaveTextContent(c.primary.label);
    expect(primary).toHaveAttribute('href', c.primary.to);
    expect(primary).toHaveAttribute('data-hero-cta', key);
    expect(scene.options?.src).toBe('/models/sync-mascot.glb');
    expect(screen.getByRole('link', { name: PRODUCT_PAGES.find((p) => p.key === key)!.name })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it.each(KEYS)('%s: Status-Badges nur aus der Registry', async (key) => {
    await renderPage(key);
    const status = screen.getByTestId('product-status');
    for (const s of PRODUCT_CONTENT[key].status) {
      const item = IMPLEMENTATION_ITEMS.find((i) => i.id === s.registryId);
      expect(item, s.registryId).toBeTruthy();
      expect(status).toHaveTextContent(`${s.label} ${STATUS_TEXT[item!.status]}`);
    }
  });

  it.each(KEYS)('%s: Ablauf Schritt für Schritt, SYNC winkt beim Start', async (key) => {
    await renderPage(key);
    act(() => scene.options!.onLoad());
    const steps = PRODUCT_CONTENT[key].flow.steps;
    const demo = screen.getByTestId('product-demo');
    expect(demo).toHaveAttribute('data-hero-cta', `${key}-demo`);

    fireEvent.click(within(demo).getByRole('button', { name: 'Ablauf starten' }));
    expect(scene.wave).toHaveBeenCalledTimes(1);
    expect(within(demo).getByText(steps[0]!.result)).toBeInTheDocument();

    const next = within(demo).getByRole('button', { name: 'Nächster Schritt' });
    for (let i = 1; i < steps.length; i++) fireEvent.click(next);
    expect(within(demo).getByText(steps[steps.length - 1]!.result)).toBeInTheDocument();
    expect(next).toBeDisabled();
    expect(scene.wave).toHaveBeenCalledTimes(1);

    fireEvent.click(within(demo).getByRole('button', { name: 'Von vorn' }));
    expect(within(demo).getByText('Noch kein Schritt. Starten Sie den Ablauf.')).toBeInTheDocument();
  });

  it.each(KEYS)('%s: Tarife aus shared/pricing.ts, Grenzen und Pflichtseiten', async (key) => {
    await renderPage(key);
    if (key === 'governance-os') {
      expect(screen.getByTestId('product-plan-governance-launch')).toHaveTextContent('Einmalig');
    }
    for (const card of key === 'governance-os' ? [] : planCards(PRODUCT_CONTENT[key].source)) {
      const el = screen.getByTestId(`product-plan-${card.id}`);
      expect(within(el).getByText(card.price.replace(/\s+/g, ' '))).toBeInTheDocument();
    }
    expect(screen.getByTestId('product-limits')).toHaveTextContent(PRODUCT_CONTENT[key].limits);
    expect(screen.getByTestId('product-tax-note').textContent?.length).toBeGreaterThan(0);
    const legal = screen.getByRole('navigation', { name: 'Rechtliches' });
    for (const l of LEGAL_LINKS) expect(within(legal).getByRole('link', { name: l.label })).toHaveAttribute('href', l.to);
  });

  it('nennt die Grenzen aus der Registry und verspricht keine Code-Korrektur', () => {
    expect(PRODUCT_CONTENT['claude-code-optimizer'].limits).toMatch(/GitHub-Repositories.*automatische Code-Korrekturen/);
    expect(PRODUCT_CONTENT['app-builder'].limits).toMatch(/Preview/);
    expect(PRODUCT_CONTENT['governance-os'].limits).toMatch(/In Vorbereitung/);
    const text = JSON.stringify(PRODUCT_CONTENT);
    expect(text).not.toMatch(/Pilot|Demo buchen|Beratung anfragen|Termin vereinbaren|Sales/);
  });

  it('räumt die Szene beim Unmount auf', async () => {
    const view = await renderPage('governance-os');
    view.unmount();
    expect(scene.dispose).toHaveBeenCalledTimes(1);
  });
});
