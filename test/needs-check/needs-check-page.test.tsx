/**
 * /check und /check/ergebnisse — Ablauf mit simuliertem Auth-Kontext und
 * simulierter API. Kein echtes Backend (Datenbank: needs-check-results.db.test.ts).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const auth = vi.hoisted(() => ({ value: { user: null as null | { id: string; email: string }, isLoading: false } }));
const configured = vi.hoisted(() => ({ value: true }));
const apiMock = vi.hoisted(() => ({
  saveCheck: vi.fn(),
  getCheck: vi.fn(),
  listChecks: vi.fn(),
  deleteCheck: vi.fn(),
}));

vi.mock('../../src/features/supabase/SupabaseAuthContext', () => ({
  useSupabaseAuth: () => auth.value,
}));
vi.mock('../../src/lib/supabase', () => ({
  isSupabaseConfigured: () => configured.value,
  getSupabase: () => { throw new Error('nicht im Test'); },
}));
vi.mock('../../src/features/needs-check/api', async (orig) => {
  const actual = await orig<typeof import('../../src/features/needs-check/api')>();
  return { ...actual, ...apiMock };
});

import { NeedsCheckPage } from '../../src/pages/NeedsCheckPage';
import { NeedsCheckSavedPage } from '../../src/pages/NeedsCheckSavedPage';
import { readPending, writePending } from '../../src/features/needs-check/pending';

const USER = { id: 'u1', email: 'a@b.de' };

function Where() {
  const loc = useLocation();
  return <p data-testid="where">{loc.pathname + loc.search}</p>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/check" element={<><NeedsCheckPage /><Where /></>} />
        <Route path="/check/ergebnisse" element={<><NeedsCheckSavedPage /><Where /></>} />
        <Route path="/check/ergebnisse/:id" element={<NeedsCheckSavedPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

function answerAll(opts: { goal: string; area: string; site: 'Ja' | 'Nein'; url?: string }) {
  fireEvent.click(screen.getByLabelText(opts.goal));
  fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
  fireEvent.click(screen.getByLabelText(opts.area));
  fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
  fireEvent.click(screen.getByLabelText(opts.site));
  if (opts.url !== undefined) fireEvent.change(screen.getByRole('textbox'), { target: { value: opts.url } });
  fireEvent.click(screen.getByRole('button', { name: 'Ergebnis anzeigen' }));
}

function saved(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    createdAt: '2026-11-15T10:00:00Z',
    modelVersion: 1,
    answers: { goal: 'inquiries', area: 'praxis', hasWebsite: false, websiteUrl: null },
    recommendationIds: ['automate.chat', 'build.new_site', 'govern.runtime'],
    ...overrides,
  };
}

beforeEach(() => {
  sessionStorage.clear();
  auth.value = { user: null, isLoading: false };
  configured.value = true;
  Object.values(apiMock).forEach((m) => m.mockReset());
});

describe('/check — Ablauf', () => {
  it('Weiter ist gesperrt, bis eine Antwort gewählt ist', () => {
    renderAt('/check');
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeDisabled();
    expect(screen.getByText(/Ihre Website wird dabei nicht abgerufen/)).toBeInTheDocument();
  });

  it('Ergebnis aus den Angaben, gekennzeichnet; keine technische Prüfung im Check', () => {
    renderAt('/check');
    answerAll({ goal: 'Eine neue oder bessere Website', area: 'Handwerk', site: 'Nein' });
    expect(screen.getByRole('heading', { level: 1, name: 'Das passt zu Ihrem Betrieb' })).toBeInTheDocument();
    expect(screen.getByTestId('nc-basis')).toHaveTextContent(/^Grundlage: Ihre Angaben$/);
    expect(screen.getByRole('link', { name: 'Entwurf erzeugen' }).getAttribute('href')).toMatch(/^\/build\?prompt=/);
    expect(screen.queryByRole('button', { name: /prüfen/i })).toBeNull();
    expect(screen.queryByTestId('nc-audit-hint')).toBeNull();
  });

  it('mit Website: eindeutiger Verweis auf /audit statt eingebauter Prüfung', () => {
    renderAt('/check');
    answerAll({ goal: 'Eine neue oder bessere Website', area: 'Handel', site: 'Ja', url: 'beispiel.de' });
    const hint = screen.getByTestId('nc-audit-hint');
    expect(hint).toHaveTextContent(/enthält keine technische Prüfung/);
    expect(screen.getByRole('link', { name: 'Zum kostenlosen Scan →' })).toHaveAttribute('href', '/audit?source=needs-check');
    expect(screen.getByTestId('nc-basis')).not.toHaveTextContent(/technische Prüfung/);
  });

  it('Verfügbarkeit nur als heutiger Stand aus der Registry', () => {
    renderAt('/check');
    answerAll({ goal: 'Kundenanfragen schneller beantworten', area: 'Praxis', site: 'Nein' });
    expect(screen.getByTestId('nc-status-automate.chat')).toHaveTextContent('Aktueller Stand: Vorschau');
  });

  it('ungültige Adresse wird abgelehnt, Ergebnis erscheint nicht', () => {
    renderAt('/check');
    answerAll({ goal: 'Kundenanfragen schneller beantworten', area: 'Praxis', site: 'Ja', url: 'kein text' });
    expect(screen.getByRole('alert')).toHaveTextContent(/gültige Adresse/);
    expect(screen.queryByText('Das passt zu Ihrem Betrieb')).toBeNull();
  });

  it('fehlende Verbindung: Speichern gesperrt und ehrlich beschriftet', () => {
    configured.value = false;
    renderAt('/check');
    answerAll({ goal: 'Eine neue oder bessere Website', area: 'Handel', site: 'Nein' });
    expect(screen.getByRole('button', { name: 'Anmelden und speichern' })).toBeDisabled();
    expect(screen.getByText(/nicht verfügbar/)).toBeInTheDocument();
  });
});

describe('/check — Speichern und Anmeldung', () => {
  it('ohne Anmeldung: nur Angaben werden gemerkt, Weiterleitung mit Rücksprung', () => {
    renderAt('/check');
    answerAll({ goal: 'Regeln und Nachweise für KI und Website', area: 'Kanzlei', site: 'Nein' });
    fireEvent.click(screen.getByRole('button', { name: 'Anmelden und speichern' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/welcome?next=%2Fcheck%3Fresume%3D1');
    expect(readPending()).toEqual({ wantsSave: true, answers: { goal: 'rules', area: 'kanzlei', hasWebsite: false, websiteUrl: null } });
    expect(apiMock.saveCheck).not.toHaveBeenCalled();
  });

  it('nach der Anmeldung: wiederhergestellt und gespeichert; „Gespeichert“ erst nach Bestätigung', async () => {
    writePending({ answers: { goal: 'rules', area: 'kanzlei', hasWebsite: false, websiteUrl: null }, wantsSave: true });
    let resolveSave: (v: unknown) => void = () => {};
    apiMock.saveCheck.mockReturnValue(new Promise((r) => { resolveSave = r; }));
    auth.value = { user: USER, isLoading: false };
    renderAt('/check?resume=1');
    expect(await screen.findByText('Das passt zu Ihrem Betrieb')).toBeInTheDocument();
    expect(apiMock.saveCheck).toHaveBeenCalledWith({ goal: 'rules', area: 'kanzlei', hasWebsite: false, websiteUrl: null });
    expect(screen.getByRole('button', { name: 'Wird gespeichert …' })).toBeDisabled();
    expect(screen.queryByTestId('nc-saved')).toBeNull();
    resolveSave({ ok: true, data: saved({ id: 'res-1' }) });
    expect(await screen.findByTestId('nc-saved')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ergebnis öffnen' })).toHaveAttribute('href', '/check/ergebnisse/res-1');
    expect(readPending()).toBeNull();
  });

  it('Kontingent erreicht: verständliche Meldung, kein „Gespeichert“', async () => {
    apiMock.saveCheck.mockResolvedValue({ ok: false, error: { kind: 'rate_limited' } });
    auth.value = { user: USER, isLoading: false };
    renderAt('/check');
    answerAll({ goal: 'Eine neue oder bessere Website', area: 'Handwerk', site: 'Nein' });
    fireEvent.click(screen.getByRole('button', { name: 'Ergebnis speichern' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/20 Ergebnisse gespeichert/);
    expect(screen.queryByTestId('nc-saved')).toBeNull();
  });
});

describe('/check/ergebnisse — erneut öffnen', () => {
  it('ohne Anmeldung: Hinweis und Anmeldelink mit Rücksprung', () => {
    renderAt('/check/ergebnisse/11111111-1111-1111-1111-111111111111');
    expect(screen.getByRole('link', { name: 'Anmelden' })).toHaveAttribute('href', '/welcome?next=%2Fcheck%2Fergebnisse%2F11111111-1111-1111-1111-111111111111');
    expect(apiMock.getCheck).not.toHaveBeenCalled();
  });

  it('zeigt die gespeicherten Empfehlungen des Servers mit Versionshinweis', async () => {
    auth.value = { user: USER, isLoading: false };
    // Absichtlich andere Reihenfolge als die heutige Logik: angezeigt wird, was gespeichert ist.
    apiMock.getCheck.mockResolvedValue({ ok: true, data: saved({ recommendationIds: ['govern.runtime', 'automate.chat'] }) });
    renderAt('/check/ergebnisse/11111111-1111-1111-1111-111111111111');
    expect(await screen.findByText('Gespeichertes Ergebnis')).toBeInTheDocument();
    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual(['Regeln, Freigaben und Nachweise', 'Chat-Assistent für Kundenanfragen']);
    expect(screen.getByTestId('nc-version-note')).toHaveTextContent(/Modellversion 1/);
    expect(screen.getByTestId('nc-version-note')).toHaveTextContent(/heutigen Stand/);
  });

  it('fremdes Ergebnis: abgewiesen, nichts angezeigt', async () => {
    auth.value = { user: USER, isLoading: false };
    apiMock.getCheck.mockResolvedValue({ ok: false, error: { kind: 'not_found' } });
    renderAt('/check/ergebnisse/22222222-2222-2222-2222-222222222222');
    expect(await screen.findByTestId('nc-saved-error')).toHaveTextContent(/anderen Konto/);
    expect(screen.queryByText('Gespeichertes Ergebnis')).toBeNull();
  });

  it('Löschen führt zur Liste zurück und erklärt das Kontingent', async () => {
    auth.value = { user: USER, isLoading: false };
    apiMock.getCheck.mockResolvedValue({ ok: true, data: saved() });
    apiMock.deleteCheck.mockResolvedValue({ ok: true, data: null });
    apiMock.listChecks.mockResolvedValue({ ok: true, data: [] });
    renderAt('/check/ergebnisse/11111111-1111-1111-1111-111111111111');
    expect(await screen.findByText(/zählt weiter zu Ihren höchstens 20 Speicherungen/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ergebnis löschen' }));
    expect(await screen.findByTestId('nc-empty')).toBeInTheDocument();
    expect(apiMock.deleteCheck).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111');
  });

  it('leere Liste und Ladefehler', async () => {
    auth.value = { user: USER, isLoading: false };
    apiMock.listChecks.mockResolvedValueOnce({ ok: true, data: [] });
    const { unmount } = renderAt('/check/ergebnisse');
    expect(await screen.findByTestId('nc-empty')).toBeInTheDocument();
    unmount();
    apiMock.listChecks.mockResolvedValueOnce({ ok: false, error: { kind: 'failed', message: 'Netzwerk' } });
    renderAt('/check/ergebnisse');
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Netzwerk/));
  });
});
