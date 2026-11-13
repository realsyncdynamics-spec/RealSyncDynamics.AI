/**
 * Zielarchitektur: sechs bestehende Einstiege, Badge aus dem Status,
 * die acht Bereiche der Hülle bleiben daneben erreichbar.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { TenantProvider } from '../../src/core/access/TenantProvider';
import { AppShellPreview } from '../../src/app/AppShellPreview';
import { PlatformArchitecture } from '../../src/components/platform/PlatformArchitecture';
import {
  PLATFORM_ENTRY,
  PLATFORM_MODULES,
  badgeLabel,
  moduleBadge,
} from '../../src/components/platform/platformArchitecture';
import { getImplementation } from '../../src/product/implementation-status';
import { resolveTheme } from '../../src/app/theme/resolve';

const app = readFileSync('src/App.tsx', 'utf8');

function routeExists(href: string): boolean {
  if (href === '/') return app.includes('path="/"');
  return app.includes(`path="${href}"`) || app.includes(`path="${href}/`) || app.includes(`path="${href.split('/:')[0]}`);
}

describe('Plattform-Architektur', () => {
  it('verbindet jede Karte mit einer bestehenden Route und dem Status', () => {
    expect(PLATFORM_MODULES).toHaveLength(6);
    for (const module of PLATFORM_MODULES) {
      expect(routeExists(module.href), module.href).toBe(true);
      const badge = moduleBadge(module);
      if (!module.ssotId) {
        expect(badge).toBe('geplant');
        continue;
      }
      const status = getImplementation(module.ssotId)?.status;
      expect(status, module.ssotId).toBeTruthy();
      if (status === 'live') expect(badge).toBe('live');
      if (status === 'preview') expect(badge).toBe('demo');
      if (status === 'coming-soon') expect(badge).toBe('geplant');
    }
    expect(moduleBadge(PLATFORM_MODULES.find((item) => item.id === 'creative-studio')!)).toBe('geplant');
    expect(moduleBadge(PLATFORM_MODULES.find((item) => item.id === 'agent-studio')!)).toBe('demo');
    expect(moduleBadge(PLATFORM_MODULES.find((item) => item.id === 'governance-os')!)).toBe('live');
  });

  it('lässt den Einstieg auf vorhandenen Türen', () => {
    for (const link of PLATFORM_ENTRY) expect(routeExists(link.href), link.href).toBe(true);
    expect(PLATFORM_ENTRY.map((link) => link.label)).toEqual(['Landingpage', 'Login', 'Onboarding', 'Checkout']);
  });

  it('zeigt die sechs Karten und kennzeichnet Demo über das Badge-Token', () => {
    const cream = resolveTheme('light-cream');
    expect(cream['--badge-demo-text']).toBe(cream['--color-status-demo']);
    expect(cream['--badge-live-text']).toBe(cream['--color-status-success']);
    render(
      <MemoryRouter>
        <PlatformArchitecture />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'RealSync Dynamics AI' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Gemeinsame technische Basis' })).toBeInTheDocument();
    const demo = screen.getByRole('link', { name: /AI Agent Studio/ });
    expect(demo).toHaveAttribute('href', '/chatbot/start');
    expect(demo).toHaveTextContent(badgeLabel('demo'));
    expect(screen.getByRole('link', { name: /AI Creative Studio/ })).toHaveTextContent('geplant');
    expect(screen.getByRole('link', { name: /Governance OS/ })).toHaveAttribute('href', '/governance-runtime');
  });

  it('hängt die Module in die Hülle, ohne die acht Bereiche zu entfernen', () => {
    render(
      <TenantProvider initialFixturePreview>
        <MemoryRouter>
          <AppShellPreview />
        </MemoryRouter>
      </TenantProvider>,
    );
    const platform = screen.getByRole('navigation', { name: 'Plattform' });
    expect(platform.querySelectorAll('button')).toHaveLength(6);
    expect(screen.getByRole('navigation', { name: 'Bereiche' }).querySelectorAll('button')).toHaveLength(8);
    fireEvent.click(screen.getByRole('button', { name: /Command Center/ }));
    expect(screen.getByRole('heading', { name: 'Governance Control Room' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Website & App Builder/ }));
    expect(screen.getByRole('heading', { name: 'Website Builder' })).toBeInTheDocument();
  });
});
