import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { OriginalComplianceHero } from '../../src/components/landing/OriginalComplianceHero';

afterEach(cleanup);

it('renders the approved original Europe compliance hero without fake KPI claims', () => {
  const view = render(
    <MemoryRouter>
      <OriginalComplianceHero />
    </MemoryRouter>,
  );

  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'AI Compliance Operations OS for Europe',
  );
  expect(screen.getByText('DISCOVER')).toBeInTheDocument();
  expect(screen.getByText('CLASSIFY')).toBeInTheDocument();
  expect(screen.getByText('ENFORCE')).toBeInTheDocument();
  expect(screen.getByText('PROVE')).toBeInTheDocument();

  const group = screen.getByRole('group', { name: 'Pläne und Einstiege' });
  expect(within(group).getByRole('link', { name: /Free Audit/i })).toHaveAttribute('href', '/audit');
  expect(within(group).getByRole('link', { name: /Starter 79€/i })).toHaveAttribute('href', '/checkout/starter');
  expect(within(group).getByRole('link', { name: /Growth 249€/i })).toHaveAttribute('href', '/checkout/growth');
  expect(within(group).getByRole('link', { name: /Agency 699€/i })).toHaveAttribute('href', '/checkout/agency');
  expect(within(group).getByRole('link', { name: /Enterprise/i })).toHaveAttribute(
    'href',
    '/contact-sales?tier=enterprise&source=home-hero-pricing',
  );

  expect(screen.getByText(/Supabase Frankfurt/)).toBeInTheDocument();
  expect(screen.getByText(/Multi-Tenant RLS/)).toBeInTheDocument();
  expect(screen.getByText(/Ollama EU-lokal/)).toBeInTheDocument();

  expect(view.container.textContent).not.toMatch(/99\.9|uptime|SLA/i);
});
