import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { HeroTitanium } from '../../src/components/landing/HeroTitanium';
import { HERO_DASHBOARD_CTA_LABEL } from '../../src/components/governance-frontend/hero-content';
import { tierById } from '../../src/config/pricing';

afterEach(cleanup);
describe('Gold landing handoffs', () => {
  it('uses the existing audit, dashboard and canonical checkout routes', () => {
    render(<MemoryRouter><HeroTitanium sectionId="overview" /></MemoryRouter>);
    expect(screen.getByRole('heading', {level: 1}).textContent).toContain('AI Compliance');
    expect(screen.getByRole('link', {name: 'Free Audit'}).getAttribute('href')).toBe('/audit');
    for (const id of ['starter', 'growth', 'agency']) {
      const tier = tierById(id)!;
      const link = screen.getByRole('link', {name: new RegExp(tier.name)});
      expect(link.getAttribute('href')).toBe(tier.cta.href);
      expect(link.textContent).toContain(`${tier.priceEur} € / Monat`);
    }
    expect(screen.getByRole('link', {name: HERO_DASHBOARD_CTA_LABEL}).getAttribute('href')).toBe('/app/dashboard');
    expect(screen.getByRole('link', {name: 'Enterprise'}).getAttribute('href')).toBe('/enterprise');
    expect(document.querySelector('#product')).toBeNull();
  });
});
