import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

/**
 * Sichert die freigegebene Korrektur des Produktflusses ab.
 *
 * Vorher führte der Scan unmittelbar in die Gestaltungsauswahl — wer nur
 * Governance wollte, hatte keinen Ausgang. Seit der Freigabe landet er auf
 * der Weiche. Ohne diesen Test fiele die Änderung beim nächsten Refactor
 * still um, und der Trichter wäre wieder ein reiner Umbau-Trichter.
 */
const postEdgeFunction = vi.fn();
vi.mock('../../src/lib/edgeFunction', () => ({
  postEdgeFunction: (...args: unknown[]) => postEdgeFunction(...args),
}));

const { ScanEntryPage } = await import('../../src/unified-entry/pages/ScanEntryPage');

function renderFunnel() {
  return render(
    <MemoryRouter initialEntries={['/unified-entry/scan']}>
      <Routes>
        <Route path="/unified-entry/scan" element={<ScanEntryPage />} />
        <Route path="/unified-entry/entscheidung" element={<div>WEICHE</div>} />
        <Route path="/unified-entry/preview" element={<div>GESTALTUNGSAUSWAHL</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  postEdgeFunction.mockReset();
  postEdgeFunction.mockResolvedValue({
    ok: true,
    url: 'https://example.de',
    domain: 'example.de',
    score: 62,
    severity: 'medium',
    trackers: [{ id: 'ga', name: 'Google Analytics', category: 'analytics' }],
    cookies: [{}, {}],
    consent_manager_detected: false,
  });
});

describe('Einstiegsseite des Trichters', () => {
  it('fragt nach der Automation statt nach einem Website-Neubau', () => {
    renderFunnel();
    expect(
      screen.getByRole('heading', { name: /Was soll RealSync für Ihre Website automatisieren\?/ }),
    ).toBeInTheDocument();
  });

  it('führt nach dem Scan auf die Weiche, nicht in die Gestaltungsauswahl', async () => {
    renderFunnel();

    fireEvent.change(screen.getByLabelText('Website-URL'), { target: { value: 'example.de' } });
    fireEvent.click(screen.getByRole('button', { name: 'Website scannen' }));

    await waitFor(() => expect(screen.getByText('WEICHE')).toBeInTheDocument());
    expect(screen.queryByText('GESTALTUNGSAUSWAHL')).not.toBeInTheDocument();
  });

  it('ergänzt fehlendes Schema, bevor der Scan losgeht', async () => {
    renderFunnel();

    fireEvent.change(screen.getByLabelText('Website-URL'), { target: { value: 'example.de' } });
    fireEvent.click(screen.getByRole('button', { name: 'Website scannen' }));

    await waitFor(() => expect(postEdgeFunction).toHaveBeenCalled());
    expect(postEdgeFunction).toHaveBeenCalledWith(
      'cookie-scan',
      { url: 'https://example.de' },
      { requireAuth: false },
    );
  });

  it('scannt ohne Domain nicht und bleibt auf der Seite', async () => {
    renderFunnel();

    fireEvent.click(screen.getByRole('button', { name: 'Website scannen' }));

    expect(await screen.findByText('Bitte geben Sie eine Domain ein')).toBeInTheDocument();
    expect(postEdgeFunction).not.toHaveBeenCalled();
    expect(screen.queryByText('WEICHE')).not.toBeInTheDocument();
  });
});
