/**
 * Tests für die Warteliste-Landingpage (/warteliste) und das Anmeldeformular.
 *
 * Der Schwerpunkt liegt auf zwei Zusagen, die im Produkt gelten sollen:
 *  1. Es wird nie eine Wartelistenposition oder Anmeldezahl erfunden — beides
 *     kommt aus der Edge Function `waitlist-join`. Antwortet sie nicht, bleibt
 *     der Zähler unsichtbar und die Anmeldung meldet einen Fehler.
 *  2. Die Anmeldung geht ausschließlich über die Edge Function, nie direkt
 *     gegen die Tabelle (kein Client-seitiger Tabellenzugriff).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WaitlistLanding } from '../../src/pages/WaitlistLanding';

function renderPage(path = '/warteliste') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <WaitlistLanding />
    </MemoryRouter>,
  );
}

/**
 * Füllt das erste Formular (Hero) aus und schickt es ab. Kein user-event —
 * @testing-library/user-event ist keine Dependency dieses Repos, fireEvent
 * reicht für ein Formular ohne Tastatur-Interaktionslogik.
 */
async function submitEmail(email: string) {
  const input = screen.getAllByLabelText(/Geschäftliche E-Mail/i)[0];
  fireEvent.change(input, { target: { value: email } });
  await act(async () => {
    fireEvent.submit(input.closest('form')!);
  });
}

/** Antwort-Stub für fetch — GET liefert den Zähler, POST die Position. */
function mockFetch(handlers: {
  count?: number | null;
  post?: { ok: boolean; status?: number; body?: unknown };
}) {
  return vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (method === 'GET') {
      if (handlers.count === null || handlers.count === undefined) {
        return { ok: false, status: 500, json: async () => ({}) } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, count: handlers.count }),
      } as Response;
    }
    const post = handlers.post ?? { ok: true, body: { ok: true, position: 42 } };
    return {
      ok: post.ok,
      status: post.status ?? (post.ok ? 200 : 500),
      json: async () => post.body ?? {},
    } as Response;
  });
}

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('WaitlistLanding — Rendering', () => {
  it('rendert Überschrift, Formular und Absende-Button', async () => {
    vi.stubGlobal('fetch', mockFetch({ count: null }));
    renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: /Sichern Sie sich Ihren Platz/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Geschäftliche E-Mail/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Auf die Warteliste/i }).length).toBeGreaterThan(0);
  });

  it('verlinkt die ohne Warteliste nutzbaren Einstiege', () => {
    vi.stubGlobal('fetch', mockFetch({ count: null }));
    renderPage();

    const scan = screen.getByRole('link', { name: /Website kostenlos scannen/i });
    expect(scan).toHaveAttribute('href', expect.stringContaining('/audit'));
    expect(screen.getByRole('link', { name: /Kostenlose Tools ansehen/i }))
      .toHaveAttribute('href', '/tools');
  });
});

describe('WaitlistLanding — Anmeldezähler', () => {
  it('zeigt die reale Anzahl aus der Edge Function', async () => {
    vi.stubGlobal('fetch', mockFetch({ count: 137 }));
    renderPage();

    expect(await screen.findByText(/137 Anmeldungen bisher/i)).toBeInTheDocument();
  });

  it('bleibt unsichtbar, wenn das Backend nicht antwortet — keine geratene Zahl', async () => {
    vi.stubGlobal('fetch', mockFetch({ count: null }));
    renderPage();

    await waitFor(() => {
      expect(screen.queryByText(/Anmeldungen bisher/i)).not.toBeInTheDocument();
    });
  });

  it('blendet den Zähler bei 0 Anmeldungen aus', async () => {
    vi.stubGlobal('fetch', mockFetch({ count: 0 }));
    renderPage();

    await waitFor(() => {
      expect(screen.queryByText(/Anmeldung(en)? bisher/i)).not.toBeInTheDocument();
    });
  });
});

describe('WaitlistForm — Absenden', () => {
  it('sendet an die Edge Function und zeigt die zurückgegebene Position', async () => {
    const fetchMock = mockFetch({ count: null, post: { ok: true, body: { ok: true, position: 42 } } });
    vi.stubGlobal('fetch', fetchMock);
    renderPage();

    await submitEmail('test@firma.de');

    expect(await screen.findByText(/Sie sind auf der Warteliste/i)).toBeInTheDocument();
    expect(screen.getByText('#42')).toBeInTheDocument();

    const postCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === 'POST');
    expect(postCall).toBeDefined();
    // Der Client spricht die Edge Function an, nie /rest/v1/waitlist_signups.
    expect(String(postCall![0])).toContain('/functions/v1/waitlist-join');
    const sent = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(sent.email).toBe('test@firma.de');
    expect(sent.source).toBe('warteliste-hero');
  });

  it('meldet vorhandene Anmeldungen als solche statt als Fehler', async () => {
    vi.stubGlobal('fetch', mockFetch({
      count: null,
      post: { ok: true, body: { ok: true, position: 7, already_registered: true } },
    }));
    renderPage();

    await submitEmail('doppelt@firma.de');

    expect(await screen.findByText(/Sie stehen bereits auf der Liste/i)).toBeInTheDocument();
    expect(screen.getByText('#7')).toBeInTheDocument();
  });

  it('zeigt die Fehlermeldung des Backends, statt Erfolg vorzutäuschen', async () => {
    vi.stubGlobal('fetch', mockFetch({
      count: null,
      post: {
        ok: false,
        status: 429,
        body: { ok: false, error: { code: 'RATE_LIMITED', message: 'Zu viele Anmeldungen. Bitte später erneut versuchen.' } },
      },
    }));
    renderPage();

    await submitEmail('limit@firma.de');

    expect(await screen.findByText(/Zu viele Anmeldungen/i)).toBeInTheDocument();
    expect(screen.queryByText(/Sie sind auf der Warteliste/i)).not.toBeInTheDocument();
  });

  it('übernimmt utm-Parameter aus der URL in die Anmeldung', async () => {
    const fetchMock = mockFetch({ count: null });
    vi.stubGlobal('fetch', fetchMock);
    renderPage('/warteliste?utm_source=linkedin&utm_campaign=launch');

    await submitEmail('utm@firma.de');

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === 'POST');
      expect(postCall).toBeDefined();
      const sent = JSON.parse((postCall![1] as RequestInit).body as string);
      expect(sent.utm).toEqual({ utm_source: 'linkedin', utm_campaign: 'launch' });
    });
  });
});
