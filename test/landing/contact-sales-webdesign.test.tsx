/**
 * /contact-sales?intent=webdesign — Webdesign-Anfragen landen nicht im
 * Enterprise-Funnel, sondern als persönliche Projektanfrage.
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

it('shows a personal website inquiry instead of the Enterprise copy for intent=webdesign', async () => {
  mountAt('?source=frontend-builder&intent=webdesign');
  expect(await screen.findByRole('heading', { level: 1, name: 'Individuelles Webdesign anfragen' })).toBeInTheDocument();
  expect(screen.queryByText(/Enterprise kostet/)).toBeNull();
  expect(screen.queryByTestId('contact-sales-enterprise-checkout')).toBeNull();
  expect(screen.getByText(/persönliches Festangebot nach Projektumfang/)).toBeInTheDocument();
  expect(screen.getByRole('combobox')).toHaveValue('webdesign');
  expect(screen.getByRole('button', { name: 'Anfrage senden' })).toBeInTheDocument();
});

it('shows the Enterprise fixed price and checkout for plain contact links', () => {
  mountAt('?source=landing');
  expect(screen.getByRole('heading', { level: 1, name: 'Enterprise anfragen' })).toBeInTheDocument();
  // Enterprise ist nicht Teil der Beta: Festpreis, ohne Testphase, direkt buchbar.
  expect(screen.getByText(/Enterprise kostet 1\.498\s€\/Monat netto, ohne Testphase und direkt buchbar/)).toBeInTheDocument();
  expect(screen.getByTestId('contact-sales-enterprise-checkout')).toHaveAttribute('href', '/checkout/enterprise');
  expect(document.body.textContent).not.toMatch(/Enterprise-Beta|auf Anfrage/);
  // Kein Kontingent: /contact-sales schreibt über sales-lead, ohne Obergrenze.
  expect(document.body.textContent).not.toMatch(/100 Unternehmen|14 Tage|Founding Access/);
});
