/**
 * /contact-sales?intent=gespraech — Hero-CTA „Gespräch anfragen“ (Landing v6).
 * Eine Gesprächsanfrage, keine Terminbuchung: Die Seite darf weder Termine
 * noch Terminvorschläge versprechen, solange es keine Terminvereinbarung gibt.
 */
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ContactSales } from '../../src/pages/ContactSales';
import { CTA } from '../../src/content/runtimeVocab';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
});

function mountAt(search: string) {
  // ContactSales liest window.location.search direkt.
  window.history.replaceState({}, '', `/contact-sales${search}`);
  return render(<MemoryRouter initialEntries={[`/contact-sales${search}`]}><ContactSales /></MemoryRouter>);
}

it('shows a personal conversation request instead of Founding Access for intent=gespraech', async () => {
  mountAt('?intent=gespraech&source=landing-v6-hero');
  expect(await screen.findByRole('heading', { level: 1, name: 'Anfrage für ein persönliches Gespräch' })).toBeInTheDocument();
  expect(screen.queryByText(/Founding Access/)).toBeNull();
  expect(screen.queryByText(/Termin/)).toBeNull();
  expect(screen.getByRole('button', { name: CTA.consult })).toBeInTheDocument();
});

it('confirms receipt without promising automatic appointments', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal('fetch', fetchMock);
  mountAt('?intent=gespraech&source=landing-v6-hero');

  fireEvent.change(screen.getByRole('textbox', { name: /E-Mail/ }), { target: { value: 'kunde@example.de' } });
  fireEvent.click(screen.getByRole('button', { name: CTA.consult }));

  expect(await screen.findByText(/Ihre Anfrage ist eingegangen\. Wir melden uns per E-Mail zu den nächsten Schritten\./)).toBeInTheDocument();
  expect(screen.queryByText(/AI Agent/)).toBeNull();
  expect(screen.queryByText(/Termin/)).toBeNull();

  const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
  expect(body.intent).toBe('gespraech');
  expect(body.plan_key).toBeUndefined();
});
