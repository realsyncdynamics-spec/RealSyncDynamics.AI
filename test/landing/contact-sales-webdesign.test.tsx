/**
 * /contact-sales?intent=webdesign — Webdesign-Anfragen landen nicht im
 * Founding-/Enterprise-Funnel, sondern als persönliche Projektanfrage.
 */
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ContactSales } from '../../src/pages/ContactSales';

afterEach(() => { cleanup(); window.history.replaceState({}, '', '/'); });

function mountAt(search: string) {
  // ContactSales liest window.location.search direkt.
  window.history.replaceState({}, '', `/contact-sales${search}`);
  return render(<MemoryRouter initialEntries={[`/contact-sales${search}`]}><ContactSales /></MemoryRouter>);
}

it('shows a personal website inquiry instead of Founding Access for intent=webdesign', async () => {
  mountAt('?source=frontend-builder&intent=webdesign');
  expect(await screen.findByRole('heading', { level: 1, name: 'Ihre Website individuell gestalten' })).toBeInTheDocument();
  expect(screen.queryByText(/Founding Access/)).toBeNull();
  expect(screen.getByRole('combobox')).toHaveValue('webdesign');
  expect(screen.getByRole('button', { name: 'Anfrage senden' })).toBeInTheDocument();
});

it('keeps the Founding Access copy for plain contact links', () => {
  mountAt('?source=landing');
  expect(screen.getByRole('heading', { level: 1, name: 'Founding Access anfragen' })).toBeInTheDocument();
});
