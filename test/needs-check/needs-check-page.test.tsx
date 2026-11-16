/**
 * /check — Ablauf mit simuliertem Auth-Kontext und simulierter API.
 * Kein echtes Backend (siehe needs-check-rls.db.test.ts für die Datenbank).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const auth = vi.hoisted(() => ({ value: { user: null as null | { id: string; email: string }, isLoading: false } }));
const configured = vi.hoisted(() => ({ value: true }));
const apiMock = vi.hoisted(() => ({
  saveCheck: vi.fn(),
  runWebsiteScan: vi.fn(),
  getCheck: vi.fn(),
  listChecks: vi.fn(),
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

function Where() {
  const loc = useLocation();
  return <p data-testid="where">{loc.pathname + loc.search}</p>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/check" element={<><NeedsCheckPage /><Where /></>} />
        <Route path="/check/ergebnisse" element={<NeedsCheckSavedPage />} />
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

  it('Startseite → Check → Ergebnis: Empfehlungen aus den Angaben, klar gekennzeichnet', () => {
    renderAt('/check');
    answerAll({ goal: 'Eine neue oder bessere Website', area: 'Handwerk', site: 'Nein' });
    expect(screen.getByRole('heading', { level: 1, name: 'Das passt zu Ihrem Betrieb' })).toBeInTheDocument();
    expect(screen.getByTestId('nc-basis')).toHaveTextContent('Grundlage: Ihre Angaben');
    expect(screen.getByTestId('nc-basis')).not.toHaveTextContent('technische Prüfung');
    const first = screen.getByRole('link', { name: 'Entwurf erzeugen' });
    expect(first.getAttribute('href')).toMatch(/^\/build\?prompt=/);
    // Ohne Adresse wird keine technische Prüfung angeboten.
    expect(screen.queryByRole('button', { name: 'Jetzt prüfen' })).toBeNull();
    expect(apiMock.runWebsiteScan).not.toHaveBeenCalled();
  });

  it('ungültige Adresse wird abgelehnt, Ergebnis erscheint nicht', () => {
    renderAt('/check');
    answerAll({ goal: 'Kundenanfragen schneller beantworten', area: 'Praxis', site: 'Ja', url: 'kein text' });
    expect(screen.getByRole('alert')).toHaveTextContent(/gültige Adresse/);
    expect(screen.queryByText('Das passt zu Ihrem Betrieb')).toBeNull();
  });

  it('technische Prüfung nur auf Wunsch; danach wechselt die Kennzeichnung', async () => {
    apiMock.runWebsiteScan.mockResolvedValue({ ok: true, data: { auditId: 'a1', domain: 'beispiel.de', score: 70, issues: [{ title: 'Kein Impressum-Link gefunden', severity: 'Kritisch', ref: '§ 5 DDG' }], coverageNotice: null } });
    renderAt('/check');
    answerAll({ goal: 'Eine neue oder bessere Website', area: 'Handel', site: 'Ja', url: 'beispiel.de' });
    expect(apiMock.runWebsiteScan).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Jetzt prüfen' }));
    expect(apiMock.runWebsiteScan).toHaveBeenCalledWith('https://beispiel.de');
    await screen.findByTestId('nc-scan-result');
    expect(screen.getByTestId('nc-basis')).toHaveTextContent('Ihre Angaben + technische Prüfung');
    expect(screen.getByRole('link', { name: /Vollständigen Bericht/ })).toHaveAttribute('href', '/audit/result/a1');
  });

  it('Backend-Ausfall beim Scan: Fehlermeldung, kein erfundenes Ergebnis', async () => {
    apiMock.runWebsiteScan.mockResolvedValue({ ok: false, error: { kind: 'failed', message: 'Die Prüfung ist gerade nicht erreichbar.' } });
    renderAt('/check');
    answerAll({ goal: 'Eine neue oder bessere Website', area: 'Handel', site: 'Ja', url: 'beispiel.de' });
    fireEvent.click(screen.getByRole('button', { name: 'Jetzt prüfen' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/nicht erreichbar/);
    expect(screen.queryByTestId('nc-scan-result')).toBeNull();
    expect(screen.getByTestId('nc-basis')).toHaveTextContent(/^Grundlage: Ihre Angaben$/);
  });

  it('fehlende Verbindung: Speichern und Prüfen sind gesperrt und ehrlich beschriftet', () => {
    configured.value = false;
    renderAt('/check');
    answerAll({ goal: 'Eine neue oder bessere Website', area: 'Handel', site: 'Ja', url: 'beispiel.de' });
    expect(screen.getByRole('button', { name: 'Jetzt prüfen' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Anmelden und speichern' })).toBeDisabled();
    expect(screen.getAllByText(/nicht verfügbar/).length).toBeGreaterThan(0);
  });
});

describe('/check — Speichern und Anmeldung', () => {
  it('ohne Anmeldung: Angaben werden gemerkt, Weiterleitung zur Anmeldung mit Rücksprung', () => {
    renderAt('/check');
    answerAll({ goal: 'Regeln und Nachweise für KI und Website', area: 'Kanzlei', site: 'Nein' });
    fireEvent.click(screen.getByRole('button', { name: 'Anmelden und speichern' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/welcome?next=%2Fcheck%3Fresume%3D1');
    expect(readPending()).toMatchObject({ wantsSave: true, answers: { goal: 'rules', area: 'kanzlei', hasWebsite: false } });
    expect(apiMock.saveCheck).not.toHaveBeenCalled();
  });

  it('nach der Anmeldung: Ablauf wird wiederhergestellt und gespeichert; „Gespeichert“ erst nach Bestätigung', async () => {
    writePending({ answers: { goal: 'rules', area: 'kanzlei', hasWebsite: false, websiteUrl: null }, auditId: null, wantsSave: true });
    let resolveSave: (v: unknown) => void = () => {};
    apiMock.saveCheck.mockReturnValue(new Promise((r) => { resolveSave = r; }));
    auth.value = { user: { id: 'u1', email: 'a@b.de' }, isLoading: false };
    renderAt('/check?resume=1');
    expect(await screen.findByText('Das passt zu Ihrem Betrieb')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wird gespeichert …' })).toBeDisabled();
    expect(screen.queryByTestId('nc-saved')).toBeNull();
    resolveSave({ ok: true, data: { id: 'res-1' } });
    expect(await screen.findByTestId('nc-saved')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ergebnis öffnen' })).toHaveAttribute('href', '/check/ergebnisse/res-1');
    expect(readPending()).toBeNull();
  });

  it('Speicherfehler wird angezeigt, kein „Gespeichert“', async () => {
    apiMock.saveCheck.mockResolvedValue({ ok: false, error: { kind: 'rate_limited' } });
    auth.value = { user: { id: 'u1', email: 'a@b.de' }, isLoading: false };
    renderAt('/check');
    answerAll({ goal: 'Eine neue oder bessere Website', area: 'Handwerk', site: 'Nein' });
    fireEvent.click(screen.getByRole('button', { name: 'Ergebnis speichern' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Zu viele Anfragen/);
    expect(screen.queryByTestId('nc-saved')).toBeNull();
  });
});

describe('/check/ergebnisse — erneut öffnen', () => {
  it('ohne Anmeldung: Hinweis und Anmeldelink mit Rücksprung', () => {
    renderAt('/check/ergebnisse/11111111-1111-1111-1111-111111111111');
    expect(screen.getByRole('link', { name: 'Anmelden' })).toHaveAttribute('href', '/welcome?next=%2Fcheck%2Fergebnisse%2F11111111-1111-1111-1111-111111111111');
    expect(apiMock.getCheck).not.toHaveBeenCalled();
  });

  it('eigenes Ergebnis wird angezeigt', async () => {
    auth.value = { user: { id: 'u1', email: 'a@b.de' }, isLoading: false };
    apiMock.getCheck.mockResolvedValue({ ok: true, data: { id: 'x', createdAt: '2026-11-15T10:00:00Z', answers: { goal: 'inquiries', area: 'praxis', hasWebsite: false, websiteUrl: null }, recommendationIds: ['automate.chat'], auditId: null, basis: 'answers' } });
    renderAt('/check/ergebnisse/x');
    expect(await screen.findByText('Gespeichertes Ergebnis')).toBeInTheDocument();
    expect(screen.getByText('Chat-Assistent für Kundenanfragen')).toBeInTheDocument();
  });

  it('fremdes Ergebnis: abgewiesen, nichts angezeigt', async () => {
    auth.value = { user: { id: 'u1', email: 'a@b.de' }, isLoading: false };
    apiMock.getCheck.mockResolvedValue({ ok: false, error: { kind: 'not_found' } });
    renderAt('/check/ergebnisse/22222222-2222-2222-2222-222222222222');
    expect(await screen.findByTestId('nc-saved-error')).toHaveTextContent(/anderen Konto/);
    expect(screen.queryByText('Gespeichertes Ergebnis')).toBeNull();
  });

  it('leere Liste zeigt einen Leerzustand', async () => {
    auth.value = { user: { id: 'u1', email: 'a@b.de' }, isLoading: false };
    apiMock.listChecks.mockResolvedValue({ ok: true, data: [] });
    renderAt('/check/ergebnisse');
    expect(await screen.findByTestId('nc-empty')).toBeInTheDocument();
  });

  it('Ladefehler der Liste wird angezeigt', async () => {
    auth.value = { user: { id: 'u1', email: 'a@b.de' }, isLoading: false };
    apiMock.listChecks.mockResolvedValue({ ok: false, error: { kind: 'failed', message: 'Netzwerk' } });
    renderAt('/check/ergebnisse');
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Netzwerk/));
  });
});
