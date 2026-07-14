/**
 * Smoke-/Verhaltens-Tests für die Flow-Zielseiten.
 *
 * Rendert die dynamische Route `/flow/*` über einen MemoryRouter und prüft,
 * dass die richtigen Erklärseiten erscheinen, der Zustand in LocalStorage
 * persistiert wird und unbekannte Slugs eine Rückweg-Seite (keine Sackgasse)
 * liefern.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { FlowProvider } from '../../src/flow/FlowContext';
import { FlowStepRoute } from '../../src/flow/FlowStepRoute';
import { FLOW_STEP_LIST } from '../../src/flow/flowRoutes';

function renderFlowAt(path: string) {
  return render(
    <FlowProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/flow" element={<Navigate to="/flow/start-scan" replace />} />
          <Route path="/flow/*" element={<FlowStepRoute />} />
          <Route path="*" element={<div>fallback</div>} />
        </Routes>
      </MemoryRouter>
    </FlowProvider>,
  );
}

describe('FlowStepRoute — Rendering', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('rendert die Scan-Erklärseite mit Titel und Erklärung', () => {
    renderFlowAt('/flow/start-scan');
    expect(screen.getByRole('heading', { name: /Compliance-Scan starten/i })).toBeInTheDocument();
    expect(screen.getByText(/Was passiert hier\?/i)).toBeInTheDocument();
    // Weiter + Zurück müssen sichtbar sein.
    expect(screen.getByText(/Weiter: Domain eingeben/i)).toBeInTheDocument();
    expect(screen.getByText(/Zurück zur Startseite/i)).toBeInTheDocument();
  });

  it('rendert verschachtelte Checkout-Slugs (checkout/starter)', () => {
    renderFlowAt('/flow/checkout/starter');
    expect(screen.getByRole('heading', { name: /Paket .Starter/i })).toBeInTheDocument();
    expect(screen.getByText(/Checkout starten \(Starter\)/i)).toBeInTheDocument();
  });

  it('zeigt für unbekannte Slugs eine Rückweg-Seite (keine Sackgasse)', () => {
    renderFlowAt('/flow/gibtsnicht');
    expect(screen.getByRole('heading', { name: /Dieser Schritt existiert nicht/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ablauf starten/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Zur Startseite/i })).toBeInTheDocument();
  });

  it('jede definierte Flow-Seite rendert ohne Fehler', () => {
    for (const step of FLOW_STEP_LIST) {
      const { unmount } = renderFlowAt(`/flow/${step.slug}`);
      expect(screen.getByRole('heading', { name: new RegExp(step.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') })).toBeInTheDocument();
      unmount();
    }
  });
});

describe('FlowStepRoute — Kontext-Persistenz', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('speichert den stateEffect eines Schritts in LocalStorage', () => {
    renderFlowAt('/flow/checkout/starter');
    const raw = window.localStorage.getItem('rsd.flow.state.v1');
    expect(raw).toBeTruthy();
    const state = JSON.parse(raw as string);
    expect(state.selectedPlan).toBe('starter');
    expect(state.checkoutStatus).toBe('started');
    expect(state.lastStepId).toBe('pricing.checkoutStarter');
  });

  it('vermerkt besuchte Schritte im Verlauf', () => {
    renderFlowAt('/flow/report');
    const state = JSON.parse(window.localStorage.getItem('rsd.flow.state.v1') as string);
    expect(state.scanCompleted).toBe(true);
    expect(state.visited).toContain('scan.finished');
  });
});
