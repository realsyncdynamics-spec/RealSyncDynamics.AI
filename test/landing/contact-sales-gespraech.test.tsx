/**
 * /contact-sales?intent=gespraech — Hero-CTA „Gespräch anfragen“ (Landing v6).
 * Eine Anfrage, keine Terminbuchung: weder Terminvorschläge noch
 * Founding-/Enterprise-Copy versprechen.
 */
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ContactSales } from '../../src/pages/ContactSales';

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

it('shows a conversation request instead of Founding Access for intent=gespraech', async () => {
  mountAt('?intent=gespraech&source=landing-v6-hero');
  expect(await screen.findByRole('heading', { level: 1, name: 'Anfrage für ein persönliches Gespräch' })).toBeInTheDocument();
  expect(screen.queryByText(/Founding Access/)).toBeNull();
  expect(screen.queryByText(/14 Tage kostenloser Enterprise-Zugang/)).toBeNull();
  expect(screen.queryByText(/Terminvorschl/)).toBeNull();
  expect(screen.getByRole('button', { name: 'Gespräch anfragen' })).toBeInTheDocument();
});

it('confirms receipt without promising an automatic reply or appointment', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);

  const { container } = mountAt('?intent=gespraech&source=landing-v6-hero');
  fireEvent.change(container.querySelector('input[type="email"]') as HTMLInputElement, {
    target: { value: 'kontakt@example.de' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Gespräch anfragen' }));

  expect(await screen.findByText(/Ihre Anfrage ist eingegangen\. Wir melden uns per E-Mail zu den nächsten Schritten\./)).toBeInTheDocument();
  expect(screen.queryByText(/AI Agent/)).toBeNull();
  const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
  expect(body.intent).toBe('gespraech');
  expect(body.plan_key).toBeUndefined();
});
