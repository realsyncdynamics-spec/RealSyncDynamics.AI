import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { TenantProvider } from '../../src/core/access/TenantProvider';
import { AppShellPreview } from '../../src/app/AppShellPreview';

function renderShell() {
  return render(
    <TenantProvider initialFixturePreview>
      <MemoryRouter>
        <AppShellPreview />
      </MemoryRouter>
    </TenantProvider>,
  );
}

describe('AppShell', () => {
  it('zeigt Sidebar, Mandantenwechsel, Suchslot und Profil', async () => {
    renderShell();
    const nav = await screen.findByRole('navigation', { name: 'Bereiche' });
    expect(nav.querySelectorAll('button')).toHaveLength(8);
    await screen.findByRole('option', { name: 'Beispiel · B2B-SaaS' });
    expect(screen.getByTestId('tenant-switcher')).toBeInTheDocument();
    expect(screen.getByLabelText('Suche')).toBeInTheDocument();
    expect(screen.getByText('Keine Sitzung')).toBeInTheDocument();
    expect(screen.getAllByText('UI-Konzept · Beispieldaten').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Primär' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Mandant wechseln'), { target: { value: 'fixture-b2b-saas' } });
    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-theme', 'beispiel-b2b-saas');
    expect(screen.getByRole('heading', { name: 'Governance Control Room' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Website Builder' }));
    expect(screen.getByRole('heading', { name: 'Website Builder' })).toBeInTheDocument();
    expect(screen.getByText('/app/websites')).toBeInTheDocument();
    expect(screen.getByText('/app/siteos')).toBeInTheDocument();
  });
});
